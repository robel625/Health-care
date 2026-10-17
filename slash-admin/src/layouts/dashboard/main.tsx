import { AuthGuard } from "@/components/auth/auth-guard";
import { LineLoading } from "@/components/loading";
import { GLOBAL_CONFIG } from "@/global-config";
import Page403 from "@/pages/sys/error/Page403";
import { useSettings } from "@/store/settingStore";
import { cn } from "@/utils";
import { flattenTrees } from "@/utils/tree";
import { clone, concat } from "ramda";
import { Suspense } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { backendNavData } from "./nav/nav-data/nav-data-backend";
import { frontendNavData } from "./nav/nav-data/nav-data-frontend";
import { useUserInfo, useUserRoles } from "@/store/userStore";
import { isRouteAuthorized } from "@/utils/rbac";

/**
 * find auth by path
 * @param path
 * @returns
 */
function findAuthByPath(path: string): string[] {
	// 1. Exact match
	const foundItem = allItems.find((item) => item.path === path);
	if (foundItem?.auth && foundItem.auth.length > 0) {
		return foundItem.auth;
	}

	// 2. Hierarchical prefix match (e.g. /healthcare/encounters/123 -> /healthcare/encounters)
	const segments = path.split("/").filter(Boolean);
	while (segments.length > 0) {
		segments.pop();
		const parentPath = "/" + segments.join("/");
		const parentItem = allItems.find((item) => item.path === parentPath);
		if (parentItem?.auth && parentItem.auth.length > 0) {
			return parentItem.auth;
		}
	}

	return [];
}

const navData = GLOBAL_CONFIG.routerMode === "frontend" ? clone(frontendNavData) : backendNavData;
const allItems = navData.reduce((acc: any[], group) => {
	const flattenedItems = flattenTrees(group.items);
	return concat(acc, flattenedItems);
}, []);

const Main = () => {
	const { themeStretch } = useSettings();
	const user = useUserInfo();
	const roles = useUserRoles();
	const isStaff = !!user?.is_staff;

	const { pathname } = useLocation();
	const currentNavAuth = findAuthByPath(pathname);
	const routeAllowed = isRouteAuthorized(pathname, roles, isStaff);

	if (!routeAllowed) {
		return <Page403 />;
	}

	return (
		<AuthGuard checkAny={currentNavAuth} fallback={<Page403 />}>
			<main
				data-slot="slash-layout-main"
				className={cn(
					"flex-auto w-full flex flex-col",
					"transition-[max-width] duration-300 ease-in-out",
					"px-4 sm:px-6 py-4 sm:py-6 md:px-8 mx-auto",
					{
						"max-w-full": themeStretch,
						"xl:max-w-screen-xl": !themeStretch,
					},
				)}
				style={{
					willChange: "max-width",
				}}
			>
				<Suspense fallback={<LineLoading />}>
					<Outlet />
					<ScrollRestoration />
				</Suspense>
			</main>
		</AuthGuard>
	);
};

export default Main;
