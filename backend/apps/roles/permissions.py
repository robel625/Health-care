"""
Frappe-style permission classes for Django REST Framework.

Implements Frappe's permission model:
  1. Role-based: user has roles -> roles have DocPerm entries
  2. DocPerm: per-Doctype permissions at different permlevels
  3. CustomDocPerm: admin overrides of standard DocPerm
  4. if_owner: permission only applies if user is document owner
  5. UserPermission: row-level restrictions
  6. DocShare: per-document sharing

Usage:
    from apps.roles.permissions import HasPermissionOrAdmin

    class MyView(ModelViewSet):
        permission_classes = [HasPermissionOrAdmin]
        doctype_name = "Customer"
"""

from django.db import models
from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Django staff/superusers or users with administrative roles."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        user_roles = set(_get_user_role_names(request.user))
        admin_roles = {"System Manager", "Administrator", "Healthcare Administrator"}
        return bool(user_roles & admin_roles)


class HasRole(BasePermission):
    """
    Check that the user has at least one of the listed roles.

    Usage:
        class MyView(APIView):
            permission_classes = [HasRole]
            required_roles = ["Sales Manager", "Administrator"]
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True

        required_roles = getattr(view, "required_roles", [])
        if not required_roles:
            return True

        user_roles = _get_user_role_names(request.user)
        return bool(set(user_roles) & set(required_roles))


class HasPermission(BasePermission):
    """
    Frappe-style: check doctype + permission_type against the user's roles.

    Usage:
        class CustomerView(ModelViewSet):
            permission_classes = [HasPermission]
            doctype_name = "Customer"
            # required_permission auto-detected from HTTP method
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True

        doctype_name = getattr(view, "doctype_name", None)
        if not doctype_name:
            return True

        required_perm = _get_required_permission(request, view)
        return _user_has_doctype_permission(request.user, doctype_name, required_perm)


class HasPermissionOrAdmin(BasePermission):
    """
    Same as HasPermission but staff/admins always pass.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True

        doctype_name = getattr(view, "doctype_name", None)
        if not doctype_name:
            return True

        required_perm = _get_required_permission(request, view)
        return _user_has_doctype_permission(request.user, doctype_name, required_perm)


# ── Frappe-style Permission Check Engine ───────────────────────────
def _get_required_permission(request, view):
    """Map HTTP method to Frappe permission flag."""
    required_perm = getattr(view, "required_permission", None)
    if required_perm:
        return required_perm

    method_map = {
        "GET": "read",
        "HEAD": "read",
        "OPTIONS": "read",
        "POST": "create",
        "PUT": "write",
        "PATCH": "write",
        "DELETE": "delete",
    }
    return method_map.get(request.method, "read")


def _get_user_role_names(user):
    """Get all active role names for a user from both UserRole and HasRole tables."""
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


def _get_user_role_ids(user):
    """Get all active role IDs for a user."""
    from .models import UserRole, HasRole

    role_ids = set(
        UserRole.objects.filter(user=user, role__is_active=True)
        .values_list("role_id", flat=True)
    )
    role_ids |= set(
        HasRole.objects.filter(user=user, role__is_active=True)
        .values_list("role_id", flat=True)
    )
    return role_ids


def _user_has_doctype_permission(user, doctype_name, permission_type, permlevel=0):
    """
    Check if a user has a specific permission on a doctype via their roles.
    
    Frappe logic:
      1. Get user's active roles
      2. Check DocPerm for the given doctype + role + permlevel + flag
      3. Check CustomDocPerm overrides (CustomDocPerm takes precedence)
      4. Admin/staff always pass
    """
    from .models import CustomDocPerm, DocPerm, DocType

    role_names = set(_get_user_role_names(user))
    if "System Manager" in role_names or "Administrator" in role_names or "Healthcare Administrator" in role_names:
        return True

    role_ids = _get_user_role_ids(user)
    if not role_ids:
        return False

    # Try to find the doctype
    try:
        doctype = DocType.objects.get(name=doctype_name)
    except DocType.DoesNotExist:
        return False

    # Check CustomDocPerm first (overrides standard per role)
    custom_perms = CustomDocPerm.objects.filter(
        doctype_ref=doctype,
        role_id__in=role_ids,
        permlevel=permlevel,
    )
    if custom_perms.exists():
        for cp in custom_perms:
            if getattr(cp, permission_type, False):
                return True
        return False

    # Fall back to standard DocPerm
    standard_perms = DocPerm.objects.filter(
        doctype_ref=doctype,
        role_id__in=role_ids,
        permlevel=permlevel,
    )
    for sp in standard_perms:
        if getattr(sp, permission_type, False):
            return True

    return False


def _user_has_doctype_permission_with_owner(user, doctype_name, permission_type, doc_owner=None, permlevel=0):
    """
    Extended permission check with if_owner support.
    If a DocPerm has if_owner=True, it only grants access if the user is the document owner.
    """
    from .models import CustomDocPerm, DocPerm, DocType

    role_names = set(_get_user_role_names(user))
    if "System Manager" in role_names or "Administrator" in role_names or "Healthcare Administrator" in role_names:
        return True

    role_ids = _get_user_role_ids(user)
    if not role_ids:
        return False

    try:
        doctype = DocType.objects.get(name=doctype_name)
    except DocType.DoesNotExist:
        return False

    # Check CustomDocPerm first
    custom_perms = CustomDocPerm.objects.filter(
        doctype_ref=doctype,
        role_id__in=role_ids,
        permlevel=permlevel,
    )
    if custom_perms.exists():
        for cp in custom_perms:
            if getattr(cp, permission_type, False):
                if cp.if_owner:
                    if doc_owner and str(user.id) == str(doc_owner):
                        return True
                else:
                    return True
        return False

    # Fall back to standard DocPerm
    standard_perms = DocPerm.objects.filter(
        doctype_ref=doctype,
        role_id__in=role_ids,
        permlevel=permlevel,
    )
    for sp in standard_perms:
        if getattr(sp, permission_type, False):
            if sp.if_owner:
                if doc_owner and str(user.id) == str(doc_owner):
                    return True
            else:
                return True

    return False


# ── Public Permission Helpers ──────────────────────────────────────
def get_user_permissions(user):
    """
    Return a dict of {doctype_name: [permission_type, ...]} for the user.
    Mirrors Frappe's get_user_permissions() function.
    """
    from .models import CustomDocPerm, DocPerm, DocType

    role_ids = _get_user_role_ids(user)
    if not role_ids:
        return {}

    result = {}

    # Collect all DocPerm entries for user's roles
    all_perms = DocPerm.objects.filter(
        role_id__in=role_ids,
    ).select_related("doctype_ref")

    for perm in all_perms:
        doctype_name = perm.doctype_ref.name
        for flag in perm.get_active_permissions():
            result.setdefault(doctype_name, set()).add(flag)

    # Apply CustomDocPerm overrides
    custom_perms = CustomDocPerm.objects.filter(
        role_id__in=role_ids,
    ).select_related("doctype_ref")

    for cp in custom_perms:
        doctype_name = cp.doctype_ref.name
        active = []
        for flag_name in [
            "select", "read", "write", "create", "delete",
            "submit", "cancel", "amend", "report", "export",
            "print", "email", "share", "mask",
        ]:
            if getattr(cp, flag_name, False):
                active.append(flag_name)
        if getattr(cp, "perm_import", False):
            active.append("import")

        if active:
            # CustomDocPerm replaces standard permissions for this doctype+role
            result.setdefault(doctype_name, set())
            result[doctype_name] |= set(active)

    # Convert sets to sorted lists
    return {k: sorted(v) for k, v in result.items()}


def get_user_row_permissions(user, doctype_name):
    """
    Get row-level UserPermission restrictions for a doctype.
    Mirrors Frappe's get_user_permissions() filtered by doctype.
    """

    from .models import UserPermission

    user_perms = UserPermission.objects.filter(
        user=user,
        allow=doctype_name,
    )

    return [
        {
            "for_value": up.for_value,
            "is_default": up.is_default,
            "apply_to_all_doctypes": up.apply_to_all_doctypes,
            "applicable_for": up.applicable_for,
            "hide_descendants": up.hide_descendants,
        }
        for up in user_perms
    ]


# ── Queryset Filtering ─────────────────────────────────────────────

# Map doctype names to their model's "owner" field and link fields.
# "owner" = field that stores the document creator's username
# "link_fields" = fields that reference other doctypes (for apply_to_all_doctypes)
DOCTYPE_FILTER_CONFIG = {
    # ── Healthcare DocTypes ───────────────────────────
    "Patient": {
        "owner_field": "owner",
        "link_fields": {
            "medical_department": "Medical Department",
        },
    },
    "Patient Appointment": {
        "owner_field": "owner",
        "link_fields": {
            "department": "Medical Department",
            "practitioner": "Healthcare Practitioner",
            "patient": "Patient",
        },
    },
    "Patient Encounter": {
        "owner_field": "owner",
        "link_fields": {
            "medical_department": "Medical Department",
            "practitioner": "Healthcare Practitioner",
            "patient": "Patient",
        },
    },
    "Vital Signs": {
        "owner_field": "owner",
        "link_fields": {
            "patient": "Patient",
        },
    },
    "Drug Prescription": {
        "owner_field": "owner",
        "link_fields": {
            "practitioner": "Healthcare Practitioner",
            "patient": "Patient",
        },
    },
    "Lab Test": {
        "owner_field": "owner",
        "link_fields": {
            "department": "Medical Department",
            "practitioner": "Healthcare Practitioner",
            "patient": "Patient",
        },
    },
    "Inpatient Record": {
        "owner_field": "owner",
        "link_fields": {
            "medical_department": "Medical Department",
            "patient": "Patient",
        },
    },
    "Nursing Task": {
        "owner_field": "owner",
        "link_fields": {
            "patient": "Patient",
        },
    },
    "Clinical Procedure": {
        "owner_field": "owner",
        "link_fields": {
            "medical_department": "Medical Department",
            "practitioner": "Healthcare Practitioner",
            "patient": "Patient",
        },
    },
    "Therapy Plan": {
        "owner_field": "owner",
        "link_fields": {
            "practitioner": "Healthcare Practitioner",
            "patient": "Patient",
        },
    },
    "Medication Request": {
        "owner_field": "owner",
        "link_fields": {
            "practitioner": "Healthcare Practitioner",
            "patient": "Patient",
        },
    },
    "Pharmacy Stock": {
        "owner_field": "owner",
        "link_fields": {
            "warehouse": "Pharmacy Warehouse",
        },
    },
    # ── Generic Legacy DocTypes ───────────────────────
    "Customer": {
        "owner_field": "owner",
        "link_fields": {},
    },
    "Supplier": {
        "owner_field": "owner",
        "link_fields": {},
    },
}


def apply_user_permissions(queryset, user, doctype_name, user_field="owner"):
    """
    Filter a queryset based on the user's UserPermission records.

    Frappe behavior:
      - Staff/admin users see everything (no filtering)
      - If no UserPermission records exist for the user, user sees everything
      - Filters by direct permissions on this doctype and linked permissions
        (e.g., Medical Department -> Patient Appointment)
    """
    from .models import UserPermission

    # Staff/admin always sees everything
    if not user or not user.is_authenticated or user.is_staff:
        return queryset

    # Check if user has admin role
    role_names = set(_get_user_role_names(user))
    if "System Manager" in role_names or "Administrator" in role_names or "Healthcare Administrator" in role_names:
        return queryset

    user_perms = UserPermission.objects.filter(user=user)
    if not user_perms.exists():
        return queryset

    config = DOCTYPE_FILTER_CONFIG.get(doctype_name, {})
    link_fields = config.get("link_fields", {})

    from django.db.models import Q
    has_filter = False
    q_filter = Q()

    # Direct permissions on this doctype
    direct_perms = user_perms.filter(allow=doctype_name)
    if direct_perms.exists():
        allowed_values = list(direct_perms.values_list("for_value", flat=True))
        q_filter |= Q(**{f"{user_field}__in": allowed_values})
        has_filter = True

    # Linked permissions (e.g., restricting department or practitioner)
    for field_name, linked_doctype in link_fields.items():
        linked = user_perms.filter(allow=linked_doctype, apply_to_all_doctypes=True)
        if linked.exists():
            linked_values = list(linked.values_list("for_value", flat=True))
            sub_q = None
            if linked_doctype == "Medical Department":
                sub_q = Q(**{f"{field_name}__department__in": linked_values})
            elif linked_doctype == "Healthcare Practitioner":
                sub_q = Q(**{f"{field_name}__practitioner_name__in": linked_values}) | Q(**{f"{field_name}__practitioner_id__in": linked_values})
            elif linked_doctype == "Patient":
                sub_q = Q(**{f"{field_name}__patient_name__in": linked_values}) | Q(**{f"{field_name}__patient_id__in": linked_values})
            else:
                sub_q = Q(**{f"{field_name}__in": linked_values})

            if sub_q:
                try:
                    queryset.filter(sub_q)
                    q_filter &= sub_q
                    has_filter = True
                except Exception:
                    pass

    if has_filter:
        try:
            return queryset.filter(q_filter)
        except Exception:
            return queryset

    return queryset



def check_docshare(user, doctype, docname, rights=None):
    """
    Check if a user has been shared a specific document.
    Mirrors Frappe's frappe.share.check_docshare().
    
    Args:
        rights: list of rights to check, e.g. ["read", "write"]
    """
    from .models import DocShare

    if rights is None:
        rights = ["read"]

    # Check if shared with user directly
    shares = DocShare.objects.filter(
        share_doctype=doctype,
        share_name=str(docname),
    ).filter(
        models.Q(user=user) | models.Q(everyone=True)
    )

    for share in shares:
        if all(getattr(share, r, False) for r in rights):
            return True

    return False


def add_user_permission(doctype, docname, user, is_default=0, hide_descendants=0, applicable_for=None):
    """
    Add a user permission entry.
    Mirrors Frappe's add_user_permission().
    """
    from .models import UserPermission

    apply_to_all = not applicable_for

    user_perm, created = UserPermission.objects.get_or_create(
        user=user,
        allow=doctype,
        for_value=str(docname),
        applicable_for=applicable_for or "",
        apply_to_all_doctypes=apply_to_all,
        defaults={
            "is_default": is_default,
            "hide_descendants": hide_descendants,
        },
    )
    return user_perm


# ── Access Log Helper ──────────────────────────────────────────────
def make_access_log(user=None, doctype=None, document=None, method=None,
                    file_type=None, report_name=None, filters=None,
                    page=None, columns=None):
    """
    Create an AccessLog entry.
    Mirrors Frappe's make_access_log() function.
    """
    from .models import AccessLog

    AccessLog.objects.create(
        user=user,
        export_from=doctype or "",
        reference_document=str(document) if document else "",
        method=method or "",
        file_type=file_type or "",
        report_name=report_name or "",
        filters=str(filters) if filters else "",
        page=page or "",
        columns=columns or "",
    )


# ── Activity Log Helper ───────────────────────────────────────────
def add_authentication_log(subject, user, operation="Login", status="Success", ip_address=None):
    """
    Create an ActivityLog entry for authentication events.
    Mirrors Frappe's add_authentication_log().
    """
    from .models import ActivityLog

    ActivityLog.objects.create(
        subject=subject,
        user=user,
        operation=operation,
        status=status,
        ip_address=ip_address,
    )
