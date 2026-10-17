import type { NavItemDataProps } from "@/components/nav/types";
import { GLOBAL_CONFIG } from "@/global-config";
import { useNotificationStore } from "@/store/notificationStore";
import { useUserInfo, useUserPermissions, useUserRoles } from "@/store/userStore";
import { checkAny, deepFreeze } from "@/utils";
import { extractRoleNames } from "@/utils/rbac";
import { useMemo } from "react";
import { backendNavData } from "./nav-data-backend";
import { frontendNavData } from "./nav-data-frontend";

// Freeze the shared constants once at module load so no future code can accidentally
// mutate them at runtime (writes throw in strict mode / dev). filterItems only reads
// them and always returns fresh copies, and main.tsx deep-clones before use.
deepFreeze(backendNavData);
deepFreeze(frontendNavData);

const navData = GLOBAL_CONFIG.routerMode === "backend" ? backendNavData : frontendNavData;

/**
 * Pure function: recursively filters navigation items based on permissions, roles, and staff flag.
 *
 * @param items Navigation items array (original data, not mutated)
 * @param permissions Array of permission codes
 * @param userRoles Array of normalized user role names
 * @param isStaff Whether user is staff/superadmin (bypasses restrictions)
 * @returns Filtered navigation items
 */
const filterItems = (
	items: NavItemDataProps[],
	permissions: string[],
	userRoles: string[] = [],
	isStaff = false,
): NavItemDataProps[] => {
	const result: NavItemDataProps[] = [];

	for (const item of items) {
		// 1. Role inclusion check
		if (!isStaff && item.roles && item.roles.length > 0) {
			const hasRole = item.roles.some((r) =>
				userRoles.some((ur) => ur.includes(r.toLowerCase()) || r.toLowerCase().includes(ur))
			);
			if (!hasRole) {
				continue;
			}
		}

		// 2. Role exclusion check
		if (!isStaff && item.excludeRoles && item.excludeRoles.length > 0) {
			const isExcluded = item.excludeRoles.some((r) =>
				userRoles.some((ur) => ur.includes(r.toLowerCase()) || r.toLowerCase().includes(ur))
			);
			if (isExcluded) {
				continue;
			}
		}

		// 3. Permission check (staff/admin always sees everything, like Frappe)
		const hasPermission = isStaff ? true : item.auth ? checkAny(item.auth, permissions) : true;
		if (!hasPermission) {
			continue;
		}

		// Recursively filter children
		let children: NavItemDataProps[] | undefined;
		if (item.children?.length) {
			children = filterItems(item.children, permissions, userRoles, isStaff);
			if (children.length === 0) {
				continue;
			}
		}

		result.push({
			...item,
			...(children ? { children } : {}),
		});
	}

	return result;
};

/**
 * Filters nav data by permissions, user roles, and staff flag.
 * @param permissions Permission code list
 * @param userRoles Normalized role name list
 * @param isStaff Whether user is staff
 * @returns Filtered navigation groups
 */
const filterNavData = (permissions: string[], userRoles: string[] = [], isStaff = false) => {
	return navData
		.map((group) => {
			// Check group role inclusion
			if (!isStaff && (group as any).roles && (group as any).roles.length > 0) {
				const hasGroupRole = (group as any).roles.some((r: string) =>
					userRoles.some((ur) => ur.includes(r.toLowerCase()) || r.toLowerCase().includes(ur))
				);
				if (!hasGroupRole) {
					return null;
				}
			}

			// Check group role exclusion
			if (!isStaff && (group as any).excludeRoles && (group as any).excludeRoles.length > 0) {
				const isGroupExcluded = (group as any).excludeRoles.some((r: string) =>
					userRoles.some((ur) => ur.includes(r.toLowerCase()) || r.toLowerCase().includes(ur))
				);
				if (isGroupExcluded) {
					return null;
				}
			}

			const filteredItems = filterItems(group.items, permissions, userRoles, isStaff);

			// If all items in group filtered out, hide group
			if (filteredItems.length === 0) {
				return null;
			}

			// Return new group object without mutating source
			return {
				...group,
				items: filteredItems,
			};
		})
		.filter((group): group is NonNullable<typeof group> => group !== null);
};

/**
 * Badge config: maps nav path to notification count key
 */
const badgeMap: Record<string, string> = {
	"/erp/error-logs": "error_logs",
	"/erp/communications": "communications",
	"/erp/comments": "comments",
	"/erp/workflows": "workflow_actions",
};

/**
 * Recursively add badge counts to nav items
 */
const addBadges = (
	items: NavItemDataProps[],
	counts: Record<string, any>,
): NavItemDataProps[] => {
	return items.map((item) => {
		const badgeKey = badgeMap[item.path];
		let badge = badgeKey ? counts[badgeKey] ?? 0 : undefined;

		// For parent items with children, sum child badges
		let children = item.children;
		if (children && children.length > 0) {
			children = addBadges(children, counts);
			const childTotal = children.reduce((sum, child) => {
				return sum + (typeof child.badge === "number" ? child.badge : 0);
			}, 0);
			if (childTotal > 0) badge = childTotal;
		}

		return {
			...item,
			badge: badge && badge > 0 ? badge : undefined,
			children,
		};
	});
};

/**
 * Hook to get filtered navigation data based on user permissions and roles
 * with notification badge counts
 */
export const useFilteredNavData = () => {
	const permissions = useUserPermissions();
	const user = useUserInfo();
	const roles = useUserRoles();
	const isStaff = !!user?.is_staff;
	const counts = useNotificationStore((s) => s.counts);
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const userRoleNames = useMemo(() => extractRoleNames(roles), [roles]);

	const filteredNavData = useMemo(
		() => filterNavData(permissionCodes, userRoleNames, isStaff),
		[permissionCodes, userRoleNames, isStaff],
	);
	const navDataWithBadges = useMemo(
		() => filteredNavData.map((group) => ({ ...group, items: addBadges(group.items, counts) })),
		[filteredNavData, counts],
	);
	return navDataWithBadges;
};
