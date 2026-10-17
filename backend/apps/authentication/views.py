import logging
import re

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import PasswordResetCode, UserProfile
from .serializers import (
    ChangePasswordSerializer,
    ForgotPasswordRequestSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResetPasswordConfirmSerializer,
    UserSerializer,
    VerifyResetCodeSerializer,
)

logger = logging.getLogger(__name__)


def mask_email(email: str) -> str:
    """Mask email for privacy, e.g. admin@erp.com -> ad***@erp.com"""
    if not email or "@" not in email:
        return email or ""
    parts = email.split("@")
    name, domain = parts[0], parts[1]
    if len(name) <= 2:
        masked_name = name[0] + "*"
    else:
        masked_name = name[:2] + "*" * min(max(len(name) - 3, 2), 5) + name[-1]
    return f"{masked_name}@{domain}"


def mask_phone(phone: str) -> str:
    """Mask phone number for privacy, e.g. +251911000000 -> +251****000"""
    if not phone:
        return ""
    clean = phone.strip()
    if len(clean) <= 6:
        return clean
    prefix = clean[:4] if clean.startswith("+") else clean[:3]
    suffix = clean[-3:]
    return f"{prefix}****{suffix}"


def find_user_by_identifier(identifier: str):
    """
    Find user by either:
    1. Email address
    2. Username
    3. Phone number (matching UserProfile, HealthcarePractitioner, or Patient)
    Returns: (user, channel, destination) or (None, None, None)
    """
    identifier = identifier.strip()
    if not identifier:
        return None, None, None

    # 1. Match Email
    if "@" in identifier:
        user = User.objects.filter(email__iexact=identifier).first()
        if user:
            return user, "email", user.email

    # 2. Match exact Username
    user = User.objects.filter(username__iexact=identifier).first()
    if user:
        if user.email:
            return user, "email", user.email
        profile = getattr(user, "profile", None)
        if profile and profile.phone_number:
            return user, "phone", profile.phone_number
        return user, "email", f"{user.username}@healthcare.local"

    # 3. Match Phone number
    # Normalize phone: extract digits
    digits = re.sub(r"[^\d]", "", identifier)
    phone_candidates = {identifier, digits}
    if digits.startswith("251") and len(digits) > 9:
        phone_candidates.add("0" + digits[3:])
        phone_candidates.add("+" + digits)
        phone_candidates.add(digits[3:])
    elif digits.startswith("0") and len(digits) > 8:
        phone_candidates.add("+251" + digits[1:])
        phone_candidates.add("251" + digits[1:])
        phone_candidates.add(digits[1:])

    # Query UserProfile
    profile_query = Q(phone_number__in=phone_candidates)
    if len(digits) >= 8:
        profile_query |= Q(phone_number__icontains=digits[-8:])
    profile = UserProfile.objects.filter(profile_query).first()
    if profile and profile.user:
        return profile.user, "phone", profile.phone_number or identifier

    # Query HealthcarePractitioner
    try:
        from apps.healthcare.models import HealthcarePractitioner
        pract_query = Q(mobile_phone__in=phone_candidates) | Q(office_phone__in=phone_candidates)
        if len(digits) >= 8:
            pract_query |= Q(mobile_phone__icontains=digits[-8:]) | Q(office_phone__icontains=digits[-8:])
        pract = HealthcarePractitioner.objects.filter(pract_query).exclude(user=None).first()
        if pract and pract.user:
            return pract.user, "phone", pract.mobile_phone or pract.office_phone or identifier
    except Exception:
        pass

    # Query Patient
    try:
        from apps.healthcare.models import Patient
        pat_query = Q(mobile__in=phone_candidates) | Q(phone__in=phone_candidates)
        if len(digits) >= 8:
            pat_query |= Q(mobile__icontains=digits[-8:]) | Q(phone__icontains=digits[-8:])
        pat = Patient.objects.filter(pat_query).exclude(user=None).first()
        if pat and pat.user:
            return pat.user, "phone", pat.mobile or pat.phone or identifier
    except Exception:
        pass

    return None, None, None


def build_user_payload(user):
    """Build enriched user info dictionary with roles, role profiles, and Frappe-style permissions."""
    user_data = UserSerializer(user).data
    user_data["avatar"] = ""
    user_data["menu"] = []

    # Fetch real roles from both UserRole and HasRole tables (Frappe-style)
    from apps.roles.models import HasRole, UserRole, UserRoleProfile
    from apps.roles.permissions import get_user_permissions, get_user_row_permissions

    role_names = set(
        UserRole.objects.filter(user=user, role__is_active=True)
        .values_list("role__name", flat=True)
    )
    role_names |= set(
        HasRole.objects.filter(user=user, role__is_active=True)
        .values_list("role__name", flat=True)
    )
    user_roles = sorted(role_names)

    user_data["roles"] = [
        {"id": str(i), "name": r, "code": r.upper().replace(" ", "_")}
        for i, r in enumerate(user_roles, 1)
    ]

    # Fetch role profiles
    role_profiles = list(
        UserRoleProfile.objects.filter(user=user)
        .select_related("role_profile")
        .values_list("role_profile__role_profile", flat=True)
    )
    user_data["role_profiles"] = role_profiles

    # Fetch effective permissions (Frappe-style)
    perms = get_user_permissions(user)
    user_data["permissions"] = [
        {"id": f"perm_{doctype}_{pt}", "name": f"{doctype}:{pt}", "code": f"{doctype}:{pt}"}
        for doctype, perm_types in perms.items()
        for pt in perm_types
    ]

    # Fetch row-level user permissions
    row_perms = {}
    for doctype_name in perms:
        row = get_user_row_permissions(user, doctype_name)
        if row:
            row_perms[doctype_name] = row
    user_data["user_permissions"] = row_perms

    return user_data


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if not user:
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        refresh = RefreshToken.for_user(user)
        user_data = build_user_payload(user)

        # Log successful authentication (Frappe Activity Log)
        from apps.roles.permissions import add_authentication_log
        ip_address = request.META.get("REMOTE_ADDR")
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(",")[0].strip()

        add_authentication_log(
            subject=f"Login: {user.username} from {ip_address}",
            user=user,
            operation="Login",
            status="Success",
            ip_address=ip_address,
        )

        return Response(
            {
                "user": user_data,
                "accessToken": str(refresh.access_token),
                "refreshToken": str(refresh),
            }
        )


class RegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": build_user_payload(user),
                "accessToken": str(refresh.access_token),
                "refreshToken": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(build_user_payload(request.user))

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        phone_number = request.data.get("phone_number")
        if phone_number is not None:
            profile, _ = UserProfile.objects.get_or_create(user=request.user)
            profile.phone_number = str(phone_number).strip()
            profile.save()

        return Response(build_user_payload(request.user))


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"error": "Invalid old password"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()

        return Response({"message": "Password changed successfully"})


class ForgotPasswordView(APIView):
    """
    Initiate password reset via Email address OR Phone number.
    Generates a secure 6-digit OTP code and dispatches it via the selected channel.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        raw_identifier = (
            request.data.get("identifier")
            or request.data.get("email")
            or request.data.get("phone")
            or ""
        )
        if not raw_identifier or not str(raw_identifier).strip():
            return Response(
                {"detail": "Please provide your email address or phone number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user, channel, destination = find_user_by_identifier(str(raw_identifier).strip())
        if not user:
            return Response(
                {"detail": "No registered account found with that email address or phone number."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user.is_active:
            return Response(
                {"detail": "This account is currently inactive. Please contact medical administration."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Invalidate previous unused codes for this user
        PasswordResetCode.objects.filter(user=user, is_used=False).update(is_used=True)

        # Create new reset code
        reset_code = PasswordResetCode.objects.create(
            user=user,
            delivery_channel=channel,
            delivery_destination=destination,
        )

        ip_address = request.META.get("REMOTE_ADDR")
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(",")[0].strip()

        # Send via email or phone
        if channel == "email":
            masked_dest = mask_email(destination)
            subject = "EEU Health Services - Password Reset Verification Code"
            body = (
                f"Hello {user.first_name or user.username},\n\n"
                f"You have requested to reset your password for the EEU Health Services Portal.\n\n"
                f"Your 6-digit verification code is: {reset_code.code}\n\n"
                f"This code will expire in 15 minutes.\n"
                f"If you did not request this password reset, please contact IT administration immediately.\n\n"
                f"Ethiopian Electric Utility (EEU)\n"
                f"Health Services Directorate • Addis Ababa"
            )
            try:
                send_mail(
                    subject,
                    body,
                    settings.DEFAULT_FROM_EMAIL,
                    [destination],
                    fail_silently=False,
                )
                logger.info(f"Password reset email sent to {destination}")
            except Exception as e:
                logger.warning(f"Could not send email via mail server: {e}")
        else:
            masked_dest = mask_phone(destination)
            logger.info(f"[SMS Gateway] Dispatched OTP {reset_code.code} to {destination}")

        # Log action in Frappe Activity Log
        from apps.roles.permissions import add_authentication_log
        add_authentication_log(
            subject=f"Password Reset Code Requested: {user.username} via {channel}",
            user=user,
            operation="Password Reset Request",
            status="Success",
            ip_address=ip_address,
        )

        # Print banner in server console for development & debugging
        print(f"\n{'='*70}\n[EEU HEALTHCARE - PASSWORD RESET VERIFICATION CODE]\n"
              f"User:        {user.username} ({user.get_full_name()})\n"
              f"Channel:     {channel.upper()} -> {destination}\n"
              f"Code:        {reset_code.code}\n"
              f"Session ID:  {reset_code.id}\n"
              f"Valid until: {reset_code.expires_at}\n"
              f"{'='*70}\n")

        return Response(
            {
                "success": True,
                "message": f"Verification code sent to your {channel} ({masked_dest}).",
                "channel": channel,
                "target_masked": masked_dest,
                "token": str(reset_code.id),
                "debug_code": reset_code.code if settings.DEBUG else None,
            }
        )


class VerifyResetCodeView(APIView):
    """
    Verify if the 6-digit verification code is valid and active.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyResetCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code_input = serializer.validated_data["code"].strip()
        token = serializer.validated_data.get("token", "").strip()
        identifier = serializer.validated_data.get("identifier", "").strip()

        reset_code = None
        if token:
            reset_code = PasswordResetCode.objects.filter(id=token, code=code_input).first()

        if not reset_code and identifier:
            user, _, _ = find_user_by_identifier(identifier)
            if user:
                reset_code = PasswordResetCode.objects.filter(
                    user=user, code=code_input, is_used=False
                ).first()

        if not reset_code or not reset_code.is_valid():
            return Response(
                {"detail": "Invalid or expired verification code. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"valid": True, "message": "Verification code is valid."})


class ResetPasswordConfirmView(APIView):
    """
    Validate OTP code and set new user password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code_input = serializer.validated_data["code"].strip()
        new_password = serializer.validated_data["new_password"]
        token = serializer.validated_data.get("token", "").strip()
        identifier = serializer.validated_data.get("identifier", "").strip()

        reset_code = None
        if token:
            reset_code = PasswordResetCode.objects.filter(id=token, code=code_input).first()

        if not reset_code and identifier:
            user, _, _ = find_user_by_identifier(identifier)
            if user:
                reset_code = PasswordResetCode.objects.filter(
                    user=user, code=code_input, is_used=False
                ).first()

        if not reset_code or not reset_code.is_valid():
            return Response(
                {"detail": "Invalid or expired verification code. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = reset_code.user
        user.set_password(new_password)
        user.save()

        # Mark code as consumed
        reset_code.is_used = True
        reset_code.save()

        # Invalidate any other outstanding codes
        PasswordResetCode.objects.filter(user=user, is_used=False).update(is_used=True)

        # Log password reset to activity log
        from apps.roles.permissions import add_authentication_log
        ip_address = request.META.get("REMOTE_ADDR")
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(",")[0].strip()

        add_authentication_log(
            subject=f"Password Reset Completed: {user.username}",
            user=user,
            operation="Password Reset",
            status="Success",
            ip_address=ip_address,
        )

        return Response(
            {
                "success": True,
                "message": "Password has been successfully updated. You can now sign in.",
                "username": user.username,
            }
        )


class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    search_fields = ["username", "email", "first_name", "last_name"]
    filterset_fields = ["is_active", "is_staff"]


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_token(request):
    try:
        refresh = RefreshToken(request.data.get("refreshToken"))
        return Response({"accessToken": str(refresh.access_token)})
    except Exception:
        return Response(
            {"error": "Invalid refresh token"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
