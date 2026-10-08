"""
Frappe-style Role & Permission system.

Based on Frappe's core doctypes:
  Role, DocPerm, CustomDocPerm, HasRole, UserRole,
  RoleProfile, UserRoleProfile, UserPermission, DocShare,
  AccessLog, ActivityLog, APIRequestLog, PermissionLog,
  AuditTrail, SecuritySettings
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


# ── Role (frappe/core/doctype/role) ────────────────────────────────
STANDARD_ROLES = ("Administrator", "System Manager", "All", "Guest")


class Role(models.Model):
    """
    Named role – mirrors Frappe's Role DocType.
    Fields from Frappe: role_name, home_page, restrict_to_domain,
    disabled, is_custom, desk_access, two_factor_auth
    """
    name = models.CharField(max_length=140, unique=True)
    role_name = models.CharField(max_length=140, blank=True, default="")
    home_page = models.CharField(
        max_length=255, blank=True, default="",
        help_text='Route, e.g. "/desk"',
    )
    restrict_to_domain = models.CharField(
        max_length=140, blank=True, default="",
        help_text="Restrict this role to a specific domain",
    )
    disabled = models.BooleanField(
        default=False,
        help_text="If disabled, this role will be removed from all users.",
    )
    is_custom = models.BooleanField(
        default=False,
        help_text="Custom roles can be modified by admins.",
    )
    desk_access = models.BooleanField(
        default=True,
        help_text="Whether this role provides desk (admin panel) access.",
    )
    two_factor_auth = models.BooleanField(
        default=False,
        help_text="Require two-factor authentication for this role.",
    )
    description = models.TextField(blank=True, default="")
    is_system_role = models.BooleanField(
        default=False,
        help_text="System roles cannot be deleted by non-admins.",
    )
    is_active = models.BooleanField(default=True)
    owner = models.CharField(max_length=140, blank=True, default="Administrator")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=140, blank=True, default="Administrator")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Standard roles cannot be disabled
        if self.name in STANDARD_ROLES and self.disabled:
            from django.core.exceptions import ValidationError
            raise ValidationError(f"Standard role '{self.name}' cannot be disabled.")
        # Guest role never has desk access
        if self.name == "Guest":
            self.desk_access = False
        super().save(*args, **kwargs)


# ── DocType (our system's document types for permission targets) ────
class DocType(models.Model):
    """
    Represents a document type / resource in the system.
    Mirrors Frappe's DocType metadata for permission purposes.
    """
    name = models.CharField(max_length=140, unique=True)
    module = models.CharField(max_length=140, blank=True, default="")
    description = models.TextField(blank=True, default="")
    is_submittable = models.BooleanField(
        default=False,
        help_text="Whether this doctype supports submit/cancel workflow.",
    )
    is_active = models.BooleanField(default=True)
    owner = models.CharField(max_length=140, blank=True, default="Administrator")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=140, blank=True, default="Administrator")

    class Meta:
        ordering = ["module", "name"]
        verbose_name = "Doc Type"
        verbose_name_plural = "Doc Types"

    def __str__(self):
        return self.name


# ── Permission flags (same set Frappe uses in DocPerm) ─────────────
PERMISSION_FLAGS = (
    ("select", "Select"),
    ("read", "Read"),
    ("write", "Write"),
    ("create", "Create"),
    ("delete", "Delete"),
    ("submit", "Submit"),
    ("cancel", "Cancel"),
    ("amend", "Amend"),
    ("report", "Report"),
    ("export", "Export"),
    ("import", "Import"),
    ("print", "Print"),
    ("email", "Email"),
    ("share", "Share"),
    ("mask", "Mask"),
)


# ── DocPerm (frappe/core/doctype/docperm) ──────────────────────────
class DocPerm(models.Model):
    """
    Permission entry on a DocType definition.
    Fields from Frappe: role, permlevel, if_owner, and all permission flags.
    """
    doctype_ref = models.ForeignKey(
        DocType, on_delete=models.CASCADE, related_name="doc_perms",
        help_text="The DocType this permission applies to",
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="doc_perms")
    permlevel = models.IntegerField(
        default=0,
        help_text="Permission level (0=base, higher for custom fields)",
    )
    if_owner = models.BooleanField(
        default=False,
        help_text="Apply this rule only if the user is the owner of the document.",
    )

    # Permission flags (same as Frappe DocPerm)
    select = models.BooleanField(default=False)
    read = models.BooleanField(default=True)
    write = models.BooleanField(default=True)
    create = models.BooleanField(default=True)
    delete = models.BooleanField(default=True)
    submit = models.BooleanField(default=False)
    cancel = models.BooleanField(default=False)
    amend = models.BooleanField(default=False)
    report = models.BooleanField(default=True)
    export = models.BooleanField(default=True)
    perm_import = models.BooleanField(default=False, db_column="import")
    print = models.BooleanField(default=True)
    email = models.BooleanField(default=True)
    share = models.BooleanField(default=True)
    mask = models.BooleanField(default=False)

    owner = models.CharField(max_length=140, blank=True, default="Administrator")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    modified_by = models.CharField(max_length=140, blank=True, default="Administrator")

    class Meta:
        unique_together = ["doctype_ref", "role", "permlevel"]
        ordering = ["doctype_ref", "role", "permlevel"]

    def __str__(self):
        return f"{self.doctype_ref.name} / {self.role.name} (L{self.permlevel})"

    def get_active_permissions(self):
        """Return list of active permission flags."""
        active = []
        for flag_name in [
            "select", "read", "write", "create", "delete",
            "submit", "cancel", "amend", "report", "export",
            "print", "email", "share", "mask",
        ]:
            if getattr(self, flag_name, False):
                active.append(flag_name)
        if getattr(self, "perm_import", False):
            active.append("import")
        return active


# ── CustomDocPerm (frappe/core/doctype/custom_docperm) ─────────────
class CustomDocPerm(models.Model):
    """
    Custom permission override for a DocType.
    Mirrors Frappe's Custom DocPerm – allows admins to override
    standard DocPerm entries per role.
    """
    doctype_ref = models.ForeignKey(
        DocType, on_delete=models.CASCADE, related_name="custom_doc_perms",
    )
    parent = models.CharField(
        max_length=140, blank=True, default="",
        help_text="Reference document type name",
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="custom_doc_perms")
    permlevel = models.IntegerField(default=0)
    if_owner = models.BooleanField(
        default=False,
        help_text="Apply this rule only if the user is the owner.",
    )
    is_app_disabled = models.BooleanField(
        default=False,
        help_text="Set while owner app is disabled.",
    )

    # Permission flags
    select = models.BooleanField(default=False)
    read = models.BooleanField(default=False)
    write = models.BooleanField(default=False)
    create = models.BooleanField(default=False)
    delete = models.BooleanField(default=False)
    submit = models.BooleanField(default=False)
    cancel = models.BooleanField(default=False)
    amend = models.BooleanField(default=False)
    report = models.BooleanField(default=False)
    export = models.BooleanField(default=True)
    perm_import = models.BooleanField(default=False, db_column="import")
    print = models.BooleanField(default=False)
    email = models.BooleanField(default=False)
    share = models.BooleanField(default=False)
    mask = models.BooleanField(default=False)

    owner = models.CharField(max_length=140, blank=True, default="Administrator")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["doctype_ref", "role", "permlevel"]
        ordering = ["doctype_ref", "role", "permlevel"]
        verbose_name = "Custom Doc Perm"
        verbose_name_plural = "Custom Doc Perms"

    def __str__(self):
        return f"Custom: {self.doctype_ref.name} / {self.role.name}"

    def save(self, *args, **kwargs):
        # if_owner is only honoured at permlevel 0
        if self.permlevel > 0 and self.if_owner:
            self.if_owner = False
        super().save(*args, **kwargs)


# ── HasRole (frappe/core/doctype/has_role) ─────────────────────────
class HasRole(models.Model):
    """
    Child table linking User to Roles (Frappe's Has Role).
    Used as inline table on User documents.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="has_roles",
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="has_role_entries")
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "role"]
        ordering = ["user", "role"]

    def __str__(self):
        return f"{self.user.username} -> {self.role.name}"


# ── UserRole (frappe/core/doctype/user_role) ───────────────────────
class UserRole(models.Model):
    """
    Alternate user-role link (newer Frappe pattern).
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_role_entries")
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "role"]
        ordering = ["user", "role"]

    def __str__(self):
        return f"{self.user.username} -> {self.role.name}"


# ── RoleProfile (frappe/core/doctype/role_profile) ─────────────────
class RoleProfile(models.Model):
    """
    A profile that bundles multiple roles together.
    When a RoleProfile is assigned to a user, all its roles are synced.
    """
    role_profile = models.CharField(max_length=140, unique=True)
    description = models.TextField(blank=True, default="")
    owner = models.CharField(max_length=140, blank=True, default="Administrator")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["role_profile"]

    def __str__(self):
        return self.role_profile


class RoleProfileRole(models.Model):
    """Child table: roles within a RoleProfile."""
    role_profile = models.ForeignKey(
        RoleProfile, on_delete=models.CASCADE, related_name="roles"
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE)

    class Meta:
        unique_together = ["role_profile", "role"]

    def __str__(self):
        return f"{self.role_profile.role_profile} -> {self.role.name}"


# ── UserRoleProfile (frappe/core/doctype/user_role_profile) ────────
class UserRoleProfile(models.Model):
    """
    Links a User to a RoleProfile.
    When the RoleProfile changes, roles are synced to the user.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_profiles",
    )
    role_profile = models.ForeignKey(
        RoleProfile, on_delete=models.CASCADE, related_name="user_profiles"
    )
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["user", "role_profile"]

    def __str__(self):
        return f"{self.user.username} -> {self.role_profile.role_profile}"


# ── UserPermission (frappe/core/doctype/user_permission) ───────────
class UserPermission(models.Model):
    """
    Row-level permission: restricts a user to specific document values.
    E.g., user can only see Customer "Acme Corp".
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="frappe_user_permissions",
    )
    allow = models.CharField(
        max_length=140,
        help_text="DocType name to restrict (e.g., 'Customer')",
    )
    for_value = models.CharField(
        max_length=255,
        help_text="Specific document value the user is allowed to access",
    )
    is_default = models.BooleanField(
        default=False,
        help_text="Whether this is the default permission for the user.",
    )
    apply_to_all_doctypes = models.BooleanField(
        default=True,
        help_text="Apply this restriction to all DocTypes that link to the allowed DocType.",
    )
    applicable_for = models.CharField(
        max_length=140, blank=True, default="",
        help_text="Specific DocType this restriction applies to.",
    )
    hide_descendants = models.BooleanField(
        default=False,
        help_text="Hide descendant records of the For Value.",
    )
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["user", "allow", "for_value", "applicable_for", "apply_to_all_doctypes"]
        ordering = ["user", "allow"]

    def __str__(self):
        return f"{self.user.username}: {self.allow} = {self.for_value}"


# ── DocShare (frappe/core/doctype/docshare) ────────────────────────
class DocShare(models.Model):
    """
    Share a specific document with a user.
    Mirrors Frappe's DocShare.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="doc_shares",
        null=True, blank=True,
    )
    share_doctype = models.CharField(max_length=140)
    share_name = models.CharField(max_length=255)
    everyone = models.BooleanField(
        default=False,
        help_text="Share with everyone (user is ignored).",
    )
    read = models.BooleanField(default=False)
    write = models.BooleanField(default=False)
    submit = models.BooleanField(default=False)
    share = models.BooleanField(default=False)
    notify_by_email = models.BooleanField(default=True)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["user", "share_doctype", "share_name"]
        ordering = ["-creation"]

    def __str__(self):
        who = "Everyone" if self.everyone else (self.user.username if self.user else "?")
        return f"{who} -> {self.share_doctype}:{self.share_name}"

    def save(self, *args, **kwargs):
        # Cascade permissions downwards (same as Frappe)
        if self.share or self.write or self.submit:
            self.read = True
        if self.submit:
            self.write = True
        # Everyone shares don't need a user
        if self.everyone:
            self.user = None
        super().save(*args, **kwargs)


# ── AccessLog (frappe/core/doctype/access_log) ─────────────────────
class AccessLog(models.Model):
    """
    Logs data exports, report views, and file downloads.
    Mirrors Frappe's Access Log.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="access_logs",
    )
    export_from = models.CharField(max_length=255, blank=True, default="")
    reference_document = models.CharField(max_length=255, blank=True, default="")
    file_type = models.CharField(max_length=50, blank=True, default="")
    method = models.CharField(max_length=20, blank=True, default="")
    report_name = models.CharField(max_length=255, blank=True, default="")
    filters = models.TextField(blank=True, default="")
    page = models.TextField(blank=True, default="")
    columns = models.TextField(blank=True, default="")
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"Access: {self.user} - {self.export_from or self.method or 'unknown'}"

    @classmethod
    def clear_old_logs(cls, days=30):
        cutoff = timezone.now() - timezone.timedelta(days=days)
        cls.objects.filter(timestamp__lt=cutoff).delete()


# ── ActivityLog (frappe/core/doctype/activity_log) ─────────────────
class ActivityLog(models.Model):
    """
    Keeps track of all activity feeds - login, logout, document changes.
    Mirrors Frappe's Activity Log.
    """
    OPERATION_CHOICES = [
        ("", ""),
        ("Login", "Login"),
        ("Logout", "Logout"),
        ("Impersonate", "Impersonate"),
        ("Create", "Create"),
        ("Update", "Update"),
        ("Delete", "Delete"),
        ("Submit", "Submit"),
        ("Cancel", "Cancel"),
    ]
    STATUS_CHOICES = [
        ("", ""),
        ("Success", "Success"),
        ("Failed", "Failed"),
        ("Linked", "Linked"),
        ("Closed", "Closed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.TextField(blank=True, default="")
    content = models.TextField(blank=True, default="")
    communication_date = models.DateTimeField(null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="activity_logs",
    )
    full_name = models.CharField(max_length=255, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    operation = models.CharField(max_length=20, choices=OPERATION_CHOICES, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, blank=True, default="")

    # Reference fields
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=255, blank=True, default="")
    reference_owner = models.CharField(max_length=140, blank=True, default="")

    # Timeline fields
    timeline_doctype = models.CharField(max_length=140, blank=True, default="")
    timeline_name = models.CharField(max_length=255, blank=True, default="")

    # Link fields
    link_doctype = models.CharField(max_length=140, blank=True, default="")
    link_name = models.CharField(max_length=255, blank=True, default="")

    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"{self.operation}: {self.subject[:80]}"

    def save(self, *args, **kwargs):
        if not self.communication_date:
            self.communication_date = timezone.now()
        if not self.full_name and self.user:
            self.full_name = f"{self.user.first_name} {self.user.last_name}".strip()
        super().save(*args, **kwargs)

    @classmethod
    def clear_old_logs(cls, days=90):
        cutoff = timezone.now() - timezone.timedelta(days=days)
        cls.objects.filter(creation__lt=cutoff).delete()


# ── APIRequestLog (frappe/core/doctype/api_request_log) ────────────
class APIRequestLog(models.Model):
    """
    Logs API requests for auditing and debugging.
    Mirrors Frappe's API Request Log.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    path = models.CharField(max_length=1024, blank=True, default="")
    method = models.CharField(max_length=10, blank=True, default="")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="api_logs",
    )
    status_code = models.IntegerField(null=True, blank=True)
    request_body = models.TextField(blank=True, default="")
    response_body = models.TextField(blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    duration_ms = models.IntegerField(null=True, blank=True)
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"{self.method} {self.path} [{self.status_code}]"

    @classmethod
    def clear_old_logs(cls, days=90):
        cutoff = timezone.now() - timezone.timedelta(days=days)
        cls.objects.filter(creation__lt=cutoff).delete()


# ── PermissionLog (frappe/core/doctype/permission_log) ─────────────
class PermissionLog(models.Model):
    """
    Logs permission changes on documents.
    Mirrors Frappe's Permission Log.
    """
    STATUS_CHOICES = [
        ("Updated", "Updated"),
        ("Removed", "Removed"),
        ("Added", "Added"),
        ("Reset", "Reset"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="permission_logs_changed",
    )
    for_doctype = models.CharField(
        max_length=140,
        help_text="DocType whose permissions changed",
    )
    for_document = models.CharField(
        max_length=255,
        help_text="Document whose permissions changed",
    )
    reference_type = models.CharField(max_length=140, blank=True, default="")
    reference = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Updated")
    changes = models.JSONField(
        default=dict, blank=True,
        help_text='JSON {"from": {...}, "to": {...}}',
    )
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"{self.status}: {self.for_doctype}/{self.for_document}"


# ── AuditTrail (frappe/core/doctype/audit_trail) ──────────────────
class AuditTrail(models.Model):
    """
    Tracks document version history and amendments.
    Mirrors Frappe's Audit Trail.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctype_name = models.CharField(
        max_length=140,
        help_text="DocType to audit",
    )
    document = models.CharField(
        max_length=255,
        help_text="Document name/ID",
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    owner = models.CharField(max_length=140, blank=True, default="Administrator")
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]
        verbose_name = "Audit Trail"
        verbose_name_plural = "Audit Trails"

    def __str__(self):
        return f"Audit: {self.doctype_name}/{self.document}"


# ── SecuritySettings (frappe/core/doctype/security_settings) ──────
class SecuritySettings(models.Model):
    """
    Global security configuration (singleton).
    Mirrors Frappe's Security Settings.
    """
    # Password policy
    enable_password_policy = models.BooleanField(default=False)
    minimum_password_score = models.IntegerField(
        default=2,
        help_text="0-4: 0=very weak, 4=very strong",
    )
    password_reset_link_expiry_duration = models.IntegerField(
        default=20160,
        help_text="Minutes (default 14 days)",
    )
    logout_on_password_reset = models.BooleanField(default=True)
    allow_login_using_mobile_number = models.BooleanField(default=False)
    allow_login_using_user_name = models.BooleanField(default=False)
    max_signups_per_minute = models.IntegerField(default=0)
    max_login_attempts = models.IntegerField(default=5)
    session_expiry = models.CharField(
        max_length=20, default="06:00",
        help_text="Session expiry time (HH:MM)",
    )
    session_expiry_mobile = models.CharField(
        max_length=20, default="06:00",
        help_text="Mobile session expiry time",
    )

    # Session management
    allow_all_sessions = models.BooleanField(
        default=True,
        help_text="Allow multiple active sessions",
    )

    # 2FA
    enable_two_factor_auth = models.BooleanField(default=False)
    two_factor_method = models.CharField(
        max_length=20, default="OTP App",
        choices=[
            ("OTP App", "OTP App"),
            ("Email", "Email"),
            ("SMS", "SMS"),
        ],
    )

    # IP restriction
    restrict_ip_list = models.TextField(
        blank=True, default="",
        help_text="Comma-separated IP addresses",
    )

    # Security.txt
    public_policy = models.URLField(
        blank=True, default="https://frappe.io/security",
    )
    public_contacts = models.JSONField(default=list, blank=True)
    public_languages = models.JSONField(default=list, blank=True)
    public_expires = models.DateTimeField(null=True, blank=True)

    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Security Settings"
        verbose_name_plural = "Security Settings"

    def __str__(self):
        return "Security Settings"

    def save(self, *args, **kwargs):
        # Singleton pattern
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ── Import ALL additional core models ─────────────────────────────
from apps.roles.core_models import (  # noqa: E402, F401
    BlockModule,
    Comment,
    Communication,
    CommunicationLink,
    CustomRole,
    DataExport,
    DataImport,
    DataImportLog,
    DefaultValue,
    DeletedDocument,
    DocField,
    DocTypeAction,
    DocTypeLink,
    DocTypeState,
    Domain,
    DomainSettings,
    DocumentNamingRule,
    ErrorLog,
    File,
    HasDomain,
    LogSettings,
    LogsToClear,
    ModuleDef,
    Page,
    PermissionInspector,
    PreparedReport,
    Report,
    RolePermissionForPageAndReport,
    ScheduledJobLog,
    ScheduledJobType,
    ServerScript,
    SubmissionQueue,
    SystemSettings,
    UserEmail,
    UserGroup,
    UserGroupMember,
    UserInvitation,
    UserSocialLogin,
    Version,
    ViewLog,
    Workflow,
    WorkflowAction,
    WorkflowActionPermittedRole,
    WorkflowDocumentState,
    WorkflowState,
    WorkflowTransition,
    EmailTemplate,
    NotificationSetting,
    NotificationDelivery,
    UserNotificationSetting,
    EmailAccount,
)



