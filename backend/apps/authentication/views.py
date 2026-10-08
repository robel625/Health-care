from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)


def build_user_payload(user):
    """Build enriched user info dictionary with roles, role profiles, and Frappe-style permissions."""
    user_data = UserSerializer(user).data
    user_data["avatar"] = ""
    user_data["menu"] = []

    # Fetch real roles from both UserRole and HasRole tables (Frappe-style)
    from apps.roles.models import UserRole, HasRole, UserRoleProfile
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
