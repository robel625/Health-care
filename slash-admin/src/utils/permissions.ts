/**
 * Healthcare Permission Utilities for React Frontend.
 *
 * Maps backend DocPerm flags to frontend permission checks.
 * The backend returns permissions as an array of {id, name, code} objects
 * where code is like "Patient:read", "Patient Encounter:write", etc.
 *
 * Usage:
 *   const { canRead, canWrite, canCreate, canDelete } = useDoctypePermissions("Patient");
 *   if (canCreate) { showCreateButton(); }
 */

import { useUserInfo } from "@/store/userStore";

// ── Permission Flag Types ──────────────────────────────────────────
export type PermFlag =
  | "select"
  | "read"
  | "write"
  | "create"
  | "delete"
  | "submit"
  | "cancel"
  | "amend"
  | "report"
  | "export"
  | "import"
  | "print"
  | "email"
  | "share"
  | "mask";

// ── Parse Permissions from User Info ───────────────────────────────

/**
 * Extract the set of permission codes the current user has.
 * Returns a Set like {"Customer:read", "Sales Order:write", ...}
 */
function getUserPermCodes(user: any): Set<string> {
  const perms = user?.permissions || [];
  const codes = new Set<string>();
  for (const p of perms) {
    if (p?.code) {
      codes.add(p.code);
    } else if (typeof p === "string") {
      codes.add(p);
    }
  }
  return codes;
}

/**
 * Check if the user has a specific permission on a doctype.
 * @param user - The user info object from the store
 * @param doctype - The doctype name (e.g. "Customer")
 * @param flag - The permission flag (e.g. "read", "write", "create")
 */
export function hasPermission(user: any, doctype: string, flag: PermFlag): boolean {
  // Staff/admin users always have all permissions
  if (user?.is_staff) return true;

  const codes = getUserPermCodes(user);
  return codes.has(`${doctype}:${flag}`);
}

/**
 * Get all permissions for a specific doctype.
 * Returns an array of permission flags the user has.
 */
export function getDoctypePermissions(user: any, doctype: string): PermFlag[] {
  if (user?.is_staff) {
    return ["select", "read", "write", "create", "delete", "submit", "cancel", "amend", "report", "export", "import", "print", "email", "share", "mask"];
  }

  const codes = getUserPermCodes(user);
  const flags: PermFlag[] = [];
  const allFlags: PermFlag[] = ["read", "write", "create", "delete", "submit", "cancel", "amend", "report", "export", "import", "print", "email", "share"];

  for (const flag of allFlags) {
    if (codes.has(`${doctype}:${flag}`)) {
      flags.push(flag);
    }
  }
  return flags;
}

// ── React Hooks ────────────────────────────────────────────────────

/**
 * Hook to get all permissions for a specific doctype.
 *
 * Usage:
 *   const perms = useDoctypePermissions("Customer");
 *   if (perms.canCreate) { ... }
 */
export function useDoctypePermissions(doctype: string) {
  const user = useUserInfo();
  const perms = getDoctypePermissions(user, doctype);

  return {
    canSelect: perms.includes("select"),
    canRead: perms.includes("read"),
    canWrite: perms.includes("write"),
    canCreate: perms.includes("create"),
    canDelete: perms.includes("delete"),
    canSubmit: perms.includes("submit"),
    canCancel: perms.includes("cancel"),
    canAmend: perms.includes("amend"),
    canReport: perms.includes("report"),
    canExport: perms.includes("export"),
    canImport: perms.includes("import"),
    canPrint: perms.includes("print"),
    canEmail: perms.includes("email"),
    canShare: perms.includes("share"),
    flags: perms,
    isStaff: !!user?.is_staff,
  };
}

/**
 * Simple hook to check if the current user has a specific permission.
 *
 * Usage:
 *   const canEdit = useHasPermission("Customer", "write");
 *   if (canEdit) { showEditButton(); }
 */
export function useHasPermission(doctype: string, flag: PermFlag): boolean {
  const user = useUserInfo();
  return hasPermission(user, doctype, flag);
}

/**
 * Hook to check multiple permissions at once.
 *
 * Usage:
 *   const { read, write, create, delete } = useCanDo("Customer");
 */
export function useCanDo(doctype: string) {
  const user = useUserInfo();

  return {
    read: hasPermission(user, doctype, "read"),
    write: hasPermission(user, doctype, "write"),
    create: hasPermission(user, doctype, "create"),
    delete: hasPermission(user, doctype, "delete"),
    submit: hasPermission(user, doctype, "submit"),
    cancel: hasPermission(user, doctype, "cancel"),
    report: hasPermission(user, doctype, "report"),
    export: hasPermission(user, doctype, "export"),
    print: hasPermission(user, doctype, "print"),
    isStaff: !!user?.is_staff,
  };
}

/**
 * Hook to check if the user has any of the given roles.
 */
export function useHasRole(...roleNames: string[]): boolean {
  const user = useUserInfo();
  if (user?.is_staff) return true;

  const userRoles = user?.roles || [];
  for (const role of userRoles) {
    const name = typeof role === "string" ? role : role?.name;
    if (name && roleNames.includes(name)) return true;
  }
  return false;
}

/**
 * Hook to check if the user is an administrator.
 */
export function useIsAdmin(): boolean {
  const user = useUserInfo();
  return !!user?.is_staff;
}

/**
 * Granular Role-Based Access Control hook for Healthcare modules.
 * Determines specific role boundaries and capabilities:
 * - Healthcare Administrator
 * - Receptionist
 * - Practitioner (Doctor)
 * - Laboratory Technician
 * - Pharmacist
 * - Nurse
 */
export function useHealthcareRoles() {
  const user = useUserInfo();
  const isStaff = !!user?.is_staff;
  const userRoles = (user?.roles || []).map((r: any) => (typeof r === "string" ? r : r?.name || "")).filter(Boolean);

  const isAdmin = isStaff || userRoles.some(r => ["Healthcare Administrator", "System Manager", "Administrator"].includes(r));
  const isDoctor = userRoles.some(r => ["Physician", "Doctor", "Healthcare Practitioner", "Practitioner"].includes(r));
  const isReceptionist = userRoles.some(r => ["Receptionist"].includes(r));
  const isLabTech = userRoles.some(r => ["Laboratory User", "Lab Technician", "LabTest Approver"].includes(r));
  const isPharmacist = userRoles.some(r => ["Pharmacy User", "Pharmacist"].includes(r));
  const isNurse = userRoles.some(r => ["Nursing User", "Nurse"].includes(r));

  return {
    isStaff,
    isAdmin,
    isDoctor,
    isReceptionist,
    isLabTech,
    isPharmacist,
    isNurse,
    userRoles,
    // Granular Clinical & Privacy Boundaries
    // Administrative privileges must not automatically grant access to confidential clinical records
    canViewClinical: isDoctor || isNurse,
    canViewConfidential: isDoctor,
    canDispense: isPharmacist || isStaff,
    canManageLabResults: isLabTech || isStaff,
    canManageAppointments: isReceptionist || isAdmin || isStaff,
    canRegisterPatient: isReceptionist || isAdmin || isStaff,
  };
}

// ── Doctype Name Mapping ──────────────────────────────────────────

/**
 * Map navigation paths to their corresponding doctype names.
 * Used to determine which permissions to check for each nav item.
 */
export const PATH_TO_DOCTYPE: Record<string, string> = {
  "/erp/roles": "Role",
  "/erp/user-roles": "Role",
  "/erp/permission-matrix": "Role",
  "/erp/doctypes": "DocType",
  "/erp/comments": "Comment",
  "/erp/communications": "Communication",
  "/erp/error-logs": "Error Log",
  "/erp/scheduled-jobs": "Scheduled Job Type",
  // Healthcare
  "/healthcare": "Patient",
  "/healthcare/occupational": "Patient",
  "/healthcare/occupational/dashboard": "Patient",
  "/healthcare/occupational/incidents": "Patient",
  "/healthcare/occupational/fitness-evaluations": "Patient",
  "/healthcare/occupational/sick-leave-certificates": "Patient",
  "/healthcare/occupational/first-aid-kits": "Patient",
  "/healthcare/occupational/staff-registry": "Patient",
  "/healthcare/occupational/executive-report": "Patient",
  "/healthcare/occupational/emergency-sos": "Patient",
  "/healthcare/occupational/guarantee-of-payment": "Patient",
  "/healthcare/occupational/pme-campaigns": "Patient",
  "/healthcare/occupational/toxic-surveillance": "Patient",
  "/healthcare/occupational/guide": "Patient",
  "/healthcare/patients": "Patient",
  "/healthcare/patients/new": "Patient",
  "/healthcare/patient-history": "Patient",
  "/healthcare/practitioners": "Healthcare Practitioner",
  "/healthcare/practitioners/new": "Healthcare Practitioner",
  "/healthcare/practitioners/practitioner-schedule": "Practitioner Schedule",
  "/healthcare/appointments": "Patient Appointment",
  "/healthcare/encounters": "Patient Encounter",
  "/healthcare/external-referrals/new": "Patient Encounter",
  "/healthcare/medical-leave-slips/new": "Patient Encounter",
  "/healthcare/vital-signs": "Vital Signs",
  "/healthcare/prescriptions": "Drug Prescription",
  "/healthcare/service-requests": "Service Request",
  "/healthcare/lab-tests": "Lab Test",
  "/healthcare/lab-test-templates": "Lab Test Template",
  "/healthcare/lab-test-uoms": "Lab Test UOM",
  "/healthcare/lab-test-samples": "Lab Test Sample",
  "/healthcare/sample-collections": "Sample Collection",
  "/healthcare/observations": "Observation",
  "/healthcare/observation-templates": "Observation",
  "/healthcare/departments": "Medical Department",
  "/healthcare/medications": "Medication",
  "/healthcare/allergies": "Allergy",
  "/healthcare/reference-data": "Healthcare Settings",
  // Pharmacy
  "/healthcare/pharmacy": "Medication",
  "/healthcare/pharmacy/outpatient": "Medication Request",
  "/healthcare/pharmacy/medication-requests": "Medication Request",
  "/healthcare/pharmacy/medication-requests/new": "Medication Request",
  "/healthcare/pharmacy/stock": "Medication",
  "/healthcare/pharmacy/medications": "Medication",
};
