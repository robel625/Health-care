"""DRF mixin for applying Frappe-style row-level UserPermission filtering.

Usage:
    from apps.roles.filters import UserPermissionFilterMixin

    class CustomerViewSet(UserPermissionFilterMixin, viewsets.ModelViewSet):
        doctype_name = "Customer"
        queryset = Customer.objects.all()
        ...

The mixin overrides get_queryset() to filter based on the user's
UserPermission records. Staff/admin users see everything.
"""

from apps.roles.permissions import apply_user_permissions


class UserPermissionFilterMixin:
    """
    Mixin that adds row-level UserPermission filtering to a DRF ViewSet.

    Requires:
        - doctype_name attribute on the viewset
        - The queryset's model should have an 'owner' field (from BaseModel)

    Attributes:
        doctype_name: The Frappe doctype name to check permissions for
        user_field: The model field to filter by user identity (default: "owner")
    """

    doctype_name = None
    user_field = "owner"

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if not user or not user.is_authenticated:
            return queryset.none()

        if not self.doctype_name:
            return queryset

        return apply_user_permissions(queryset, user, self.doctype_name, self.user_field)
