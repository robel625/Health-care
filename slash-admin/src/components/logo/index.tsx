import { cn } from "@/utils";
import { NavLink } from "react-router";
import eeuLogoImg from "@/assets/images/eeu-logo.png";

interface Props {
	size?: number | string;
	className?: string;
	withBorder?: boolean;
}

function Logo({ size = 42, className, withBorder = false }: Props) {
	const pixelSize = typeof size === "number" ? `${size}px` : size;

	return (
		<NavLink
			to="/healthcare"
			className={cn("inline-flex items-center justify-center shrink-0 transition-transform hover:scale-105", className)}
		>
			<img
				src={eeuLogoImg}
				alt="Ethiopian Electric Utility (EEU) Health Services"
				className={cn(
					"rounded-full object-contain aspect-square drop-shadow-sm",
					withBorder && "ring-2 ring-emerald-500/40 p-0.5",
				)}
				style={{ width: pixelSize, height: pixelSize }}
			/>
		</NavLink>
	);
}

export default Logo;
