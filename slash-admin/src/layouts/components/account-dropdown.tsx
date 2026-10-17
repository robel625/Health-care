import { useLoginStateContext } from "@/pages/sys/login/providers/login-provider";
import { useRouter } from "@/routes/hooks";
import { useUserActions, useUserInfo, useUserRoles } from "@/store/userStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/dropdown-menu";
import { getRoleDisplayInfo, getRoleDashboardPath } from "@/utils/rbac";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

/**
 * Account Dropdown
 */
export default function AccountDropdown() {
	const { replace } = useRouter();
	const user = useUserInfo();
	const { username, email, avatar } = user;
	const roles = useUserRoles();
	const isStaff = !!user?.is_staff;
	const roleInfo = getRoleDisplayInfo(roles, isStaff);
	const roleDashboardPath = getRoleDashboardPath(roles, isStaff);

	const { clearUserInfoAndToken } = useUserActions();
	const { backToLogin } = useLoginStateContext();
	const { t } = useTranslation();
	const logout = () => {
		try {
			clearUserInfoAndToken();
			backToLogin();
		} catch (error) {
			console.log(error);
		} finally {
			replace("/auth/login");
		}
	};

	const userInitial = (username?.[0] || "U").toUpperCase();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="rounded-full">
					<Avatar className="h-7 w-7">
						{avatar ? <AvatarImage src={avatar} alt={username} /> : null}
						<AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
							{userInitial}
						</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-60">
				<div className="flex items-center gap-2 p-2">
					<Avatar className="h-10 w-10">
						{avatar ? <AvatarImage src={avatar} alt={username} /> : null}
						<AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
							{userInitial}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col items-start min-w-0">
						<div className="text-text-primary text-sm font-medium truncate w-full">{username}</div>
						<div className="text-text-secondary text-xs truncate w-full">{email}</div>
						<div className="mt-1">
							<span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${roleInfo.badgeClass}`}>
								{roleInfo.label}
							</span>
						</div>
					</div>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<NavLink to={roleDashboardPath} className="font-medium text-primary">
						Department Dashboard
					</NavLink>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<NavLink to="https://docs-admin.slashspaces.com/" target="_blank">
						{t("sys.docs")}
					</NavLink>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<NavLink to="/management/user/profile">{t("sys.nav.user.profile")}</NavLink>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<NavLink to="/management/user/account">{t("sys.nav.user.account")}</NavLink>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem className="font-bold text-warning" onClick={logout}>
					{t("sys.login.logout")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
