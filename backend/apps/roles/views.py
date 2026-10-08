"""
Frappe-style views for Role & Permission system.
"""

from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.roles.permissions import (
    IsAdminUser,
    get_user_permissions,
    get_user_row_permissions,
)

from .models import (
    AccessLog,
    ActivityLog,
    APIRequestLog,
    AuditTrail,
    CustomDocPerm,
    DocPerm,
    DocShare,
    DocType,
    HasRole,
    PermissionLog,
    Role,
    RoleProfile,
    RoleProfileRole,
    SecuritySettings,
    SystemSettings,
    UserPermission,
    UserRole,
    UserRoleProfile,
)
from .serializers import (
    AccessLogSerializer,
    ActivityLogSerializer,
    APIRequestLogSerializer,
    AuditTrailSerializer,
    CustomDocPermSerializer,
    DocPermSerializer,
    DocShareSerializer,
    DocTypeSerializer,
    HasRoleSerializer,
    PermissionLogSerializer,
    RoleProfileSerializer,
    RoleProfileRoleSerializer,
    RoleSerializer,
    SecuritySettingsSerializer,
    SystemSettingsSerializer,
    UserPermissionSerializer,
    UserRoleProfileSerializer,
    UserRoleSerializer,
    UserSummarySerializer,
)


# ── Role CRUD ──────────────────────────────────────────────────────
class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    search_fields = ["name", "role_name", "description"]
    filterset_fields = ["is_active", "is_system_role", "disabled", "desk_access", "is_custom"]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.name in ("Administrator", "System Manager", "Guest", "All"):
            return Response(
                {"detail": f"Standard role '{role.name}' cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


# ── DocType CRUD ──────────────────────────────────────────────────
class DocTypeViewSet(viewsets.ModelViewSet):
    queryset = DocType.objects.all()
    serializer_class = DocTypeSerializer
    search_fields = ["name", "module"]
    filterset_fields = ["module", "is_active", "is_submittable"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── DocPerm CRUD ──────────────────────────────────────────────────
class DocPermViewSet(viewsets.ModelViewSet):
    queryset = DocPerm.objects.select_related("doctype_ref", "role").all()
    serializer_class = DocPermSerializer
    search_fields = ["doctype_ref__name", "role__name"]
    filterset_fields = ["doctype_ref", "role", "permlevel"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── CustomDocPerm CRUD ────────────────────────────────────────────
class CustomDocPermViewSet(viewsets.ModelViewSet):
    queryset = CustomDocPerm.objects.select_related("doctype_ref", "role").all()
    serializer_class = CustomDocPermSerializer
    search_fields = ["doctype_ref__name", "role__name"]
    filterset_fields = ["doctype_ref", "role", "permlevel"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── HasRole CRUD ──────────────────────────────────────────────────
class HasRoleViewSet(viewsets.ModelViewSet):
    queryset = HasRole.objects.select_related("user", "role").all()
    serializer_class = HasRoleSerializer
    filterset_fields = ["user", "role"]
    search_fields = ["user__username", "user__email", "role__name"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── UserRole CRUD ─────────────────────────────────────────────────
class UserRoleViewSet(viewsets.ModelViewSet):
    queryset = UserRole.objects.select_related("user", "role").all()
    serializer_class = UserRoleSerializer
    filterset_fields = ["user", "role"]
    search_fields = ["user__username", "user__email", "role__name"]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def create(self, request, *args, **kwargs):
        role_ids = request.data.get("roles") or request.data.get("role_ids")
        user_id = request.data.get("user")
        if role_ids and isinstance(role_ids, list) and user_id:
            user = User.objects.get(id=user_id)
            created_entries = []
            for r_val in role_ids:
                if isinstance(r_val, int):
                    role = Role.objects.get(id=r_val)
                else:
                    role = Role.objects.get(name=r_val)
                ur, _ = UserRole.objects.get_or_create(user=user, role=role)
                HasRole.objects.get_or_create(user=user, role=role)
                created_entries.append(ur)
            serializer = self.get_serializer(created_entries, many=True)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        response = super().create(request, *args, **kwargs)
        if response.status_code == status.HTTP_201_CREATED:
            try:
                ur_obj = UserRole.objects.get(id=response.data.get("id"))
                HasRole.objects.get_or_create(user=ur_obj.user, role=ur_obj.role)
            except Exception:
                pass
        return response

    def perform_destroy(self, instance):
        HasRole.objects.filter(user=instance.user, role=instance.role).delete()
        instance.delete()



# ── RoleProfile CRUD ──────────────────────────────────────────────
class RoleProfileViewSet(viewsets.ModelViewSet):
    queryset = RoleProfile.objects.prefetch_related("roles__role").all()
    serializer_class = RoleProfileSerializer
    search_fields = ["role_profile"]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def perform_create(self, serializer):
        profile = serializer.save()
        # Create role entries from request data
        role_ids = self.request.data.get("role_ids", [])
        for rid in role_ids:
            try:
                role = Role.objects.get(id=rid)
                RoleProfileRole.objects.create(role_profile=profile, role=role)
            except Role.DoesNotExist:
                pass

    def perform_update(self, serializer):
        profile = serializer.save()
        role_ids = self.request.data.get("role_ids", None)
        if role_ids is not None:
            profile.roles.all().delete()
            for rid in role_ids:
                try:
                    role = Role.objects.get(id=rid)
                    RoleProfileRole.objects.create(role_profile=profile, role=role)
                except Role.DoesNotExist:
                    pass


# ── UserRoleProfile CRUD ──────────────────────────────────────────
class UserRoleProfileViewSet(viewsets.ModelViewSet):
    queryset = UserRoleProfile.objects.select_related("user", "role_profile").all()
    serializer_class = UserRoleProfileSerializer
    filterset_fields = ["user", "role_profile"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── UserPermission CRUD ──────────────────────────────────────────
class UserPermissionViewSet(viewsets.ModelViewSet):
    queryset = UserPermission.objects.select_related("user").all()
    serializer_class = UserPermissionSerializer
    filterset_fields = ["user", "allow"]
    search_fields = ["user__username", "allow", "for_value"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── DocShare CRUD ─────────────────────────────────────────────────
class DocShareViewSet(viewsets.ModelViewSet):
    queryset = DocShare.objects.select_related("user").all()
    serializer_class = DocShareSerializer
    filterset_fields = ["share_doctype", "share_name", "user"]
    search_fields = ["share_doctype", "share_name"]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = self.queryset
        share_doctype = self.request.query_params.get("share_doctype") or self.request.query_params.get("doctype")
        share_name = self.request.query_params.get("share_name") or self.request.query_params.get("docname")
        if share_doctype:
            qs = qs.filter(share_doctype=share_doctype)
        if share_name:
            qs = qs.filter(share_name=share_name)
        return qs

    def perform_create(self, serializer):
        owner = self.request.user.username if self.request.user.is_authenticated else ""
        serializer.save(owner=owner)


# ── AccessLog ─────────────────────────────────────────────────────
class AccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AccessLog.objects.select_related("user").all()
    serializer_class = AccessLogSerializer
    filterset_fields = ["user", "export_from", "method"]
    search_fields = ["export_from", "report_name"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── ActivityLog ───────────────────────────────────────────────────
class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.select_related("user").all()
    serializer_class = ActivityLogSerializer
    filterset_fields = ["user", "operation", "status"]
    search_fields = ["subject", "full_name"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── APIRequestLog ─────────────────────────────────────────────────
class APIRequestLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = APIRequestLog.objects.select_related("user").all()
    serializer_class = APIRequestLogSerializer
    filterset_fields = ["user", "method", "status_code"]
    search_fields = ["path"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── PermissionLog ─────────────────────────────────────────────────
class PermissionLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PermissionLog.objects.select_related("changed_by").all()
    serializer_class = PermissionLogSerializer
    filterset_fields = ["changed_by", "for_doctype", "status"]
    search_fields = ["for_doctype", "for_document"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── AuditTrail ────────────────────────────────────────────────────
class AuditTrailViewSet(viewsets.ModelViewSet):
    queryset = AuditTrail.objects.all()
    serializer_class = AuditTrailSerializer
    search_fields = ["doctype_name", "document"]
    permission_classes = [IsAuthenticated, IsAdminUser]


# ── SecuritySettings (singleton) ─────────────────────────────────
class SecuritySettingsViewSet(viewsets.ModelViewSet):
    serializer_class = SecuritySettingsSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return SecuritySettings.objects.filter(pk=1)

    def list(self, request, *args, **kwargs):
        settings_obj, _ = SecuritySettings.objects.get_or_create(pk=1)
        serializer = self.get_serializer(settings_obj)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        settings_obj, _ = SecuritySettings.objects.get_or_create(pk=1)
        serializer = self.get_serializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ── SystemSettings (singleton) ───────────────────────────────────
class SystemSettingsViewSet(viewsets.ModelViewSet):
    serializer_class = SystemSettingsSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return SystemSettings.objects.filter(pk=1)

    def list(self, request, *args, **kwargs):
        settings_obj, _ = SystemSettings.objects.get_or_create(pk=1)
        serializer = self.get_serializer(settings_obj)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        settings_obj, _ = SystemSettings.objects.get_or_create(pk=1)
        serializer = self.get_serializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ── Users list (for permission matrix) ───────────────────────────
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    search_fields = ["username", "email", "first_name", "last_name"]
    filterset_fields = ["is_active", "is_staff"]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_serializer_class(self):
        if self.action in ["retrieve", "create", "update", "partial_update"]:
            from apps.roles.serializers import UserDetailSerializer
            return UserDetailSerializer
        return UserSummarySerializer

    def perform_create(self, serializer):
        password = self.request.data.get("password")
        user = serializer.save()
        if password:
            user.set_password(password)
            user.save()

    def perform_update(self, serializer):
        password = self.request.data.get("password")
        user = serializer.save()
        if password:
            user.set_password(password)
            user.save()

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get("new_password", "admin123")
        user.set_password(new_password)
        user.save()
        return Response({"message": f"Password reset for {user.username}"})

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        return Response({"is_active": user.is_active})

    @action(detail=True, methods=["get", "post"], url_path="roles")
    def user_roles(self, request, pk=None):
        user = self.get_object()
        if request.method == "GET":
            from apps.roles.models import UserRole, HasRole
            role_names = set(
                UserRole.objects.filter(user=user, role__is_active=True)
                .values_list("role__name", flat=True)
            )
            role_names |= set(
                HasRole.objects.filter(user=user, role__is_active=True)
                .values_list("role__name", flat=True)
            )
            return Response(sorted(role_names))
        # POST: set roles
        role_names = request.data.get("roles", [])
        from apps.roles.models import Role, UserRole
        # Remove existing
        UserRole.objects.filter(user=user).delete()
        from apps.roles.models import HasRole
        HasRole.objects.filter(user=user).delete()
        # Add new
        for rname in role_names:
            try:
                role = Role.objects.get(name=rname)
                UserRole.objects.get_or_create(user=user, role=role)
            except Role.DoesNotExist:
                pass
        return Response({"status": "ok", "roles": role_names})


# ── Permission Matrix API ────────────────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdminUser])
def permission_matrix(request):
    """
    Returns a full Frappe-style permission matrix:
    {
        "roles": [
            {
                "id": 1,
                "name": "Administrator",
                "desk_access": true,
                "disabled": false,
                "permissions": {
                    "Customer": {
                        "read": true, "write": true, ...
                    },
                    ...
                }
            },
            ...
        ],
        "doctypes": ["Customer", "Supplier", ...],
        "modules": ["Selling", "Buying", ...],
    }
    """
    roles = Role.objects.filter(is_active=True).order_by("name")
    doctypes = DocType.objects.filter(is_active=True).order_by("name")

    matrix = []
    for role in roles:
        # Standard DocPerms
        doc_perms = DocPerm.objects.filter(
            role=role
        ).select_related("doctype_ref")

        perm_map = {}
        for dp in doc_perms:
            dt_name = dp.doctype_ref.name
            perm_map.setdefault(dt_name, {})
            for flag in dp.get_active_permissions():
                perm_map[dt_name][flag] = True
            if dp.if_owner:
                perm_map[dt_name]["if_owner"] = True

        # Custom DocPerms (override)
        custom_perms = CustomDocPerm.objects.filter(
            role=role
        ).select_related("doctype_ref")

        for cp in custom_perms:
            dt_name = cp.doctype_ref.name
            active_flags = []
            for flag_name in [
                "select", "read", "write", "create", "delete",
                "submit", "cancel", "amend", "report", "export",
                "print", "email", "share", "mask",
            ]:
                if getattr(cp, flag_name, False):
                    active_flags.append(flag_name)
            if getattr(cp, "perm_import", False):
                active_flags.append("import")

            perm_map.setdefault(dt_name, {})
            perm_map[dt_name] = {f: True for f in active_flags}
            if cp.if_owner:
                perm_map[dt_name]["if_owner"] = True

        matrix.append({
            "id": role.id,
            "name": role.name,
            "desk_access": role.desk_access,
            "disabled": role.disabled,
            "is_custom": role.is_custom,
            "permissions": perm_map,
        })

    modules = sorted(set(doctypes.values_list("module", flat=True)))

    return Response({
        "roles": matrix,
        "doctypes": [d.name for d in doctypes],
        "modules": [m for m in modules if m],
    })


# ── My Permissions (current user) ───────────────────────────────
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_permissions(request):
    """Return the current user's effective permissions (Frappe-style)."""
    perms = get_user_permissions(request.user)
    roles = _get_user_role_names(request.user)
    row_perms = {}
    for doctype_name in perms:
        row = get_user_row_permissions(request.user, doctype_name)
        if row:
            row_perms[doctype_name] = row

    # Get doc shares
    from .models import DocShare
    shares = DocShare.objects.filter(
        Q(user=request.user) | Q(everyone=True)
    ).values("share_doctype", "share_name", "read", "write", "submit", "share")

    return Response({
        "roles": roles,
        "permissions": perms,
        "row_permissions": row_perms,
        "doc_shares": list(shares),
        "is_staff": request.user.is_staff,
    })


# ── Bulk Role Assignment ─────────────────────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminUser])
def bulk_assign_role(request):
    """
    Bulk assign a role to multiple users.
    POST: { "role_id": 1, "user_ids": [1, 2, 3] }
    """
    role_id = request.data.get("role_id")
    user_ids = request.data.get("user_ids", [])

    if not role_id or not user_ids:
        return Response(
            {"detail": "role_id and user_ids are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        role = Role.objects.get(id=role_id)
    except Role.DoesNotExist:
        return Response(
            {"detail": "Role not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    created = 0
    for uid in user_ids:
        try:
            user = User.objects.get(id=uid)
            _, was_created = UserRole.objects.get_or_create(user=user, role=role)
            if was_created:
                created += 1
        except User.DoesNotExist:
            continue

    return Response({
        "detail": f"Role '{role.name}' assigned to {created} user(s).",
        "created": created,
    })


# ── Bulk Remove Role ──────────────────────────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminUser])
def bulk_remove_role(request):
    """
    Bulk remove a role from multiple users.
    POST: { "role_id": 1, "user_ids": [1, 2, 3] }
    """
    role_id = request.data.get("role_id")
    user_ids = request.data.get("user_ids", [])

    if not role_id or not user_ids:
        return Response(
            {"detail": "role_id and user_ids are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    deleted, _ = UserRole.objects.filter(
        role_id=role_id,
        user_id__in=user_ids,
    ).delete()

    return Response({
        "detail": f"Role removed from {deleted} user(s).",
        "deleted": deleted,
    })


# ── Clear Old Logs ────────────────────────────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminUser])
def clear_old_logs(request):
    """
    Clear old log entries.
    POST: { "log_type": "access|activity|api_request", "days": 90 }
    """
    log_type = request.data.get("log_type", "access")
    days = int(request.data.get("days", 90))

    if log_type == "access":
        AccessLog.clear_old_logs(days=days)
    elif log_type == "activity":
        ActivityLog.clear_old_logs(days=days)
    elif log_type == "api_request":
        APIRequestLog.clear_old_logs(days=days)
    else:
        return Response(
            {"detail": f"Unknown log type: {log_type}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response({"detail": f"Cleared {log_type} logs older than {days} days."})


def _get_user_role_names(user):
    """Get all active role names for a user."""
    from .models import UserRole, HasRole
    role_names = set(
        UserRole.objects.filter(user=user, role__is_active=True)
        .values_list("role__name", flat=True)
    )
    role_names |= set(
        HasRole.objects.filter(user=user, role__is_active=True)
        .values_list("role__name", flat=True)
    )
    return sorted(role_names)


# ── Matrix Permission Update APIs ────────────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminUser])
def update_matrix_perm(request):
    """
    Update a single permission cell in the Permission Matrix.
    POST { role: "Physician", doctype: "Patient", permission: "write", value: true }
    """
    role_name = request.data.get("role")
    doctype_name = request.data.get("doctype")
    perm_field = request.data.get("permission")
    value = request.data.get("value", False)
    permlevel = int(request.data.get("permlevel", 0))

    if not role_name or not doctype_name or not perm_field:
        return Response({"error": "role, doctype, and permission are required"}, status=400)

    try:
        role = Role.objects.get(name=role_name)
    except Role.DoesNotExist:
        return Response({"error": f"Role '{role_name}' not found"}, status=404)

    try:
        doctype = DocType.objects.get(name=doctype_name)
    except DocType.DoesNotExist:
        return Response({"error": f"DocType '{doctype_name}' not found"}, status=404)

    custom_perm, created = CustomDocPerm.objects.get_or_create(
        doctype_ref=doctype,
        role=role,
        permlevel=permlevel,
        defaults={
            "parent": doctype.name,
            "owner": request.user.username,
        }
    )

    if created:
        std_perm = DocPerm.objects.filter(doctype_ref=doctype, role=role, permlevel=permlevel).first()
        if std_perm:
            for flag in ["select", "read", "write", "create", "delete", "submit", "cancel", "amend", "report", "export", "print", "email", "share"]:
                setattr(custom_perm, flag, getattr(std_perm, flag, False))

    if perm_field == "import":
        custom_perm.perm_import = bool(value)
    elif hasattr(custom_perm, perm_field):
        setattr(custom_perm, perm_field, bool(value))
    else:
        return Response({"error": f"Invalid permission flag '{perm_field}'"}, status=400)

    custom_perm.save()
    return Response({
        "status": "success",
        "role": role.name,
        "doctype": doctype.name,
        "permission": perm_field,
        "value": value,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminUser])
def bulk_update_matrix_perms(request):
    """
    Bulk update permissions for a role across multiple doctypes.
    POST { role: "Nurse", doctypes: ["Patient", "Vital Signs"], action: "read_all"|"full_ehr"|"clear" }
    """
    role_name = request.data.get("role")
    doctypes_list = request.data.get("doctypes", [])
    action_type = request.data.get("action")

    if not role_name or not action_type:
        return Response({"error": "role and action are required"}, status=400)

    try:
        role = Role.objects.get(name=role_name)
    except Role.DoesNotExist:
        return Response({"error": f"Role '{role_name}' not found"}, status=404)

    updated_count = 0
    for dt_name in doctypes_list:
        try:
            doctype = DocType.objects.get(name=dt_name)
        except DocType.DoesNotExist:
            continue

        custom_perm, _ = CustomDocPerm.objects.get_or_create(
            doctype_ref=doctype,
            role=role,
            permlevel=0,
            defaults={"parent": doctype.name, "owner": request.user.username}
        )

        if action_type == "read_all":
            custom_perm.read = True
            custom_perm.report = True
            custom_perm.print = True
        elif action_type == "full_ehr":
            custom_perm.read = True
            custom_perm.write = True
            custom_perm.create = True
            custom_perm.submit = True
            custom_perm.report = True
            custom_perm.print = True
        elif action_type == "clear":
            for flag in ["select", "read", "write", "create", "delete", "submit", "cancel", "amend", "report", "print", "email", "share"]:
                setattr(custom_perm, flag, False)

        custom_perm.save()
        updated_count += 1

    return Response({"status": "success", "updated_count": updated_count})
