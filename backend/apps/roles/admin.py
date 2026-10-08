from django.contrib import admin

from .models import (
    AccessLog,
    ActivityLog,
    APIRequestLog,
    AuditTrail,
    Comment,
    Communication,
    CommunicationLink,
    CustomDocPerm,
    CustomRole,
    DataExport,
    DataImport,
    DataImportLog,
    DeletedDocument,
    DocField,
    DocPerm,
    DocShare,
    DocType,
    DocTypeAction,
    DocTypeLink,
    DocTypeState,
    DocumentNamingRule,
    ErrorLog,
    HasRole,
    Page,
    PermissionLog,
    PreparedReport,
    Report,
    Role,
    RolePermissionForPageAndReport,
    RoleProfile,
    RoleProfileRole,
    ScheduledJobLog,
    ScheduledJobType,
    SecuritySettings,
    ServerScript,
    SubmissionQueue,
    UserEmail,
    UserGroup,
    UserGroupMember,
    UserInvitation,
    UserPermission,
    UserSocialLogin,
    UserRole,
    UserRoleProfile,
    Version,
    ViewLog,
)


class DocPermInline(admin.TabularInline):
    model = DocPerm
    extra = 0
    fields = [
        "role", "permlevel", "if_owner",
        "select", "read", "write", "create", "delete",
        "submit", "cancel", "amend", "report", "export",
        "print", "email", "share",
    ]


class CustomDocPermInline(admin.TabularInline):
    model = CustomDocPerm
    extra = 0
    fields = [
        "role", "permlevel", "if_owner",
        "select", "read", "write", "create", "delete",
        "submit", "cancel", "amend", "report", "export",
        "print", "email", "share",
    ]


class HasRoleInline(admin.TabularInline):
    model = HasRole
    extra = 0
    autocomplete_fields = ["role"]


class UserRoleInline(admin.TabularInline):
    model = UserRole
    extra = 0
    autocomplete_fields = ["role"]


class RoleProfileRoleInline(admin.TabularInline):
    model = RoleProfileRole
    extra = 0
    autocomplete_fields = ["role"]


class UserRoleProfileInline(admin.TabularInline):
    model = UserRoleProfile
    extra = 0
    autocomplete_fields = ["role_profile"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = [
        "name", "desk_access", "disabled", "is_custom",
        "two_factor_auth", "is_system_role", "is_active",
    ]
    list_filter = ["disabled", "desk_access", "is_custom", "is_system_role", "is_active"]
    search_fields = ["name", "role_name", "description"]
    inlines = [HasRoleInline, UserRoleInline]
    readonly_fields = ["creation", "modified"]


@admin.register(DocType)
class DocTypeAdmin(admin.ModelAdmin):
    list_display = ["name", "module", "is_submittable", "is_active"]
    list_filter = ["module", "is_submittable", "is_active"]
    search_fields = ["name", "module"]
    inlines = [DocPermInline, CustomDocPermInline]


@admin.register(DocPerm)
class DocPermAdmin(admin.ModelAdmin):
    list_display = [
        "doctype_ref", "role", "permlevel", "if_owner",
        "read", "write", "create", "delete",
    ]
    list_filter = ["role", "permlevel", "doctype_ref__module"]
    search_fields = ["doctype_ref__name", "role__name"]
    autocomplete_fields = ["doctype_ref", "role"]


@admin.register(CustomDocPerm)
class CustomDocPermAdmin(admin.ModelAdmin):
    list_display = [
        "doctype_ref", "role", "permlevel", "if_owner", "is_app_disabled",
        "read", "write", "create", "delete",
    ]
    list_filter = ["role", "permlevel"]
    search_fields = ["doctype_ref__name", "role__name"]
    autocomplete_fields = ["doctype_ref", "role"]


@admin.register(HasRole)
class HasRoleAdmin(admin.ModelAdmin):
    list_display = ["user", "role", "creation"]
    list_filter = ["role"]
    search_fields = ["user__username", "user__email"]
    autocomplete_fields = ["user", "role"]


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ["user", "role", "creation"]
    list_filter = ["role"]
    search_fields = ["user__username", "user__email"]
    autocomplete_fields = ["user", "role"]


@admin.register(RoleProfile)
class RoleProfileAdmin(admin.ModelAdmin):
    list_display = ["role_profile", "owner", "creation"]
    search_fields = ["role_profile"]
    inlines = [RoleProfileRoleInline, UserRoleProfileInline]


@admin.register(UserRoleProfile)
class UserRoleProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "role_profile", "creation"]
    search_fields = ["user__username"]
    autocomplete_fields = ["user", "role_profile"]


@admin.register(UserPermission)
class UserPermissionAdmin(admin.ModelAdmin):
    list_display = [
        "user", "allow", "for_value", "is_default",
        "apply_to_all_doctypes", "applicable_for",
    ]
    list_filter = ["allow", "is_default"]
    search_fields = ["user__username", "allow", "for_value"]
    autocomplete_fields = ["user"]


@admin.register(DocShare)
class DocShareAdmin(admin.ModelAdmin):
    list_display = [
        "user", "everyone", "share_doctype", "share_name",
        "read", "write", "submit", "share",
    ]
    list_filter = ["share_doctype", "everyone"]
    search_fields = ["share_doctype", "share_name"]
    autocomplete_fields = ["user"]


@admin.register(AccessLog)
class AccessLogAdmin(admin.ModelAdmin):
    list_display = ["user", "export_from", "method", "file_type", "timestamp"]
    list_filter = ["method", "file_type"]
    search_fields = ["export_from", "report_name"]
    readonly_fields = ["timestamp"]
    date_hierarchy = "timestamp"


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = [
        "subject", "user", "operation", "status",
        "ip_address", "creation",
    ]
    list_filter = ["operation", "status"]
    search_fields = ["subject", "full_name"]
    date_hierarchy = "creation"


@admin.register(APIRequestLog)
class APIRequestLogAdmin(admin.ModelAdmin):
    list_display = ["path", "method", "user", "status_code", "duration_ms", "creation"]
    list_filter = ["method", "status_code"]
    search_fields = ["path"]
    date_hierarchy = "creation"


@admin.register(PermissionLog)
class PermissionLogAdmin(admin.ModelAdmin):
    list_display = [
        "changed_by", "for_doctype", "for_document", "status", "creation",
    ]
    list_filter = ["for_doctype", "status"]
    search_fields = ["for_doctype", "for_document"]
    date_hierarchy = "creation"


@admin.register(AuditTrail)
class AuditTrailAdmin(admin.ModelAdmin):
    list_display = ["doctype_name", "document", "start_date", "end_date", "creation"]
    search_fields = ["doctype_name", "document"]
    date_hierarchy = "creation"


@admin.register(SecuritySettings)
class SecuritySettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not SecuritySettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    fieldsets = (
        ("Password Policy", {
            "fields": (
                "enable_password_policy", "minimum_password_score",
                "password_reset_link_expiry_duration", "logout_on_password_reset",
            ),
        }),
        ("Login Settings", {
            "fields": (
                "allow_login_using_mobile_number", "allow_login_using_user_name",
                "max_signups_per_minute", "max_login_attempts",
            ),
        }),
        ("Session", {
            "fields": (
                "session_expiry", "session_expiry_mobile",
                "allow_all_sessions",
            ),
        }),
        ("Two-Factor Auth", {
            "fields": ("enable_two_factor_auth", "two_factor_method"),
        }),
        ("IP Restriction", {
            "fields": ("restrict_ip_list",),
        }),
    )


# ═══════════════════════════════════════════════════════════════════
#  CORE DOCTYPE ADMIN REGISTRATIONS
# ═══════════════════════════════════════════════════════════════════


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["comment_type", "subject", "comment_email", "reference_doctype", "reference_name", "creation"]
    list_filter = ["comment_type", "reference_doctype", "published"]
    search_fields = ["content", "subject", "comment_email"]
    date_hierarchy = "creation"
    readonly_fields = ["creation", "modified"]


@admin.register(Communication)
class CommunicationAdmin(admin.ModelAdmin):
    list_display = [
        "subject", "communication_medium", "communication_type",
        "status", "sent_or_received", "sender", "user", "communication_date",
    ]
    list_filter = ["communication_medium", "communication_type", "status", "sent_or_received"]
    search_fields = ["subject", "content", "sender", "recipients"]
    date_hierarchy = "communication_date"
    readonly_fields = ["creation", "modified"]


@admin.register(CommunicationLink)
class CommunicationLinkAdmin(admin.ModelAdmin):
    list_display = ["communication", "link_doctype", "link_name", "link_title"]
    search_fields = ["link_doctype", "link_name"]


@admin.register(ErrorLog)
class ErrorLogAdmin(admin.ModelAdmin):
    list_display = ["method", "reference_doctype", "seen", "fingerprint", "creation"]
    list_filter = ["seen", "reference_doctype"]
    search_fields = ["method", "error"]
    date_hierarchy = "creation"


@admin.register(Version)
class VersionAdmin(admin.ModelAdmin):
    list_display = ["ref_doctype", "docname", "owner", "creation"]
    list_filter = ["ref_doctype"]
    search_fields = ["ref_doctype", "docname"]
    date_hierarchy = "creation"


@admin.register(ViewLog)
class ViewLogAdmin(admin.ModelAdmin):
    list_display = ["reference_doctype", "reference_name", "viewed_by", "creation"]
    list_filter = ["reference_doctype"]
    date_hierarchy = "creation"


@admin.register(DeletedDocument)
class DeletedDocumentAdmin(admin.ModelAdmin):
    list_display = ["deleted_doctype", "deleted_name", "restored", "creation"]
    list_filter = ["deleted_doctype", "restored"]
    date_hierarchy = "creation"


@admin.register(DocumentNamingRule)
class DocumentNamingRuleAdmin(admin.ModelAdmin):
    list_display = ["document_type", "prefix", "prefix_digits", "counter", "disabled"]
    list_filter = ["document_type", "disabled"]
    search_fields = ["document_type", "prefix"]


@admin.register(CustomRole)
class CustomRoleAdmin(admin.ModelAdmin):
    list_display = ["page", "report", "ref_doctype", "owner"]
    search_fields = ["page", "report"]


@admin.register(RolePermissionForPageAndReport)
class RolePermissionForPageAndReportAdmin(admin.ModelAdmin):
    list_display = ["set_role_for", "page", "report", "enable_prepared_report"]
    list_filter = ["set_role_for"]
    search_fields = ["page", "report"]


@admin.register(ScheduledJobType)
class ScheduledJobTypeAdmin(admin.ModelAdmin):
    list_display = ["method", "frequency", "queue", "stopped", "last_execution"]
    list_filter = ["frequency", "stopped", "queue"]
    search_fields = ["method"]
    date_hierarchy = "last_execution"


@admin.register(ScheduledJobLog)
class ScheduledJobLogAdmin(admin.ModelAdmin):
    list_display = ["scheduled_job_type", "status", "creation"]
    list_filter = ["status"]
    date_hierarchy = "creation"


@admin.register(ServerScript)
class ServerScriptAdmin(admin.ModelAdmin):
    list_display = ["name_display", "script_type", "reference_doctype", "disabled"]
    list_filter = ["script_type", "disabled"]
    search_fields = ["name_display"]


@admin.register(DataImport)
class DataImportAdmin(admin.ModelAdmin):
    list_display = ["reference_doctype", "import_type", "status", "payload_count"]
    list_filter = ["reference_doctype", "status", "import_type"]
    date_hierarchy = "creation"


@admin.register(DataExport)
class DataExportAdmin(admin.ModelAdmin):
    list_display = ["reference_doctype", "file_type"]
    list_filter = ["reference_doctype", "file_type"]


@admin.register(PreparedReport)
class PreparedReportAdmin(admin.ModelAdmin):
    list_display = ["report_name", "status", "queued_at", "report_end_time"]
    list_filter = ["report_name", "status"]
    date_hierarchy = "queued_at"


@admin.register(SubmissionQueue)
class SubmissionQueueAdmin(admin.ModelAdmin):
    list_display = ["ref_doctype", "ref_docname", "status", "job_id"]
    list_filter = ["ref_doctype", "status"]
    date_hierarchy = "creation"


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ["name_display", "title", "module", "is_restricted"]
    list_filter = ["module", "is_restricted", "system_page"]
    search_fields = ["name_display", "title"]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["name_display", "report_type", "ref_doctype", "module", "disabled"]
    list_filter = ["report_type", "module", "disabled"]
    search_fields = ["name_display"]


@admin.register(DocField)
class DocFieldAdmin(admin.ModelAdmin):
    list_display = ["doctype_ref", "fieldname", "fieldtype", "label", "reqd"]
    list_filter = ["fieldtype", "reqd"]
    search_fields = ["fieldname", "label"]
    autocomplete_fields = ["doctype_ref"]


@admin.register(DocTypeLink)
class DocTypeLinkAdmin(admin.ModelAdmin):
    list_display = ["doctype_ref", "link_doctype", "link_fieldname"]
    list_filter = ["doctype_ref"]


@admin.register(DocTypeAction)
class DocTypeActionAdmin(admin.ModelAdmin):
    list_display = ["doctype_ref", "label", "action_type", "action"]
    list_filter = ["action_type"]


@admin.register(DocTypeState)
class DocTypeStateAdmin(admin.ModelAdmin):
    list_display = ["doctype_ref", "title", "color"]


@admin.register(UserEmail)
class UserEmailAdmin(admin.ModelAdmin):
    list_display = ["user", "email_id", "email_account", "awaiting_password"]
    autocomplete_fields = ["user"]


@admin.register(UserSocialLogin)
class UserSocialLoginAdmin(admin.ModelAdmin):
    list_display = ["user", "provider", "userid"]
    autocomplete_fields = ["user"]


@admin.register(UserGroup)
class UserGroupAdmin(admin.ModelAdmin):
    list_display = ["name"]
    search_fields = ["name"]


@admin.register(UserGroupMember)
class UserGroupMemberAdmin(admin.ModelAdmin):
    list_display = ["user_group", "user"]
    autocomplete_fields = ["user_group", "user"]


@admin.register(UserInvitation)
class UserInvitationAdmin(admin.ModelAdmin):
    list_display = ["email", "status", "key", "creation"]
    list_filter = ["status"]
    search_fields = ["email"]
    date_hierarchy = "creation"
