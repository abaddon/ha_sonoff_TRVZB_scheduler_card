/**
 * Unit tests for time.ts
 * Tests time formatting, parsing, and utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  formatTime,
  parseTime,
  compareTime,
  timeToMinutes,
  minutesToTime,
  generateTimeOptions
} from '../../src/utils/time';

describe('time.ts', () => {
  describe('formatTime', () => {
    it('should format hours and minutes to HH:mm', () => {
      expect(formatTime(0, 0)).toBe('00:00');
      expect(formatTime(6, 30)).toBe('06:30');
      expect(formatTime(12, 0)).toBe('12:00');
      expect(formatTime(23, 59)).toBe('23:59');
    });

    it('should pad single digit hours with zero', () => {
      expect(formatTime(0, 0)).toBe('00:00');
      expect(formatTime(1, 0)).toBe('01:00');
      expect(formatTime(9, 0)).toBe('09:00');
    });

    it('should pad single digit minutes with zero', () => {
      expect(formatTime(12, 0)).toBe('12:00');
      expect(formatTime(12, 1)).toBe('12:01');
      expect(formatTime(12, 9)).toBe('12:09');
    });

    it('should handle midnight', () => {
      expect(formatTime(0, 0)).toBe('00:00');
    });

    it('should handle end of day', () => {
      expect(formatTime(23, 59)).toBe('23:59');
    });

    it('should handle noon', () => {
      expect(formatTime(12, 0)).toBe('12:00');
    });

    it('should not pad double digit values', () => {
      expect(formatTime(10, 30)).toBe('10:30');
      expect(formatTime(23, 45)).toBe('23:45');
    });
  });

  describe('parseTime', () => {
    it('should parse valid time strings', () => {
      expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
      expect(parseTime('06:30')).toEqual({ hours: 6, minutes: 30 });
      expect(parseTime('12:00')).toEqual({ hours: 12, minutes: 0 });
      expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    });

    it('should parse midnight', () => {
      expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
    });

    it('should parse end of day', () => {
      expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    });

    it('should throw error for invalid format', () => {
      expect(() => parseTime('12:00:00')).toThrow('Invalid time format');
      expect(() => parseTime('12')).toThrow('Invalid time format');
      expect(() => parseTime('12:')).toThrow('Invalid time format');
      expect(() => parseTime(':30')).toThrow('Invalid time format');
      expect(() => parseTime('1:30')).toThrow('Invalid time format');
      expect(() => parseTime('12:3')).toThrow('Invalid time format');
    });

    it('should throw error for hours out of range', () => {
      expect(() => parseTime('24:00')).toThrow('Invalid hours');
      expect(() => parseTime('25:00')).toThrow('Invalid hours');
      expect(() => parseTime('-1:00')).toThrow('Invalid hours');
    });

    it('should throw error for minutes out of range', () => {
      expect(() => parseTime('12:60')).toThrow('Invalid minutes');
      expect(() => parseTime('12:99')).toThrow('Invalid minutes');
      expect(() => parseTime('12:-1')).toThrow('Invalid minutes');
    });

    it('should throw error for non-numeric values', () => {
      expect(() => parseTime('ab:cd')).toThrow('Invalid time format');
      expect(() => parseTime('12:ab')).toThrow('Invalid time format');
      expect(() => parseTime('ab:30')).toThrow('Invalid time format');
    });

    it('should throw error for empty string', () => {
      expect(() => parseTime('')).toThrow('Invalid time format');
    });

    it('should accept all valid hours (0-23)', () => {
      for (let h = 0; h < 24; h++) {
        const time = formatTime(h, 0);
        expect(parseTime(time).hours).toBe(h);
      }
    });

    it('should accept all valid minutes (0-59)', () => {
      for (let m = 0; m < 60; m++) {
        const time = formatTime(12, m);
        expect(parseTime(time).minutes).toBe(m);
      }
    });
  });

  describe('compareTime', () => {
    it('should return -1 when first time is earlier', () => {
      expect(compareTime('06:00', '12:00')).toBe(-1);
      expect(compareTime('00:00', '23:59')).toBe(-1);
      expect(compareTime('12:00', '12:30')).toBe(-1);
    });

    it('should return 1 when first time is later', () => {
      expect(compareTime('12:00', '06:00')).toBe(1);
      expect(compareTime('23:59', '00:00')).toBe(1);
      expect(compareTime('12:30', '12:00')).toBe(1);
    });

    it('should return 0 when times are equal', () => {
      expect(compareTime('06:00', '06:00')).toBe(0);
      expect(compareTime('00:00', '00:00')).toBe(0);
      expect(compareTime('23:59', '23:59')).toBe(0);
    });

    it('should handle midnight comparisons', () => {
      expect(compareTime('00:00', '00:01')).toBe(-1);
      expect(compareTime('00:00', '12:00')).toBe(-1);
      expect(compareTime('23:59', '00:00')).toBe(1);
    });

    it('should handle same hour different minutes', () => {
      expect(compareTime('12:00', '12:30')).toBe(-1);
      expect(compareTime('12:30', '12:00')).toBe(1);
      expect(compareTime('12:15', '12:15')).toBe(0);
    });

    it('should be transitive', () => {
      const times = ['06:00', '12:00', '18:00'];
      expect(compareTime(times[0], times[1])).toBe(-1);
      expect(compareTime(times[1], times[2])).toBe(-1);
      expect(compareTime(times[0], times[2])).toBe(-1);
    });
  });

  describe('timeToMinutes', () => {
    it('should convert midnight to 0', () => {
      expect(timeToMinutes('00:00')).toBe(0);
    });

    it('should convert times to minutes since midnight', () => {
      expect(timeToMinutes('00:01')).toBe(1);
      expect(timeToMinutes('00:30')).toBe(30);
      expect(timeToMinutes('01:00')).toBe(60);
      expect(timeToMinutes('06:00')).toBe(360);
      expect(timeToMinutes('12:00')).toBe(720);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('should handle hours and minutes correctly', () => {
      expect(timeToMinutes('01:30')).toBe(90); // 60 + 30
      expect(timeToMinutes('06:45')).toBe(405); // 360 + 45
      expect(timeToMinutes('12:15')).toBe(735); // 720 + 15
    });

    it('should convert end of day to 1439', () => {
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('should throw for invalid time format', () => {
      expect(() => timeToMinutes('invalid')).toThrow();
      expect(() => timeToMinutes('25:00')).toThrow();
    });
  });

  describe('minutesToTime', () => {
    it('should convert 0 to midnight', () => {
      expect(minutesToTime(0)).toBe('00:00');
    });

    it('should convert minutes since midnight to time', () => {
      expect(minutesToTime(1)).toBe('00:01');
      expect(minutesToTime(30)).toBe('00:30');
      expect(minutesToTime(60)).toBe('01:00');
      expect(minutesToTime(360)).toBe('06:00');
      expect(minutesToTime(720)).toBe('12:00');
      expect(minutesToTime(1439)).toBe('23:59');
    });

    it('should handle hours and minutes correctly', () => {
      expect(minutesToTime(90)).toBe('01:30');
      expect(minutesToTime(405)).toBe('06:45');
      expect(minutesToTime(735)).toBe('12:15');
    });

    it('should convert 1439 to end of day', () => {
      expect(minutesToTime(1439)).toBe('23:59');
    });

    it('should throw error for negative minutes', () => {
      expect(() => minutesToTime(-1)).toThrow('Invalid minutes');
      expect(() => minutesToTime(-100)).toThrow('Invalid minutes');
    });

    it('should throw error for minutes >= 1440', () => {
      expect(() => minutesToTime(1440)).toThrow('Invalid minutes');
      expect(() => minutesToTime(1500)).toThrow('Invalid minutes');
    });

    it('should be inverse of timeToMinutes', () => {
      const times = ['00:00', '06:30', '12:00', '18:45', '23:59'];
      times.forEach(time => {
        const minutes = timeToMinutes(time);
        expect(minutesToTime(minutes)).toBe(time);
      });
    });

    it('should round-trip with timeToMinutes', () => {
      for (let m = 0; m < 1440; m += 15) {
        const time = minutesToTime(m);
        expect(timeToMinutes(time)).toBe(m);
      }
    });
  });

  describe('generateTimeOptions', () => {
    it('should generate options with 15 minute steps by default', () => {
      const options = generateTimeOptions();

      expect(options).toContain('00:00');
      expect(options).toContain('00:15');
      expect(options).toContain('00:30');
      expect(options).toContain('00:45');
      expect(options).toContain('01:00');
    });

    it('should generate correct number of options for 15 minute steps', () => {
      const options = generateTimeOptions(15);

      // 24 hours * 4 options per hour = 96 options
      expect(options).toHaveLength(96);
    });

    it('should start with midnight', () => {
      const options = generateTimeOptions(15);

      expect(options[0]).toBe('00:00');
    });

    it('should not include 24:00', () => {
      const options = generateTimeOptions(15);

      expect(options).not.toContain('24:00');
      expect(options[options.length - 1]).toBe('23:45');
    });

    it('should generate options with 30 minute steps', () => {
      const options = generateTimeOptions(30);

      expect(options).toHaveLength(48); // 24 hours * 2
      expect(options).toContain('00:00');
      expect(options).toContain('00:30');
      expect(options).toContain('01:00');
      expect(options).toContain('01:30');
      expect(options).not.toContain('00:15');
      expect(options).not.toContain('00:45');
    });

    it('should generate options with 60 minute steps', () => {
      const options = generateTimeOptions(60);

      expect(options).toHaveLength(24);
      expect(options).toContain('00:00');
      expect(options).toContain('01:00');
      expect(options).toContain('02:00');
      expect(options).not.toContain('00:30');
    });

    it('should generate options with 5 minute steps', () => {
      const options = generateTimeOptions(5);

      expect(options).toHaveLength(288); // 24 * 60 / 5
      expect(options).toContain('00:00');
      expect(options).toContain('00:05');
      expect(options).toContain('00:10');
      expect(options).toContain('00:15');
    });

    it('should generate options with 1 minute steps', () => {
      const options = generateTimeOptions(1);

      expect(options).toHaveLength(1440); // 24 * 60
      expect(options[0]).toBe('00:00');
      expect(options[1]).toBe('00:01');
      expect(options[1439]).toBe('23:59');
    });

    it('should generate all valid times', () => {
      const options = generateTimeOptions(15);

      options.forEach(time => {
        expect(() => parseTime(time)).not.toThrow();
      });
    });

    it('should generate times in chronological order', () => {
      const options = generateTimeOptions(15);

      for (let i = 1; i < options.length; i++) {
        expect(compareTime(options[i - 1], options[i])).toBe(-1);
      }
    });

    it('should handle 10 minute steps', () => {
      const options = generateTimeOptions(10);

      expect(options).toHaveLength(144); // 24 * 60 / 10
      expect(options).toContain('00:00');
      expect(options).toContain('00:10');
      expect(options).toContain('00:20');
      expect(options).toContain('00:30');
    });

    it('should handle 45 minute steps', () => {
      const options = generateTimeOptions(45);

      expect(options).toHaveLength(32); // 24 * 60 / 45
      expect(options).toContain('00:00');
      expect(options).toContain('00:45');
      expect(options).toContain('01:30');
    });

    it('should handle 90 minute steps', () => {
      const options = generateTimeOptions(90);

      expect(options).toHaveLength(16); // 24 * 60 / 90
      expect(options).toContain('00:00');
      expect(options).toContain('01:30');
      expect(options).toContain('03:00');
    });

    it('should handle 120 minute steps (2 hours)', () => {
      const options = generateTimeOptions(120);

      expect(options).toHaveLength(12);
      expect(options).toContain('00:00');
      expect(options).toContain('02:00');
      expect(options).toContain('04:00');
    });

    it('should not have duplicate times', () => {
      const options = generateTimeOptions(15);
      const uniqueOptions = new Set(options);

      expect(uniqueOptions.size).toBe(options.length);
    });
  });
});
