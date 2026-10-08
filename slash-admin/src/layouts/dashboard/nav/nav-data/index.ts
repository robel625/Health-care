import type { NavItemDataProps } from "@/components/nav/types";
import { GLOBAL_CONFIG } from "@/global-config";
import { useNotificationStore } from "@/store/notificationStore";
import { useUserInfo, useUserPermissions } from "@/store/userStore";
import { checkAny, deepFreeze } from "@/utils";
import { useMemo } from "react";
import { backendNavData } from "./nav-data-backend";
import { frontendNavData } from "./nav-data-frontend"

// Freeze the shared constants once at module load so no future code can accidentally
// mutate them at runtime (writes throw in strict mode / dev). filterItems only reads
// them and always returns fresh copies, and main.tsx deep-clones before use.
deepFreeze(backendNavData);
deepFreeze(frontendNavData);

const navData = GLOBAL_CONFIG.routerMode === "backend" ? backendNavData : frontendNavData;

/**
 * 纯函数：递归过滤导航项目，返回全新的项目数组，绝不修改入参对象。
 * 这样每次权限变化后重新计算时都基于原始的 navData，不会残留上次过滤的 children。
 *
 * @param items 导航项目数组（原始数据，不会被修改）
 * @param permissions 权限列表
 * @param isStaff 是否为 staff/admin（staff 总是看到所有项目，类似 Frappe）
 * @returns 过滤后的新数组
 */
const filterItems = (
	items: NavItemDataProps[],
	permissions: string[],
	isStaff = false,
): NavItemDataProps[] => {
	const result: NavItemDataProps[] = [];

	for (const item of items) {
		// 检查当前项目是否有权限 (staff/admin always sees everything, like Frappe)
		const hasPermission = isStaff ? true : item.auth ? checkAny(item.auth, permissions) : true;
		if (!hasPermission) {
			continue;
		}

		// 拷贝一份，仅替换需要变化的 children（原始对象保持不动）
		let children: NavItemDataProps[] | undefined;
		if (item.children?.length) {
			children = filterItems(item.children, permissions, isStaff);
			// 如果子项目都被过滤掉了，则父项目整体隐藏
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
 * 根据权限过滤导航数据（不修改共享的 navData 常量）。
 * @param permissions 权限列表
 * @param isStaff 是否 staff（跳过鉴权）
 * @returns 过滤后的新导航数据
 */
const filterNavData = (permissions: string[], isStaff = false) => {
	return navData
		.map((group) => {
			const filteredItems = filterItems(group.items, permissions, isStaff);

			// 如果组内没有项目了，返回 null
			if (filteredItems.length === 0) {
				return null;
			}

			// 返回新的组对象，原数据不被修改
			return {
				...group,
				items: filteredItems,
			};
		})
		.filter((group): group is NonNullable<typeof group> => group !== null); // 过滤掉空组
};

/**
 * Hook to get filtered navigation data based on user permissions
 * @returns Filtered navigation data
 */
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
 * Hook to get filtered navigation data based on user permissions
 * with notification badge counts
 */
export const useFilteredNavData = () => {
	const permissions = useUserPermissions();
	const user = useUserInfo();
	const isStaff = !!user?.is_staff;
	const counts = useNotificationStore((s) => s.counts);
	const permissionCodes = useMemo(() => permissions.map((p) => p.code), [permissions]);
	const filteredNavData = useMemo(
		() => filterNavData(permissionCodes, isStaff),
		[permissionCodes, isStaff],
	);
	const navDataWithBadges = useMemo(
		() => filteredNavData.map((group) => ({ ...group, items: addBadges(group.items, counts) })),
		[filteredNavData, counts],
	);
	return navDataWithBadges;
};
