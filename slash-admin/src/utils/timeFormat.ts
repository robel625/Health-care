/**
 * 12-Hour AM/PM Time Formatting Utilities for Healthcare System
 */

/**
 * Formats any time string, ISO datetime, or Date object into a 12-hour AM/PM string.
 * Examples:
 * - "09:00:00" -> "9:00 AM"
 * - "14:30:00" -> "2:30 PM"
 * - "00:15:00" -> "12:15 AM"
 * - "12:00:00" -> "12:00 PM"
 * - "9:30 am"  -> "9:30 AM"
 * - "2026-09-28T14:30:00Z" -> "2:30 PM" (local)
 */
export function formatTime12(val?: string | Date | null): string {
  if (!val) return "";
  if (val instanceof Date) {
    return formatDateTimeObject(val);
  }

  const s = String(val).trim();
  if (!s) return "";

  // If already contains AM/PM, normalize uppercase
  if (/\b(am|pm)\b/i.test(s)) {
    return s.replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  }

  // If simple time format "HH:MM" or "HH:MM:SS"
  const timeMatch = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  // If full ISO datetime or SQL datetime "YYYY-MM-DD HH:MM:SS"
  if (s.includes("T") || s.includes(" ") || s.includes("-")) {
    try {
      const d = new Date(s.includes(" ") && !s.includes("T") ? s.replace(" ", "T") : s);
      if (!isNaN(d.getTime())) {
        return formatDateTimeObject(d);
      }
    } catch {
      // fallback to original string
    }
  }

  return s;
}

function formatDateTimeObject(d: Date): string {
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Formats a start and end time into a friendly range in 12-hour AM/PM format.
 * Example: ("09:00:00", "17:00:00") -> "9:00 AM - 5:00 PM"
 */
export function formatTimeRange12(start?: string | null, end?: string | null): string {
  if (!start && !end) return "";
  if (start && !end) return formatTime12(start);
  if (!start && end) return formatTime12(end);
  return `${formatTime12(start)} - ${formatTime12(end)}`;
}

/**
 * Formats an ISO datetime or Date into a human-readable date + 12-hour AM/PM time.
 * Example: "2026-09-28T14:30:00Z" -> "Sep 28, 2026, 2:30 PM"
 */
export function formatDateTime12(val?: string | Date | null): string {
  if (!val) return "";
  try {
    const d = val instanceof Date ? val : new Date(String(val));
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(val);
  }
}

/**
 * Converts a 12-hour AM/PM time string to 24-hour "HH:MM" format (for HTML time inputs).
 * Example: "2:30 PM" -> "14:30", "9:00 AM" -> "09:00"
 */
export function to24Hour(val?: string | null): string {
  if (!val) return "";
  const s = String(val).trim();
  if (!s) return "";

  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return s;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3]?.toUpperCase();

  if (ampm) {
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
  }

  return `${String(hours).padStart(2, "0")}:${minutes}`;
}
