/**
 * PermissionGuard - Frappe-style conditional rendering component.
 *
 * Renders children only if the user has the required permission(s) on a doctype.
 * If not authorized, renders nothing (or an optional fallback).
 *
 * Usage:
 *   <PermissionGuard doctype="Customer" action="create">
 *     <Button onClick={handleCreate}>New Customer</Button>
 *   </PermissionGuard>
 *
 *   <PermissionGuard doctype="Sales Order" action={["write", "submit"]} fallback={<Badge>Read Only</Badge>}>
 *     <Button onClick={handleSubmit}>Submit</Button>
 *   </PermissionGuard>
 */

import type { PermFlag } from "@/utils/permissions";
import { useDoctypePermissions } from "@/utils/permissions";

interface PermissionGuardProps {
  /** The doctype name to check permissions against */
  doctype: string;
  /** Single action or array of actions - user needs ANY of these */
  action: PermFlag | PermFlag[];
  /** Content to render if permission is granted */
  children: React.ReactNode;
  /** Content to render if permission is denied (default: nothing) */
  fallback?: React.ReactNode;
}

/**
 * Simple permission guard - checks if user has a specific permission.
 */
export function PermissionGuard({ doctype, action, children, fallback = null }: PermissionGuardProps) {
  const userPerms = useDoctypePermissions(doctype);
  const actions = Array.isArray(action) ? action : [action];

  // Staff always passes
  if (userPerms.isStaff) {
    return <>{children}</>;
  }

  // Check if user has ANY of the required actions
  const hasAny = actions.some((a) => {
    switch (a) {
      case "read": return userPerms.canRead;
      case "write": return userPerms.canWrite;
      case "create": return userPerms.canCreate;
      case "delete": return userPerms.canDelete;
      case "submit": return userPerms.canSubmit;
      case "cancel": return userPerms.canCancel;
      case "amend": return userPerms.canAmend;
      case "report": return userPerms.canReport;
      case "export": return userPerms.canExport;
      case "import": return userPerms.canImport;
      case "print": return userPerms.canPrint;
      case "email": return userPerms.canEmail;
      case "share": return userPerms.canShare;
      case "select": return userPerms.canSelect;
      default: return false;
    }
  });

  return hasAny ? <>{children}</> : <>{fallback}</>;
}

/**
 * Hook-based version for more complex conditions.
 *
 * Usage:
 *   const guard = usePermissionGuard("Customer");
 *   if (guard.can("create")) { ... }
 */
export function usePermissionGuard(doctype: string) {
  const perms = useDoctypePermissions(doctype);

  return {
    can: (action: PermFlag): boolean => {
      if (perms.isStaff) return true;
      switch (action) {
        case "read": return perms.canRead;
        case "write": return perms.canWrite;
        case "create": return perms.canCreate;
        case "delete": return perms.canDelete;
        case "submit": return perms.canSubmit;
        case "cancel": return perms.canCancel;
        case "amend": return perms.canAmend;
        case "report": return perms.canReport;
        case "export": return perms.canExport;
        case "import": return perms.canImport;
        case "print": return perms.canPrint;
        case "email": return perms.canEmail;
        case "share": return perms.canShare;
        case "select": return perms.canSelect;
        default: return false;
      }
    },
    canAny: (...actions: PermFlag[]): boolean => {
      if (perms.isStaff) return true;
      return actions.some((a) => {
        switch (a) {
          case "read": return perms.canRead;
          case "write": return perms.canWrite;
          case "create": return perms.canCreate;
          case "delete": return perms.canDelete;
          case "submit": return perms.canSubmit;
          case "cancel": return perms.canCancel;
          case "amend": return perms.canAmend;
          case "report": return perms.canReport;
          case "export": return perms.canExport;
          case "import": return perms.canImport;
          case "print": return perms.canPrint;
          case "email": return perms.canEmail;
          case "share": return perms.canShare;
          case "select": return perms.canSelect;
          default: return false;
        }
      });
    },
    canAll: (...actions: PermFlag[]): boolean => {
      if (perms.isStaff) return true;
      return actions.every((a) => {
        switch (a) {
          case "read": return perms.canRead;
          case "write": return perms.canWrite;
          case "create": return perms.canCreate;
          case "delete": return perms.canDelete;
          case "submit": return perms.canSubmit;
          case "cancel": return perms.canCancel;
          case "amend": return perms.canAmend;
          case "report": return perms.canReport;
          case "export": return perms.canExport;
          case "import": return perms.canImport;
          case "print": return perms.canPrint;
          case "email": return perms.canEmail;
          case "share": return perms.canShare;
          case "select": return perms.canSelect;
          default: return false;
        }
      });
    },
    perms,
  };
}
