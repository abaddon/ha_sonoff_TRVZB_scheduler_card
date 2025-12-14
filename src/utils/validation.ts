/**
 * Validation utilities for TRVZB schedules
 * Implements all validation rules from the design document
 */

import { Transition, DaySchedule, WeeklySchedule, ValidationResult, DayOfWeek } from '../models/types';
import { parseTime } from './time';

/**
 * Check if a time string is valid HH:mm format
 */
export function isValidTime(time: string): boolean {
  try {
    parseTime(time);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if temperature is valid (4-35°C, 0.5°C steps)
 */
export function isValidTemperature(temp: number): boolean {
  // Check range
  if (temp < 4 || temp > 35) {
    return false;
  }

  // Check 0.5°C steps (multiply by 2 to check if it's a whole number)
  const doubled = temp * 2;
  return Number.isInteger(doubled);
}

/**
 * Validate a single transition
 */
export function validateTransition(transition: Transition): ValidationResult {
  const errors: string[] = [];

  // Validate time format
  if (!isValidTime(transition.time)) {
    errors.push(`Invalid time format: ${transition.time}. Expected HH:mm (00:00 - 23:59)`);
  }

  // Validate temperature
  if (!isValidTemperature(transition.temperature)) {
    if (transition.temperature < 4 || transition.temperature > 35) {
      errors.push(`Temperature ${transition.temperature}°C is out of range. Must be 4-35°C`);
    } else {
      errors.push(`Temperature ${transition.temperature}°C is invalid. Must be in 0.5°C steps`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a day schedule
 */
export function validateDaySchedule(schedule: DaySchedule): ValidationResult {
  const errors: string[] = [];
  const transitions = schedule.transitions;

  // Check minimum transitions
  if (transitions.length === 0) {
    errors.push('Day schedule must have at least 1 transition');
    return { valid: false, errors };
  }

  // Check maximum transitions
  if (transitions.length > 6) {
    errors.push(`Too many transitions: ${transitions.length}. Maximum is 6 per day`);
  }

  // Check first transition is at 00:00
  if (transitions[0].time !== '00:00') {
    errors.push(`First transition must be at 00:00, found ${transitions[0].time}`);
  }

  // Validate each transition
  transitions.forEach((transition, index) => {
    const result = validateTransition(transition);
    if (!result.valid) {
      result.errors.forEach(error => {
        errors.push(`Transition ${index + 1}: ${error}`);
      });
    }
  });

  // Check for duplicate times
  const times = transitions.map(t => t.time);
  const uniqueTimes = new Set(times);
  if (times.length !== uniqueTimes.size) {
    errors.push('Duplicate transition times found. Each time must be unique');
  }

  // Check chronological order
  for (let i = 1; i < transitions.length; i++) {
    const prevTime = transitions[i - 1].time;
    const currTime = transitions[i].time;

    if (!isValidTime(prevTime) || !isValidTime(currTime)) {
      continue; // Skip comparison if time format is invalid (already reported)
    }

    const { hours: prevH, minutes: prevM } = parseTime(prevTime);
    const { hours: currH, minutes: currM } = parseTime(currTime);
    const prevMinutes = prevH * 60 + prevM;
    const currMinutes = currH * 60 + currM;

    if (currMinutes <= prevMinutes) {
      errors.push(`Transitions must be in chronological order: ${prevTime} should come before ${currTime}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a weekly schedule
 */
export function validateWeeklySchedule(schedule: WeeklySchedule): ValidationResult {
  const errors: string[] = [];
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  days.forEach(day => {
    const daySchedule = schedule[day];
    const result = validateDaySchedule(daySchedule);

    if (!result.valid) {
      result.errors.forEach(error => {
        errors.push(`${day.charAt(0).toUpperCase() + day.slice(1)}: ${error}`);
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}
