"""
Frappe-style serializers for Role & Permission models.
"""

from django.contrib.auth.models import User
from rest_framework import serializers

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


# ── Role ───────────────────────────────────────────────────────────
class RoleSerializer(serializers.ModelSerializer):
    users_count = serializers.SerializerMethodField()
    doc_perms_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            "id", "name", "role_name", "home_page", "restrict_to_domain",
            "disabled", "is_custom", "desk_access", "two_factor_auth",
            "description", "is_system_role", "is_active",
            "users_count", "doc_perms_count", "owner",
            "creation", "modified",
        ]
        read_only_fields = ["creation", "modified"]

    def get_users_count(self, obj):
        return obj.user_role_entries.count() + obj.has_role_entries.count()

    def get_doc_perms_count(self, obj):
        return obj.doc_perms.count() + obj.custom_doc_perms.count()


# ── DocType ────────────────────────────────────────────────────────
class DocTypeSerializer(serializers.ModelSerializer):
    doc_perms_count = serializers.SerializerMethodField()
    custom_perms_count = serializers.SerializerMethodField()

    class Meta:
        model = DocType
        fields = [
            "id", "name", "module", "description", "is_submittable",
            "is_active", "owner", "creation", "modified",
            "doc_perms_count", "custom_perms_count",
        ]
        read_only_fields = ["creation", "modified"]

    def get_doc_perms_count(self, obj):
        return obj.doc_perms.count()

    def get_custom_perms_count(self, obj):
        return obj.custom_doc_perms.count()


# ── DocPerm ────────────────────────────────────────────────────────
class DocPermSerializer(serializers.ModelSerializer):
    doctype_name = serializers.CharField(source="doctype_ref.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)
    active_permissions = serializers.SerializerMethodField()

    class Meta:
        model = DocPerm
        fields = [
            "id", "doctype_ref", "doctype_name", "role", "role_name",
            "permlevel", "if_owner",
            "select", "read", "write", "create", "delete",
            "submit", "cancel", "amend", "report", "export",
            "print", "email", "share", "mask",
            "active_permissions",
            "owner", "creation", "modified",
        ]
        read_only_fields = ["creation", "modified"]

    def get_active_permissions(self, obj):
        return obj.get_active_permissions()


# ── CustomDocPerm ──────────────────────────────────────────────────
class CustomDocPermSerializer(serializers.ModelSerializer):
    doctype_name = serializers.CharField(source="doctype_ref.name", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = CustomDocPerm
        fields = [
            "id", "doctype_ref", "doctype_name", "parent", "role", "role_name",
            "permlevel", "if_owner", "is_app_disabled",
            "select", "read", "write", "create", "delete",
            "submit", "cancel", "amend", "report", "export",
            "print", "email", "share", "mask",
            "owner", "creation", "modified",
        ]
        read_only_fields = ["creation", "modified"]


# ── HasRole ────────────────────────────────────────────────────────
class HasRoleSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = HasRole
        fields = ["id", "user", "user_username", "role", "role_name", "creation"]
        read_only_fields = ["creation"]


# ── UserRole ───────────────────────────────────────────────────────
class UserRoleSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = UserRole
        fields = [
            "id", "user", "user_username", "user_email",
            "role", "role_name", "creation",
        ]
        read_only_fields = ["creation"]


# ── RoleProfile ────────────────────────────────────────────────────
class RoleProfileRoleSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = RoleProfileRole
        fields = ["id", "role", "role_name"]


class RoleProfileSerializer(serializers.ModelSerializer):
    roles_detail = RoleProfileRoleSerializer(source="roles", many=True, read_only=True)
    users_count = serializers.SerializerMethodField()

    class Meta:
        model = RoleProfile
        fields = [
            "id", "role_profile", "description",
            "roles_detail", "users_count",
            "owner", "creation", "modified",
        ]
        read_only_fields = ["creation", "modified"]

    def get_users_count(self, obj):
        return obj.user_profiles.count()


# ── UserRoleProfile ────────────────────────────────────────────────
class UserRoleProfileSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    role_profile_name = serializers.CharField(
        source="role_profile.role_profile", read_only=True
    )

    class Meta:
        model = UserRoleProfile
        fields = [
            "id", "user", "user_username",
            "role_profile", "role_profile_name",
            "creation",
        ]
        read_only_fields = ["creation"]


# ── UserPermission ─────────────────────────────────────────────────
class UserPermissionSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = UserPermission
        fields = [
            "id", "user", "user_username",
            "allow", "for_value", "is_default",
            "apply_to_all_doctypes", "applicable_for",
            "hide_descendants",
            "creation", "modified",
        ]
        read_only_fields = ["creation", "modified"]


# ── DocShare ───────────────────────────────────────────────────────
class DocShareSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True, default="")
    user_email = serializers.CharField(source="user.email", read_only=True, default="")
    user_full_name = serializers.SerializerMethodField()

    class Meta:
        model = DocShare
        fields = [
            "id", "user", "user_username", "user_email", "user_full_name",
            "share_doctype", "share_name", "everyone",
            "read", "write", "submit", "share",
            "notify_by_email", "owner",
            "creation", "modified",
        ]
        read_only_fields = ["creation", "modified", "owner"]
        extra_kwargs = {
            "user": {"required": False, "allow_null": True},
        }

    def get_user_full_name(self, obj):
        if obj.user:
            fn = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return fn if fn else obj.user.username
        return "Everyone" if obj.everyone else ""


# ── AccessLog ──────────────────────────────────────────────────────
class AccessLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True, default="")

    class Meta:
        model = AccessLog
        fields = [
            "id", "user", "user_username",
            "export_from", "reference_document", "file_type",
            "method", "report_name", "filters", "page",
            "columns", "timestamp",
        ]
        read_only_fields = ["timestamp"]


# ── ActivityLog ────────────────────────────────────────────────────
class ActivityLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True, default="")

    class Meta:
        model = ActivityLog
        fields = [
            "id", "subject", "content",
            "communication_date", "user", "user_username",
            "full_name", "ip_address",
            "operation", "status",
            "reference_doctype", "reference_name", "reference_owner",
            "timeline_doctype", "timeline_name",
            "link_doctype", "link_name",
            "creation",
        ]
        read_only_fields = ["creation", "communication_date"]


# ── APIRequestLog ──────────────────────────────────────────────────
class APIRequestLogSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True, default="")

    class Meta:
        model = APIRequestLog
        fields = [
            "id", "path", "method", "user", "user_username",
            "status_code", "ip_address", "user_agent",
            "duration_ms", "creation",
        ]
        read_only_fields = ["creation"]


# ── PermissionLog ──────────────────────────────────────────────────
class PermissionLogSerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(
        source="changed_by.username", read_only=True, default=""
    )

    class Meta:
        model = PermissionLog
        fields = [
            "id", "changed_by", "changed_by_username",
            "for_doctype", "for_document",
            "reference_type", "reference",
            "status", "changes", "creation",
        ]
        read_only_fields = ["creation"]


# ── AuditTrail ─────────────────────────────────────────────────────
class AuditTrailSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditTrail
        fields = [
            "id", "doctype_name", "document",
            "start_date", "end_date",
            "owner", "creation",
        ]
        read_only_fields = ["creation"]


# ── SecuritySettings ──────────────────────────────────────────────
class SecuritySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecuritySettings
        fields = "__all__"
        read_only_fields = ["creation", "modified"]


# ── SystemSettings ────────────────────────────────────────────────
class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = "__all__"
        read_only_fields = ["creation", "modified"]


# ── User Summary (for permission matrix) ──────────────────────────
class UserSummarySerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "is_active", "is_staff", "roles",
        ]

    def get_roles(self, obj):
        from .models import UserRole, HasRole
        role_names = set(
            UserRole.objects.filter(user=obj, role__is_active=True)
            .values_list("role__name", flat=True)
        )
        role_names |= set(
            HasRole.objects.filter(user=obj, role__is_active=True)
            .values_list("role__name", flat=True)
        )
        return sorted(role_names)


class UserDetailSerializer(serializers.ModelSerializer):
    """
    Frappe-style full user serializer with roles, permissions, and profile fields.
    """
    roles = serializers.SerializerMethodField()
    all_roles = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    user_type = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "is_active", "is_staff", "is_superuser",
            "date_joined", "last_login",
            "roles", "all_roles", "full_name", "user_type",
        ]
        read_only_fields = ["date_joined", "last_login"]

    def get_roles(self, obj):
        from .models import UserRole, HasRole
        role_names = set(
            UserRole.objects.filter(user=obj, role__is_active=True)
            .values_list("role__name", flat=True)
        )
        role_names |= set(
            HasRole.objects.filter(user=obj, role__is_active=True)
            .values_list("role__name", flat=True)
        )
        return sorted(role_names)

    def get_all_roles(self, obj):
        """Return all available roles for assignment."""
        from .models import Role
        return list(Role.objects.filter(is_active=True).order_by("name").values("id", "name", "desk_access"))

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def get_user_type(self, obj):
        if obj.is_superuser or obj.is_staff:
            return "System User"
        return "Website User"
