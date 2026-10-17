/**
 * Age formatting utility.
 * Formats patient age showing ONLY the year (omits month and day as per clinical preference).
 * e.g. "35 Year(s)" or fallback to stored integer age "35 Year(s)".
 */

/** Whole years elapsed between `dob` and `on` (defaults to today). */
function elapsedYears(dob: Date, on: Date): number {
	let years = on.getFullYear() - dob.getFullYear();
	const months = on.getMonth() - dob.getMonth();
	const days = on.getDate() - dob.getDate();

	if (months < 0 || (months === 0 && days < 0)) {
		years -= 1;
	}
	return Math.max(0, years);
}

/**
 * Format a patient's age showing ONLY the year (omits month and day).
 * Prefers `dob` (so the value never goes stale), falling back to a stored integer `age`.
 * Returns "" when neither is available.
 */
export function formatAge(dob?: string | null, age?: number | null, on: Date = new Date()): string {
	if (dob) {
		const parsed = new Date(dob);
		if (!Number.isNaN(parsed.getTime())) {
			const years = elapsedYears(parsed, on);
			return `${years} Year(s)`;
		}
	}
	if (age !== undefined && age !== null && age !== ("" as any)) {
		return `${age} Year(s)`;
	}
	return "";
}

/**
 * Format a patient's age showing only the year.
 * Alias to formatAge for backwards compatibility.
 */
export function formatAgeYears(dob?: string | null, age?: number | null, on: Date = new Date()): string {
	return formatAge(dob, age, on);
}

/**
 * Strips month and day parts from any age string or number, ensuring ONLY the year is displayed.
 * Examples:
 *   "35 Year(s) 2 Month(s) 11 Day(s)" -> "35 Year(s)"
 *   "28 Years 4 Months"               -> "28 Year(s)"
 *   "45"                              -> "45 Year(s)"
 *   45                                -> "45 Year(s)"
 *   "0 Year(s)"                       -> "0 Year(s)"
 */
export function cleanAgeOnlyYears(val?: string | number | null): string {
	if (val === undefined || val === null) return "";
	const str = String(val).trim();
	if (!str) return "";

	// If already a simple number (e.g. "35" or 35)
	if (/^\d+$/.test(str)) {
		return `${str} Year(s)`;
	}

	// Match leading number followed by years/year(s)/yrs/y
	const match = str.match(/^(\d+)\s*(?:years?\(?s?\)?|yrs?|y)?/i);
	if (match && match[1] !== undefined) {
		// If string was solely e.g. "5 Month(s)" with no year, return "0 Year(s)"
		if (/^\d+\s*(?:month|day)/i.test(str)) {
			return "0 Year(s)";
		}
		return `${match[1]} Year(s)`;
	}

	return str;
}
