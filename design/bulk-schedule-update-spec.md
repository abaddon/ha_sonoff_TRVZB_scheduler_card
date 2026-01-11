# Feature: Bulk Schedule Update

**Bounded Context:** Schedule Management

**Descrizione:**
Sostituisce il meccanismo attuale di pubblicazione MQTT per-day (7 messaggi separati) con una singola pubblicazione bulk che include solo i giorni modificati. Questo riduce il traffico MQTT e migliora l'efficienza quando l'utente modifica solo alcuni giorni della settimana.

---

## 1. Domain Model

### Aggregates

```
ScheduleChangeTracker (Aggregate Root)
|
+-- Entities
|   +-- WeeklySchedule (existing)
|   +-- OriginalScheduleSnapshot (new - immutable reference)
|
+-- Value Objects
|   +-- DayOfWeek
|   +-- DaySchedule (existing)
|   +-- ScheduleDiff (new)
|   +-- MQTTPartialPayload (new)
|
+-- Invariants
|   +-- INV-1: ScheduleDiff contains only days that differ from original
|   +-- INV-2: Payload JSON keys must match DAYS_OF_WEEK values
|   +-- INV-3: Empty diff results in no MQTT publish
```

### Value Objects

**ScheduleDiff** - Rappresenta i cambiamenti tra schedule originale e modificato:
```typescript
/**
 * Represents the difference between original and modified schedule
 * Contains only the days that have changed
 */
interface ScheduleDiff {
  readonly changedDays: ReadonlyMap<DayOfWeek, DaySchedule>;
  readonly hasChanges: boolean;
}
```

**MQTTPartialPayload** - Il payload JSON da pubblicare:
```typescript
/**
 * Partial MQTT payload containing only modified days
 * Example: { "weekly_schedule_monday": "00:00/18 06:00/21", "weekly_schedule_friday": "00:00/20" }
 */
type MQTTPartialPayload = Partial<Record<`weekly_schedule_${DayOfWeek}`, string>>;
```

---

## 2. Data Flow Analysis

### Current Implementation (da sostituire)

```
User edits schedule
       |
       v
card._handleScheduleChanged() updates _schedule
       |
       v
User clicks Save
       |
       v
saveSchedule(hass, entityId, schedule)
       |
       v
serializeWeeklySchedule(schedule) -> MQTTWeeklySchedule (all 7 days)
       |
       v
for (const day of DAYS_OF_WEEK) {
    hass.callService('mqtt', 'publish', {
        topic: `zigbee2mqtt/${device}/set/weekly_schedule_${day}`,
        payload: mqttSchedule[day]  // string
    });
}
```

**Problemi:**
1. Pubblica sempre tutti i 7 giorni, anche se l'utente ha modificato solo lunedi
2. 7 chiamate MQTT separate (overhead di rete)
3. Non traccia quali giorni sono effettivamente cambiati

### New Implementation (proposta)

```
Card loads schedule from sensors
       |
       v
card._originalSchedule = deepCopy(schedule)  // Snapshot immutabile
       |
       v
User edits schedule
       |
       v
card._handleScheduleChanged() updates _schedule (solo working copy)
       |
       v
User clicks Save
       |
       v
computeScheduleDiff(_originalSchedule, _schedule) -> ScheduleDiff
       |
       v
if (!diff.hasChanges) return; // No-op
       |
       v
buildPartialPayload(diff) -> MQTTPartialPayload
       |
       v
publishBulkSchedule(hass, entityId, payload)  // Single MQTT message
       |
       v
_originalSchedule = deepCopy(_schedule)  // Reset snapshot
```

---

## 3. Commands & Queries

### Commands

#### SaveScheduleCommand (refactored)

```typescript
/**
 * Command to save only modified days of a schedule
 *
 * Business Rules:
 * - BR-1: Only days that differ from original are included in payload
 * - BR-2: If no days changed, no MQTT message is published
 * - BR-3: Payload is a single JSON object, not multiple messages
 * - BR-4: Topic is `zigbee2mqtt/{device}/set` (not per-day topics)
 */
interface SaveScheduleCommand {
  entityId: string;
  originalSchedule: WeeklySchedule;  // Reference point
  modifiedSchedule: WeeklySchedule;  // Current state
}

// Result
interface SaveScheduleResult {
  success: boolean;
  daysUpdated: DayOfWeek[];
  error?: string;
}
```

**Validation Rules:**
1. `entityId` must be a valid climate entity (format: `climate.*`)
2. `originalSchedule` and `modifiedSchedule` must be valid WeeklySchedule objects
3. Each DaySchedule must pass existing validation (max 6 transitions, 00:00 start, etc.)

**Side Effects:**
- Event: `ScheduleSaved` (implicit - no explicit event system currently)
- State: `_originalSchedule` is updated to match `_modifiedSchedule`
- State: `_hasUnsavedChanges` is set to `false`

### Queries

#### ComputeScheduleDiff

```typescript
/**
 * Pure function to compute which days have changed
 *
 * Comparison logic:
 * - Two DaySchedules are equal if their serialized MQTT strings match
 * - This accounts for sorting and deduplication applied during serialization
 */
function computeScheduleDiff(
  original: WeeklySchedule,
  modified: WeeklySchedule
): ScheduleDiff;
```

**Business Rules:**
- BR-1: Comparison uses serialized form to handle equivalent representations
- BR-2: Days are compared using `serializeDaySchedule()` output for consistency
- BR-3: Order of transitions does not matter (both are sorted before comparison)

---

## 4. Implementation Details

### 4.1 New Type Definitions

File: `src/models/types.ts`

```typescript
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
```

### 4.2 Schedule Diff Function

File: `src/models/schedule.ts`

```typescript
/**
 * Compute the difference between two weekly schedules
 * Returns only the days that have changed
 *
 * @param original - The original/reference schedule
 * @param modified - The modified schedule to compare
 * @returns ScheduleDiff with only changed days
 */
export function computeScheduleDiff(
  original: WeeklySchedule,
  modified: WeeklySchedule
): ScheduleDiff {
  const changes = new Map<DayOfWeek, string>();

  for (const day of DAYS_OF_WEEK) {
    const originalSerialized = serializeDaySchedule(original[day]);
    const modifiedSerialized = serializeDaySchedule(modified[day]);

    if (originalSerialized !== modifiedSerialized) {
      changes.set(day, modifiedSerialized);
    }
  }

  return {
    changes,
    hasChanges: changes.size > 0,
    changedDays: Array.from(changes.keys())
  };
}

/**
 * Build the MQTT partial payload from a schedule diff
 *
 * @param diff - The computed schedule differences
 * @returns Object with weekly_schedule_{day} keys for changed days only
 */
export function buildPartialPayload(diff: ScheduleDiff): MQTTPartialPayload {
  const payload: MQTTPartialPayload = {};

  for (const [day, serialized] of diff.changes) {
    payload[`weekly_schedule_${day}`] = serialized;
  }

  return payload;
}
```

### 4.3 Updated HA Service

File: `src/services/ha-service.ts`

```typescript
import { computeScheduleDiff, buildPartialPayload } from '../models/schedule';

/**
 * Result of a save operation
 */
export interface SaveScheduleResult {
  success: boolean;
  daysUpdated: DayOfWeek[];
  skipped: boolean;  // True if no changes were detected
  error?: string;
}

/**
 * Save only modified days of a weekly schedule to the device via MQTT
 * Publishes a single JSON message with only the changed days
 *
 * @param hass - Home Assistant instance
 * @param entityId - Climate entity ID
 * @param originalSchedule - The schedule as it was before modifications
 * @param modifiedSchedule - The schedule after user modifications
 * @returns Result indicating which days were updated
 */
export async function saveSchedule(
  hass: HomeAssistant,
  entityId: string,
  originalSchedule: WeeklySchedule,
  modifiedSchedule: WeeklySchedule
): Promise<SaveScheduleResult> {
  try {
    // Compute which days have changed
    const diff = computeScheduleDiff(originalSchedule, modifiedSchedule);

    // No changes detected - skip MQTT publish
    if (!diff.hasChanges) {
      return {
        success: true,
        daysUpdated: [],
        skipped: true
      };
    }

    // Build the partial payload
    const payload = buildPartialPayload(diff);

    // Extract device friendly name from entity_id
    const friendlyName = extractFriendlyName(entityId);

    // Publish single message to base set topic
    const topic = `zigbee2mqtt/${friendlyName}/set`;

    await hass.callService('mqtt', 'publish', {
      topic: topic,
      payload: JSON.stringify(payload)
    });

    return {
      success: true,
      daysUpdated: diff.changedDays.slice(), // Copy array
      skipped: false
    };
  } catch (error) {
    console.error(`Error saving schedule for ${entityId}:`, error);
    return {
      success: false,
      daysUpdated: [],
      skipped: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * @deprecated Use saveSchedule with originalSchedule parameter instead
 * Legacy function that saves all 7 days (for backward compatibility during migration)
 */
export async function saveScheduleLegacy(
  hass: HomeAssistant,
  entityId: string,
  schedule: WeeklySchedule
): Promise<void> {
  // ... existing implementation moved here ...
}
```

### 4.4 Card Component Changes

File: `src/card.ts`

```typescript
@customElement('trvzb-scheduler-card')
export class TRVZBSchedulerCard extends LitElement {
  // Existing state
  @state() private _schedule: WeeklySchedule | null = null;

  // NEW: Immutable snapshot of schedule at load time
  @state() private _originalSchedule: WeeklySchedule | null = null;

  // ... existing properties ...

  /**
   * Load schedule from 7 day sensor entities
   */
  private _loadSchedule(): void {
    // ... existing logic ...

    if (schedule) {
      this._schedule = schedule;
      // NEW: Store immutable copy as reference point
      this._originalSchedule = this._deepCopySchedule(schedule);
      this._hasUnsavedChanges = false;
    }
    // ... rest of existing logic ...
  }

  /**
   * Create a deep copy of a weekly schedule
   * Used to create immutable snapshots for change tracking
   */
  private _deepCopySchedule(schedule: WeeklySchedule): WeeklySchedule {
    return {
      sunday: { transitions: schedule.sunday.transitions.map(t => ({ ...t })) },
      monday: { transitions: schedule.monday.transitions.map(t => ({ ...t })) },
      tuesday: { transitions: schedule.tuesday.transitions.map(t => ({ ...t })) },
      wednesday: { transitions: schedule.wednesday.transitions.map(t => ({ ...t })) },
      thursday: { transitions: schedule.thursday.transitions.map(t => ({ ...t })) },
      friday: { transitions: schedule.friday.transitions.map(t => ({ ...t })) },
      saturday: { transitions: schedule.saturday.transitions.map(t => ({ ...t })) },
    };
  }

  /**
   * Save schedule to device - updated to use bulk update
   */
  private async _saveSchedule(): Promise<void> {
    if (!this.hass || !this.config?.entity || !this._schedule || !this._originalSchedule || this._saving) {
      return;
    }

    this._saving = true;
    this._error = null;

    try {
      // NEW: Call updated saveSchedule with original reference
      const result = await saveSchedule(
        this.hass,
        this.config.entity,
        this._originalSchedule,
        this._schedule
      );

      if (result.success) {
        if (result.skipped) {
          // No changes detected - just clear the flag
          console.log('No schedule changes detected, skipping save');
        } else {
          console.log(`Updated ${result.daysUpdated.length} day(s):`, result.daysUpdated);
        }

        // Update original to match current (reset diff baseline)
        this._originalSchedule = this._deepCopySchedule(this._schedule);
        this._hasUnsavedChanges = false;

        // Update pending save schedule for sensor sync detection
        this._pendingSaveSchedule = serializeWeeklySchedule(this._schedule);
        // ... rest of pending save logic ...
      } else {
        throw new Error(result.error || 'Failed to save schedule');
      }
    } catch (error) {
      this._error = error instanceof Error ? error.message : 'Failed to save schedule';
      console.error('Save schedule error:', error);
    } finally {
      this._saving = false;
    }
  }
}
```

---

## 5. Pending Save Synchronization

### Problem
Il meccanismo esistente `_pendingSaveSchedule` confronta le schedule serializzate con i sensori per rilevare quando Z2M ha applicato le modifiche. Con il bulk update, i sensori potrebbero aggiornarsi uno alla volta.

### Solution
Il `_pendingSaveSchedule` continua a contenere la schedule completa serializzata. Il check `_allDaySensorsMatch()` rimane invariato - aspetta che TUTTI i sensori corrispondano, indipendentemente da quanti giorni sono stati modificati.

Questo e' corretto perche':
1. Anche se pubblichiamo solo 2 giorni, Z2M aggiornerebbe solo quei 2 sensori
2. Gli altri 5 sensori rimangono invariati (gia' corrispondono al `_pendingSaveSchedule`)
3. Quindi `_allDaySensorsMatch()` ritornera' `true` quando i giorni modificati si aggiornano

**Nessuna modifica necessaria** al meccanismo di sincronizzazione esistente.

---

## 6. Test Plan

### Unit Tests - `src/models/schedule.test.ts`

```typescript
describe('computeScheduleDiff', () => {
  it('should return empty diff when schedules are identical', () => {
    const schedule = createEmptyWeeklySchedule();
    const diff = computeScheduleDiff(schedule, schedule);

    expect(diff.hasChanges).toBe(false);
    expect(diff.changedDays).toHaveLength(0);
  });

  it('should detect single day change', () => {
    const original = createEmptyWeeklySchedule();
    const modified = { ...original };
    modified.monday = { transitions: [{ time: '00:00', temperature: 25 }] };

    const diff = computeScheduleDiff(original, modified);

    expect(diff.hasChanges).toBe(true);
    expect(diff.changedDays).toEqual(['monday']);
    expect(diff.changes.get('monday')).toBe('00:00/25');
  });

  it('should detect multiple day changes', () => {
    const original = createEmptyWeeklySchedule();
    const modified = { ...original };
    modified.monday = { transitions: [{ time: '00:00', temperature: 25 }] };
    modified.friday = { transitions: [{ time: '00:00', temperature: 22 }] };

    const diff = computeScheduleDiff(original, modified);

    expect(diff.hasChanges).toBe(true);
    expect(diff.changedDays).toHaveLength(2);
    expect(diff.changedDays).toContain('monday');
    expect(diff.changedDays).toContain('friday');
  });

  it('should ignore order differences in transitions', () => {
    // Same transitions in different order should not be detected as change
    const original = {
      ...createEmptyWeeklySchedule(),
      monday: {
        transitions: [
          { time: '00:00', temperature: 20 },
          { time: '08:00', temperature: 22 }
        ]
      }
    };
    const modified = {
      ...createEmptyWeeklySchedule(),
      monday: {
        transitions: [
          { time: '08:00', temperature: 22 },
          { time: '00:00', temperature: 20 }
        ]
      }
    };

    const diff = computeScheduleDiff(original, modified);

    expect(diff.hasChanges).toBe(false);
  });
});

describe('buildPartialPayload', () => {
  it('should build payload with weekly_schedule_ prefix', () => {
    const changes = new Map<DayOfWeek, string>();
    changes.set('monday', '00:00/20 08:00/22');

    const diff: ScheduleDiff = {
      changes,
      hasChanges: true,
      changedDays: ['monday']
    };

    const payload = buildPartialPayload(diff);

    expect(payload).toEqual({
      weekly_schedule_monday: '00:00/20 08:00/22'
    });
  });

  it('should build payload with multiple days', () => {
    const changes = new Map<DayOfWeek, string>();
    changes.set('monday', '00:00/20');
    changes.set('wednesday', '00:00/22 12:00/18');

    const diff: ScheduleDiff = {
      changes,
      hasChanges: true,
      changedDays: ['monday', 'wednesday']
    };

    const payload = buildPartialPayload(diff);

    expect(payload).toEqual({
      weekly_schedule_monday: '00:00/20',
      weekly_schedule_wednesday: '00:00/22 12:00/18'
    });
  });

  it('should return empty object for no changes', () => {
    const diff: ScheduleDiff = {
      changes: new Map(),
      hasChanges: false,
      changedDays: []
    };

    const payload = buildPartialPayload(diff);

    expect(payload).toEqual({});
  });
});
```

### Integration Tests - `test/integration/card.test.ts`

```typescript
describe('Save Operation - Bulk Update', () => {
  it('should publish single MQTT message with JSON payload', async () => {
    // Make a change to Monday only
    const weekView = queryShadow(card, 'schedule-week-view');
    dispatchCustomEvent(weekView!, 'day-selected', { day: 'monday' as DayOfWeek });
    await waitForUpdate(card);

    const dayEditor = queryShadow(card, 'day-schedule-editor');
    dispatchCustomEvent(dayEditor!, 'schedule-changed', {
      day: 'monday' as DayOfWeek,
      schedule: { transitions: [{ time: '00:00', temperature: 25 }] }
    });
    await waitForUpdate(card);

    // Save
    const saveButton = queryShadow<HTMLButtonElement>(card, '.save-button');
    saveButton!.click();
    await waitForUpdate(card);
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify single MQTT call
    const calls = scenario.recorder.getCalls('mqtt', 'publish');
    expect(calls.length).toBe(1);

    // Verify topic is base /set (not per-day)
    expect(calls[0].data.topic).toBe('zigbee2mqtt/living_room_trvzb/set');

    // Verify payload is JSON with only Monday
    const payload = JSON.parse(calls[0].data.payload as string);
    expect(payload).toHaveProperty('weekly_schedule_monday');
    expect(payload).not.toHaveProperty('weekly_schedule_tuesday');
    expect(payload).not.toHaveProperty('weekly_schedule_sunday');
  });

  it('should include multiple changed days in single payload', async () => {
    // Change Monday
    const weekView = queryShadow(card, 'schedule-week-view');
    dispatchCustomEvent(weekView!, 'day-selected', { day: 'monday' as DayOfWeek });
    await waitForUpdate(card);
    const dayEditor = queryShadow(card, 'day-schedule-editor');
    dispatchCustomEvent(dayEditor!, 'schedule-changed', {
      day: 'monday' as DayOfWeek,
      schedule: { transitions: [{ time: '00:00', temperature: 25 }] }
    });

    // Change Friday
    dispatchCustomEvent(weekView!, 'day-selected', { day: 'friday' as DayOfWeek });
    await waitForUpdate(card);
    const dayEditor2 = queryShadow(card, 'day-schedule-editor');
    dispatchCustomEvent(dayEditor2!, 'schedule-changed', {
      day: 'friday' as DayOfWeek,
      schedule: { transitions: [{ time: '00:00', temperature: 22 }] }
    });
    await waitForUpdate(card);

    // Save
    const saveButton = queryShadow<HTMLButtonElement>(card, '.save-button');
    saveButton!.click();
    await waitForUpdate(card);
    await new Promise(resolve => setTimeout(resolve, 10));

    const calls = scenario.recorder.getCalls('mqtt', 'publish');
    expect(calls.length).toBe(1);

    const payload = JSON.parse(calls[0].data.payload as string);
    expect(Object.keys(payload).length).toBe(2);
    expect(payload).toHaveProperty('weekly_schedule_monday');
    expect(payload).toHaveProperty('weekly_schedule_friday');
  });

  it('should not publish MQTT when no changes detected', async () => {
    // Open editor but don't change anything
    const weekView = queryShadow(card, 'schedule-week-view');
    dispatchCustomEvent(weekView!, 'day-selected', { day: 'monday' as DayOfWeek });
    await waitForUpdate(card);

    // Force hasUnsavedChanges to true but schedule unchanged
    (card as any)._hasUnsavedChanges = true;
    await waitForUpdate(card);

    // Save
    const saveButton = queryShadow<HTMLButtonElement>(card, '.save-button');
    saveButton!.click();
    await waitForUpdate(card);
    await new Promise(resolve => setTimeout(resolve, 10));

    // No MQTT calls should be made
    const calls = scenario.recorder.getCalls('mqtt', 'publish');
    expect(calls.length).toBe(0);
  });

  it('should update _originalSchedule after successful save', async () => {
    const originalBefore = (card as any)._originalSchedule;

    // Make a change
    const weekView = queryShadow(card, 'schedule-week-view');
    dispatchCustomEvent(weekView!, 'day-selected', { day: 'tuesday' as DayOfWeek });
    await waitForUpdate(card);
    const dayEditor = queryShadow(card, 'day-schedule-editor');
    dispatchCustomEvent(dayEditor!, 'schedule-changed', {
      day: 'tuesday' as DayOfWeek,
      schedule: { transitions: [{ time: '00:00', temperature: 30 }] }
    });
    await waitForUpdate(card);

    // Save
    const saveButton = queryShadow<HTMLButtonElement>(card, '.save-button');
    saveButton!.click();
    await waitForUpdate(card);
    await new Promise(resolve => setTimeout(resolve, 10));

    // _originalSchedule should now match _schedule
    const originalAfter = (card as any)._originalSchedule;
    const currentSchedule = (card as any)._schedule;

    expect(serializeDaySchedule(originalAfter.tuesday))
      .toBe(serializeDaySchedule(currentSchedule.tuesday));
  });
});
```

---

## 7. Migration & Backward Compatibility

### Approach: Clean Cut (No Backward Compatibility)

Rationale:
1. Il formato precedente (7 messaggi separati) e' stato introdotto di recente (commit `1e5bd46`)
2. Il nuovo formato bulk e' quello standard supportato da Zigbee2MQTT
3. Non ci sono utenti legacy da supportare

### Migration Checklist

- [ ] Remove `saveScheduleLegacy()` after verification
- [ ] Update CLAUDE.md documentation to reflect new MQTT format
- [ ] Update test expectations for single MQTT call

---

## 8. File Summary

### Files to Modify

| File | Changes |
|------|---------|
| `src/models/types.ts` | Add `MQTTPartialPayload`, `ScheduleDiff` types |
| `src/models/schedule.ts` | Add `computeScheduleDiff()`, `buildPartialPayload()` functions |
| `src/services/ha-service.ts` | Refactor `saveSchedule()` to accept original + modified, publish single JSON |
| `src/card.ts` | Add `_originalSchedule` state, update `_loadSchedule()`, `_saveSchedule()` |
| `test/integration/card.test.ts` | Update test expectations for single MQTT message |
| `CLAUDE.md` | Update documentation for new bulk format |

### New Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `computeScheduleDiff()` | `schedule.ts` | Compare two schedules, return changed days |
| `buildPartialPayload()` | `schedule.ts` | Convert diff to MQTT JSON payload |
| `_deepCopySchedule()` | `card.ts` | Create immutable schedule snapshot |

---

## Parsing Instructions (for developer subagent)

**Order of implementation:**

1. **Types first** (`src/models/types.ts`)
   - Add `MQTTPartialPayload` type
   - Add `ScheduleDiff` interface

2. **Schedule model** (`src/models/schedule.ts`)
   - Implement `computeScheduleDiff()`
   - Implement `buildPartialPayload()`
   - Add unit tests

3. **HA Service** (`src/services/ha-service.ts`)
   - Update `saveSchedule()` signature to accept `originalSchedule`
   - Implement bulk publish logic
   - Keep old signature as `saveScheduleLegacy()` temporarily

4. **Card component** (`src/card.ts`)
   - Add `_originalSchedule` state property
   - Add `_deepCopySchedule()` helper
   - Update `_loadSchedule()` to set `_originalSchedule`
   - Update `_saveSchedule()` to use new `saveSchedule()` signature

5. **Integration tests** (`test/integration/card.test.ts`)
   - Update "Save Operation" tests to expect single MQTT call
   - Add tests for partial payload content

6. **Documentation** (`CLAUDE.md`)
   - Update "Writing Schedule" section
   - Update "MQTT Topics" section

**Key Validation Points:**
- Run `npm test` after each step
- Verify MQTT payload format with `console.log()` during development
- Test with actual TRVZB device if available
