// Days of the week
export type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

// Ordered array of days of the week - single source of truth for iteration
export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
] as const;

// A single transition (time + temperature)
export interface Transition {
  id?: string;         // unique identifier for UI tracking (not persisted to MQTT)
  time: string;        // "HH:mm" format (24h)
  temperature: number; // 4-35°C, 0.5°C steps
}

// Schedule for a single day
export interface DaySchedule {
  transitions: Transition[];
}

// Weekly schedule (all 7 days)
export interface WeeklySchedule {
  sunday: DaySchedule;
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
}

// Card configuration
export interface TRVZBSchedulerCardConfig {
  type: string;
  entity: string;           // climate entity ID
  name?: string;            // optional display name
  view_mode?: 'week' | 'graph'; // default view mode
  schedule_sensor?: string; // optional override for schedule sensor entity ID
}

// Home Assistant types (simplified)
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService: (domain: string, service: string, data: Record<string, unknown>) => Promise<void>;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// MQTT schedule format (what Z2M expects)
export interface MQTTWeeklySchedule {
  sunday: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
}

/**
 * Partial MQTT payload for bulk updates
 * Contains only the days that need to be updated
 */
export type MQTTPartialPayload = Partial<Record<`weekly_schedule_${DayOfWeek}`, string>>;

/**
 * Result of computing schedule differences
 */
export interface ScheduleDiff {
  /** Map of day -> serialized schedule string for changed days only */
  readonly changes: Map<DayOfWeek, string>;
  /** True if at least one day has changed */
  readonly hasChanges: boolean;
  /** List of days that changed */
  readonly changedDays: readonly DayOfWeek[];
}

/**
 * Result of a save operation
 * Uses discriminated union for type-safe handling of different outcomes
 */
export type SaveScheduleResult =
  | { status: 'success'; daysUpdated: readonly DayOfWeek[] }
  | { status: 'skipped' }
  | { status: 'error'; error: string };
