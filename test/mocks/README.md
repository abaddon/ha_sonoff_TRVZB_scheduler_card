# Test Mocks

This directory contains mock objects and utilities for testing the TRVZB Scheduler Card.

## hass-mock.ts

Comprehensive Home Assistant mocking utilities for unit and integration tests.

### Overview

The `hass-mock.ts` module provides everything needed to simulate Home Assistant environments in tests:

- Mock Home Assistant objects
- Mock TRVZB climate entities
- Service call recording and assertions
- Sample test data
- Test scenario helpers

### Core Functions

#### `createMockHass(options?)`

Creates a mock Home Assistant object with configurable states and service call recording.

**Parameters:**
- `options.states` - Optional initial entity states
- `options.recorder` - Optional service call recorder instance

**Returns:** `HomeAssistant`

**Example:**
```typescript
import { createMockHass } from './mocks/hass-mock';

const hass = createMockHass({
  states: {
    'climate.living_room': createMockTRVZBEntity('living_room')
  }
});
```

#### `createMockTRVZBEntity(friendlyName, schedule?)`

Creates a realistic mock TRVZB climate entity with proper attributes.

**Parameters:**
- `friendlyName` - Entity name (will be converted to entity_id as `climate.{name}`)
- `schedule` - Optional weekly schedule (uses sample if not provided)

**Returns:** `HassEntity`

**Entity Attributes:**
- `min_temp`: 4°C
- `max_temp`: 35°C
- `target_temp_step`: 0.5°C
- `hvac_modes`: ['off', 'heat', 'auto']
- `weekly_schedule`: Full week schedule data

**Example:**
```typescript
import { createMockTRVZBEntity } from './mocks/hass-mock';

// Create with default schedule
const entity = createMockTRVZBEntity('bedroom_radiator');
console.log(entity.entity_id); // "climate.bedroom_radiator"

// Create with custom schedule
const customSchedule = createMockSchedule('minimal');
const entity2 = createMockTRVZBEntity('living_room', customSchedule);
```

#### `createMockSchedule(variant?)`

Creates realistic weekly schedules for testing various scenarios.

**Parameters:**
- `variant` - Schedule type: 'default' | 'weekday' | 'weekend' | 'minimal' | 'maximal'

**Returns:** `MQTTWeeklySchedule`

**Variants:**

- **default**: Standard weekly heating schedule
- **weekday**: Active heating during work week, lighter on weekends
- **weekend**: Relaxed schedule optimized for weekends
- **minimal**: Single transition per day (just midnight)
- **maximal**: Maximum 6 transitions per day

**Example:**
```typescript
import { createMockSchedule } from './mocks/hass-mock';

// Test with minimal schedule (edge case)
const minimalSchedule = createMockSchedule('minimal');

// Test with maximum transitions (6 per day)
const maximalSchedule = createMockSchedule('maximal');
```

### MockServiceCallRecorder

Class for tracking and asserting Home Assistant service calls.

**Methods:**

#### `record(domain, service, data)`
Records a service call.

#### `getLastCall()`
Returns the most recent service call.

#### `getCalls(domain?, service?)`
Gets all calls, optionally filtered by domain and/or service.

#### `reset()`
Clears all recorded calls.

#### `expectServiceCalled(domain, service, data?)`
Asserts that a service was called with optional data matching.

#### `getCallCount(domain?, service?)`
Returns the number of times a service was called.

**Example:**
```typescript
import { createMockHass, MockServiceCallRecorder } from './mocks/hass-mock';

const recorder = new MockServiceCallRecorder();
const hass = createMockHass({ recorder });

// Make some service calls
await hass.callService('mqtt', 'publish', {
  topic: 'zigbee2mqtt/device/set',
  payload: '{"schedule":"data"}'
});

// Assert the call was made
expect(recorder.expectServiceCalled('mqtt', 'publish')).toBe(true);
expect(recorder.getCallCount('mqtt')).toBe(1);

// Get the call details
const lastCall = recorder.getLastCall();
expect(lastCall.domain).toBe('mqtt');
expect(lastCall.data.topic).toBe('zigbee2mqtt/device/set');
```

### Test Scenario Helpers

#### `createTestScenario(entityName?, schedule?)`

Creates a complete test environment with hass, recorder, and entity.

**Returns:**
```typescript
{
  hass: HomeAssistant,
  recorder: MockServiceCallRecorder,
  entity: HassEntity,
  entityId: string
}
```

**Example:**
```typescript
import { createTestScenario } from './mocks/hass-mock';

const scenario = createTestScenario('living_room_trvzb');

// Use in tests
expect(scenario.hass.states[scenario.entityId]).toBeDefined();
await scenario.hass.callService('climate', 'set_temperature', {
  entity_id: scenario.entityId,
  temperature: 22
});
expect(scenario.recorder.getCallCount()).toBe(1);
```

#### `updateMockHassState(hass, entityId, updates)`

Updates a mock entity's state and attributes.

**Example:**
```typescript
import { createTestScenario, updateMockHassState } from './mocks/hass-mock';

const scenario = createTestScenario();

// Update temperature
updateMockHassState(scenario.hass, scenario.entityId, {
  attributes: { temperature: 22 }
});

// Change state
updateMockHassState(scenario.hass, scenario.entityId, {
  state: 'off'
});
```

### Edge Case Helpers

#### `createMockClimateEntityWithoutSchedule(friendlyName?)`

Creates a climate entity without schedule attributes - useful for testing error handling.

#### `createMockEntityWithInvalidSchedule(friendlyName?)`

Creates an entity with intentionally invalid schedule data for testing validation.

**Example:**
```typescript
import {
  createMockClimateEntityWithoutSchedule,
  createMockEntityWithInvalidSchedule
} from './mocks/hass-mock';

// Test handling of entities without schedules
const basicEntity = createMockClimateEntityWithoutSchedule();
expect(basicEntity.attributes.schedule).toBeUndefined();

// Test validation and error handling
const invalidEntity = createMockEntityWithInvalidSchedule();
// This entity has malformed schedule data
```

### Sample Data Constants

Pre-defined test data for common scenarios:

#### `SAMPLE_ENTITY_ID`
```typescript
"climate.living_room_trvzb"
```

#### `SAMPLE_DAY_SCHEDULE_STRING`
```typescript
"00:00/18 06:00/21 08:00/19 17:00/22 22:00/18"
```

#### `SAMPLE_WEEKLY_SCHEDULE`
A complete weekly schedule in MQTT format (string-based).

#### `SAMPLE_PARSED_WEEKLY_SCHEDULE`
The same schedule but parsed into the internal format with transitions.

### Complete Usage Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestScenario,
  updateMockHassState,
  SAMPLE_WEEKLY_SCHEDULE
} from './mocks/hass-mock';

describe('Schedule Editor', () => {
  let scenario: ReturnType<typeof createTestScenario>;

  beforeEach(() => {
    scenario = createTestScenario('living_room_trvzb');
  });

  it('should save schedule to Home Assistant', async () => {
    const newSchedule = { ...SAMPLE_WEEKLY_SCHEDULE };

    // Simulate saving schedule
    await scenario.hass.callService('mqtt', 'publish', {
      topic: 'zigbee2mqtt/living_room_trvzb/set',
      payload: JSON.stringify({ weekly_schedule: newSchedule })
    });

    // Verify the service was called correctly
    expect(scenario.recorder.expectServiceCalled('mqtt', 'publish', {
      topic: 'zigbee2mqtt/living_room_trvzb/set'
    })).toBe(true);

    const lastCall = scenario.recorder.getLastCall();
    expect(lastCall).toBeDefined();

    const payload = JSON.parse(lastCall!.data.payload as string);
    expect(payload.weekly_schedule).toEqual(newSchedule);
  });

  it('should handle entity state changes', () => {
    // Initial state
    expect(scenario.hass.states[scenario.entityId].state).toBe('heat');

    // Update state
    updateMockHassState(scenario.hass, scenario.entityId, {
      state: 'off',
      attributes: { temperature: 15 }
    });

    // Verify changes
    expect(scenario.hass.states[scenario.entityId].state).toBe('off');
    expect(scenario.hass.states[scenario.entityId].attributes.temperature).toBe(15);
  });
});
```

## Best Practices

1. **Use `createTestScenario()`** for most tests - it provides everything you need
2. **Reset recorder** between tests if using a shared instance
3. **Use variants** when testing edge cases (minimal, maximal schedules)
4. **Mock invalid data** explicitly when testing error handling
5. **Check service calls** using the recorder for integration tests

## Type Safety

All mocks are fully typed with TypeScript. Import types from the main types file:

```typescript
import type {
  HomeAssistant,
  HassEntity,
  WeeklySchedule,
  MQTTWeeklySchedule
} from '../../src/models/types';
```
