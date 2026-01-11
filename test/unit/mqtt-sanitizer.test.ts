/**
 * Unit tests for MQTT sanitizer
 * Tests the sanitization of MQTT topic segments for security
 */

import { describe, it, expect } from 'vitest';
import { sanitizeMqttTopicSegment, isValidMqttTopicSegment } from '../../src/services/mqtt-sanitizer';

describe('mqtt-sanitizer', () => {
  describe('sanitizeMqttTopicSegment', () => {
    describe('should sanitize MQTT wildcards', () => {
      it('should replace + with underscore', () => {
        const result = sanitizeMqttTopicSegment('device+name');
        expect(result.value).toBe('device_name');
        expect(result.wasModified).toBe(true);
      });

      it('should replace # with underscore', () => {
        const result = sanitizeMqttTopicSegment('device#');
        expect(result.value).toBe('device_');
        expect(result.wasModified).toBe(true);
      });

      it('should replace / with underscore', () => {
        const result = sanitizeMqttTopicSegment('device/name');
        expect(result.value).toBe('device_name');
        expect(result.wasModified).toBe(true);
      });

      it('should replace null character with underscore', () => {
        const result = sanitizeMqttTopicSegment('device\0name');
        expect(result.value).toBe('device_name');
        expect(result.wasModified).toBe(true);
      });

      it('should replace multiple forbidden chars', () => {
        const result = sanitizeMqttTopicSegment('dev+ice/na#me');
        expect(result.value).toBe('dev_ice_na_me');
        expect(result.wasModified).toBe(true);
      });

      it('should handle path traversal attempts', () => {
        const result = sanitizeMqttTopicSegment('device/../../admin');
        // device/../../admin -> device_.._.._admin (each / becomes _)
        expect(result.value).toBe('device_.._.._admin');
        expect(result.wasModified).toBe(true);
        expect(result.value).not.toContain('/');
      });
    });

    describe('should handle edge cases', () => {
      it('should use fallback for empty string', () => {
        const result = sanitizeMqttTopicSegment('');
        expect(result.value).toBe('unknown_device');
        expect(result.wasModified).toBe(true);
      });

      it('should use fallback for whitespace-only', () => {
        const result = sanitizeMqttTopicSegment('   ');
        expect(result.value).toBe('unknown_device');
        expect(result.wasModified).toBe(true);
      });

      it('should use custom fallback when provided', () => {
        const result = sanitizeMqttTopicSegment('', 'default_trvzb');
        expect(result.value).toBe('default_trvzb');
      });

      it('should handle null defensively', () => {
        // @ts-expect-error - testing defensive handling
        const result = sanitizeMqttTopicSegment(null);
        expect(result.value).toBe('unknown_device');
        expect(result.wasModified).toBe(true);
      });

      it('should handle undefined defensively', () => {
        // @ts-expect-error - testing defensive handling
        const result = sanitizeMqttTopicSegment(undefined);
        expect(result.value).toBe('unknown_device');
        expect(result.wasModified).toBe(true);
      });

      it('should truncate excessively long names', () => {
        const longName = 'a'.repeat(300);
        const result = sanitizeMqttTopicSegment(longName);
        expect(result.value.length).toBe(256);
        expect(result.wasModified).toBe(true);
      });

      it('should preserve original value in result', () => {
        const result = sanitizeMqttTopicSegment('device+name');
        expect(result.originalValue).toBe('device+name');
      });
    });

    describe('should not modify valid names', () => {
      it('should not modify standard device names', () => {
        const result = sanitizeMqttTopicSegment('living_room_trvzb');
        expect(result.value).toBe('living_room_trvzb');
        expect(result.wasModified).toBe(false);
      });

      it('should not modify names with dots', () => {
        // Dots are allowed in MQTT topic segments
        const result = sanitizeMqttTopicSegment('device.v2.name');
        expect(result.value).toBe('device.v2.name');
        expect(result.wasModified).toBe(false);
      });

      it('should not modify names with hyphens', () => {
        const result = sanitizeMqttTopicSegment('living-room-trvzb');
        expect(result.value).toBe('living-room-trvzb');
        expect(result.wasModified).toBe(false);
      });

      it('should not modify names with numbers', () => {
        const result = sanitizeMqttTopicSegment('trvzb_01_bedroom');
        expect(result.value).toBe('trvzb_01_bedroom');
        expect(result.wasModified).toBe(false);
      });
    });
  });

  describe('isValidMqttTopicSegment', () => {
    it('should return true for valid names', () => {
      expect(isValidMqttTopicSegment('living_room_trvzb')).toBe(true);
      expect(isValidMqttTopicSegment('device-name')).toBe(true);
      expect(isValidMqttTopicSegment('device.name')).toBe(true);
    });

    it('should return false for names with wildcards', () => {
      expect(isValidMqttTopicSegment('device+')).toBe(false);
      expect(isValidMqttTopicSegment('device#')).toBe(false);
      expect(isValidMqttTopicSegment('device/name')).toBe(false);
    });

    it('should return false for empty/whitespace', () => {
      expect(isValidMqttTopicSegment('')).toBe(false);
      expect(isValidMqttTopicSegment('   ')).toBe(false);
    });

    it('should return false for excessively long names', () => {
      const longName = 'a'.repeat(300);
      expect(isValidMqttTopicSegment(longName)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      // @ts-expect-error - testing defensive handling
      expect(isValidMqttTopicSegment(null)).toBe(false);
      // @ts-expect-error - testing defensive handling
      expect(isValidMqttTopicSegment(undefined)).toBe(false);
    });
  });
});
