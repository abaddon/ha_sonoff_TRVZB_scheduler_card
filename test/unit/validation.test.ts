/**
 * Unit tests for validation.ts
 * Tests validation functions for times, temperatures, and schedules
 */

import { describe, it, expect } from 'vitest';
import {
  isValidTime,
  isValidTemperature,
  validateTransition,
  validateDaySchedule,
  validateWeeklySchedule
} from '../../src/utils/validation';
import { DaySchedule, Transition, WeeklySchedule } from '../../src/models/types';

describe('validation.ts', () => {
  describe('isValidTime', () => {
    it('should accept valid times', () => {
      expect(isValidTime('00:00')).toBe(true);
      expect(isValidTime('12:00')).toBe(true);
      expect(isValidTime('23:59')).toBe(true);
      expect(isValidTime('06:30')).toBe(true);
      expect(isValidTime('15:45')).toBe(true);
    });

    it('should accept midnight', () => {
      expect(isValidTime('00:00')).toBe(true);
    });

    it('should accept end of day', () => {
      expect(isValidTime('23:59')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(isValidTime('12:00:00')).toBe(false); // with seconds
      expect(isValidTime('12')).toBe(false); // missing minutes
      expect(isValidTime('12:')).toBe(false); // missing minutes value
      expect(isValidTime(':30')).toBe(false); // missing hours
      expect(isValidTime('1:30')).toBe(false); // single digit hour
      expect(isValidTime('12:3')).toBe(false); // single digit minute
      expect(isValidTime('12-30')).toBe(false); // wrong separator
    });

    it('should reject out of range hours', () => {
      expect(isValidTime('24:00')).toBe(false);
      expect(isValidTime('25:00')).toBe(false);
      expect(isValidTime('-1:00')).toBe(false);
    });

    it('should reject out of range minutes', () => {
      expect(isValidTime('12:60')).toBe(false);
      expect(isValidTime('12:99')).toBe(false);
      expect(isValidTime('12:-1')).toBe(false);
    });

    it('should reject non-numeric values', () => {
      expect(isValidTime('ab:cd')).toBe(false);
      expect(isValidTime('12:ab')).toBe(false);
      expect(isValidTime('ab:30')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidTime('')).toBe(false);
    });

    it('should reject whitespace', () => {
      expect(isValidTime('  ')).toBe(false);
      expect(isValidTime(' 12:00')).toBe(false);
      expect(isValidTime('12:00 ')).toBe(false);
    });
  });

  describe('isValidTemperature', () => {
    it('should accept valid temperatures in range', () => {
      expect(isValidTemperature(4)).toBe(true);
      expect(isValidTemperature(20)).toBe(true);
      expect(isValidTemperature(35)).toBe(true);
      expect(isValidTemperature(22.5)).toBe(true);
    });

    it('should accept 0.5 degree steps', () => {
      expect(isValidTemperature(4.5)).toBe(true);
      expect(isValidTemperature(5.0)).toBe(true);
      expect(isValidTemperature(5.5)).toBe(true);
      expect(isValidTemperature(20.5)).toBe(true);
      expect(isValidTemperature(34.5)).toBe(true);
    });

    it('should accept minimum temperature (4°C)', () => {
      expect(isValidTemperature(4)).toBe(true);
    });

    it('should accept maximum temperature (35°C)', () => {
      expect(isValidTemperature(35)).toBe(true);
    });

    it('should reject temperatures below minimum', () => {
      expect(isValidTemperature(3.5)).toBe(false);
      expect(isValidTemperature(0)).toBe(false);
      expect(isValidTemperature(-5)).toBe(false);
    });

    it('should reject temperatures above maximum', () => {
      expect(isValidTemperature(35.5)).toBe(false);
      expect(isValidTemperature(40)).toBe(false);
      expect(isValidTemperature(100)).toBe(false);
    });

    it('should reject invalid step sizes (not 0.5)', () => {
      expect(isValidTemperature(20.1)).toBe(false);
      expect(isValidTemperature(20.2)).toBe(false);
      expect(isValidTemperature(20.3)).toBe(false);
      expect(isValidTemperature(20.4)).toBe(false);
      expect(isValidTemperature(20.6)).toBe(false);
      expect(isValidTemperature(20.7)).toBe(false);
      expect(isValidTemperature(20.8)).toBe(false);
      expect(isValidTemperature(20.9)).toBe(false);
    });

    it('should reject very small increments', () => {
      expect(isValidTemperature(20.25)).toBe(false);
      expect(isValidTemperature(20.75)).toBe(false);
    });

    it('should handle floating point precision', () => {
      // Common floating point values
      expect(isValidTemperature(20.5)).toBe(true);
      expect(isValidTemperature(21.0)).toBe(true);
      expect(isValidTemperature(21.5)).toBe(true);
    });
  });

  describe('validateTransition', () => {
    it('should validate correct transition', () => {
      const transition: Transition = { time: '06:00', temperature: 22 };
      const result = validateTransition(transition);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate transition with half-degree temperature', () => {
      const transition: Transition = { time: '06:00', temperature: 22.5 };
      const result = validateTransition(transition);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid time format', () => {
      const transition: Transition = { time: '6:00', temperature: 22 };
      const result = validateTransition(transition);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid time format');
    });

    it('should reject temperature out of range (too low)', () => {
      const transition: Transition = { time: '06:00', temperature: 3 };
      const result = validateTransition(transition);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('out of range');
      expect(result.errors[0]).toContain('4-35');
    });

    it('should reject temperature out of range (too high)', () => {
      const transition: Transition = { time: '06:00', temperature: 36 };
      const result = validateTransition(transition);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('out of range');
    });

    it('should reject invalid temperature step', () => {
      const transition: Transition = { time: '06:00', temperature: 20.3 };
      const result = validateTransition(transition);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('0.5°C steps');
    });

    it('should reject both invalid time and temperature', () => {
      const transition: Transition = { time: 'invalid', temperature: 100 };
      const result = validateTransition(transition);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('validateDaySchedule', () => {
    it('should validate correct day schedule', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '00:00', temperature: 20 },
          { time: '06:00', temperature: 22 },
          { time: '08:00', temperature: 18 }
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate single midnight transition', () => {
      const schedule: DaySchedule = {
        transitions: [{ time: '00:00', temperature: 20 }]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty schedule', () => {
      const schedule: DaySchedule = {
        transitions: []
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('at least 1 transition');
    });

    it('should reject too many transitions (>6)', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '00:00', temperature: 20 },
          { time: '04:00', temperature: 21 },
          { time: '08:00', temperature: 22 },
          { time: '12:00', temperature: 23 },
          { time: '16:00', temperature: 24 },
          { time: '20:00', temperature: 25 },
          { time: '23:00', temperature: 26 }
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Too many transitions'))).toBe(true);
      expect(result.errors.some(e => e.includes('Maximum is 6'))).toBe(true);
    });

    it('should reject schedule without midnight transition', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '06:00', temperature: 22 },
          { time: '08:00', temperature: 18 }
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('First transition must be at 00:00'))).toBe(true);
    });

    it('should reject duplicate times', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '00:00', temperature: 20 },
          { time: '06:00', temperature: 22 },
          { time: '06:00', temperature: 24 }
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate transition times'))).toBe(true);
    });

    it('should reject out-of-order times', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '00:00', temperature: 20 },
          { time: '08:00', temperature: 18 },
          { time: '06:00', temperature: 22 }
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('chronological order'))).toBe(true);
    });

    it('should reject transitions with equal consecutive times', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '00:00', temperature: 20 },
          { time: '06:00', temperature: 22 },
          { time: '06:00', temperature: 24 }
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(false);
      // Should fail both duplicate and chronological checks
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate transitions with invalid temperatures', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '00:00', temperature: 20 },
          { time: '06:00', temperature: 100 }
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Transition 2'))).toBe(true);
    });

    it('should validate transitions with invalid time format', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '00:00', temperature: 20 },
          { time: '6:00', temperature: 22 }
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Transition 2') && e.includes('Invalid time format'))).toBe(true);
    });

    it('should report multiple validation errors', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '06:00', temperature: 20 }, // Missing midnight
          { time: 'invalid', temperature: 100 }, // Invalid time and temp
          { time: '06:00', temperature: 22 } // Duplicate time
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should accept exactly 6 transitions', () => {
      const schedule: DaySchedule = {
        transitions: [
          { time: '00:00', temperature: 20 },
          { time: '04:00', temperature: 21 },
          { time: '08:00', temperature: 22 },
          { time: '12:00', temperature: 23 },
          { time: '16:00', temperature: 24 },
          { time: '20:00', temperature: 25 }
        ]
      };

      const result = validateDaySchedule(schedule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateWeeklySchedule', () => {
    it('should validate correct weekly schedule', () => {
      const schedule: WeeklySchedule = {
        sunday: { transitions: [{ time: '00:00', temperature: 20 }] },
        monday: { transitions: [{ time: '00:00', temperature: 20 }] },
        tuesday: { transitions: [{ time: '00:00', temperature: 20 }] },
        wednesday: { transitions: [{ time: '00:00', temperature: 20 }] },
        thursday: { transitions: [{ time: '00:00', temperature: 20 }] },
        friday: { transitions: [{ time: '00:00', temperature: 20 }] },
        saturday: { transitions: [{ time: '00:00', temperature: 20 }] }
      };

      const result = validateWeeklySchedule(schedule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate schedule with different transitions per day', () => {
      const schedule: WeeklySchedule = {
        sunday: {
          transitions: [
            { time: '00:00', temperature: 20 },
            { time: '08:00', temperature: 22 }
          ]
        },
        monday: {
          transitions: [
            { time: '00:00', temperature: 18 },
            { time: '07:00', temperature: 22 },
            { time: '17:00', temperature: 18 }
          ]
        },
        tuesday: { transitions: [{ time: '00:00', temperature: 19 }] },
        wednesday: { transitions: [{ time: '00:00', temperature: 20 }] },
        thursday: { transitions: [{ time: '00:00', temperature: 21 }] },
        friday: { transitions: [{ time: '00:00', temperature: 22 }] },
        saturday: { transitions: [{ time: '00:00', temperature: 20 }] }
      };

      const result = validateWeeklySchedule(schedule);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject schedule with invalid day', () => {
      const schedule: WeeklySchedule = {
        sunday: { transitions: [] }, // Invalid - empty
        monday: { transitions: [{ time: '00:00', temperature: 20 }] },
        tuesday: { transitions: [{ time: '00:00', temperature: 20 }] },
        wednesday: { transitions: [{ time: '00:00', temperature: 20 }] },
        thursday: { transitions: [{ time: '00:00', temperature: 20 }] },
        friday: { transitions: [{ time: '00:00', temperature: 20 }] },
        saturday: { transitions: [{ time: '00:00', temperature: 20 }] }
      };

      const result = validateWeeklySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Sunday'))).toBe(true);
    });

    it('should report errors for multiple invalid days', () => {
      const schedule: WeeklySchedule = {
        sunday: { transitions: [] },
        monday: { transitions: [{ time: '06:00', temperature: 20 }] }, // No midnight
        tuesday: { transitions: [{ time: '00:00', temperature: 100 }] }, // Invalid temp
        wednesday: { transitions: [{ time: '00:00', temperature: 20 }] },
        thursday: { transitions: [{ time: '00:00', temperature: 20 }] },
        friday: { transitions: [{ time: '00:00', temperature: 20 }] },
        saturday: { transitions: [{ time: '00:00', temperature: 20 }] }
      };

      const result = validateWeeklySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Sunday'))).toBe(true);
      expect(result.errors.some(e => e.includes('Monday'))).toBe(true);
      expect(result.errors.some(e => e.includes('Tuesday'))).toBe(true);
    });

    it('should prefix errors with day name', () => {
      const schedule: WeeklySchedule = {
        sunday: { transitions: [{ time: '00:00', temperature: 20 }] },
        monday: { transitions: [] },
        tuesday: { transitions: [{ time: '00:00', temperature: 20 }] },
        wednesday: { transitions: [{ time: '00:00', temperature: 20 }] },
        thursday: { transitions: [{ time: '00:00', temperature: 20 }] },
        friday: { transitions: [{ time: '00:00', temperature: 20 }] },
        saturday: { transitions: [{ time: '00:00', temperature: 20 }] }
      };

      const result = validateWeeklySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/^Monday:/);
    });

    it('should capitalize day names in error messages', () => {
      const schedule: WeeklySchedule = {
        sunday: { transitions: [{ time: '00:00', temperature: 20 }] },
        monday: { transitions: [{ time: '00:00', temperature: 20 }] },
        tuesday: { transitions: [{ time: '00:00', temperature: 20 }] },
        wednesday: { transitions: [] },
        thursday: { transitions: [{ time: '00:00', temperature: 20 }] },
        friday: { transitions: [{ time: '00:00', temperature: 20 }] },
        saturday: { transitions: [{ time: '00:00', temperature: 20 }] }
      };

      const result = validateWeeklySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/^Wednesday:/);
    });

    it('should validate all 7 days', () => {
      const schedule: WeeklySchedule = {
        sunday: { transitions: [] },
        monday: { transitions: [] },
        tuesday: { transitions: [] },
        wednesday: { transitions: [] },
        thursday: { transitions: [] },
        friday: { transitions: [] },
        saturday: { transitions: [] }
      };

      const result = validateWeeklySchedule(schedule);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(7);
    });
  });
});
