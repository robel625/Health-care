/**
 * Age formatting that matches Marley's `Patient.get_age()`:
 *
 *     35 Year(s) 2 Month(s) 11 Day(s)
 *
 * Marley stores this string on the encounter as `patient_age` (a Data field) so
 * the age a visit was recorded at stays historically true. The backend computes
 * and stores it on save; this mirrors the format for live previews in the form
 * before an encounter exists.
 */

/** Whole years/months/days elapsed between `dob` and `on` (defaults to today). */
function elapsed(dob: Date, on: Date) {
	let years = on.getFullYear() - dob.getFullYear();
	let months = on.getMonth() - dob.getMonth();
	let days = on.getDate() - dob.getDate();

	if (days < 0) {
		months -= 1;
		// Days in the calendar month preceding `on`.
		const daysInPrevMonth = new Date(on.getFullYear(), on.getMonth(), 0).getDate();
		days += daysInPrevMonth;
	}
	if (months < 0) {
		years -= 1;
		months += 12;
	}
	return { years, months, days };
}

/**
 * Format a patient's age the way Marley does.
 *
 * Prefers `dob` (so the value never goes stale), falling back to a stored
 * integer `age`. Returns "" when neither is available.
 */
export function formatAge(dob?: string | null, age?: number | null, on: Date = new Date()): string {
	if (dob) {
		const parsed = new Date(dob);
		if (!Number.isNaN(parsed.getTime())) {
			const { years, months, days } = elapsed(parsed, on);
			return `${years} Year(s) ${months} Month(s) ${days} Day(s)`;
		}
	}
	return age ? `${age} Year(s)` : "";
}
