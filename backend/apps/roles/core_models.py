"""
Complete Frappe core doctype models.

Every core doctype from frappe/frappe/core/doctype is represented here.
Fields, methods, and logic are ported from the actual Frappe source.
"""

import json
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


# ── ErrorLog (frappe/core/doctype/error_log) ──────────────────────
class ErrorLog(models.Model):
    """
    Logs system errors with fingerprinting and deduplication.
    Mirrors Frappe's Error Log.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    method = models.CharField(max_length=140, blank=True, default="")
    error = models.TextField(blank=True, default="")
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=255, blank=True, default="")
    seen = models.BooleanField(default=False)
    fingerprint = models.CharField(max_length=255, blank=True, default="")
    trace_id = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"Error: {self.method[:50]}"

    def save(self, *args, **kwargs):
        if len(str(self.method)) > 140:
            self.error = f"{self.method}\n{self.error}"
            self.method = self.method[:140]
        super().save(*args, **kwargs)

    @classmethod
    def clear_old_logs(cls, days=30):
        cutoff = timezone.now() - timezone.timedelta(days=days)
        cls.objects.filter(creation__lt=cutoff).delete()


# ── Version (frappe/core/doctype/version) ─────────────────────────
class Version(models.Model):
    """
    Tracks document changes as JSON diffs.
    Mirrors Frappe's Version doctype.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ref_doctype = models.CharField(max_length=140)
    docname = models.CharField(max_length=255)
    data = models.JSONField(default=dict, blank=True)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]
        indexes = [
            models.Index(fields=["ref_doctype", "docname"]),
        ]

    def __str__(self):
        return f"Version: {self.ref_doctype}/{self.docname}"

    def set_diff(self, old_data, new_data):
        """Compute diff between old and new document data."""
        diff = {"changed": [], "added": [], "removed": [], "row_changed": []}
        all_keys = set(list(old_data.keys()) + list(new_data.keys()))
        for key in all_keys:
            old_val = old_data.get(key)
            new_val = new_data.get(key)
            if old_val != new_val:
                diff["changed"].append([key, str(old_val) if old_val else "", str(new_val) if new_val else ""])
        if any(diff.values()):
            self.data = diff
            self.ref_doctype = new_data.get("doctype", "")
            self.docname = new_data.get("name", "")
            return True
        return False


# ── ViewLog (frappe/core/doctype/view_log) ────────────────────────
class ViewLog(models.Model):
    """
    Logs who viewed which document.
    Mirrors Frappe's View Log.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=255, blank=True, default="")
    viewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="view_logs",
    )
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]
        indexes = [
            models.Index(fields=["reference_doctype", "reference_name"]),
        ]

    def __str__(self):
        return f"View: {self.reference_doctype}/{self.reference_name}"

    @classmethod
    def clear_old_logs(cls, days=180):
        cutoff = timezone.now() - timezone.timedelta(days=days)
        cls.objects.filter(creation__lt=cutoff).delete()


# ── Comment (frappe/core/doctype/comment) ─────────────────────────
class Comment(models.Model):
    """
    Comments on documents. Mirrors Frappe's Comment.
    Supports 19 comment types including likes, assignments, attachments.
    """
    COMMENT_TYPES = [
        ("Comment", "Comment"), ("Like", "Like"), ("Info", "Info"),
        ("Label", "Label"), ("Workflow", "Workflow"), ("Created", "Created"),
        ("Submitted", "Submitted"), ("Cancelled", "Cancelled"),
        ("Updated", "Updated"), ("Deleted", "Deleted"),
        ("Assigned", "Assigned"), ("Assignment Completed", "Assignment Completed"),
        ("Attachment", "Attachment"), ("Attachment Removed", "Attachment Removed"),
        ("Shared", "Shared"), ("Unshared", "Unshared"),
        ("Bot", "Bot"), ("Relinked", "Relinked"), ("Edit", "Edit"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    comment_type = models.CharField(max_length=30, choices=COMMENT_TYPES, default="Comment")
    comment_email = models.CharField(max_length=255, blank=True, default="")
    comment_by = models.CharField(max_length=255, blank=True, default="")
    subject = models.TextField(blank=True, default="")
    content = models.TextField(blank=True, default="")
    published = models.BooleanField(default=False)
    seen = models.BooleanField(default=False)
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=255, blank=True, default="")
    reference_owner = models.CharField(max_length=140, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]
        indexes = [
            models.Index(fields=["reference_doctype", "reference_name"]),
        ]

    def __str__(self):
        return f"{self.comment_type}: {self.subject or self.content[:50]}"

    def save(self, *args, **kwargs):
        if not self.comment_email:
            self.comment_email = self.owner
        super().save(*args, **kwargs)


# ── Communication (frappe/core/doctype/communication) ─────────────
class Communication(models.Model):
    """
    Tracks emails and other communications linked to documents.
    Mirrors Frappe's Communication doctype.
    """
    MEDIUM_CHOICES = [
        ("", ""), ("Email", "Email"), ("Chat", "Chat"), ("Phone", "Phone"),
        ("SMS", "SMS"), ("Event", "Event"), ("Meeting", "Meeting"),
        ("Visit", "Visit"), ("Other", "Other"),
    ]
    TYPE_CHOICES = [
        ("Communication", "Communication"), ("Automated Message", "Automated Message"),
    ]
    STATUS_CHOICES = [
        ("Open", "Open"), ("Replied", "Replied"),
        ("Closed", "Closed"), ("Linked", "Linked"),
    ]
    SENT_RECEIVED_CHOICES = [("Sent", "Sent"), ("Received", "Received")]
    DELIVERY_STATUS_CHOICES = [
        ("", ""), ("Sent", "Sent"), ("Bounced", "Bounced"),
        ("Opened", "Opened"), ("Marked As Spam", "Marked As Spam"),
        ("Rejected", "Rejected"), ("Delayed", "Delayed"),
        ("Soft-Bounced", "Soft-Bounced"), ("Clicked", "Clicked"),
        ("Recipient Unsubscribed", "Recipient Unsubscribed"),
        ("Error", "Error"), ("Expired", "Expired"),
        ("Sending", "Sending"), ("Read", "Read"), ("Scheduled", "Scheduled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.CharField(max_length=500, blank=True, default="")
    content = models.TextField(blank=True, default="")
    text_content = models.TextField(blank=True, default="")
    communication_medium = models.CharField(max_length=20, choices=MEDIUM_CHOICES, blank=True, default="")
    communication_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="Communication")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Open")
    sent_or_received = models.CharField(max_length=20, choices=SENT_RECEIVED_CHOICES, blank=True, default="")
    delivery_status = models.CharField(max_length=30, choices=DELIVERY_STATUS_CHOICES, blank=True, default="")
    sender = models.CharField(max_length=255, blank=True, default="")
    sender_full_name = models.CharField(max_length=255, blank=True, default="")
    recipients = models.TextField(blank=True, default="")
    cc = models.TextField(blank=True, default="")
    bcc = models.TextField(blank=True, default="")
    phone_no = models.CharField(max_length=50, blank=True, default="")
    communication_date = models.DateTimeField(null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="communications",
    )
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=255, blank=True, default="")
    reference_owner = models.CharField(max_length=140, blank=True, default="")
    email_account = models.CharField(max_length=255, blank=True, default="")
    in_reply_to = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="replies")
    message_id = models.TextField(blank=True, default="")
    email_status = models.CharField(max_length=20, blank=True, default="")
    seen = models.BooleanField(default=False)
    read_by_recipient = models.BooleanField(default=False)
    read_by_recipient_on = models.DateTimeField(null=True, blank=True)
    read_receipt = models.BooleanField(default=False)
    has_attachment = models.BooleanField(default=False)
    send_after = models.DateTimeField(null=True, blank=True)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"Communication: {self.subject[:50]}"

    def save(self, *args, **kwargs):
        if not self.subject and self.content:
            from html import unescape
            import re
            text = re.sub(r'<[^>]+>', '', self.content)[:141]
            self.subject = unescape(text)
        if not self.sent_or_received:
            self.seen = True
            self.sent_or_received = "Sent"
        super().save(*args, **kwargs)


# ── CommunicationLink (frappe/core/doctype/communication_link) ────
class CommunicationLink(models.Model):
    """Timeline links connecting communications to documents."""
    communication = models.ForeignKey(Communication, on_delete=models.CASCADE, related_name="timeline_links")
    link_doctype = models.CharField(max_length=140)
    link_name = models.CharField(max_length=255)
    link_title = models.CharField(max_length=255, blank=True, default="")
    communication_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ["communication", "link_doctype", "link_name"]

    def __str__(self):
        return f"{self.link_doctype}/{self.link_name}"


# ── DeletedDocument (frappe/core/doctype/deleted_document) ────────
class DeletedDocument(models.Model):
    """Stores deleted documents for potential restore."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deleted_doctype = models.CharField(max_length=140, blank=True, default="")
    deleted_name = models.CharField(max_length=255, blank=True, default="")
    new_name = models.CharField(max_length=255, blank=True, default="")
    data = models.JSONField(default=dict, blank=True)
    restored = models.BooleanField(default=False)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"Deleted: {self.deleted_doctype}/{self.deleted_name}"

    @classmethod
    def clear_old_logs(cls, days=180):
        cutoff = timezone.now() - timezone.timedelta(days=days)
        cls.objects.filter(creation__lt=cutoff).delete()


# ── DocumentNamingRule (frappe/core/doctype/document_naming_rule) ─
class DocumentNamingRule(models.Model):
    """Rules for automatic document naming."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document_type = models.CharField(max_length=140)
    prefix = models.CharField(max_length=255, blank=True, default="")
    prefix_digits = models.IntegerField(default=6)
    counter = models.IntegerField(default=0)
    disabled = models.BooleanField(default=False)
    priority = models.IntegerField(default=0)
    conditions = models.JSONField(default=list, blank=True)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-priority", "document_type"]

    def __str__(self):
        return f"Naming: {self.document_type} ({self.prefix})"


# ── BlockModule (frappe/core/doctype/block_module) ────────────────
class BlockModule(models.Model):
    """Child table: modules blocked for a user."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocked_modules")
    module = models.CharField(max_length=140)

    class Meta:
        unique_together = ["user", "module"]

    def __str__(self):
        return f"{self.user.username}: {self.module}"


# ── DefaultValue (frappe/core/doctype/defaultvalue) ───────────────
class DefaultValue(models.Model):
    """Default values per user for different keys."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="default_values")
    defkey = models.CharField(max_length=255)
    defvalue = models.TextField(blank=True, default="")

    class Meta:
        unique_together = ["user", "defkey"]
        indexes = [models.Index(fields=["user", "defkey"])]

    def __str__(self):
        return f"{self.user.username}: {self.defkey} = {self.defvalue}"


# ── Domain (frappe/core/doctype/domain) ───────────────────────────
class Domain(models.Model):
    """Business domain."""
    name = models.CharField(max_length=140, unique=True)
    domain = models.CharField(max_length=140, blank=True, default="")
    is_active = models.BooleanField(default=True)
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


# ── HasDomain (frappe/core/doctype/has_domain) ────────────────────
class HasDomain(models.Model):
    """Active domains in Domain Settings."""
    settings = models.ForeignKey("DomainSettings", on_delete=models.CASCADE, related_name="active_domains")
    domain = models.CharField(max_length=140)

    class Meta:
        unique_together = ["settings", "domain"]

    def __str__(self):
        return self.domain


# ── DomainSettings (frappe/core/doctype/domain_settings) ──────────
class DomainSettings(models.Model):
    """Active domains configuration (singleton)."""
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Domain Settings"
        verbose_name_plural = "Domain Settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def get_active_domains(self):
        return list(self.active_domains.values_list("domain", flat=True))


# ── LogSettings (frappe/core/doctype/log_settings) ────────────────
class LogSettings(models.Model):
    """Configuration for automatic log clearing (singleton)."""
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Log Settings"
        verbose_name_plural = "Log Settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class LogsToClear(models.Model):
    """Child table: which log doctypes to clear and after how many days."""
    settings = models.ForeignKey(LogSettings, on_delete=models.CASCADE, related_name="logs_to_clear")
    ref_doctype = models.CharField(max_length=140)
    days = models.IntegerField(default=90)

    class Meta:
        unique_together = ["settings", "ref_doctype"]

    def __str__(self):
        return f"{self.ref_doctype}: {self.days} days"


# ── ModuleDef (frappe/core/doctype/module_def) ────────────────────
class ModuleDef(models.Model):
    """Module definitions."""
    name = models.CharField(max_length=140, unique=True)
    module_name = models.CharField(max_length=140, blank=True, default="")
    app_name = models.CharField(max_length=140, blank=True, default="")
    custom = models.BooleanField(default=False)
    restrict_to_domain = models.CharField(max_length=140, blank=True, default="")
    package = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


# ── SystemSettings (frappe/core/doctype/system_settings) ──────────
class SystemSettings(models.Model):
    """Global system settings (singleton)."""
    app_name = models.CharField(max_length=140, blank=True, default="ERP")
    country = models.CharField(max_length=140, blank=True, default="")
    language = models.CharField(max_length=140, blank=True, default="en")
    time_zone = models.CharField(max_length=140, blank=True, default="UTC")
    currency = models.CharField(max_length=10, blank=True, default="USD")
    date_format = models.CharField(max_length=20, blank=True, default="yyyy-MM-dd")
    time_format = models.CharField(max_length=10, blank=True, default="HH:mm:ss")
    number_format = models.CharField(max_length=20, blank=True, default="#,###.##")
    first_day_of_the_week = models.CharField(max_length=10, blank=True, default="Monday")
    float_precision = models.CharField(max_length=5, blank=True, default="3")
    currency_precision = models.CharField(max_length=5, blank=True, default="2")
    allow_login_using_mobile_number = models.BooleanField(default=False)
    allow_login_using_user_name = models.BooleanField(default=True)
    allow_guests_to_upload_files = models.BooleanField(default=False)
    disable_user_pass_login = models.BooleanField(default=False)
    max_signups_allowed_per_hour = models.IntegerField(default=0)
    deny_multiple_sessions = models.BooleanField(default=False)
    force_user_to_reset_password = models.IntegerField(default=0)
    password_reset_limit = models.IntegerField(default=5)
    enable_password_policy = models.BooleanField(default=False)
    minimum_password_score = models.CharField(max_length=5, blank=True, default="2")
    session_expiry = models.CharField(max_length=20, blank=True, default="06:00")
    enable_two_factor_auth = models.BooleanField(default=False)
    two_factor_method = models.CharField(max_length=20, blank=True, default="OTP App")
    max_file_size = models.IntegerField(default=10485760)
    strip_exif_metadata_from_uploaded_images = models.BooleanField(default=False)
    max_report_rows = models.IntegerField(default=10000)
    enable_scheduler = models.BooleanField(default=True)
    setup_complete = models.BooleanField(default=False)
    enable_telemetry = models.BooleanField(default=True)
    backup_limit = models.IntegerField(default=3)
    encrypt_backup = models.BooleanField(default=False)
    allow_error_traceback = models.BooleanField(default=True)
    log_api_requests = models.BooleanField(default=True)
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "System Settings"
        verbose_name_plural = "System Settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def get_system_setting(self, key):
        return getattr(self, key, None)


# ── File (frappe/core/doctype/file) ───────────────────────────────
class File(models.Model):
    """File management - uploads, attachments, folders."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file_name = models.CharField(max_length=255, blank=True, default="")
    file_url = models.TextField(blank=True, default="")
    file_type = models.CharField(max_length=20, blank=True, default="")
    file_size = models.BigIntegerField(default=0)
    content_hash = models.CharField(max_length=255, blank=True, default="")
    is_folder = models.BooleanField(default=False)
    is_private = models.BooleanField(default=False)
    is_home_folder = models.BooleanField(default=False)
    is_attachments_folder = models.BooleanField(default=False)
    folder = models.CharField(max_length=500, blank=True, default="")
    old_parent = models.CharField(max_length=500, blank=True, default="")
    attached_to_doctype = models.CharField(max_length=140, blank=True, default="")
    attached_to_name = models.CharField(max_length=255, blank=True, default="")
    attached_to_field = models.CharField(max_length=140, blank=True, default="")
    thumbnail_url = models.CharField(max_length=500, blank=True, default="")
    uploaded_to_dropbox = models.BooleanField(default=False)
    uploaded_to_google_drive = models.BooleanField(default=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="files")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]
        indexes = [
            models.Index(fields=["attached_to_doctype", "attached_to_name"]),
            models.Index(fields=["file_url"]),
        ]

    def __str__(self):
        return self.file_name or self.file_url


# ── UserGroup (frappe/core/doctype/user_group) ────────────────────
class UserGroup(models.Model):
    """Groups of users for notification assignment."""
    name = models.CharField(max_length=140, unique=True)
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class UserGroupMember(models.Model):
    """Child table: members of a UserGroup."""
    user_group = models.ForeignKey(UserGroup, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_group_memberships")

    class Meta:
        unique_together = ["user_group", "user"]

    def __str__(self):
        return f"{self.user_group.name} -> {self.user.username}"


# ── UserInvitation (frappe/core/doctype/user_invitation) ──────────
class UserInvitation(models.Model):
    """User invitation workflow."""
    STATUS_CHOICES = [
        ("Pending", "Pending"), ("Accepted", "Accepted"),
        ("Expired", "Expired"), ("Cancelled", "Cancelled"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="invitations")
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="sent_invitations")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    key = models.CharField(max_length=255, blank=True, default="")
    redirect_to_path = models.CharField(max_length=500, blank=True, default="/")
    roles = models.JSONField(default=list, blank=True)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"Invitation: {self.email} ({self.status})"


# ── CustomRole (frappe/core/doctype/custom_role) ──────────────────
class CustomRole(models.Model):
    """
    Custom roles for pages and reports.
    Mirrors Frappe's Custom Role.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    page = models.CharField(max_length=140, blank=True, default="")
    report = models.CharField(max_length=140, blank=True, default="")
    ref_doctype = models.CharField(max_length=140, blank=True, default="")
    roles = models.JSONField(
        default=list, blank=True,
        help_text='List of role names, e.g. ["Sales Manager", "System Manager"]',
    )
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        target = self.page or self.report or "?"
        return f"CustomRole: {target}"

    def get_custom_allowed_roles(self):
        return self.roles


# ── RolePermissionForPageAndReport ────────────────────────────────
class RolePermissionForPageAndReport(models.Model):
    """
    Manages role permissions for pages and reports.
    Mirrors Frappe's Role Permission for Page and Report.
    """
    SET_ROLE_FOR_CHOICES = [
        ("", ""),
        ("Page", "Page"),
        ("Report", "Report"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    set_role_for = models.CharField(max_length=20, choices=SET_ROLE_FOR_CHOICES, blank=True, default="")
    page = models.CharField(max_length=140, blank=True, default="")
    report = models.CharField(max_length=140, blank=True, default="")
    roles = models.JSONField(default=list, blank=True)
    enable_prepared_report = models.BooleanField(default=False)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]
        verbose_name = "Role Permission for Page and Report"
        verbose_name_plural = "Role Permissions for Pages and Reports"

    def __str__(self):
        target = self.page or self.report or "?"
        return f"Roles for {target}"

    def update_custom_roles(self):
        target = self.page if self.set_role_for == "Page" else self.report
        if not target:
            return
        custom_role, _ = CustomRole.objects.get_or_create(
            **{self.set_role_for.lower(): target},
            defaults={"roles": self.roles, "ref_doctype": self.report},
        )
        custom_role.roles = self.roles
        custom_role.save()


# ── ScheduledJobType (frappe/core/doctype/scheduled_job_type) ─────
class ScheduledJobType(models.Model):
    """
    Scheduled background jobs.
    Mirrors Frappe's Scheduled Job Type.
    """
    FREQUENCY_CHOICES = [
        ("All", "All"), ("Hourly", "Hourly"), ("Hourly Long", "Hourly Long"),
        ("Hourly Maintenance", "Hourly Maintenance"),
        ("Daily", "Daily"), ("Daily Long", "Daily Long"),
        ("Daily Maintenance", "Daily Maintenance"),
        ("Weekly", "Weekly"), ("Weekly Long", "Weekly Long"),
        ("Monthly", "Monthly"), ("Monthly Long", "Monthly Long"),
        ("Cron", "Cron"), ("Yearly", "Yearly"), ("Annual", "Annual"),
    ]
    QUEUE_CHOICES = [
        ("", ""), ("default", "default"), ("short", "short"), ("long", "long"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    method = models.CharField(max_length=500)
    frequency = models.CharField(max_length=30, choices=FREQUENCY_CHOICES, default="Daily")
    cron_format = models.CharField(max_length=255, blank=True, default="")
    queue = models.CharField(max_length=20, choices=QUEUE_CHOICES, blank=True, default="")
    stopped = models.BooleanField(default=False)
    create_log = models.BooleanField(default=True)
    last_execution = models.DateTimeField(null=True, blank=True)
    server_script = models.CharField(max_length=140, blank=True, default="")
    scheduler_event = models.CharField(max_length=140, blank=True, default="")
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["method"]
        unique_together = ["frequency", "cron_format", "method"]

    def __str__(self):
        return f"{self.method} ({self.frequency})"


# ── ScheduledJobLog (frappe/core/doctype/scheduled_job_log) ───────
class ScheduledJobLog(models.Model):
    """
    Logs of scheduled job executions.
    Mirrors Frappe's Scheduled Job Log.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheduled_job_type = models.ForeignKey(
        ScheduledJobType, on_delete=models.CASCADE, related_name="logs"
    )
    status = models.CharField(max_length=20, blank=True, default="")
    details = models.TextField(blank=True, default="")
    debug_log = models.TextField(blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"Log: {self.scheduled_job_type.method} - {self.status}"


# ── ServerScript (frappe/core/doctype/server_script) ──────────────
class ServerScript(models.Model):
    """
    Server-side scripts for custom logic.
    Mirrors Frappe's Server Script.
    """
    SCRIPT_TYPE_CHOICES = [
        ("DocType Event", "DocType Event"),
        ("Scheduler Event", "Scheduler Event"),
        ("Permission Query", "Permission Query"),
        ("API", "API"),
        ("Workflow Task", "Workflow Task"),
    ]
    FREQUENCY_CHOICES = [
        ("All", "All"), ("Hourly", "Hourly"), ("Daily", "Daily"),
        ("Weekly", "Weekly"), ("Monthly", "Monthly"), ("Yearly", "Yearly"),
        ("Hourly Long", "Hourly Long"), ("Daily Long", "Daily Long"),
        ("Weekly Long", "Weekly Long"), ("Monthly Long", "Monthly Long"),
        ("Cron", "Cron"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name_display = models.CharField(max_length=140, unique=True)
    script_type = models.CharField(max_length=30, choices=SCRIPT_TYPE_CHOICES, default="DocType Event")
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    module = models.CharField(max_length=140, blank=True, default="")
    script = models.TextField()
    disabled = models.BooleanField(default=False)
    allow_guest = models.BooleanField(default=False)

    # Scheduler fields
    event_frequency = models.CharField(max_length=30, choices=FREQUENCY_CHOICES, blank=True, default="")
    cron_format = models.CharField(max_length=255, blank=True, default="")

    # API fields
    api_method = models.CharField(max_length=140, blank=True, default="")

    # Rate limit
    enable_rate_limit = models.BooleanField(default=False)
    rate_limit_count = models.IntegerField(default=5)
    rate_limit_seconds = models.IntegerField(default=86400)

    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name_display"]

    def __str__(self):
        return f"{self.name_display} ({self.script_type})"


# ── DataImport (frappe/core/doctype/data_import) ──────────────────
class DataImport(models.Model):
    """
    Data import tracking.
    Mirrors Frappe's Data Import.
    """
    IMPORT_TYPE_CHOICES = [
        ("", ""),
        ("Insert New Records", "Insert New Records"),
        ("Update Existing Records", "Update Existing Records"),
        ("Insert or Update Records", "Insert or Update Records"),
    ]
    STATUS_CHOICES = [
        ("Pending", "Pending"), ("Success", "Success"),
        ("Partial Success", "Partial Success"), ("Error", "Error"),
        ("Timed Out", "Timed Out"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference_doctype = models.CharField(max_length=140)
    import_file = models.CharField(max_length=500, blank=True, default="")
    google_sheets_url = models.CharField(max_length=500, blank=True, default="")
    import_type = models.CharField(max_length=30, choices=IMPORT_TYPE_CHOICES, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Pending")
    submit_after_import = models.BooleanField(default=False)
    mute_emails = models.BooleanField(default=False)
    payload_count = models.IntegerField(default=0)
    show_failed_logs = models.BooleanField(default=False)
    template_options = models.TextField(blank=True, default="")
    template_warnings = models.TextField(blank=True, default="")
    custom_delimiters = models.BooleanField(default=False)
    delimiter_options = models.CharField(max_length=100, blank=True, default="")
    use_csv_sniffer = models.BooleanField(default=False)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"Import: {self.reference_doctype} ({self.status})"


# ── DataImportLog (frappe/core/doctype/data_import_log) ───────────
class DataImportLog(models.Model):
    """Log entries for data import rows."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data_import = models.ForeignKey(DataImport, on_delete=models.CASCADE, related_name="import_logs")
    log_index = models.IntegerField(default=0)
    success = models.BooleanField(default=False)
    docname = models.CharField(max_length=255, blank=True, default="")
    messages = models.TextField(blank=True, default="")
    exception = models.TextField(blank=True, default="")
    row_indexes = models.JSONField(default=list, blank=True)
    import_action = models.CharField(max_length=20, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["log_index"]

    def __str__(self):
        return f"Log {self.log_index}: {'OK' if self.success else 'FAIL'}"


# ── DataExport (frappe/core/doctype/data_export) ──────────────────
class DataExport(models.Model):
    """Data export tracking."""
    FILE_TYPE_CHOICES = [("Excel", "Excel"), ("CSV", "CSV")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference_doctype = models.CharField(max_length=140)
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES, default="CSV")
    export_without_main_header = models.BooleanField(default=False)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"Export: {self.reference_doctype}"


# ── PreparedReport (frappe/core/doctype/prepared_report) ──────────
class PreparedReport(models.Model):
    """Background report execution."""
    STATUS_CHOICES = [
        ("Queued", "Queued"), ("Started", "Started"),
        ("Completed", "Completed"), ("Error", "Error"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_name = models.CharField(max_length=255)
    filters = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Queued")
    error_message = models.TextField(blank=True, default="")
    job_id = models.CharField(max_length=255, blank=True, default="")
    queued_by = models.CharField(max_length=140, blank=True, default="")
    queued_at = models.DateTimeField(null=True, blank=True)
    report_end_time = models.DateTimeField(null=True, blank=True)
    peak_memory_usage = models.IntegerField(default=0)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"Prepared: {self.report_name} ({self.status})"

    @classmethod
    def clear_old_logs(cls, days=30):
        cutoff = timezone.now() - timezone.timedelta(days=days)
        cls.objects.filter(creation__lt=cutoff).delete()


# ── SubmissionQueue (frappe/core/doctype/submission_queue) ────────
class SubmissionQueue(models.Model):
    """Queued document submissions."""
    STATUS_CHOICES = [
        ("Queued", "Queued"), ("Finished", "Finished"), ("Failed", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ref_doctype = models.CharField(max_length=140, blank=True, default="")
    ref_docname = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Queued")
    job_id = models.CharField(max_length=255, blank=True, default="")
    enqueued_by = models.CharField(max_length=140, blank=True, default="")
    exception = models.TextField(blank=True, default="")
    ended_at = models.DateTimeField(null=True, blank=True)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]

    def __str__(self):
        return f"Queue: {self.ref_doctype}/{self.ref_docname} ({self.status})"

    @classmethod
    def clear_old_logs(cls, days=30):
        cutoff = timezone.now() - timezone.timedelta(days=days)
        cls.objects.filter(creation__lt=cutoff).delete()


# ── Page (frappe/core/doctype/page) ───────────────────────────────
class Page(models.Model):
    """Custom desk pages."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name_display = models.CharField(max_length=140, unique=True)
    title = models.CharField(max_length=140, blank=True, default="")
    module = models.CharField(max_length=140, blank=True, default="")
    icon = models.CharField(max_length=50, blank=True, default="")
    is_restricted = models.BooleanField(default=False)
    system_page = models.BooleanField(default=False)
    _doctype = models.CharField(max_length=140, blank=True, default="")
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name_display"]

    def __str__(self):
        return self.name_display


# ── Report (frappe/core/doctype/report) ───────────────────────────
class Report(models.Model):
    """System reports."""
    REPORT_TYPE_CHOICES = [
        ("Report Builder", "Report Builder"),
        ("Script Report", "Script Report"),
        ("Query Report", "Query Report"),
        ("Custom Report", "Custom Report"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name_display = models.CharField(max_length=140, unique=True)
    report_type = models.CharField(max_length=30, choices=REPORT_TYPE_CHOICES, default="Report Builder")
    ref_doctype = models.CharField(max_length=140, blank=True, default="")
    module = models.CharField(max_length=140, blank=True, default="")
    is_standard = models.BooleanField(default=False)
    disabled = models.BooleanField(default=False)
    prepared_report = models.BooleanField(default=False)
    generate_csv = models.BooleanField(default=False)
    timeout = models.IntegerField(default=0)
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name_display"]

    def __str__(self):
        return self.name_display


# ── UserEmail (frappe/core/doctype/user_email) ────────────────────
class UserEmail(models.Model):
    """Email accounts linked to a user."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_emails_list")
    email_account = models.CharField(max_length=255)
    email_id = models.CharField(max_length=255)
    awaiting_password = models.BooleanField(default=False)
    used_oauth = models.BooleanField(default=False)

    class Meta:
        unique_together = ["user", "email_account"]

    def __str__(self):
        return f"{self.user.username}: {self.email_id}"


# ── UserSocialLogin (frappe/core/doctype/user_social_login) ───────
class UserSocialLogin(models.Model):
    """Social login provider links for a user."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="social_logins")
    provider = models.CharField(max_length=50)
    userid = models.CharField(max_length=255, blank=True, default="")
    username = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        unique_together = ["user", "provider"]

    def __str__(self):
        return f"{self.user.username}: {self.provider}"


# ── PermissionInspector (frappe/core/doctype/permission_inspector) ──
class PermissionInspector(models.Model):
    """
    Virtual doctype for debugging permissions.
    Not persisted to database - used as a form helper.
    """
    ref_doctype = models.CharField(max_length=140, blank=True, default="")
    docname = models.CharField(max_length=255, blank=True, default="")
    user = models.CharField(max_length=140, blank=True, default="")
    permission_type = models.CharField(
        max_length=20, blank=True, default="read",
        choices=[
            ("read", "read"), ("write", "write"), ("create", "create"),
            ("delete", "delete"), ("submit", "submit"), ("cancel", "cancel"),
            ("select", "select"), ("amend", "amend"), ("print", "print"),
            ("email", "email"), ("report", "report"), ("import", "import"),
            ("export", "export"), ("share", "share"),
        ],
    )
    output = models.TextField(blank=True, default="")

    class Meta:
        managed = False  # No database table

    def debug(self):
        """Run permission check and return debug output."""
        from apps.roles.permissions import _user_has_doctype_permission
        from django.contrib.auth.models import User
        try:
            user = User.objects.get(username=self.user)
        except User.DoesNotExist:
            self.output = f"User '{self.user}' not found"
            return False
        result = _user_has_doctype_permission(user, self.ref_doctype, self.permission_type)
        self.output = f"User: {self.user}\nDocType: {self.ref_doctype}\nPermission: {self.permission_type}\nResult: {result}"
        return result


# ── DocField (frappe/core/doctype/docfield) ───────────────────────
class DocField(models.Model):
    """Represents a field on a DocType."""
    FIELDTYPE_CHOICES = [
        ("Data", "Data"), ("Link", "Link"), ("Select", "Select"),
        ("Check", "Check"), ("Text", "Text"), ("Small Text", "Small Text"),
        ("Int", "Int"), ("Float", "Float"), ("Currency", "Currency"),
        ("Date", "Date"), ("Datetime", "Datetime"), ("Time", "Time"),
        ("Table", "Table"), ("HTML", "HTML"), ("Code", "Code"),
        ("Attach", "Attach"), ("Image", "Image"), ("Password", "Password"),
        ("Read Only", "Read Only"), ("Section Break", "Section Break"),
        ("Column Break", "Column Break"), ("Tab Break", "Tab Break"),
        ("Long Text", "Long Text"), ("Text Editor", "Text Editor"),
        ("Dynamic Link", "Dynamic Link"), ("Percent", "Percent"),
        ("Rating", "Rating"), ("Color", "Color"), ("Duration", "Duration"),
        ("Heading", "Heading"), ("Signature", "Signature"),
        ("Autocomplete", "Autocomplete"), ("Barcode", "Barcode"),
        ("Attach Image", "Attach Image"),
    ]

    doctype_ref = models.ForeignKey("DocType", on_delete=models.CASCADE, related_name="fields")
    fieldname = models.CharField(max_length=140, blank=True, default="")
    fieldtype = models.CharField(max_length=30, choices=FIELDTYPE_CHOICES, default="Data")
    label = models.CharField(max_length=140, blank=True, default="")
    options = models.TextField(blank=True, default="")
    default = models.TextField(blank=True, default="")
    description = models.TextField(blank=True, default="")
    reqd = models.BooleanField(default=False)
    read_only = models.BooleanField(default=False)
    hidden = models.BooleanField(default=False)
    bold = models.BooleanField(default=False)
    in_list_view = models.BooleanField(default=False)
    in_standard_filter = models.BooleanField(default=False)
    in_global_search = models.BooleanField(default=False)
    unique = models.BooleanField(default=False)
    no_copy = models.BooleanField(default=False)
    set_only_once = models.BooleanField(default=False)
    allow_in_quick_entry = models.BooleanField(default=False)
    allow_on_submit = models.BooleanField(default=False)
    translatable = models.BooleanField(default=False)
    is_virtual = models.BooleanField(default=False)
    permlevel = models.IntegerField(default=0)
    depends_on = models.TextField(blank=True, default="")
    mandatory_depends_on = models.TextField(blank=True, default="")
    collapsible = models.BooleanField(default=False)
    fetch_from = models.TextField(blank=True, default="")
    fetch_if_empty = models.BooleanField(default=False)
    precision = models.CharField(max_length=5, blank=True, default="")
    length = models.IntegerField(default=0)
    columns = models.IntegerField(default=0)
    search_index = models.BooleanField(default=False)
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["doctype_ref", "fieldname"]
        verbose_name = "Doc Field"
        verbose_name_plural = "Doc Fields"

    def __str__(self):
        return f"{self.fieldname} ({self.fieldtype})"


# ── DocTypeLink (frappe/core/doctype/doctype_link) ────────────────
class DocTypeLink(models.Model):
    """Links from one DocType to another."""
    doctype_ref = models.ForeignKey("DocType", on_delete=models.CASCADE, related_name="links")
    link_doctype = models.CharField(max_length=140)
    link_fieldname = models.CharField(max_length=140, blank=True, default="")
    parent_doctype = models.CharField(max_length=140, blank=True, default="")
    table_fieldname = models.CharField(max_length=140, blank=True, default="")
    group = models.CharField(max_length=140, blank=True, default="")
    hidden = models.BooleanField(default=False)
    custom = models.BooleanField(default=False)
    is_child_table = models.BooleanField(default=False)
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["doctype_ref"]
        verbose_name = "Doc Type Link"
        verbose_name_plural = "Doc Type Links"

    def __str__(self):
        return f"{self.doctype_ref.name} -> {self.link_doctype}"


# ── DocTypeAction (frappe/core/doctype/doctype_action) ────────────
class DocTypeAction(models.Model):
    """Actions on a DocType form."""
    ACTION_TYPE_CHOICES = [("Server Action", "Server Action"), ("Route", "Route")]
    doctype_ref = models.ForeignKey("DocType", on_delete=models.CASCADE, related_name="actions")
    label = models.CharField(max_length=140)
    action_type = models.CharField(max_length=20, choices=ACTION_TYPE_CHOICES, default="Server Action")
    action = models.TextField(blank=True, default="")
    group = models.CharField(max_length=140, blank=True, default="")
    hidden = models.BooleanField(default=False)
    custom = models.BooleanField(default=False)
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["doctype_ref", "label"]
        verbose_name = "Doc Type Action"
        verbose_name_plural = "Doc Type Actions"

    def __str__(self):
        return f"{self.doctype_ref.name}: {self.label}"


# ── DocTypeState (frappe/core/doctype/doctype_state) ──────────────
class DocTypeState(models.Model):
    """Workflow states for a DocType."""
    COLOR_CHOICES = [
        ("Blue", "Blue"), ("Cyan", "Cyan"), ("Gray", "Gray"),
        ("Green", "Green"), ("Light Blue", "Light Blue"),
        ("Orange", "Orange"), ("Pink", "Pink"), ("Purple", "Purple"),
        ("Red", "Red"), ("Yellow", "Yellow"),
    ]
    doctype_ref = models.ForeignKey("DocType", on_delete=models.CASCADE, related_name="states")
    title = models.CharField(max_length=140)
    color = models.CharField(max_length=20, choices=COLOR_CHOICES, default="Blue")
    custom = models.BooleanField(default=False)
    creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["doctype_ref", "title"]
        verbose_name = "Doc Type State"
        verbose_name_plural = "Doc Type States"

    def __str__(self):
        return f"{self.doctype_ref.name}: {self.title}"


# ── WorkflowState (frappe/workflow/doctype/workflow_state) ──────────
class WorkflowState(models.Model):
    """
    Named states a workflow document can be in.
    Mirrors Frappe's Workflow State.
    """
    STYLE_CHOICES = [
        ("", ""), ("Primary", "Primary"), ("Info", "Info"),
        ("Success", "Success"), ("Warning", "Warning"),
        ("Danger", "Danger"), ("Inverse", "Inverse"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow_state_name = models.CharField(max_length=140, unique=True)
    icon = models.CharField(max_length=50, blank=True, default="")
    style = models.CharField(max_length=20, choices=STYLE_CHOICES, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["workflow_state_name"]
        verbose_name = "Workflow State"
        verbose_name_plural = "Workflow States"

    def __str__(self):
        return self.workflow_state_name


# ── Workflow (frappe/workflow/doctype/workflow) ─────────────────────
class Workflow(models.Model):
    """
    Defines an approval workflow for a DocType.
    Mirrors Frappe's Workflow: states, transitions, and document state mapping.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow_name = models.CharField(max_length=140, unique=True)
    document_type = models.CharField(
        max_length=140,
        help_text="DocType this workflow applies to",
    )
    workflow_state_field = models.CharField(
        max_length=140, default="workflow_state",
        help_text="Field name on the DocType that holds the workflow state",
    )
    is_active = models.BooleanField(default=True)
    override_status = models.BooleanField(
        default=False,
        help_text="Override document status with workflow state",
    )
    send_email_alert = models.BooleanField(
        default=True,
        help_text="Send email alerts on state transitions",
    )
    workflow_data = models.JSONField(null=True, blank=True)
    owner = models.CharField(max_length=140, blank=True, default="Administrator")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["workflow_name"]

    def __str__(self):
        return self.workflow_name

    def set_active(self):
        """Deactivate other workflows for the same DocType when this one is active."""
        if self.is_active:
            Workflow.objects.filter(
                document_type=self.document_type, is_active=True
            ).exclude(pk=self.pk).update(is_active=False)

    def save(self, *args, **kwargs):
        self.set_active()
        super().save(*args, **kwargs)


class WorkflowDocumentState(models.Model):
    """
    Child table: maps workflow states to document statuses.
    Mirrors Frappe's Workflow Document State.
    """
    DOC_STATUS_CHOICES = [("0", "Draft"), ("1", "Submitted"), ("2", "Cancelled")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name="states")
    state = models.ForeignKey(WorkflowState, on_delete=models.CASCADE, related_name="workflow_states")
    doc_status = models.CharField(max_length=1, choices=DOC_STATUS_CHOICES, default="0")
    allow_edit = models.CharField(max_length=140, blank=True, default="")
    is_optional_state = models.BooleanField(default=False)
    avoid_status_override = models.BooleanField(default=False)
    send_email = models.BooleanField(default=False)
    message = models.TextField(blank=True, default="")
    next_action_email_template = models.CharField(max_length=140, blank=True, default="")
    evaluate_as_expression = models.BooleanField(default=False)
    update_field = models.CharField(max_length=140, blank=True, default="")
    update_value = models.CharField(max_length=255, blank=True, default="")
    workflow_builder_id = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        ordering = ["workflow", "doc_status"]

    def __str__(self):
        return f"{self.workflow.workflow_name}: {self.state.workflow_state_name} (DocStatus {self.doc_status})"


class WorkflowTransition(models.Model):
    """
    Child table: defines allowed transitions between states.
    Mirrors Frappe's Workflow Transition.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name="transitions")
    state = models.ForeignKey(WorkflowState, on_delete=models.CASCADE, related_name="from_transitions")
    action = models.CharField(max_length=140, help_text="Button label, e.g. Approve, Reject")
    next_state = models.ForeignKey(WorkflowState, on_delete=models.CASCADE, related_name="to_transitions")
    allowed = models.CharField(
        max_length=140,
        help_text="Role name allowed to perform this transition",
    )
    allow_self_approval = models.BooleanField(default=False)
    send_email_to_creator = models.BooleanField(default=False)
    condition = models.TextField(
        blank=True, default="",
        help_text="Python expression evaluated to determine if transition is allowed",
    )
    transition_tasks = models.CharField(max_length=140, blank=True, default="")
    workflow_builder_id = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        ordering = ["workflow", "state"]

    def __str__(self):
        return f"{self.state.workflow_state_name} -> {self.action} -> {self.next_state.workflow_state_name}"


class WorkflowActionPermittedRole(models.Model):
    """
    Child table: roles permitted to perform a workflow action.
    Mirrors Frappe's Workflow Action Permitted Role.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow_action = models.ForeignKey("WorkflowAction", on_delete=models.CASCADE, related_name="permitted_roles")
    role = models.CharField(max_length=140)

    class Meta:
        unique_together = ["workflow_action", "role"]

    def __str__(self):
        return f"{self.workflow_action} -> {self.role}"


class WorkflowAction(models.Model):
    """
    Pending workflow actions waiting for user approval.
    Mirrors Frappe's Workflow Action.
    """
    STATUS_CHOICES = [("Open", "Open"), ("Completed", "Completed")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=255, blank=True, default="")
    workflow_state = models.CharField(max_length=140, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Open")
    user = models.CharField(max_length=140, blank=True, default="")
    completed_by = models.CharField(max_length=140, blank=True, default="")
    completed_by_role = models.CharField(max_length=140, blank=True, default="")
    owner = models.CharField(max_length=140, blank=True, default="")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creation"]
        indexes = [
            models.Index(fields=["reference_name", "reference_doctype", "status"]),
        ]

    def __str__(self):
        return f"Action: {self.reference_doctype}/{self.reference_name} [{self.status}]"


# ── EmailTemplate (frappe/email/doctype/email_template) ────────────
class EmailTemplate(models.Model):
    """
    Email templates for system notifications, workflow alerts, and communications.
    Mirrors Frappe's Email Template with Jinja2 template support.
    """
    CATEGORY_CHOICES = [
        ("Workflow", "Workflow"),
        ("Notification", "Notification"),
        ("System", "System"),
        ("Onboarding", "Onboarding"),
        ("Custom", "Custom"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name_template = models.CharField(max_length=255, unique=True, help_text="Template name")
    subject = models.CharField(max_length=500, help_text="Subject line (supports Jinja2)")
    reference_doctype = models.CharField(max_length=140, blank=True, default="", help_text="DocType this template is for")
    use_html = models.BooleanField(default=True, help_text="Use HTML response instead of plain text")
    response_html = models.TextField(blank=True, default="", help_text="HTML response body (supports Jinja2)")
    response = models.TextField(blank=True, default="", help_text="Plain text response body (supports Jinja2)")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="Custom")
    enabled = models.BooleanField(default=True)
    description = models.TextField(blank=True, default="")
    owner = models.CharField(max_length=140, blank=True, default="Administrator")
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "name_template"]
        verbose_name = "Email Template"
        verbose_name_plural = "Email Templates"

    def __str__(self):
        return self.name_template

    @property
    def response_(self):
        """Return the active response body (HTML or plain text)."""
        return self.response_html if self.use_html else self.response

    def get_formatted_subject(self, doc=None):
        """Render subject with Jinja2 template engine."""
        if not doc:
            return self.subject
        try:
            from django.template import Template, Context
            t = Template(self.subject)
            return t.render(Context(doc) if isinstance(doc, dict) else Context({"doc": doc}))
        except Exception:
            return self.subject

    def get_formatted_response(self, doc=None):
        """Render response body with Jinja2 template engine."""
        body = self.response_
        if not doc or not body:
            return body
        try:
            from django.template import Template, Context
            t = Template(body)
            return t.render(Context(doc) if isinstance(doc, dict) else Context({"doc": doc}))
        except Exception:
            return body

    def get_formatted_email(self, doc=None):
        """Return complete email dict with rendered subject and body."""
        return {
            "subject": self.get_formatted_subject(doc),
            "message": self.get_formatted_response(doc),
        }


# ── NotificationSetting ──────────────────────────────────────────

class NotificationSetting(models.Model):
    """
    Configures which events generate notifications and who receives them.
    Mirrors Frappe's Notification Settings doctype.
    Each row = one event type with its channels and recipients.
    """
    EVENT_CHOICES = [
        # Healthcare & Clinical Events
        ("patient_appointment_created", "Patient Appointment Scheduled"),
        ("patient_appointment_cancelled", "Patient Appointment Cancelled"),
        ("lab_test_ordered", "Lab Test Ordered"),
        ("lab_test_approved", "Lab Test Approved"),
        ("prescription_created", "Drug Prescription Issued"),
        ("inpatient_admission", "Inpatient Admitted"),
        ("inpatient_discharge", "Inpatient Discharged"),
        ("vital_signs_alert", "Abnormal Vital Signs Recorded"),
        ("pharmacy_dispensed", "Medication Dispensed"),
        ("medical_leave_created", "Medical Leave Issued"),
        ("low_stock_alert", "Pharmacy Low Stock Alert"),
        # Clinical Workflow & Collaboration
        ("workflow_approved", "Clinical Workflow Approved"),
        ("workflow_rejected", "Clinical Workflow Rejected"),
        ("workflow_action", "Clinical Workflow Action Assigned"),
        ("comment_added", "Clinical Note / Comment Added"),
        ("communication_received", "Patient Communication Received"),
        ("document_shared", "Medical Document Shared"),
        # System & Security
        ("error_log_created", "System Error Log Created"),
        ("system_error", "Clinical System Error"),
        ("user_created", "New Healthcare Staff User"),
        ("password_changed", "Staff Password Changed"),
        ("scheduled_job_failure", "Scheduled Healthcare Job Failure"),
    ]

    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("dashboard", "Dashboard"),
        ("system", "System Notification"),
    ]

    RECIPIENT_CHOICES = [
        ("owner", "Document Owner"),
        ("roles", "Specific Roles"),
        ("users", "Specific Users"),
        ("all", "All Users"),
        ("system_managers", "System Managers"),
    ]

    event = models.CharField(
        max_length=50, choices=EVENT_CHOICES, unique=True,
        help_text="The event that triggers this notification",
    )
    enabled = models.BooleanField(
        default=True,
        help_text="Enable or disable this notification",
    )

    # Channels
    send_email = models.BooleanField(
        default=True,
        help_text="Send email notification",
    )
    send_dashboard = models.BooleanField(
        default=True,
        help_text="Show in dashboard notification panel",
    )
    send_system = models.BooleanField(
        default=False,
        help_text="Show system-level notification",
    )

    # Recipients
    recipient_type = models.CharField(
        max_length=30, choices=RECIPIENT_CHOICES, default="roles",
        help_text="Who receives this notification",
    )
    # Store as JSON arrays since M2M is overkill for this
    recipient_roles = models.JSONField(
        default=list, blank=True,
        help_text='List of role names, e.g. ["Healthcare Administrator", "Physician"]',
    )
    recipient_users = models.JSONField(
        default=list, blank=True,
        help_text='List of usernames, e.g. ["admin", "dr_smith"]',
    )

    # DocType association (optional)
    reference_doctype = models.CharField(
        max_length=140, blank=True, default="",
        help_text="Limit this notification to a specific DocType",
    )

    # Message template
    subject_template = models.CharField(
        max_length=255, blank=True, default="",
        help_text="Email subject template (Jinja2)",
    )
    message_template = models.TextField(
        blank=True, default="",
        help_text="Email message template (Jinja2)",
    )

    # Metadata
    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    owner = models.CharField(max_length=140, blank=True, default="Administrator")

    class Meta:
        ordering = ["event"]
        verbose_name = "Notification Setting"
        verbose_name_plural = "Notification Settings"

    def __str__(self):
        return f"{self.get_event_display()} ({'enabled' if self.enabled else 'disabled'})"

    @classmethod
    def load_defaults(cls):
        """Create default settings for healthcare event types if they don't exist."""
        role_map = {
            "patient_appointment_created": ["Receptionist", "Physician", "Healthcare Administrator"],
            "patient_appointment_cancelled": ["Receptionist", "Physician", "Healthcare Administrator"],
            "lab_test_ordered": ["Lab Technician", "Healthcare Administrator"],
            "lab_test_approved": ["Physician", "Nurse", "Healthcare Administrator"],
            "prescription_created": ["Pharmacist", "Healthcare Administrator"],
            "inpatient_admission": ["Nurse", "Physician", "Healthcare Administrator"],
            "inpatient_discharge": ["Nurse", "Physician", "Healthcare Administrator"],
            "vital_signs_alert": ["Physician", "Nurse"],
            "pharmacy_dispensed": ["Pharmacist", "Healthcare Administrator"],
            "low_stock_alert": ["Pharmacist", "Healthcare Administrator"],
            "medical_leave_created": ["Healthcare Administrator", "Physician"],
        }
        for event_code, event_label in cls.EVENT_CHOICES:
            roles = role_map.get(event_code, ["Healthcare Administrator", "System Manager"])
            cls.objects.get_or_create(
                event=event_code,
                defaults={
                    "enabled": True,
                    "send_email": True,
                    "send_dashboard": True,
                    "send_system": False,
                    "recipient_type": "roles",
                    "recipient_roles": roles,
                },
            )


# ── NotificationDelivery ─────────────────────────────────────────

class NotificationDelivery(models.Model):
    """
    Tracks each notification sent to a user.
    Mirrors Frappe's Notification Log.
    """
    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("dashboard", "Dashboard"),
        ("system", "System"),
    ]
    STATUS_CHOICES = [
        ("sent", "Sent"),
        ("delivered", "Delivered"),
        ("read", "Read"),
        ("failed", "Failed"),
    ]

    event = models.CharField(
        max_length=50,
        help_text="Event code that triggered this notification",
    )
    subject = models.CharField(max_length=255, blank=True, default="")
    message = models.TextField(blank=True, default="")
    channel = models.CharField(
        max_length=20, choices=CHANNEL_CHOICES, default="dashboard",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="sent",
    )

    # Recipient
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_deliveries",
    )
    recipient_name = models.CharField(
        max_length=140, blank=True, default="",
        help_text="Denormalized username for quick display",
    )

    # Source reference
    reference_doctype = models.CharField(max_length=140, blank=True, default="")
    reference_name = models.CharField(max_length=255, blank=True, default="")
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="triggered_notifications",
    )

    # Email tracking
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    creation = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-creation"]
        verbose_name = "Notification Delivery"
        verbose_name_plural = "Notification Deliveries"

    def __str__(self):
        return f"{self.event} -> {self.recipient_name} ({self.channel}) [{self.status}]"

    def mark_read(self):
        from django.utils import timezone
        self.status = "read"
        self.read_at = timezone.now()
        self.save(update_fields=["status", "read_at"])

    @classmethod
    def clear_old(cls, days=90):
        from django.utils import timezone
        cutoff = timezone.now() - timezone.timedelta(days=days)
        cls.objects.filter(creation__lt=cutoff).delete()


# ── UserNotificationSetting ─────────────────────────────────────

class UserNotificationSetting(models.Model):
    """
    Per-user notification preferences.
    Each row = one user's preference for one event type.
    When set, overrides the global NotificationSetting for that user.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_settings",
    )
    event = models.CharField(
        max_length=50,
        help_text="Event code (same as NotificationSetting.event)",
    )

    # Override flags — null means "use global setting"
    enabled = models.BooleanField(
        null=True, blank=True, default=None,
        help_text="null = use global, true/false = override",
    )
    send_email = models.BooleanField(null=True, blank=True, default=None)
    send_dashboard = models.BooleanField(null=True, blank=True, default=None)
    send_system = models.BooleanField(null=True, blank=True, default=None)

    # Mute period (Frappe-style)
    mute_until = models.DateTimeField(
        null=True, blank=True, default=None,
        help_text="Mute all notifications until this time",
    )

    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["user", "event"]
        ordering = ["user", "event"]
        verbose_name = "User Notification Setting"
        verbose_name_plural = "User Notification Settings"

    def __str__(self):
        return f"{self.user.username}: {self.event} (enabled={self.enabled})"

    @classmethod
    def get_effective(cls, user, event):
        """
        Return the effective (resolved) setting for a user+event.
        Falls back to the global NotificationSetting if no user override exists.
        Returns a dict: {enabled, send_email, send_dashboard, send_system, muted}.
        """
        from django.utils import timezone

        # Check user-level override
        try:
            user_setting = cls.objects.get(user=user, event=event)
        except cls.DoesNotExist:
            user_setting = None

        # Check mute
        if user_setting and user_setting.mute_until:
            if timezone.now() < user_setting.mute_until:
                return {
                    "enabled": False,
                    "send_email": False,
                    "send_dashboard": False,
                    "send_system": False,
                    "muted": True,
                    "mute_until": user_setting.mute_until,
                }

        # Get global setting
        try:
            global_setting = NotificationSetting.objects.get(event=event)
        except NotificationSetting.DoesNotExist:
            return {
                "enabled": False,
                "send_email": False,
                "send_dashboard": False,
                "send_system": False,
                "muted": False,
            }

        # Resolve: user override takes priority, then global
        def resolve(user_val, global_val, default=False):
            if user_val is not None:
                return user_val
            return global_val if global_val is not None else default

        us = user_setting
        return {
            "enabled": resolve(
                us.enabled if us else None,
                global_setting.enabled,
            ) if us else global_setting.enabled,
            "send_email": resolve(
                us.send_email if us else None,
                global_setting.send_email,
            ) if us else global_setting.send_email,
            "send_dashboard": resolve(
                us.send_dashboard if us else None,
                global_setting.send_dashboard,
            ) if us else global_setting.send_dashboard,
            "send_system": resolve(
                us.send_system if us else None,
                global_setting.send_system,
            ) if us else global_setting.send_system,
            "muted": False,
        }


# ── EmailAccount ──────────────────────────────────────────────────

class EmailAccount(models.Model):
    """
    Configurable email account for sending notifications.
    Mirrors Frappe's Email Account doctype.
    Supports multiple SMTP accounts (e.g., noreply, support, billing).
    """
    email_account_name = models.CharField(
        max_length=140, unique=True,
        help_text="Unique name for this email account",
    )
    email_id = models.EmailField(
        help_text="Email address (e.g., noreply@company.com)",
    )
    email_sender_name = models.CharField(
        max_length=140, blank=True, default="",
        help_text="Display name for outgoing emails",
    )

    # SMTP settings
    smtp_server = models.CharField(
        max_length=255, blank=True, default="",
        help_text="SMTP server (e.g., smtp.gmail.com)",
    )
    smtp_port = models.IntegerField(
        default=587,
        help_text="SMTP port (587 for TLS, 465 for SSL)",
    )
    smtp_username = models.CharField(
        max_length=255, blank=True, default="",
    )
    smtp_password = models.CharField(
        max_length=255, blank=True, default="",
        help_text="Stored encrypted in production",
    )
    use_tls = models.BooleanField(
        default=True,
        help_text="Use STARTTLS (port 587)",
    )
    use_ssl = models.BooleanField(
        default=False,
        help_text="Use SSL (port 465)",
    )

    # IMAP settings (for receiving)
    incoming_server = models.CharField(
        max_length=255, blank=True, default="",
    )
    incoming_port = models.IntegerField(default=993)
    use_imap = models.BooleanField(default=False)

    # Defaults
    default_incoming = models.BooleanField(
        default=False,
        help_text="Use as default incoming email account",
    )
    default_outgoing = models.BooleanField(
        default=False,
        help_text="Use as default outgoing email account",
    )

    # Status
    enable_outgoing = models.BooleanField(
        default=True,
        help_text="Enable sending emails from this account",
    )
    enable_incoming = models.BooleanField(default=False)
    anonymized = models.BooleanField(
        default=False,
        help_text="Anonymize email headers",
    )
    always_use_account_name = models.BooleanField(
        default=False,
        help_text="Always use account email address as sender",
    )

    # BCC
    bcc_address = models.EmailField(
        blank=True, default="",
        help_text="Blind carbon copy address",
    )
    footer = models.TextField(
        blank=True, default="",
        help_text="Email footer (HTML)",
    )
    footer_included = models.BooleanField(default=False)

    creation = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    owner = models.CharField(max_length=140, blank=True, default="Administrator")

    class Meta:
        ordering = ["-default_outgoing", "email_account_name"]
        verbose_name = "Email Account"
        verbose_name_plural = "Email Accounts"

    def __str__(self):
        return f"{self.email_account_name} <{self.email_id}>"

    def get_smtp_connection(self):
        """Return a Django email SMTP backend configured with this account's settings."""
        from django.core.mail.backends.smtp import EmailBackend
        return EmailBackend(
            host=self.smtp_server or None,
            port=self.smtp_port,
            username=self.smtp_username or None,
            password=self.smtp_password or None,
            use_tls=self.use_tls,
            use_ssl=self.use_ssl,
        )

    def send_email(self, subject, message, recipient_list, html_message=None,
                   cc=None, bcc=None, attachments=None):
        """
        Send an email using this account's SMTP settings.
        Falls back to Django's DEFAULT_FROM_EMAIL if no account is configured.
        Returns True on success, False on failure.
        """
        from django.core.mail import send_mail, EmailMultiAlternatives
        from django.conf import settings

        from_email = f"{self.email_sender_name} <{self.email_id}>" if self.email_sender_name else self.email_id
        all_recipients = list(recipient_list or [])

        # Add BCC
        bcc_list = []
        if bcc:
            bcc_list = [bcc]
        elif self.bcc_address:
            bcc_list = [self.bcc_address]

        try:
            if html_message:
                # Use EmailMultiAlternatives for HTML emails
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=message,
                    from_email=from_email,
                    to=all_recipients,
                    cc=cc or [],
                    bcc=bcc_list,
                )
                msg.attach_alternative(html_message, "text/html")
                if self.footer and self.footer_included:
                    msg.attach_alternative(
                        f"{html_message}<hr><small>{self.footer}</small>",
                        "text/html",
                    )
                # Use account-specific SMTP if configured
                if self.smtp_server:
                    backend = self.get_smtp_connection()
                    msg.connection = backend
                msg.send(fail_silently=False)
            else:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=from_email,
                    recipient_list=all_recipients,
                    fail_silently=False,
                    **({"connection": self.get_smtp_connection()} if self.smtp_server else {}),
                )
            return True
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to send email via {self.email_account_name}: {e}")
            return False

    @classmethod
    def get_default_outgoing(cls):
        """Return the default outgoing email account, or None."""
        return cls.objects.filter(enable_outgoing=True, default_outgoing=True).first() or \
               cls.objects.filter(enable_outgoing=True).first()

    @classmethod
    def get_default_incoming(cls):
        """Return the default incoming email account, or None."""
        return cls.objects.filter(enable_incoming=True, default_incoming=True).first() or \
               cls.objects.filter(enable_incoming=True).first()
