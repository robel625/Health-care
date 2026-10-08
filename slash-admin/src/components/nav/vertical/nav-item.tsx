import Icon from "@/components/icon/icon";
import { NotificationBadge } from "@/components/notification-badge";
import useLocale from "@/locales/use-locale";
import { TooltipContent } from "@/ui/tooltip";
import { Tooltip } from "@/ui/tooltip";
import { TooltipTrigger } from "@/ui/tooltip";
import { TooltipProvider } from "@/ui/tooltip";
import { cn } from "@/utils";
import { NavItemRenderer } from "../components";
import { navItemClasses, navItemStyles } from "../styles";
import type { NavItemProps } from "../types";

export function NavItem(item: NavItemProps) {
	const { title, icon, info, badge, caption, open, active, disabled, depth, hasChild } = item;
	const { t } = useLocale();

	const content = (
		<>
			{/* Icon */}
			<span style={navItemStyles.icon} className="mr-3 items-center justify-center">
				{icon && typeof icon === "string" ? <Icon icon={icon} /> : icon}
			</span>

			{/* Texts */}
			<span style={navItemStyles.texts} className="min-h-[24px]">
				{/* Title */}
				<span style={navItemStyles.title}>{t(title)}</span>

				{/* Caption */}
				{caption && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span style={navItemStyles.caption}>{t(caption)}</span>
							</TooltipTrigger>
							<TooltipContent side="top" align="start">
								{t(caption)}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				)}
			</span>

			{/* Badge */}
			{typeof badge === "number" && badge > 0 && (
				<NotificationBadge count={badge} className="mr-1" />
			)}
			{typeof badge === "string" && badge && (
				<span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none text-white bg-primary shrink-0 mr-1">
					{badge}
				</span>
			)}

			{/* Info */}
			{info && <span style={navItemStyles.info}>{info}</span>}

			{/* Arrow */}
			{hasChild && (
				<Icon
					icon="eva:arrow-ios-forward-fill"
					style={{
						...navItemStyles.arrow,
						transform: open ? "rotate(90deg)" : "rotate(0deg)",
					}}
				/>
			)}
		</>
	);

	const itemClassName = cn(
		navItemClasses.base,
		navItemClasses.hover,
		"min-h-[44px]",
		active && depth === 1 && navItemClasses.active,
		active && depth !== 1 && "bg-action-hover!",
		disabled && navItemClasses.disabled,
	);

	return (
		<NavItemRenderer item={item} className={itemClassName}>
			{content}
		</NavItemRenderer>
	);
}
