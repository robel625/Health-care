"""
Frappe-style views, serializers, and URL routes for all core doctypes.

Comment, Communication, CommunicationLink, ErrorLog, Version, ViewLog,
CustomRole, ScheduledJobType, ServerScript, DataImport, DataExport,
PreparedReport, SubmissionQueue, Page, Report, etc.
"""

import html
import re

from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.roles.permissions import IsAdminUser

from .models import (
    Comment,
    Communication,
    CommunicationLink,
    CustomRole,
    DataExport,
    DataImport,
    DataImportLog,
    DeletedDocument,
    DocField,
    DocType,
    DocTypeAction,
    DocTypeLink,
    DocTypeState,
    DocumentNamingRule,
    ErrorLog,
    HasRole,
    Page,
    PermissionInspector,
    PreparedReport,
    Report,
    Role,
    RolePermissionForPageAndReport,
    ScheduledJobLog,
    ScheduledJobType,
    ServerScript,
    SubmissionQueue,
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


# ═══════════════════════════════════════════════════════════════════
#  SERIALIZERS
# ═══════════════════════════════════════════════════════════════════

def _sanitize_html_content(content):
    """Frappe-style HTML sanitization."""
    if not content:
        return content
    # Remove dangerous tags
    content = re.sub(r'<(form|input|button)[^>]*>.*?</\1>', '', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<(form|input|button)[^>]*/>', '', content, flags=re.IGNORECASE)
    return content


# ── CommunicationLink ─────────────────────────────────────────────
class CommunicationLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunicationLink
        fields = ["id", "link_doctype", "link_name", "link_title", "communication_date"]
        read_only_fields = ["communication_date"]


# ── Comment (Frappe's Comment doctype) ────────────────────────────
class CommentSerializer(serializers.ModelSerializer):
    """Frappe-style Comment serializer with validation."""
    comment_user_name = serializers.SerializerMethodField()
    timeline_links_count = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id", "comment_type", "comment_email", "comment_by",
            "subject", "content", "published", "seen",
            "reference_doctype", "reference_name", "reference_owner",
            "ip_address", "owner",
            "comment_user_name", "timeline_links_count",
            "creation", "modified",
        ]
        read_only_fields = ["owner", "comment_user_name", "creation", "modified"]

    def get_comment_user_name(self, obj):
        if obj.comment_email:
            try:
                user = User.objects.get(email=obj.comment_email)
                return f"{user.first_name} {user.last_name}".strip() or user.username
            except User.DoesNotExist:
                pass
        return obj.comment_by or obj.comment_email or "Unknown"

    def get_timeline_links_count(self, obj):
        return 0  # Comments don't have timeline links

    def validate_content(self, value):
        """Frappe validates and sanitizes comment content."""
        if value:
            value = _sanitize_html_content(value)
        return value

    def validate(self, data):
        """Frappe validates that comment_email defaults to session user."""
        if not data.get("comment_email"):
            data["comment_email"] = self.context["request"].user.email
        if not data.get("comment_by"):
            user = self.context["request"].user
            data["comment_by"] = f"{user.first_name} {user.last_name}".strip() or user.username

        # Set reference_owner if reference is provided
        if data.get("reference_doctype") and data.get("reference_name") and not data.get("reference_owner"):
            data["reference_owner"] = "admin"  # Would normally fetch from DB

        return data


# ── Communication (Frappe's Communication doctype) ────────────────
class CommunicationSerializer(serializers.ModelSerializer):
    """Frappe-style Communication serializer with email handling."""
    timeline_links = CommunicationLinkSerializer(many=True, read_only=True)
    user_name = serializers.SerializerMethodField()
    sender_name_display = serializers.SerializerMethodField()
    to_list = serializers.SerializerMethodField()
    cc_list = serializers.SerializerMethodField()

    class Meta:
        model = Communication
        fields = [
            "id", "subject", "content", "text_content",
            "communication_medium", "communication_type",
            "status", "sent_or_received", "delivery_status",
            "sender", "sender_full_name", "sender_name_display",
            "recipients", "cc", "bcc", "phone_no",
            "communication_date", "user", "user_name",
            "reference_doctype", "reference_name", "reference_owner",
            "email_account", "in_reply_to", "message_id", "email_status",
            "seen", "read_by_recipient", "read_by_recipient_on",
            "read_receipt", "has_attachment", "send_after",
            "timeline_links", "to_list", "cc_list",
            "owner", "creation", "modified",
        ]
        read_only_fields = [
            "owner", "user", "sender_full_name", "sender_name_display",
            "reference_owner", "delivery_status", "seen",
            "read_by_recipient", "read_by_recipient_on", "read_receipt",
            "creation", "modified",
        ]

    def get_user_name(self, obj):
        if obj.user:
            return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.username
        return ""

    def get_sender_name_display(self, obj):
        if obj.sender_full_name:
            return obj.sender_full_name
        if obj.sender:
            return obj.sender
        return ""

    def get_to_list(self, obj):
        """Parse recipients into a clean list."""
        if not obj.recipients:
            return []
        return [email.strip() for email in obj.recipients.split(",") if email.strip()]

    def get_cc_list(self, obj):
        """Parse CC into a clean list."""
        if not obj.cc:
            return []
        return [email.strip() for email in obj.cc.split(",") if email.strip()]

    def validate_subject(self, value):
        """Frappe auto-generates subject from content if empty."""
        return value

    def validate_content(self, value):
        """Sanitize content."""
        if value:
            value = _sanitize_html_content(value)
        return value

    def validate(self, data):
        """Frappe-style validation."""
        request = self.context["request"]

        # Set user from request
        if not data.get("user"):
            data["user"] = request.user

        # Auto-generate subject from content
        if not data.get("subject") and data.get("content"):
            text = re.sub(r'<[^>]+>', '', data["content"])[:141]
            data["subject"] = html.unescape(text)

        # Set sent_or_received default
        if not data.get("sent_or_received"):
            data["sent_or_received"] = "Sent"
            data["seen"] = True

        # Set status based on reference
        if not self.instance:  # New instance only
            if data.get("reference_doctype") and data.get("reference_name"):
                data["status"] = "Linked"
            else:
                data["status"] = "Open"

        # Set sender_full_name from sender
        if data.get("sender") and not data.get("sender_full_name"):
            from email.utils import parse_addr
            name, email_addr = parse_addr(data["sender"])
            if name and name != email_addr:
                data["sender_full_name"] = name
                data["sender"] = email_addr

        # Set communication_date
        if not data.get("communication_date"):
            data["communication_date"] = timezone.now()

        # Set send_after to None if empty string
        if data.get("send_after") == "":
            data["send_after"] = None

        return data


class CommunicationCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for creating communications."""
    timeline_links_data = CommunicationLinkSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = Communication
        fields = [
            "subject", "content", "communication_medium",
            "recipients", "cc", "bcc", "phone_no",
            "reference_doctype", "reference_name",
            "send_after", "timeline_links_data",
        ]

    def validate(self, data):
        request = self.context["request"]
        data["user"] = request.user
        if not data.get("sent_or_received"):
            data["sent_or_received"] = "Sent"
        if not data.get("subject") and data.get("content"):
            text = re.sub(r'<[^>]+>', '', data["content"])[:141]
            data["subject"] = html.unescape(text)
        if data.get("reference_doctype") and data.get("reference_name"):
            data["status"] = "Linked"
        else:
            data["status"] = "Open"
        if not data.get("communication_date"):
            data["communication_date"] = timezone.now()
        if data.get("send_after") == "":
            data["send_after"] = None
        return data

    def create(self, validated_data):
        timeline_links_data = validated_data.pop("timeline_links_data", [])
        communication = Communication.objects.create(**validated_data)
        for link_data in timeline_links_data:
            CommunicationLink.objects.create(communication=communication, **link_data)
        return communication


# ── ErrorLog ──────────────────────────────────────────────────────
class ErrorLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ErrorLog
        fields = [
            "id", "method", "error", "reference_doctype", "reference_name",
            "seen", "fingerprint", "trace_id", "metadata", "creation",
        ]
        read_only_fields = ["creation"]


# ── Version ───────────────────────────────────────────────────────
class VersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Version
        fields = ["id", "ref_doctype", "docname", "data", "owner", "creation"]
        read_only_fields = ["creation"]


# ── ViewLog ───────────────────────────────────────────────────────
class ViewLogSerializer(serializers.ModelSerializer):
    viewed_by_username = serializers.CharField(source="viewed_by.username", read_only=True, default="")

    class Meta:
        model = ViewLog
        fields = ["id", "reference_doctype", "reference_name", "viewed_by", "viewed_by_username", "creation"]
        read_only_fields = ["creation"]


# ── DeletedDocument ───────────────────────────────────────────────
class DeletedDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeletedDocument
        fields = [
            "id", "deleted_doctype", "deleted_name", "new_name",
            "data", "restored", "owner", "creation",
        ]
        read_only_fields = ["owner", "creation"]


# ── DocumentNamingRule ────────────────────────────────────────────
class DocumentNamingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentNamingRule
        fields = [
            "id", "document_type", "prefix", "prefix_digits",
            "counter", "disabled", "priority", "conditions",
            "owner", "creation", "modified",
        ]
        read_only_fields = ["counter", "owner", "creation", "modified"]


# ── CustomRole ────────────────────────────────────────────────────
class CustomRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomRole
        fields = [
            "id", "page", "report", "ref_doctype", "roles",
            "owner", "creation", "modified",
        ]
        read_only_fields = ["owner", "creation", "modified"]


# ── RolePermissionForPageAndReport ────────────────────────────────
class RolePermissionForPageAndReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermissionForPageAndReport
        fields = [
            "id", "set_role_for", "page", "report", "roles",
            "enable_prepared_report", "owner", "creation", "modified",
        ]
        read_only_fields = ["owner", "creation", "modified"]


# ── ScheduledJobType ──────────────────────────────────────────────
class ScheduledJobTypeSerializer(serializers.ModelSerializer):
    last_execution_display = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledJobType
        fields = [
            "id", "method", "frequency", "cron_format", "queue",
            "stopped", "create_log", "last_execution", "last_execution_display",
            "server_script", "scheduler_event", "owner", "creation", "modified",
        ]
        read_only_fields = ["owner", "creation", "modified"]

    def get_last_execution_display(self, obj):
        if obj.last_execution:
            return obj.last_execution.isoformat()
        return None


# ── ScheduledJobLog ───────────────────────────────────────────────
class ScheduledJobLogSerializer(serializers.ModelSerializer):
    job_method = serializers.CharField(source="scheduled_job_type.method", read_only=True)

    class Meta:
        model = ScheduledJobLog
        fields = ["id", "scheduled_job_type", "job_method", "status", "details", "debug_log", "creation"]
        read_only_fields = ["creation"]


# ── ServerScript ──────────────────────────────────────────────────
class ServerScriptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServerScript
        fields = [
            "id", "name_display", "script_type", "reference_doctype",
            "module", "script", "disabled", "allow_guest",
            "event_frequency", "cron_format", "api_method",
            "enable_rate_limit", "rate_limit_count", "rate_limit_seconds",
            "owner", "creation", "modified",
        ]
        read_only_fields = ["owner", "creation", "modified"]


# ── DataImport ────────────────────────────────────────────────────
class DataImportSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataImport
        fields = [
            "id", "reference_doctype", "import_file", "google_sheets_url",
            "import_type", "status", "submit_after_import", "mute_emails",
            "payload_count", "show_failed_logs", "template_options",
            "template_warnings", "custom_delimiters", "delimiter_options",
            "use_csv_sniffer", "owner", "creation", "modified",
        ]
        read_only_fields = ["status", "payload_count", "owner", "creation", "modified"]


# ── DataExport ────────────────────────────────────────────────────
class DataExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataExport
        fields = [
            "id", "reference_doctype", "file_type",
            "export_without_main_header", "owner", "creation", "modified",
        ]
        read_only_fields = ["owner", "creation", "modified"]


# ── PreparedReport ────────────────────────────────────────────────
class PreparedReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreparedReport
        fields = [
            "id", "report_name", "filters", "status", "error_message",
            "job_id", "queued_by", "queued_at", "report_end_time",
            "peak_memory_usage", "owner", "creation", "modified",
        ]
        read_only_fields = ["owner", "creation", "modified"]


# ── SubmissionQueue ───────────────────────────────────────────────
class SubmissionQueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionQueue
        fields = [
            "id", "ref_doctype", "ref_docname", "status", "job_id",
            "enqueued_by", "exception", "ended_at",
            "owner", "creation", "modified",
        ]
        read_only_fields = ["owner", "creation", "modified"]


# ── Page ──────────────────────────────────────────────────────────
class PageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Page
        fields = [
            "id", "name_display", "title", "module", "icon",
            "is_restricted", "system_page", "_doctype",
            "owner", "creation", "modified",
        ]
        read_only_fields = ["owner", "creation", "modified"]


# ── Report ────────────────────────────────────────────────────────
class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = [
            "id", "name_display", "report_type", "ref_doctype",
            "module", "is_standard", "disabled", "prepared_report",
            "generate_csv", "timeout", "owner", "creation", "modified",
        ]
        read_only_fields = ["owner", "creation", "modified"]


# ── DocField ──────────────────────────────────────────────────────
class DocFieldSerializer(serializers.ModelSerializer):
    doctype_name = serializers.CharField(source="doctype_ref.name", read_only=True)

    class Meta:
        model = DocField
        fields = [
            "id", "doctype_ref", "doctype_name", "fieldname", "fieldtype",
            "label", "options", "default", "description",
            "reqd", "read_only", "hidden", "bold",
            "in_list_view", "in_standard_filter", "in_global_search",
            "unique", "no_copy", "set_only_once",
            "permlevel", "depends_on", "mandatory_depends_on",
            "collapsible", "fetch_from", "fetch_if_empty",
            "precision", "length", "columns", "search_index",
            "creation", "modified",
        ]
        read_only_fields = ["creation", "modified"]


# ── DocTypeLink ───────────────────────────────────────────────────
class DocTypeLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocTypeLink
        fields = [
            "id", "doctype_ref", "link_doctype", "link_fieldname",
            "parent_doctype", "table_fieldname", "group",
            "hidden", "custom", "is_child_table", "creation",
        ]
        read_only_fields = ["creation"]


# ── DocTypeAction ─────────────────────────────────────────────────
class DocTypeActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocTypeAction
        fields = [
            "id", "doctype_ref", "label", "action_type",
            "action", "group", "hidden", "custom", "creation",
        ]
        read_only_fields = ["creation"]


# ── DocTypeState ──────────────────────────────────────────────────
class DocTypeStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocTypeState
        fields = ["id", "doctype_ref", "title", "color", "custom", "creation"]
        read_only_fields = ["creation"]


# ═══════════════════════════════════════════════════════════════════
#  VIEWS & VIEWSETS
# ═══════════════════════════════════════════════════════════════════

# ── Comment ViewSet ───────────────────────────────────────────────
class CommentViewSet(viewsets.ModelViewSet):
    """
    Frappe-style Comment CRUD.
    Supports filtering by reference_doctype/reference_name (timeline).
    """
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["content", "subject", "comment_email"]
    filterset_fields = ["comment_type", "reference_doctype", "reference_name", "published"]

    def get_queryset(self):
        qs = Comment.objects.all()
        ref_doctype = self.request.query_params.get("reference_doctype")
        ref_name = self.request.query_params.get("reference_name")
        if ref_doctype and ref_name:
            qs = qs.filter(reference_doctype=ref_doctype, reference_name=ref_name)
        else:
            user = self.request.user
            if user and user.is_authenticated:
                from apps.roles.permissions import _get_user_role_names
                user_roles = set(_get_user_role_names(user))
                admin_roles = {"System Manager", "Administrator", "Healthcare Administrator"}
                is_admin = user.is_staff or user.is_superuser or bool(user_roles & admin_roles)
                if not is_admin:
                    qs = qs.filter(Q(owner=user.username) | Q(reference_owner=user.username))
        return qs

    def perform_create(self, serializer):
        """Frappe auto-sets owner and IP."""
        kwargs = {"owner": self.request.user.username}
        x_forwarded_for = self.request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            kwargs["ip_address"] = x_forwarded_for.split(",")[0].strip()
        else:
            kwargs["ip_address"] = self.request.META.get("REMOTE_ADDR")
        instance = serializer.save(**kwargs)

        # Dispatch notification
        try:
            from apps.roles.notification_dispatcher import dispatch_notification
            dispatch_notification(
                event="comment_added",
                subject=f"New comment by {self.request.user.username}",
                message=instance.content[:200] if instance.content else "",
                reference_doctype=instance.reference_doctype or "",
                reference_name=instance.reference_name or "",
                triggered_by=self.request.user,
            )
        except Exception:
            pass  # Don't let notification failure break the request

    @action(detail=False, methods=["get"], url_path="timeline")
    def timeline(self, request):
        """Get all comments for a document (Frappe timeline API)."""
        ref_doctype = request.query_params.get("reference_doctype")
        ref_name = request.query_params.get("reference_name")
        if not ref_doctype or not ref_name:
            return Response(
                {"detail": "reference_doctype and reference_name are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comments = Comment.objects.filter(
            reference_doctype=ref_doctype, reference_name=ref_name
        ).order_by("-creation")

        communications = Communication.objects.filter(
            reference_doctype=ref_doctype, reference_name=ref_name
        ).order_by("-communication_date")

        # Merge and sort by date
        timeline = []
        for c in comments:
            timeline.append({
                "type": "comment",
                "data": CommentSerializer(c).data,
                "date": c.creation.isoformat() if c.creation else None,
            })
        for c in communications:
            timeline.append({
                "type": "communication",
                "data": CommunicationSerializer(c).data,
                "date": c.communication_date.isoformat() if c.communication_date else None,
            })

        timeline.sort(key=lambda x: x["date"] or "", reverse=True)
        return Response(timeline)


# ── Communication ViewSet ─────────────────────────────────────────
class CommunicationViewSet(viewsets.ModelViewSet):
    """
    Frappe-style Communication CRUD with timeline links.
    """
    serializer_class = CommunicationSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["subject", "content", "sender"]
    filterset_fields = [
        "communication_medium", "communication_type", "status",
        "sent_or_received", "reference_doctype", "reference_name",
    ]

    def get_queryset(self):
        qs = Communication.objects.prefetch_related("timeline_links").all()
        user = self.request.user
        if not (user and user.is_authenticated):
            return Communication.objects.none()

        from apps.roles.permissions import _get_user_role_names
        user_roles = set(_get_user_role_names(user))
        admin_roles = {"System Manager", "Administrator", "Healthcare Administrator"}
        is_admin = user.is_staff or user.is_superuser or bool(user_roles & admin_roles)

        if not is_admin:
            user_email = user.email or ""
            qs = qs.filter(
                Q(user=user)
                | Q(owner=user.username)
                | Q(sender=user_email)
                | Q(recipients__icontains=user_email)
                | Q(recipients__icontains=user.username)
                | Q(cc__icontains=user_email)
            )

        ref_doctype = self.request.query_params.get("reference_doctype")
        ref_name = self.request.query_params.get("reference_name")
        if ref_doctype and ref_name:
            qs = qs.filter(reference_doctype=ref_doctype, reference_name=ref_name)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return CommunicationCreateSerializer
        return CommunicationSerializer

    def perform_create(self, serializer):
        """Frappe auto-sets owner and user."""
        kwargs = {
            "owner": self.request.user.username,
            "user": self.request.user,
        }
        instance = serializer.save(**kwargs)

        # Dispatch notification
        try:
            from apps.roles.notification_dispatcher import dispatch_notification
            dispatch_notification(
                event="communication_received",
                subject=instance.subject or f"New {instance.communication_medium or 'message'}",
                message=(instance.text_content or instance.content or "")[:200],
                reference_doctype=instance.reference_doctype or "",
                reference_name=instance.reference_name or "",
                triggered_by=self.request.user,
            )
        except Exception:
            pass

    @action(detail=True, methods=["post"], url_path="add-link")
    def add_link(self, request, pk=None):
        """Add a timeline link to a communication."""
        comm = self.get_object()
        link_doctype = request.data.get("link_doctype")
        link_name = request.data.get("link_name")
        if not link_doctype or not link_name:
            return Response(
                {"detail": "link_doctype and link_name are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        link, created = CommunicationLink.objects.get_or_create(
            communication=comm,
            link_doctype=link_doctype,
            link_name=link_name,
            defaults={"communication_date": comm.communication_date},
        )
        return Response(CommunicationLinkSerializer(link).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="remove-link")
    def remove_link(self, request, pk=None):
        """Remove a timeline link from a communication."""
        comm = self.get_object()
        link_doctype = request.data.get("link_doctype")
        link_name = request.data.get("link_name")
        deleted, _ = CommunicationLink.objects.filter(
            communication=comm, link_doctype=link_doctype, link_name=link_name
        ).delete()
        return Response({"deleted": deleted})

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        """Mark communication as read by recipient."""
        comm = self.get_object()
        comm.read_by_recipient = True
        comm.read_by_recipient_on = timezone.now()
        comm.save(update_fields=["read_by_recipient", "read_by_recipient_on"])
        return Response({"status": "marked as read"})

    @action(detail=False, methods=["get"], url_path="timeline")
    def timeline(self, request):
        """Get all communications for a document (Frappe timeline API)."""
        ref_doctype = request.query_params.get("reference_doctype")
        ref_name = request.query_params.get("reference_name")
        if not ref_doctype or not ref_name:
            return Response(
                {"detail": "reference_doctype and reference_name are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        comms = Communication.objects.filter(
            reference_doctype=ref_doctype, reference_name=ref_name
        ).prefetch_related("timeline_links").order_by("-communication_date")
        return Response(CommunicationSerializer(comms, many=True).data)

    @action(detail=False, methods=["post"], url_path="bulk-send")
    def bulk_send(self, request):
        """
        Send bulk communications to multiple recipients.
        POST: {
            "subject": "Quarterly Newsletter",
            "content": "<p>Hello team!</p>",
            "communication_medium": "Email",
            "recipients": ["user1@example.com", "user2@example.com"],
            "cc": ["manager@example.com"],
            "reference_doctype": "",
            "reference_name": ""
        }
        """
        subject = request.data.get("subject", "")
        content = request.data.get("content", "")
        medium = request.data.get("communication_medium", "Email")
        recipients = request.data.get("recipients", [])
        cc = request.data.get("cc", [])
        ref_doctype = request.data.get("reference_doctype", "")
        ref_name = request.data.get("reference_name", "")

        if not recipients:
            return Response(
                {"detail": "At least one recipient is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not subject and not content:
            return Response(
                {"detail": "Subject or content is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_comms = []
        for email in recipients:
            comm = Communication.objects.create(
                subject=subject,
                content=content,
                communication_medium=medium,
                communication_type="Communication",
                status="Linked",
                sent_or_received="Sent",
                sender=request.user.email or request.user.username,
                sender_full_name=f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
                recipients=email,
                cc=",".join(cc) if cc else "",
                user=request.user,
                reference_doctype=ref_doctype,
                reference_name=ref_name,
                owner=request.user.username,
            )
            created_comms.append(CommunicationSerializer(comm).data)

        return Response({
            "detail": f"{len(created_comms)} communication(s) sent successfully.",
            "count": len(created_comms),
            "communications": created_comms,
        })


class IsHealthcareOrSystemAdmin(IsAuthenticated):
    """
    Allows access only to Healthcare Administrator, System Manager, or Django staff/superusers.
    """
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        from apps.roles.permissions import _get_user_role_names
        user_roles = set(_get_user_role_names(request.user))
        admin_roles = {"System Manager", "Administrator", "Healthcare Administrator"}
        return bool(user_roles & admin_roles)


# ── ErrorLog ViewSet ──────────────────────────────────────────────
class ErrorLogViewSet(viewsets.ModelViewSet):
    serializer_class = ErrorLogSerializer
    permission_classes = [IsHealthcareOrSystemAdmin]
    search_fields = ["method", "error"]
    filterset_fields = ["seen", "reference_doctype"]

    def get_queryset(self):
        user = self.request.user
        if not (user and user.is_authenticated):
            return ErrorLog.objects.none()
        if user.is_staff or user.is_superuser:
            return ErrorLog.objects.all()
        from apps.roles.permissions import _get_user_role_names
        user_roles = set(_get_user_role_names(user))
        admin_roles = {"System Manager", "Administrator", "Healthcare Administrator"}
        if bool(user_roles & admin_roles):
            return ErrorLog.objects.all()
        return ErrorLog.objects.none()

    def perform_create(self, serializer):
        instance = serializer.save()
        try:
            from apps.roles.notification_dispatcher import dispatch_notification
            dispatch_notification(
                event="error_log_created",
                subject=f"Error: {instance.method or 'Unknown'} {instance.error[:100] if instance.error else ''}",
                message=instance.error[:500] if instance.error else "",
                reference_doctype=instance.reference_doctype or "",
                reference_name=instance.reference_name or "",
            )
        except Exception:
            pass

    @action(detail=False, methods=["post"], url_path="clear-all")
    def clear_all(self, request):
        """Clear all error logs."""
        ErrorLog.objects.all().delete()
        return Response({"status": "all error logs cleared"})


# ── Version ViewSet ───────────────────────────────────────────────
class VersionViewSet(viewsets.ModelViewSet):
    serializer_class = VersionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["ref_doctype", "docname"]

    def get_queryset(self):
        qs = Version.objects.all()
        ref_doctype = self.request.query_params.get("ref_doctype")
        docname = self.request.query_params.get("docname")
        if ref_doctype and docname:
            qs = qs.filter(ref_doctype=ref_doctype, docname=docname)
        return qs


# ── ViewLog ViewSet ───────────────────────────────────────────────
class ViewLogViewSet(viewsets.ModelViewSet):
    serializer_class = ViewLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["reference_doctype", "reference_name", "viewed_by"]

    def get_queryset(self):
        return ViewLog.objects.select_related("viewed_by").all()

    def perform_create(self, serializer):
        serializer.save(viewed_by=self.request.user)


# ── DeletedDocument ViewSet ───────────────────────────────────────
class DeletedDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DeletedDocumentSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["deleted_doctype", "restored"]

    def get_queryset(self):
        return DeletedDocument.objects.all()


# ── DocumentNamingRule ViewSet ────────────────────────────────────
class DocumentNamingRuleViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentNamingRuleSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    search_fields = ["document_type", "prefix"]
    filterset_fields = ["document_type", "disabled"]

    def get_queryset(self):
        return DocumentNamingRule.objects.all()


# ── CustomRole ViewSet ────────────────────────────────────────────
class CustomRoleViewSet(viewsets.ModelViewSet):
    serializer_class = CustomRoleSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    search_fields = ["page", "report"]

    def get_queryset(self):
        return CustomRole.objects.all()


# ── RolePermissionForPageAndReport ViewSet ────────────────────────
class RolePermissionForPageAndReportViewSet(viewsets.ModelViewSet):
    serializer_class = RolePermissionForPageAndReportSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["set_role_for", "page", "report"]

    def get_queryset(self):
        return RolePermissionForPageAndReport.objects.all()


# ── ScheduledJobType ViewSet ──────────────────────────────────────
class ScheduledJobTypeViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduledJobTypeSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    search_fields = ["method"]
    filterset_fields = ["frequency", "stopped"]

    def get_queryset(self):
        return ScheduledJobType.objects.all()

    @action(detail=True, methods=["post"], url_path="execute")
    def execute_job(self, request, pk=None):
        """Force execute a scheduled job."""
        job = self.get_object()
        # In real Frappe, this would enqueue the job
        return Response({"status": f"Job '{job.method}' queued for execution"})


# ── ScheduledJobLog ViewSet ───────────────────────────────────────
class ScheduledJobLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ScheduledJobLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["status", "scheduled_job_type"]

    def get_queryset(self):
        return ScheduledJobLog.objects.select_related("scheduled_job_type").all()


# ── ServerScript ViewSet ──────────────────────────────────────────
class ServerScriptViewSet(viewsets.ModelViewSet):
    serializer_class = ServerScriptSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    search_fields = ["name_display"]
    filterset_fields = ["script_type", "disabled"]

    def get_queryset(self):
        return ServerScript.objects.all()


# ── DataImport ViewSet ────────────────────────────────────────────
class DataImportViewSet(viewsets.ModelViewSet):
    serializer_class = DataImportSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["reference_doctype", "status", "import_type"]

    def get_queryset(self):
        return DataImport.objects.all()


# ── DataExport ViewSet ────────────────────────────────────────────
class DataExportViewSet(viewsets.ModelViewSet):
    serializer_class = DataExportSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["reference_doctype", "file_type"]

    def get_queryset(self):
        return DataExport.objects.all()


# ── PreparedReport ViewSet ────────────────────────────────────────
class PreparedReportViewSet(viewsets.ModelViewSet):
    serializer_class = PreparedReportSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["report_name", "status"]

    def get_queryset(self):
        return PreparedReport.objects.all()


# ── SubmissionQueue ViewSet ───────────────────────────────────────
class SubmissionQueueViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionQueueSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["ref_doctype", "status"]

    def get_queryset(self):
        return SubmissionQueue.objects.all()


# ── Page ViewSet ──────────────────────────────────────────────────
class PageViewSet(viewsets.ModelViewSet):
    serializer_class = PageSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    search_fields = ["name_display", "title"]
    filterset_fields = ["module", "is_restricted"]

    def get_queryset(self):
        return Page.objects.all()


# ── Report ViewSet ────────────────────────────────────────────────
class ReportViewSet(viewsets.ModelViewSet):
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    search_fields = ["name_display"]
    filterset_fields = ["report_type", "ref_doctype", "module", "disabled"]

    def get_queryset(self):
        return Report.objects.all()


# ── DocField ViewSet ──────────────────────────────────────────────
class DocFieldViewSet(viewsets.ModelViewSet):
    serializer_class = DocFieldSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    search_fields = ["fieldname", "label"]
    filterset_fields = ["doctype_ref", "fieldtype", "reqd"]

    def get_queryset(self):
        return DocField.objects.select_related("doctype_ref").all()


# ── DocTypeLink ViewSet ───────────────────────────────────────────
class DocTypeLinkViewSet(viewsets.ModelViewSet):
    serializer_class = DocTypeLinkSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["doctype_ref", "link_doctype"]

    def get_queryset(self):
        return DocTypeLink.objects.all()


# ── DocTypeAction ViewSet ─────────────────────────────────────────
class DocTypeActionViewSet(viewsets.ModelViewSet):
    serializer_class = DocTypeActionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["doctype_ref"]

    def get_queryset(self):
        return DocTypeAction.objects.all()


# ── DocTypeState ViewSet ──────────────────────────────────────────
class DocTypeStateViewSet(viewsets.ModelViewSet):
    serializer_class = DocTypeStateSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["doctype_ref"]

    def get_queryset(self):
        return DocTypeState.objects.all()


# ── Permission Inspector ──────────────────────────────────────────
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsAdminUser])
def permission_inspector(request):
    """
    Debug permissions for a user on a doctype.
    POST: { "ref_doctype": "Customer", "docname": "CUST-001", "user": "sales_user", "permission_type": "read" }
    """
    ref_doctype = request.data.get("ref_doctype")
    user_username = request.data.get("user")
    permission_type = request.data.get("permission_type", "read")
    docname = request.data.get("docname", "")

    if not ref_doctype or not user_username:
        return Response(
            {"detail": "ref_doctype and user are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(username=user_username)
    except User.DoesNotExist:
        return Response(
            {"detail": f"User '{user_username}' not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    from apps.roles.permissions import _user_has_doctype_permission, _user_has_doctype_permission_with_owner

    result = _user_has_doctype_permission(user, ref_doctype, permission_type)

    # Get all roles for this user
    from apps.roles.models import UserRole, HasRole
    roles = list(
        UserRole.objects.filter(user=user, role__is_active=True)
        .values_list("role__name", flat=True)
    )
    roles += list(
        HasRole.objects.filter(user=user, role__is_active=True)
        .values_list("role__name", flat=True)
    )

    # Get all permissions for this doctype
    from apps.roles.models import DocPerm, CustomDocPerm, DocType
    try:
        doctype = DocType.objects.get(name=ref_doctype)
    except DocType.DoesNotExist:
        doctype = None

    doctype_perms = []
    if doctype:
        for dp in DocPerm.objects.filter(doctype_ref=doctype):
            doctype_perms.append({
                "role": dp.role.name,
                "permlevel": dp.permlevel,
                "if_owner": dp.if_owner,
                "active_permissions": dp.get_active_permissions(),
            })

    return Response({
        "user": user_username,
        "ref_doctype": ref_doctype,
        "docname": docname,
        "permission_type": permission_type,
        "result": result,
        "user_roles": sorted(set(roles)),
        "doctype_permissions": doctype_perms,
    })


# ═══════════════════════════════════════════════════════════════════
#  WORKFLOW SERIALIZERS & VIEWSETS
# ═══════════════════════════════════════════════════════════════════

class WorkflowStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowState
        fields = "__all__"


class WorkflowDocumentStateSerializer(serializers.ModelSerializer):
    state_name = serializers.CharField(source="state.workflow_state_name", read_only=True)
    allow_edit_display = serializers.CharField(source="allow_edit", read_only=True)

    class Meta:
        model = WorkflowDocumentState
        fields = "__all__"


class WorkflowTransitionSerializer(serializers.ModelSerializer):
    state_name = serializers.CharField(source="state.workflow_state_name", read_only=True)
    next_state_name = serializers.CharField(source="next_state.workflow_state_name", read_only=True)

    class Meta:
        model = WorkflowTransition
        fields = "__all__"


class WorkflowActionPermittedRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowActionPermittedRole
        fields = "__all__"


class WorkflowActionSerializer(serializers.ModelSerializer):
    permitted_roles = WorkflowActionPermittedRoleSerializer(many=True, read_only=True)

    class Meta:
        model = WorkflowAction
        fields = "__all__"


class WorkflowSerializer(serializers.ModelSerializer):
    states = WorkflowDocumentStateSerializer(many=True, read_only=True)
    transitions = WorkflowTransitionSerializer(many=True, read_only=True)
    document_type_display = serializers.CharField(source="document_type", read_only=True)

    class Meta:
        model = Workflow
        fields = "__all__"


class WorkflowCreateSerializer(serializers.Serializer):
    """Accepts nested states and transitions for workflow creation."""
    workflow_name = serializers.CharField(max_length=140)
    document_type = serializers.CharField(max_length=140)
    workflow_state_field = serializers.CharField(max_length=140, default="workflow_state")
    is_active = serializers.BooleanField(default=True)
    override_status = serializers.BooleanField(default=False)
    send_email_alert = serializers.BooleanField(default=True)
    states = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    transitions = serializers.ListField(child=serializers.DictField(), required=False, default=list)

    def create(self, validated_data):
        states_data = validated_data.pop("states", [])
        transitions_data = validated_data.pop("transitions", [])
        owner = self.context["request"].user.username if self.context.get("request") else "Administrator"
        validated_data["owner"] = owner

        workflow = Workflow.objects.create(**validated_data)

        # Create states
        state_map = {}
        for s in states_data:
            state_name = s.get("state", "")
            ws, _ = WorkflowState.objects.get_or_create(workflow_state_name=state_name)
            WorkflowDocumentState.objects.create(
                workflow=workflow, state=ws,
                doc_status=str(s.get("doc_status", "0")),
                allow_edit=s.get("allow_edit", ""),
                is_optional_state=s.get("is_optional_state", False),
                send_email=s.get("send_email", False),
                message=s.get("message", ""),
            )
            state_map[state_name] = ws

        # Create transitions
        for t in transitions_data:
            from_state = state_map.get(t.get("state", ""))
            to_state = state_map.get(t.get("next_state", ""))
            if from_state and to_state:
                WorkflowTransition.objects.create(
                    workflow=workflow,
                    state=from_state,
                    next_state=to_state,
                    action=t.get("action", ""),
                    allowed=t.get("allowed", ""),
                    allow_self_approval=t.get("allow_self_approval", False),
                    send_email_to_creator=t.get("send_email_to_creator", False),
                    condition=t.get("condition", ""),
                )

        return workflow


class WorkflowStateViewSet(viewsets.ModelViewSet):
    queryset = WorkflowState.objects.all()
    serializer_class = WorkflowStateSerializer
    permission_classes = [IsAuthenticated]


class WorkflowViewSet(viewsets.ModelViewSet):
    queryset = Workflow.objects.all()
    serializer_class = WorkflowSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return WorkflowCreateSerializer
        return WorkflowSerializer

    def perform_create(self, serializer):
        if isinstance(serializer, WorkflowCreateSerializer):
            serializer.save()
        else:
            serializer.save(owner=self.request.user.username)

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        workflow = self.get_object()
        workflow.is_active = not workflow.is_active
        workflow.save()
        return Response({"is_active": workflow.is_active})

    @action(detail=False, methods=["get"])
    def by_doctype(self, request):
        doctype = request.query_params.get("doctype", "")
        workflows = Workflow.objects.filter(document_type=doctype, is_active=True)
        serializer = self.get_serializer(workflows, many=True)
        return Response(serializer.data)


class WorkflowDocumentStateViewSet(viewsets.ModelViewSet):
    queryset = WorkflowDocumentState.objects.select_related("state").all()
    serializer_class = WorkflowDocumentStateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        workflow_id = self.request.query_params.get("workflow")
        if workflow_id:
            qs = qs.filter(workflow_id=workflow_id)
        return qs


class WorkflowTransitionViewSet(viewsets.ModelViewSet):
    queryset = WorkflowTransition.objects.select_related("state", "next_state").all()
    serializer_class = WorkflowTransitionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        workflow_id = self.request.query_params.get("workflow")
        if workflow_id:
            qs = qs.filter(workflow_id=workflow_id)
        return qs


class WorkflowActionViewSet(viewsets.ModelViewSet):
    queryset = WorkflowAction.objects.prefetch_related("permitted_roles").all()
    serializer_class = WorkflowActionSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        action_obj = self.get_object()
        action_obj.status = "Completed"
        action_obj.completed_by = request.user.username
        action_obj.save()

        # Determine if this is an approval or rejection based on the action name
        action_name = (action_obj.action or "").lower()
        if "reject" in action_name or "deny" in action_name:
            event = "workflow_rejected"
        else:
            event = "workflow_approved"

        try:
            from apps.roles.notification_dispatcher import dispatch_notification
            dispatch_notification(
                event=event,
                subject=f"Workflow action '{action_obj.action}' completed by {request.user.username}",
                message=f"Action '{action_obj.action}' on {action_obj.reference_doctype or 'document'} {action_obj.reference_name or ''} has been completed.",
                reference_doctype=action_obj.reference_doctype or "",
                reference_name=action_obj.reference_name or "",
                triggered_by=request.user,
            )
        except Exception:
            pass

        return Response({"status": "Completed"})


# ── EmailTemplate ─────────────────────────────────────────────────
class EmailTemplateSerializer(serializers.ModelSerializer):
    response_ = serializers.SerializerMethodField()

    class Meta:
        model = EmailTemplate
        fields = "__all__"

    def get_response_(self, obj):
        return obj.response_


class EmailTemplateViewSet(viewsets.ModelViewSet):
    queryset = EmailTemplate.objects.all()
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=["post"])
    def preview(self, request, pk=None):
        """Render template with sample data."""
        template = self.get_object()
        sample_data = {
            "doc": {
                "name": "TEST-00001",
                "customer": "Test Customer",
                "grand_total": 1500.00,
                "status": "Draft",
                "owner": request.user.username,
            },
            "user": {
                "full_name": request.user.get_full_name() or request.user.username,
                "email": request.user.email,
            },
        }
        rendered = template.get_formatted_email(sample_data)
        return Response(rendered)

    @action(detail=False, methods=["get"])
    def by_category(self, request):
        category = request.query_params.get("category", "")
        qs = self.get_queryset()
        if category:
            qs = qs.filter(category=category)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# ── NotificationSetting ──────────────────────────────────────────

class NotificationSettingSerializer(serializers.ModelSerializer):
    event_display = serializers.CharField(source="get_event_display", read_only=True)
    recipient_type_display = serializers.CharField(source="get_recipient_type_display", read_only=True)

    class Meta:
        model = NotificationSetting
        fields = [
            "id", "event", "event_display", "enabled",
            "send_email", "send_dashboard", "send_system",
            "recipient_type", "recipient_type_display",
            "recipient_roles", "recipient_users",
            "reference_doctype", "subject_template", "message_template",
            "creation", "modified", "owner",
        ]


class NotificationSettingViewSet(viewsets.ModelViewSet):
    queryset = NotificationSetting.objects.all()
    serializer_class = NotificationSettingSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["event", "reference_doctype"]
    filterset_fields = ["enabled", "send_email", "send_dashboard", "recipient_type"]

    @action(detail=False, methods=["get"])
    def events(self, request):
        """Return available event types with their current settings."""
        settings_map = {
            s.event: NotificationSettingSerializer(s).data
            for s in self.get_queryset()
        }
        events = []
        for code, label in NotificationSetting.EVENT_CHOICES:
            events.append({
                "code": code,
                "label": label,
                "setting": settings_map.get(code),
            })
        return Response(events)

    @action(detail=False, methods=["post"])
    def toggle_all(self, request):
        """Enable or disable all notifications."""
        enabled = request.data.get("enabled", True)
        count = self.get_queryset().update(enabled=enabled)
        return Response({"updated": count, "enabled": enabled})

    @action(detail=False, methods=["post"])
    def reset_defaults(self, request):
        """Reset all notification settings to defaults."""
        self.get_queryset().delete()
        NotificationSetting.load_defaults()
        return Response({"message": "All settings reset to defaults"})


# ── NotificationDelivery ──────────────────────────────────────────

class NotificationDeliverySerializer(serializers.ModelSerializer):
    event_display = serializers.SerializerMethodField()
    channel_display = serializers.CharField(source="get_channel_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    triggered_by_name = serializers.CharField(source="triggered_by.username", read_only=True, default="")
    action_url = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    class Meta:
        model = NotificationDelivery
        fields = [
            "id", "event", "event_display", "subject", "message",
            "channel", "channel_display", "status", "status_display",
            "recipient", "recipient_name",
            "reference_doctype", "reference_name",
            "category", "action_url",
            "triggered_by", "triggered_by_name",
            "email_sent", "email_sent_at",
            "creation", "read_at",
        ]
        read_only_fields = ["recipient_name", "email_sent_at", "read_at"]

    def get_event_display(self, obj):
        return obj.event.replace("_", " ").title()

    def get_action_url(self, obj):
        if getattr(obj, "action_url", ""):
            return obj.action_url
        if not obj.reference_doctype:
            return ""
        norm = obj.reference_doctype.replace(" ", "").lower()
        ref = obj.reference_name or ""
        if norm in ["patientappointment", "appointment"]:
            return f"/healthcare/appointments/{ref}" if ref else "/healthcare/appointments"
        if norm in ["labtest", "labresult"]:
            return f"/healthcare/lab-tests/{ref}" if ref else "/healthcare/lab-tests"
        if norm in ["patientencounter", "encounter"]:
            return f"/healthcare/encounters/{ref}" if ref else "/healthcare/encounters"
        if norm in ["patient"]:
            return f"/healthcare/patients/{ref}" if ref else "/healthcare/patients"
        if norm in ["drugprescription", "prescription"]:
            return "/healthcare/prescriptions"
        if norm in ["errorlog"]:
            return "/erp/error-logs"
        return ""

    def get_category(self, obj):
        cat = getattr(obj, "category", "")
        if cat:
            return cat
        if obj.event in ["error_log_created", "system_error", "scheduled_job_failure"] or obj.status == "failed":
            return "errors"
        if obj.event in ["communication_received"]:
            return "messages"
        if obj.event in ["comment_added"]:
            return "comments"
        return "clinical"


class NotificationDeliveryViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationDeliverySerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["subject", "message", "recipient_name"]
    filterset_fields = ["event", "channel", "status", "recipient", "category"]

    def get_queryset(self):
        user = self.request.user
        if not (user and user.is_authenticated):
            return NotificationDelivery.objects.none()

        from apps.roles.permissions import _get_user_role_names
        user_roles = set(_get_user_role_names(user))
        admin_roles = {"System Manager", "Administrator", "Healthcare Administrator"}
        is_admin = user.is_staff or user.is_superuser or bool(user_roles & admin_roles)

        query_params = getattr(self.request, "query_params", getattr(self.request, "GET", {}))
        category = query_params.get("category", "").lower()

        if is_admin:
            qs = NotificationDelivery.objects.all()
            if category == "errors":
                qs = qs.filter(
                    Q(status="failed")
                    | Q(category="errors")
                    | Q(event__in=["error_log_created", "system_error", "scheduled_job_failure"])
                )
            elif category and category != "all":
                qs = qs.filter(category=category)
            return qs
        else:
            # Non-admins: STRICTLY scoped to their assigned notifications
            if category == "errors":
                return NotificationDelivery.objects.none()
            qs = NotificationDelivery.objects.filter(recipient=user)
            if category and category != "all":
                qs = qs.filter(category=category)
            return qs

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        """Mark a notification as read."""
        delivery = self.get_object()
        delivery.mark_read()
        return Response({"status": "read"})

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        """Mark all notifications as read for the current user."""
        from django.utils import timezone as tz
        count = self.get_queryset().filter(status__in=["sent", "delivered"]).update(
            status="read", read_at=tz.now()
        )
        return Response({"marked_read": count})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        """Return count of unread notifications."""
        count = self.get_queryset().filter(status__in=["sent", "delivered"]).count()
        return Response({"unread_count": count})

    @action(detail=False, methods=["post"])
    def clear_old(self, request):
        """Delete notifications older than specified days."""
        days = request.data.get("days", 90)
        NotificationDelivery.clear_old(days=days)
        return Response({"message": f"Cleared notifications older than {days} days"})


# ── UserNotificationSetting ──────────────────────────────────────

class UserNotificationSettingSerializer(serializers.ModelSerializer):
    event_display = serializers.SerializerMethodField()
    effective = serializers.SerializerMethodField()

    class Meta:
        model = UserNotificationSetting
        fields = [
            "id", "user", "event", "event_display",
            "enabled", "send_email", "send_dashboard", "send_system",
            "mute_until", "creation", "modified", "effective",
        ]
        read_only_fields = ["user", "creation", "modified"]

    def get_event_display(self, obj):
        return obj.event.replace("_", " ").title()

    def get_effective(self, obj):
        """Return the resolved effective setting for this user+event."""
        return UserNotificationSetting.get_effective(obj.user, obj.event)


class UserNotificationSettingViewSet(viewsets.ModelViewSet):
    serializer_class = UserNotificationSettingSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["event"]
    filterset_fields = ["enabled", "event"]

    def get_queryset(self):
        return UserNotificationSetting.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"])
    def my_preferences(self, request):
        """Return all event preferences for the current user with effective values."""
        from .core_models import NotificationSetting

        user = request.user
        user_settings = {
            s.event: s for s in UserNotificationSetting.objects.filter(user=user)
        }
        global_settings = {
            s.event: s for s in NotificationSetting.objects.all()
        }

        result = []
        for event_code, event_label in NotificationSetting.EVENT_CHOICES:
            user_s = user_settings.get(event_code)
            global_s = global_settings.get(event_code)
            effective = UserNotificationSetting.get_effective(user, event_code)
            result.append({
                "event": event_code,
                "event_display": event_label,
                "user_override": {
                    "id": user_s.id if user_s else None,
                    "enabled": user_s.enabled if user_s else None,
                    "send_email": user_s.send_email if user_s else None,
                    "send_dashboard": user_s.send_dashboard if user_s else None,
                    "send_system": user_s.send_system if user_s else None,
                    "mute_until": user_s.mute_until.isoformat() if user_s and user_s.mute_until else None,
                } if user_s else None,
                "global_setting": {
                    "enabled": global_s.enabled if global_s else True,
                    "send_email": global_s.send_email if global_s else True,
                    "send_dashboard": global_s.send_dashboard if global_s else True,
                    "send_system": global_s.send_system if global_s else False,
                } if global_s else None,
                "effective": effective,
            })

        return Response(result)

    @action(detail=False, methods=["post"])
    def set_preference(self, request):
        """Update or create a preference override for an event."""
        event = request.data.get("event")
        if not event:
            return Response({"error": "Event is required"}, status=400)

        if request.data.get("reset"):
            UserNotificationSetting.objects.filter(user=request.user, event=event).delete()
            return Response({"status": "reset"})

        fields = ["enabled", "send_email", "send_dashboard", "send_system"]
        update_data = {}
        for f in fields:
            if f in request.data:
                update_data[f] = request.data[f]

        setting, _ = UserNotificationSetting.objects.update_or_create(
            user=request.user,
            event=event,
            defaults=update_data,
        )
        return Response(UserNotificationSettingSerializer(setting).data)

    @action(detail=False, methods=["post"])
    def bulk_preset(self, request):
        """Apply a bulk preset to all clinical notification preferences."""
        preset = request.data.get("preset") # 'critical_only' | 'enable_all' | 'routine_off'
        from .core_models import NotificationSetting

        critical_events = {"vital_signs_alert", "system_error", "scheduled_job_failure"}
        priority_events = {"inpatient_admission", "prescription_created", "low_stock_alert", "patient_appointment_cancelled", "workflow_rejected"}

        if preset == "critical_only":
            for code, _ in NotificationSetting.EVENT_CHOICES:
                is_crit = code in critical_events
                UserNotificationSetting.objects.update_or_create(
                    user=request.user,
                    event=code,
                    defaults={
                        "enabled": is_crit,
                        "send_dashboard": is_crit,
                        "send_email": is_crit,
                    }
                )
        elif preset == "enable_all":
            for code, _ in NotificationSetting.EVENT_CHOICES:
                UserNotificationSetting.objects.update_or_create(
                    user=request.user,
                    event=code,
                    defaults={
                        "enabled": True,
                        "send_dashboard": True,
                        "send_email": True,
                    }
                )
        return Response({"status": "applied", "preset": preset})
    def mute_all(self, request):
        """Mute all notifications for a duration."""
        from django.utils import timezone
        from datetime import timedelta
        from .core_models import NotificationSetting

        minutes = request.data.get("minutes", 60)
        mute_until = timezone.now() + timedelta(minutes=minutes)
        for event_code, _ in NotificationSetting.EVENT_CHOICES:
            UserNotificationSetting.objects.update_or_create(
                user=request.user,
                event=event_code,
                defaults={"mute_until": mute_until},
            )
        return Response({
            "muted_until": mute_until.isoformat(),
            "affected": len(NotificationSetting.EVENT_CHOICES),
        })

    @action(detail=False, methods=["post"])
    def unmute_all(self, request):
        """Unmute all notifications."""
        count = self.get_queryset().update(mute_until=None)
        return Response({"unmuted": count})

    @action(detail=False, methods=["post"])
    def reset_to_global(self, request):
        """Delete all user overrides, reverting to global defaults."""
        count = self.get_queryset().delete()[0]
        return Response({"reset": count})


# ── EmailAccount ──────────────────────────────────────────────────

class EmailAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailAccount
        fields = [
            "id", "email_account_name", "email_id", "email_sender_name",
            "smtp_server", "smtp_port", "smtp_username", "smtp_password",
            "use_tls", "use_ssl",
            "incoming_server", "incoming_port", "use_imap",
            "default_incoming", "default_outgoing",
            "enable_outgoing", "enable_incoming", "anonymized",
            "always_use_account_name", "bcc_address", "footer", "footer_included",
            "creation", "modified", "owner",
        ]
        extra_kwargs = {
            "smtp_password": {"write_only": False},  # Show in form but mask in UI
        }


class EmailAccountViewSet(viewsets.ModelViewSet):
    queryset = EmailAccount.objects.all()
    serializer_class = EmailAccountSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["email_account_name", "email_id"]
    filterset_fields = ["enable_outgoing", "enable_incoming", "default_outgoing", "default_incoming"]

    @action(detail=True, methods=["post"])
    def test_connection(self, request, pk=None):
        """Test SMTP connection for this email account."""
        account = self.get_object()
        if not account.smtp_server:
            return Response(
                {"success": False, "error": "No SMTP server configured"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            backend = account.get_smtp_connection()
            # Try to open connection
            backend.open()
            backend.close()
            return Response({"success": True, "message": "SMTP connection successful"})
        except Exception as e:
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["post"])
    def send_test_email(self, request, pk=None):
        """Send a test email using this account."""
        account = self.get_object()
        to_email = request.data.get("to_email", request.user.email)
        if not to_email:
            return Response(
                {"error": "No recipient email address provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        success = account.send_email(
            subject="ERP Test Email",
            message="This is a test email from your ERP system. If you received this, your email configuration is working correctly.",
            recipient_list=[to_email],
            html_message="""<h2 style="color: #667eea;">Test Email</h2>
            <p>This is a test email from your ERP system.</p>
            <p>If you received this, your email configuration is working correctly.</p>
            <p style="color: #999; font-size: 12px;">Sent from: {}</p>""".format(account.email_account_name),
        )
        return Response({
            "success": success,
            "message": f"Test email sent to {to_email}" if success else "Failed to send email",
            "to_email": to_email,
        })

    @action(detail=False, methods=["get"])
    def default_outgoing(self, request):
        """Return the default outgoing email account."""
        account = EmailAccount.get_default_outgoing()
        if account:
            return Response(self.get_serializer(account).data)
        return Response({"detail": "No outgoing email account configured"}, status=404)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_notification_email(request):
    """
    Send a custom notification email to specified recipients.
    Used by the bulk messaging page.
    """
    subject = request.data.get("subject", "")
    message = request.data.get("message", "")
    recipients = request.data.get("recipients", [])
    html_message = request.data.get("html_message", "")

    if not subject or not recipients:
        return Response(
            {"error": "subject and recipients are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from apps.roles.notification_dispatcher import _send_email, _build_html_email

    results = []
    for email in recipients:
        html = html_message or _build_html_email(
            subject=subject,
            message=message,
            event="communication_received",
            triggered_by=request.user,
        )
        success = _send_email(
            to_email=email,
            subject=subject,
            message=message,
            html_message=html,
        )
        results.append({"email": email, "success": success})

    sent = sum(1 for r in results if r["success"])
    failed = len(results) - sent

    return Response({
        "sent": sent,
        "failed": failed,
        "results": results,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_counts(request):
    """
    Return unread/notification counts for sidebar badges, scoped strictly by role.
    """
    from django.db.models import Q
    from django.utils import timezone
    from datetime import timedelta
    from apps.roles.permissions import _get_user_role_names

    user = request.user
    counts = {}

    user_roles = set(_get_user_role_names(user))
    admin_roles = {"System Manager", "Administrator", "Healthcare Administrator"}
    is_admin = user.is_staff or user.is_superuser or bool(user_roles & admin_roles)

    since_24h = timezone.now() - timedelta(hours=24)
    since_7d = timezone.now() - timedelta(days=7)

    if is_admin:
        # Healthcare Administrator sees Errors, System failures, and Admin notifications
        counts["error_logs"] = ErrorLog.objects.filter(creation__gte=since_24h).count()
        counts["error_logs_total"] = ErrorLog.objects.count()
        counts["job_failures"] = (
            ScheduledJobLog.objects.filter(
                status="Failure",
                scheduled_job_type__last_execution__gte=since_24h
            ).count() if ScheduledJobLog.objects.exists() else 0
        )
        counts["failed_deliveries"] = NotificationDelivery.objects.filter(status="failed").count()
        counts["unread_notifications"] = NotificationDelivery.objects.filter(
            recipient=user, status__in=["sent", "delivered"]
        ).count()
        counts["communications"] = 0
        counts["comments"] = 0
        counts["workflow_actions"] = WorkflowAction.objects.filter(status="Pending").count()
    else:
        # Non-admins: No access to system errors or failed jobs
        counts["error_logs"] = 0
        counts["error_logs_total"] = 0
        counts["job_failures"] = 0
        counts["failed_deliveries"] = 0

        # Unread notifications delivered to this specific user
        counts["unread_notifications"] = NotificationDelivery.objects.filter(
            recipient=user, status__in=["sent", "delivered"]
        ).count()

        # Messages (Communications)
        user_email = user.email or ""
        counts["communications"] = Communication.objects.filter(
            creation__gte=since_7d
        ).filter(
            Q(user=user)
            | Q(recipients__icontains=user_email)
            | Q(recipients__icontains=user.username)
        ).exclude(communication_type="Chat").exclude(read_by_recipient=True).count()

        # Comments on user's documents
        counts["comments"] = Comment.objects.filter(
            creation__gte=since_24h
        ).filter(
            Q(owner=user.username) | Q(reference_owner=user.username)
        ).count()

        # Pending workflow actions assigned to user's roles
        counts["workflow_actions"] = WorkflowAction.objects.filter(
            status="Pending"
        ).filter(
            Q(permitted_roles__role__in=list(user_roles))
        ).distinct().count()

    return Response(counts)


# ═══════════════════════════════════════════════════════════════════
#  URL ROUTES
# ═══════════════════════════════════════════════════════════════════

def get_core_urlpatterns():
    """Return URL patterns for all core doctypes."""
    from django.urls import include, path
    from rest_framework.routers import DefaultRouter

    router = DefaultRouter()

    # Comments & Communications
    router.register(r"comments", CommentViewSet, basename="comment")
    router.register(r"communications", CommunicationViewSet, basename="communication")

    # Logging & Audit
    router.register(r"error-logs", ErrorLogViewSet, basename="error-log")
    router.register(r"versions", VersionViewSet, basename="version")
    router.register(r"view-logs", ViewLogViewSet, basename="view-log")
    router.register(r"deleted-documents", DeletedDocumentViewSet, basename="deleted-document")

    # Naming & Rules
    router.register(r"naming-rules", DocumentNamingRuleViewSet, basename="naming-rule")
    router.register(r"custom-roles", CustomRoleViewSet, basename="custom-role")
    router.register(r"page-report-roles", RolePermissionForPageAndReportViewSet, basename="page-report-role")

    # Scheduled Jobs
    router.register(r"job-types", ScheduledJobTypeViewSet, basename="job-type")
    router.register(r"job-logs", ScheduledJobLogViewSet, basename="job-log")

    # Scripts
    router.register(r"server-scripts", ServerScriptViewSet, basename="server-script")

    # Data Import/Export
    router.register(r"data-imports", DataImportViewSet, basename="data-import")
    router.register(r"data-exports", DataExportViewSet, basename="data-export")

    # Reports
    router.register(r"prepared-reports", PreparedReportViewSet, basename="prepared-report")
    router.register(r"submission-queue", SubmissionQueueViewSet, basename="submission-queue")

    # Pages & Reports
    router.register(r"pages-list", PageViewSet, basename="page-list")
    router.register(r"reports-list", ReportViewSet, basename="report-list")

    # DocType metadata
    router.register(r"doc-fields", DocFieldViewSet, basename="doc-field")
    router.register(r"doctype-links", DocTypeLinkViewSet, basename="doctype-link")
    router.register(r"doctype-actions", DocTypeActionViewSet, basename="doctype-action")
    router.register(r"doctype-states", DocTypeStateViewSet, basename="doctype-state")

    # Workflow
    router.register(r"workflows", WorkflowViewSet, basename="workflow")
    router.register(r"workflow-states", WorkflowStateViewSet, basename="workflow-state")
    router.register(r"workflow-doc-states", WorkflowDocumentStateViewSet, basename="workflow-doc-state")
    router.register(r"workflow-transitions", WorkflowTransitionViewSet, basename="workflow-transition")
    router.register(r"workflow-actions", WorkflowActionViewSet, basename="workflow-action")

    # Email Templates
    router.register(r"email-templates", EmailTemplateViewSet, basename="email-template")

    return [
        path("", include(router.urls)),
        path("permission-inspector/", permission_inspector, name="permission-inspector"),
    ]
