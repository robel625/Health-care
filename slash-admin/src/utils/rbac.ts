/**
 * Healthcare Role-Based Access Control (RBAC) & Navigation Utilities
 * 
 * Provides centralized role detection, role-to-dashboard routing, 
 * permission checking, and dynamic navigation filtering.
 */

export type HealthcareRole = 
  | "admin"
  | "practitioner"
  | "laboratorist"
  | "pharmacist"
  | "receptionist";

export interface UserRoleItem {
  id?: string | number;
  name?: string;
  code?: string;
}

/**
 * Normalizes user roles into lowercase strings for matching.
 */
export function extractRoleNames(roles?: (UserRoleItem | string)[]): string[] {
  if (!roles || !Array.isArray(roles)) return [];
  return roles
    .map((r) => {
      if (typeof r === "string") return r.toLowerCase().trim();
      return (r?.name || r?.code || "").toLowerCase().trim();
    })
    .filter(Boolean);
}

/**
 * Checks if user is an Administrator or Frappe System Manager.
 */
export function isUserAdmin(roles?: (UserRoleItem | string)[], isStaff = false): boolean {
  if (isStaff) return true;
  const list = extractRoleNames(roles);
  return list.some((r) =>
    r.includes("admin") ||
    r.includes("system manager") ||
    r.includes("administrator") ||
    r.includes("healthcare administrator")
  );
}

/**
 * Checks if user is a Practitioner (Doctor / Physician).
 */
export function isUserPractitioner(roles?: (UserRoleItem | string)[]): boolean {
  const list = extractRoleNames(roles);
  return list.some((r) =>
    r.includes("physician") ||
    r.includes("doctor") ||
    r.includes("practitioner") ||
    r.includes("healthcare practitioner")
  );
}

/**
 * Checks if user is a Laboratorist / Lab Technician.
 */
export function isUserLaboratorist(roles?: (UserRoleItem | string)[]): boolean {
  const list = extractRoleNames(roles);
  return list.some((r) =>
    r.includes("lab") ||
    r.includes("laboratorist") ||
    r.includes("technician") ||
    r.includes("pathology")
  );
}

/**
 * Checks if user is a Pharmacist.
 */
export function isUserPharmacist(roles?: (UserRoleItem | string)[]): boolean {
  const list = extractRoleNames(roles);
  return list.some((r) =>
    r.includes("pharmacist") ||
    r.includes("pharmacy")
  );
}

/**
 * Checks if user is a Receptionist.
 */
export function isUserReceptionist(roles?: (UserRoleItem | string)[]): boolean {
  const list = extractRoleNames(roles);
  return list.some((r) =>
    r.includes("receptionist") ||
    r.includes("registrar") ||
    r.includes("front desk")
  );
}

/**
 * Determines primary operational healthcare role for dashboard resolution.
 * Priority: Admin (if staff/explicit admin) > Doctor > Lab > Pharmacy > Receptionist.
 */
export function getPrimaryHealthcareRole(
  roles?: (UserRoleItem | string)[],
  isStaff = false
): HealthcareRole {
  // If user is explicitly non-staff with specific operational role:
  if (!isStaff) {
    if (isUserLaboratorist(roles)) return "laboratorist";
    if (isUserPharmacist(roles)) return "pharmacist";
    if (isUserReceptionist(roles)) return "receptionist";
    if (isUserPractitioner(roles)) return "practitioner";
  }

  // If user is admin/staff or has admin role:
  if (isUserAdmin(roles, isStaff)) return "admin";

  // Fallback checks
  if (isUserPractitioner(roles)) return "practitioner";
  if (isUserLaboratorist(roles)) return "laboratorist";
  if (isUserPharmacist(roles)) return "pharmacist";
  if (isUserReceptionist(roles)) return "receptionist";

  return "admin";
}

/**
 * Maps a user's role to their designated healthcare dashboard route.
 */
export function getRoleDashboardPath(
  roles?: (UserRoleItem | string)[],
  isStaff = false
): string {
  const primary = getPrimaryHealthcareRole(roles, isStaff);
  switch (primary) {
    case "laboratorist":
      return "/healthcare/lab-dashboard";
    case "pharmacist":
      return "/healthcare/pharmacy";
    case "receptionist":
      return "/healthcare/reception-dashboard";
    case "practitioner":
      return "/healthcare/practitioner-dashboard";
    case "admin":
    default:
      return "/healthcare";
  }
}

/**
 * Human-friendly role display label & badge styling.
 */
export function getRoleDisplayInfo(
  roles?: (UserRoleItem | string)[],
  isStaff = false
): { label: string; role: HealthcareRole; color: string; badgeClass: string } {
  const role = getPrimaryHealthcareRole(roles, isStaff);
  switch (role) {
    case "laboratorist":
      return {
        label: "Laboratory Specialist",
        role: "laboratorist",
        color: "#0284c7",
        badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
      };
    case "pharmacist":
      return {
        label: "Licensed Pharmacist",
        role: "pharmacist",
        color: "#059669",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      };
    case "receptionist":
      return {
        label: "Front Desk & Reception",
        role: "receptionist",
        color: "#d97706",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      };
    case "practitioner":
      return {
        label: "Physician / Practitioner",
        role: "practitioner",
        color: "#7c3aed",
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
      };
    case "admin":
    default:
      return {
        label: isStaff ? "System Administrator" : "Healthcare Administrator",
        role: "admin",
        color: "#dc2626",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      };
  }
}

/**
 * Verifies if a user role is permitted to navigate to a given path.
 * Enforces security boundaries:
 * - Receptionists cannot access clinical encounters, vitals, lab dashboard, or pharmacy.
 * - Laboratorists cannot access encounters, pharmacy, or reception dashboard.
 * - Pharmacists cannot access encounters, lab dashboard, or reception dashboard.
 * - Practitioners have clinical consultation, encounters, and lab/pharmacy ordering access, but not front-desk reception triage queue or system settings.
 * - Admins/Staff have universal oversight.
 */
export function isRouteAuthorized(
  path: string,
  roles?: (UserRoleItem | string)[],
  isStaff = false
): boolean {
  if (isStaff || isUserAdmin(roles, isStaff)) return true;

  const normalizedPath = path.toLowerCase();

  // Root or generic dashboard routes
  if (normalizedPath === "/" || normalizedPath === "/healthcare") {
    return true;
  }

  // Common user settings paths are always authorized
  if (
    normalizedPath.startsWith("/management/user") ||
    normalizedPath.startsWith("/erp/profile") ||
    normalizedPath.startsWith("/erp/account") ||
    normalizedPath.startsWith("/erp/my-notification-prefs") ||
    normalizedPath === "/erp/guide" ||
    normalizedPath === "/healthcare/guide"
  ) {
    return true;
  }

  // System administration routes are restricted to Admins
  if (
    normalizedPath.startsWith("/erp/roles") ||
    normalizedPath.startsWith("/erp/users") ||
    normalizedPath.startsWith("/erp/doctypes") ||
    normalizedPath.startsWith("/erp/permission") ||
    normalizedPath.startsWith("/erp/system-settings") ||
    normalizedPath.startsWith("/erp/server-scripts") ||
    normalizedPath.startsWith("/erp/workflows")
  ) {
    return false;
  }

  const role = getPrimaryHealthcareRole(roles, isStaff);

  switch (role) {
    case "receptionist":
      if (
        normalizedPath.startsWith("/healthcare/reception-dashboard") ||
        normalizedPath.startsWith("/healthcare/reception") ||
        normalizedPath.startsWith("/healthcare/patients") ||
        normalizedPath.startsWith("/healthcare/appointments") ||
        normalizedPath.startsWith("/healthcare/practitioners/practitioner-schedule") ||
        normalizedPath.startsWith("/healthcare/occupational/staff-registry")
      ) {
        return true;
      }
      return false;

    case "laboratorist":
      if (
        normalizedPath.startsWith("/healthcare/lab-dashboard") ||
        normalizedPath.startsWith("/healthcare/diagnostics") ||
        normalizedPath.startsWith("/healthcare/lab-tests") ||
        normalizedPath.startsWith("/healthcare/lab-test-templates") ||
        normalizedPath.startsWith("/healthcare/lab-test-uoms") ||
        normalizedPath.startsWith("/healthcare/lab-test-samples") ||
        normalizedPath.startsWith("/healthcare/sample-collections") ||
        normalizedPath.startsWith("/healthcare/observations") ||
        normalizedPath.startsWith("/healthcare/observation-templates")
      ) {
        return true;
      }
      return false;

    case "pharmacist":
      if (
        normalizedPath.startsWith("/healthcare/pharmacy") ||
        normalizedPath.startsWith("/healthcare/prescriptions")
      ) {
        return true;
      }
      return false;

    case "practitioner":
      if (
        normalizedPath.startsWith("/healthcare/reception-dashboard") ||
        normalizedPath.startsWith("/healthcare/reception")
      ) {
        return false;
      }
      return true;

    default:
      return true;
  }
}
