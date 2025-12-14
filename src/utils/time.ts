/**
 * Time utilities for TRVZB Scheduler Card
 * All functions work with HH:mm format (24-hour)
 */

/**
 * Format hours and minutes to HH:mm string
 */
export function formatTime(hours: number, minutes: number): string {
  const h = hours.toString().padStart(2, '0');
  const m = minutes.toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Parse HH:mm string to hours and minutes
 * @throws Error if time format is invalid
 */
export function parseTime(time: string): { hours: number; minutes: number } {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format: ${time}. Expected HH:mm`);
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23) {
    throw new Error(`Invalid hours: ${hours}. Must be 0-23`);
  }

  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid minutes: ${minutes}. Must be 0-59`);
  }

  return { hours, minutes };
}

/**
 * Compare two time strings
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareTime(a: string, b: string): number {
  const minutesA = timeToMinutes(a);
  const minutesB = timeToMinutes(b);

  if (minutesA < minutesB) return -1;
  if (minutesA > minutesB) return 1;
  return 0;
}

/**
 * Convert time string to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const { hours, minutes } = parseTime(time);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string
 */
export function minutesToTime(minutes: number): string {
  if (minutes < 0 || minutes >= 1440) {
    throw new Error(`Invalid minutes: ${minutes}. Must be 0-1439`);
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return formatTime(hours, mins);
}

/**
 * Generate array of time options for dropdowns
 * @param stepMinutes Step size in minutes (e.g., 15, 30)
 * @returns Array of time strings in HH:mm format
 */
export function generateTimeOptions(stepMinutes: number = 15): string[] {
  const options: string[] = [];
  const totalMinutes = 24 * 60; // 1440 minutes in a day

  for (let minutes = 0; minutes < totalMinutes; minutes += stepMinutes) {
    options.push(minutesToTime(minutes));
  }

  return options;
}
