import { Icon } from "@/components/icon";
import Logo from "@/components/logo";
import { NavVertical } from "@/components/nav";
import type { NavProps } from "@/components/nav/types";
import { GLOBAL_CONFIG } from "@/global-config";
import { Button } from "@/ui/button";
import { ScrollArea } from "@/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/ui/sheet";

export function NavMobileLayout({ data }: NavProps) {
	return (
		<Sheet modal={false}>
			<SheetTrigger asChild>
				<Button variant="ghost" size="icon">
					<Icon icon="local:ic-menu" size={24} />
				</Button>
			</SheetTrigger>
			<SheetContent side="left" className="[&>button]:hidden px-2 w-[280px]">
				<div className="flex gap-2.5 px-2 h-[var(--layout-header-height)] items-center">
					<Logo size={36} />
					<div className="flex flex-col">
						<span className="text-sm font-extrabold tracking-tight text-foreground">
							EEU Health Services
						</span>
						<span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
							Ethiopian Electric Utility
						</span>
					</div>
				</div>
				<ScrollArea className="h-full">
					<NavVertical data={data} />
				</ScrollArea>
			</SheetContent>
		</Sheet>
	);
}
