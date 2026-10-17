import { GLOBAL_CONFIG } from "@/global-config";
import DashboardLayout from "@/layouts/dashboard";
import LoginAuthGuard from "@/routes/components/login-auth-guard";
import { Navigate, type RouteObject } from "react-router";
import { getBackendDashboardRoutes } from "./backend";
import { getFrontendDashboardRoutes } from "./frontend";
import { erpRoutes } from "./erp";
import { useUserInfo, useUserRoles } from "@/store/userStore";
import { getRoleDashboardPath } from "@/utils/rbac";

const getRoutes = (): RouteObject[] => {
	if (GLOBAL_CONFIG.routerMode === "frontend") {
		return getFrontendDashboardRoutes();
	}
	return getBackendDashboardRoutes();
};

function DashboardIndexRedirect() {
	const user = useUserInfo();
	const roles = useUserRoles();
	const isStaff = !!user?.is_staff;
	const targetPath = getRoleDashboardPath(roles, isStaff);

	return <Navigate to={targetPath} replace />;
}

export const dashboardRoutes: RouteObject[] = [
	{
		element: (
			<LoginAuthGuard>
				<DashboardLayout />
			</LoginAuthGuard>
		),
		children: [
			{ index: true, element: <DashboardIndexRedirect /> },
			...erpRoutes,
			...getRoutes(),
		],
	},
];
