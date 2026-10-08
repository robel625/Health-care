import { Icon } from "@/components/icon";
import Logo from "@/components/logo";
import { NavMini, NavVertical } from "@/components/nav";
import type { NavProps } from "@/components/nav/types";
import { GLOBAL_CONFIG } from "@/global-config";
import { useSettingActions, useSettings } from "@/store/settingStore";
import { ThemeLayout } from "@/types/enum";
import { Button } from "@/ui/button";
import { ScrollArea } from "@/ui/scroll-area";
import { cn } from "@/utils";

type Props = {
	data: NavProps["data"];
	className?: string;
};

export function NavVerticalLayout({ data, className }: Props) {
	const settings = useSettings();
	const { themeLayout } = settings;
	const { setSettings } = useSettingActions();

	const navWidth = themeLayout === ThemeLayout.Vertical ? "var(--layout-nav-width)" : "var(--layout-nav-width-mini)";
	const handleToggle = () => {
		setSettings({
			...settings,
			themeLayout: themeLayout === ThemeLayout.Mini ? ThemeLayout.Vertical : ThemeLayout.Mini,
		});
	};
	return (
		<nav
			data-slot="slash-layout-nav"
			className={cn("fixed inset-y-0 left-0 flex-col h-full bg-background border-r border-dashed z-nav transition-[width] duration-300 ease-in-out", className)}
			style={{
				width: navWidth,
			}}
		>
			<div
				className={cn("relative flex items-center py-4 px-2 h-[var(--layout-header-height)] ", {
					"justify-center": themeLayout === ThemeLayout.Mini,
				})}
			>
				<div className="flex items-center justify-start pl-1 gap-2.5 overflow-hidden">
					<Logo size={36} />
					<div
						className="flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
						style={{
							opacity: themeLayout === ThemeLayout.Mini ? 0 : 1,
							maxWidth: themeLayout === ThemeLayout.Mini ? 0 : "180px",
							whiteSpace: "nowrap",
						}}
					>
						<span className="text-sm font-extrabold tracking-tight text-foreground truncate">
							EEU Health Services
						</span>
						<span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase truncate">
							Ethiopian Electric Utility
						</span>
					</div>
				</div>

				<Button variant="outline" size="icon" onClick={handleToggle} className="h-7 w-7 absolute right-0 translate-x-1/2">
					{themeLayout === ThemeLayout.Mini ? <Icon icon="lucide:arrow-right-to-line" size={12} /> : <Icon icon="lucide:arrow-left-to-line" size={12} />}
				</Button>
			</div>

			<ScrollArea className={cn("h-[calc(100vh-var(--layout-header-height))] px-2 bg-background")}>
				{themeLayout === ThemeLayout.Mini ? <NavMini data={data} /> : <NavVertical data={data} />}
			</ScrollArea>
		</nav>
	);
}
