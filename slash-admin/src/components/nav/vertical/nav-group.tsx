import { Icon } from "@/components/icon";
import useLocale from "@/locales/use-locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/collapsible";
import { cn } from "@/utils";
import { useLocation } from "react-router";
import { useToggle } from "react-use";
import type { NavGroupProps } from "../types";
import { NavList } from "./nav-list";

export function NavGroup({ name, items, defaultOpen }: NavGroupProps) {
	const location = useLocation();

	// Check if any child item matches current location pathname
	const hasActiveChild = items.some((item) => {
		if (item.path && location.pathname.startsWith(item.path)) return true;
		if (item.children?.some((child) => child.path && location.pathname.startsWith(child.path))) return true;
		return false;
	});

	// Collapsed when started for "EEU Occupational Health & Safety" or if defaultOpen is false,
	// unless user is directly visiting a route in this group.
	const initialOpen = hasActiveChild
		? true
		: defaultOpen !== undefined
			? defaultOpen
			: name === "EEU Occupational Health & Safety"
				? false
				: true;

	const [open, toggleOpen] = useToggle(initialOpen);

	return (
		<Collapsible open={open}>
			<CollapsibleTrigger asChild>
				<Group name={name} open={open} onClick={toggleOpen} />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ul className="flex w-full flex-col gap-1">
					{items.map((item, index) => (
						<NavList key={item.title || index} data={item} depth={1} />
					))}
				</ul>
			</CollapsibleContent>
		</Collapsible>
	);
}

function Group({ name, open, onClick }: { name?: string; open: boolean; onClick: (nextValue: boolean) => void }) {
	const { t } = useLocale();
	return (
		name && (
			<div
				className={cn(
					"group w-full inline-flex items-center justify-start relative gap-2 cursor-pointer pt-4 pr-2 pb-2 pl-3 transition-all duration-300 ease-in-out",
					"hover:pl-4",
				)}
				onClick={() => onClick(!open)}
			>
				<Icon
					icon="eva:arrow-ios-forward-fill"
					className={cn("absolute left-[-4px] h-4 w-4 inline-flex shrink-0 transition-all duration-300 ease-in-out", "opacity-40 group-hover:opacity-100", {
						"rotate-90 opacity-70": open,
					})}
				/>

				<span className={cn("text-xs font-medium transition-all duration-300 ease-in-out text-text-disabled", "hover:text-text-primary")}>{t(name)}</span>
			</div>
		)
	);
}
