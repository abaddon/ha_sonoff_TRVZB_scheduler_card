/**
 * MQTT Topic Sanitization Module
 * Provides defense-in-depth protection against MQTT topic injection
 */

/**
 * MQTT special characters that must be sanitized
 * - '+' single-level wildcard
 * - '#' multi-level wildcard
 * - '/' topic separator
 * - '\0' null character (can cause parsing issues)
 */
const MQTT_FORBIDDEN_CHARS_REGEX = /[+#/\0]/g;

/**
 * Same pattern without /g flag for use with .test()
 * (Regex with /g flag is stateful and causes issues with repeated .test() calls)
 */
const MQTT_FORBIDDEN_CHARS_TEST_REGEX = /[+#/\0]/;

/**
 * Replacement character for forbidden MQTT characters
 * Underscore is safe and commonly used in MQTT topics
 */
const SAFE_REPLACEMENT = '_';

/**
 * Maximum length for MQTT topic segment
 * Prevents excessively long topics that could cause issues
 */
const MAX_TOPIC_SEGMENT_LENGTH = 256;

/**
 * Result of sanitization operation
 * Provides both the sanitized value and metadata about what was changed
 */
export interface SanitizationResult {
  readonly value: string;
  readonly wasModified: boolean;
  readonly originalValue: string;
}

/**
 * Sanitize a string for safe use in MQTT topic construction
 *
 * Invariants:
 * - Result never contains +, #, /, or null characters
 * - Result is never empty (returns fallback if input is empty/whitespace)
 * - Result is truncated to MAX_TOPIC_SEGMENT_LENGTH
 *
 * @param input - Raw string to sanitize
 * @param fallback - Value to use if input is empty/whitespace
 * @returns Sanitization result with safe value
 */
export function sanitizeMqttTopicSegment(
  input: string,
  fallback: string = 'unknown_device'
): SanitizationResult {
  // Handle null/undefined defensively
  if (input == null) {
    return {
      value: fallback,
      wasModified: true,
      originalValue: String(input)
    };
  }

  // Trim whitespace
  const trimmed = input.trim();

  // Use fallback for empty strings
  if (trimmed.length === 0) {
    return {
      value: fallback,
      wasModified: true,
      originalValue: input
    };
  }

  // Replace forbidden characters
  const sanitized = trimmed.replace(MQTT_FORBIDDEN_CHARS_REGEX, SAFE_REPLACEMENT);

  // Truncate if too long
  const truncated = sanitized.length > MAX_TOPIC_SEGMENT_LENGTH
    ? sanitized.slice(0, MAX_TOPIC_SEGMENT_LENGTH)
    : sanitized;

  return {
    value: truncated,
    wasModified: truncated !== input,
    originalValue: input
  };
}

/**
 * Validate that a string is safe for MQTT topic use without modification
 * Use this for validation-only scenarios where you want to reject invalid input
 *
 * @param input - String to validate
 * @returns true if string is safe for MQTT topics
 */
export function isValidMqttTopicSegment(input: string): boolean {
  if (input == null || input.trim().length === 0) {
    return false;
  }

  if (input.length > MAX_TOPIC_SEGMENT_LENGTH) {
    return false;
  }

  return !MQTT_FORBIDDEN_CHARS_TEST_REGEX.test(input);
}
