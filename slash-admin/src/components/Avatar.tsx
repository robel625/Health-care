import { useState } from "react";
import { cn, getInitials } from "@/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "doc";
type AvatarTone =
  | "emerald"
  | "blue"
  | "green"
  | "red"
  | "gray"
  | "purple"
  | "orange";

const sizeClasses: Record<AvatarSize, string> = {
  xs: "w-5 h-5 text-[10px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-9 h-9 text-xs",
  xl: "w-10 h-10 text-sm",
  "2xl": "w-16 h-16 text-xl",
  doc: "w-14 h-14 text-lg",
};

const toneClasses: Record<AvatarTone, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-700",
  purple: "bg-purple-100 text-purple-700",
  orange: "bg-orange-100 text-orange-700",
};

interface AvatarProps {
  /** Raw value (name, username, id...) to derive initials from. */
  name?: unknown;
  /** Pre-computed initials; overrides `name` when provided. */
  initials?: string;
  /** Fallback text when no initials can be derived (default "U"). */
  fallback?: string;
  /** Optional image URL. Falls back to initials when unset/broken. */
  src?: string;
  /** Alt text for the image (defaults to the derived initials). */
  alt?: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  className?: string;
}

/**
 * Avatar with initials fallback. Wraps getInitials so it never crashes on
 * numeric/object API values. When `src` is provided the image is shown;
 * if it fails to load (or is empty), initials render instead.
 */
export default function Avatar({
  name,
  initials,
  fallback = "U",
  src,
  alt,
  size = "md",
  tone = "emerald",
  className,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const text = initials ?? getInitials(name, fallback);
  const showImage = Boolean(src) && !imgError;

  return (
    <div
      className={cn(
        "rounded-full overflow-hidden flex items-center justify-center font-bold shrink-0",
        sizeClasses[size],
        toneClasses[tone],
        className
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt ?? text}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        text
      )}
    </div>
  );
}
