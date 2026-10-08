import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * merge classnames
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * check if item exists in resourcePool
 */
export const check = (item: string, resourcePool: string[]) => {
	return resourcePool.some((p) => p === item);
};

/**
 * check if any item exists in resourcePool
 */
export const checkAny = (items: string[], resourcePool: string[]) => items.some((item) => check(item, resourcePool));

/**
 * check if all items exist in resourcePool
 */
export const checkAll = (items: string[], resourcePool: string[]) => items.every((item) => check(item, resourcePool));

/**
 * Safely compute initials (max 2 chars) from a value that may come from an API
 * (can be a number, object, null...). Never throws.
 */
export const getInitials = (value: unknown, fallback = "U"): string => {
	const name = typeof value === "string" ? value : "";
	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	return initials || fallback;
};

/**
 * Recursively freeze an object tree so shared constants can't be mutated at runtime.
 * ES modules are always strict mode, so any accidental write throws a TypeError in
 * development instead of silently corrupting the shared data. React elements (objects
 * with a `$$typeof` marker) are treated as immutable values and left unfrozen, since
 * React dev tooling may attach internals to them.
 */
export const deepFreeze = <T>(value: T): T => {
	const seen = new WeakSet<object>();
	const freeze = (node: unknown): unknown => {
		if (node === null || typeof node !== "object") return node;
		const obj = node as object;
		if (seen.has(obj)) return node; // guard against cycles
		seen.add(obj);
		if ("$$typeof" in obj) return node; // don't freeze React elements
		for (const key of Object.keys(obj)) {
			freeze((obj as Record<string, unknown>)[key]);
		}
		return Object.freeze(obj);
	};
	return freeze(value) as T;
};

/**
 * join url parts
 * @example
 * urlJoin('/admin/', '/api/', '/user/') // '/admin/api/user'
 * urlJoin('/admin', 'api', 'user/')     // '/admin/api/user'
 * urlJoin('/admin/', '', '/user/')      // '/admin/user'
 */
export const urlJoin = (...parts: string[]) => {
	const result = parts
		.map((part) => {
			return part.replace(/^\/+|\/+$/g, ""); // 去除两边/
		})
		.filter(Boolean);
	return `/${result.join("/")}`;
};

/**
 * Safely extract user-friendly error messages from DRF or Axios error responses
 */
export function extractErrorMessage(err: unknown, fallback = "Operation failed"): string {
	if (!err) return fallback;
	const anyErr = err as any;
	const data = anyErr?.response?.data;
	if (!data) return anyErr?.message || fallback;
	if (typeof data === "string") return data;
	if (data.detail && typeof data.detail === "string") return data.detail;
	if (data.message && typeof data.message === "string") return data.message;
	if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
		return data.non_field_errors.join(", ");
	}
	if (typeof data === "object") {
		const entries = Object.entries(data);
		if (entries.length > 0) {
			const [field, errorVal] = entries[0];
			const errorMsg = Array.isArray(errorVal) ? errorVal.join(", ") : String(errorVal);
			const friendlyField = field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
			return `${friendlyField}: ${errorMsg}`;
		}
	}
	return fallback;
}
