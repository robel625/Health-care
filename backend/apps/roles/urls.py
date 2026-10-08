from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import core_views, views

router = DefaultRouter()

# Core role & permission models
router.register(r"roles", views.RoleViewSet)
router.register(r"doctypes", views.DocTypeViewSet)
router.register(r"doc-perms", views.DocPermViewSet)
router.register(r"custom-doc-perms", views.CustomDocPermViewSet)
router.register(r"has-roles", views.HasRoleViewSet)
router.register(r"user-roles", views.UserRoleViewSet)

# Role profiles
router.register(r"role-profiles", views.RoleProfileViewSet)
router.register(r"user-role-profiles", views.UserRoleProfileViewSet)

# Row-level permissions & sharing
router.register(r"user-permissions", views.UserPermissionViewSet)
router.register(r"doc-shares", views.DocShareViewSet)

# Audit & logging
router.register(r"access-logs", views.AccessLogViewSet)
router.register(r"activity-logs", views.ActivityLogViewSet)
router.register(r"api-request-logs", views.APIRequestLogViewSet)
router.register(r"permission-logs", views.PermissionLogViewSet)
router.register(r"audit-trails", views.AuditTrailViewSet)

# Security settings
router.register(r"security-settings", views.SecuritySettingsViewSet, basename="security-settings")
router.register(r"system-settings", views.SystemSettingsViewSet, basename="system-settings")

# Users (for permission matrix)
router.register(r"users", views.UserViewSet)

# ── Core Frappe doctypes (Comment, Communication, etc.) ──
router.register(r"comments", core_views.CommentViewSet, basename="core-comment")
router.register(r"communications", core_views.CommunicationViewSet, basename="core-communication")
router.register(r"error-logs", core_views.ErrorLogViewSet, basename="core-error-log")
router.register(r"versions", core_views.VersionViewSet, basename="core-version")
router.register(r"view-logs", core_views.ViewLogViewSet, basename="core-view-log")
router.register(r"deleted-documents", core_views.DeletedDocumentViewSet, basename="core-deleted-document")
router.register(r"naming-rules", core_views.DocumentNamingRuleViewSet, basename="core-naming-rule")
router.register(r"custom-roles", core_views.CustomRoleViewSet, basename="core-custom-role")
router.register(r"page-report-roles", core_views.RolePermissionForPageAndReportViewSet, basename="core-page-report-role")
router.register(r"job-types", core_views.ScheduledJobTypeViewSet, basename="core-job-type")
router.register(r"job-logs", core_views.ScheduledJobLogViewSet, basename="core-job-log")
router.register(r"server-scripts", core_views.ServerScriptViewSet, basename="core-server-script")
router.register(r"data-imports", core_views.DataImportViewSet, basename="core-data-import")
router.register(r"data-exports", core_views.DataExportViewSet, basename="core-data-export")
router.register(r"prepared-reports", core_views.PreparedReportViewSet, basename="core-prepared-report")
router.register(r"submission-queue", core_views.SubmissionQueueViewSet, basename="core-submission-queue")
router.register(r"pages-list", core_views.PageViewSet, basename="core-page")
router.register(r"reports-list", core_views.ReportViewSet, basename="core-report")
router.register(r"doc-fields", core_views.DocFieldViewSet, basename="core-doc-field")
router.register(r"doctype-links", core_views.DocTypeLinkViewSet, basename="core-doctype-link")
router.register(r"doctype-actions", core_views.DocTypeActionViewSet, basename="core-doctype-action")
router.register(r"doctype-states", core_views.DocTypeStateViewSet, basename="core-doctype-state")

# Workflow
router.register(r"workflows", core_views.WorkflowViewSet, basename="core-workflow")
router.register(r"workflow-states", core_views.WorkflowStateViewSet, basename="core-workflow-state")
router.register(r"workflow-doc-states", core_views.WorkflowDocumentStateViewSet, basename="core-workflow-doc-state")
router.register(r"workflow-transitions", core_views.WorkflowTransitionViewSet, basename="core-workflow-transition")
router.register(r"workflow-actions", core_views.WorkflowActionViewSet, basename="core-workflow-action")

# Email Templates
router.register(r"email-templates", core_views.EmailTemplateViewSet, basename="core-email-template")
router.register(r"notification-settings", core_views.NotificationSettingViewSet, basename="core-notification-setting")
router.register(r"notification-deliveries", core_views.NotificationDeliveryViewSet, basename="core-notification-delivery")
router.register(r"user-notification-settings", core_views.UserNotificationSettingViewSet, basename="core-user-notification-setting")
router.register(r"email-accounts", core_views.EmailAccountViewSet, basename="core-email-account")

urlpatterns = [
    path("", include(router.urls)),
    # Matrix & permissions
    path("matrix/", views.permission_matrix, name="permission-matrix"),
    path("matrix/update_perm/", views.update_matrix_perm, name="update-matrix-perm"),
    path("matrix/bulk_update/", views.bulk_update_matrix_perms, name="bulk-update-matrix-perms"),
    path("my/", views.my_permissions, name="my-permissions"),
    # Bulk operations
    path("bulk-assign-role/", views.bulk_assign_role, name="bulk-assign-role"),
    path("bulk-remove-role/", views.bulk_remove_role, name="bulk-remove-role"),
    # Log management
    path("clear-old-logs/", views.clear_old_logs, name="clear-old-logs"),
    # Permission inspector
    path("permission-inspector/", core_views.permission_inspector, name="permission-inspector"),
    # Notification counts for sidebar badges
    path("notification-counts/", core_views.notification_counts, name="notification-counts"),
    # Send notification email
    path("send-notification-email/", core_views.send_notification_email, name="send-notification-email"),
]
