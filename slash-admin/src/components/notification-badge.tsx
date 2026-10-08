import { useEffect } from "react";
import { cn } from "@/utils";
import { useNotificationStore } from "@/store/notificationStore";

type NotificationBadgeProps = {
	count: number;
	max?: number;
	className?: string;
	pulse?: boolean;
};

export function NotificationBadge({
	count,
	max = 99,
	className,
	pulse = false,
}: NotificationBadgeProps) {
	if (count <= 0) return null;

	const display = count > max ? `${max}+` : String(count);

	return (
		<span
			className={cn(
				"inline-flex items-center justify-center",
				"min-w-[18px] h-[18px] px-1 rounded-full",
				"text-[10px] font-bold leading-none text-white",
				"bg-error shrink-0",
				pulse && "animate-pulse",
				className,
			)}
		>
			{display}
		</span>
	);
}

/**
 * Hook that fetches notification counts on mount and refreshes periodically.
 * Call this in the root layout or dashboard.
 */
export function useNotificationPolling() {
	const fetchCounts = useNotificationStore((s) => s.actions.fetchCounts);
	const lastFetched = useNotificationStore((s) => s.lastFetched);

	useEffect(() => {
		fetchCounts();
		const interval = setInterval(fetchCounts, 60_000);
		return () => clearInterval(interval);
	}, [fetchCounts, lastFetched]);
}
