/**
 * Usage Examples for hass-mock.ts
 *
 * This file demonstrates common patterns for using the Home Assistant mocks
 * in your tests. These examples are not actual tests but serve as documentation.
 */

import type { HomeAssistant } from '../../src/models/types';
import {
  createMockHass,
  createMockTRVZBEntity,
  createMockSchedule,
  createTestScenario,
  MockServiceCallRecorder,
  updateMockHassState,
  SAMPLE_ENTITY_ID,
  SAMPLE_WEEKLY_SCHEDULE,
} from './hass-mock';

// ============================================================================
// Example 1: Basic Setup - Simple test with a mock entity
// ============================================================================

export function example1_basicSetup() {
  // Create a mock TRVZB entity
  const entity = createMockTRVZBEntity('living_room');

  // Create mock Home Assistant with the entity
  const hass = createMockHass({
    states: {
      [entity.entity_id]: entity,
    },
  });

  // Access the entity
  console.log(hass.states[entity.entity_id].attributes.friendly_name);
  // Output: "Living Room"
}

// ============================================================================
// Example 2: Service Call Recording - Track MQTT publishes
// ============================================================================

export async function example2_serviceCallRecording() {
  // Create recorder and hass with it
  const recorder = new MockServiceCallRecorder();
  const hass = createMockHass({ recorder });

  // Simulate saving a schedule via MQTT
  await hass.callService('mqtt', 'publish', {
    topic: 'zigbee2mqtt/living_room_trvzb/set',
    payload: JSON.stringify({ weekly_schedule: SAMPLE_WEEKLY_SCHEDULE }),
  });

  // Verify the call was made
  console.log('Service called:', recorder.expectServiceCalled('mqtt', 'publish'));
  console.log('Call count:', recorder.getCallCount('mqtt'));
  console.log('Last call:', recorder.getLastCall());
}

// ============================================================================
// Example 3: Using Test Scenarios - All-in-one setup
// ============================================================================

export function example3_testScenario() {
  // Create complete test scenario (includes hass, recorder, entity)
  const scenario = createTestScenario('bedroom_trvzb');

  // Everything is connected and ready to use
  console.log('Entity ID:', scenario.entityId);
  console.log('Entity exists in hass:', scenario.entityId in scenario.hass.states);
  console.log('Schedule:', scenario.entity.attributes.weekly_schedule);
}

// ============================================================================
// Example 4: Custom Schedules - Testing different schedule variants
// ============================================================================

export function example4_customSchedules() {
  // Test with minimal schedule (edge case)
  const minimalSchedule = createMockSchedule('minimal');
  const entity1 = createMockTRVZBEntity('minimal_test', minimalSchedule);
  console.log('Minimal Monday:', minimalSchedule.monday); // "00:00/20"

  // Test with maximum transitions (6 per day)
  const maximalSchedule = createMockSchedule('maximal');
  const entity2 = createMockTRVZBEntity('maximal_test', maximalSchedule);
  console.log('Maximal transitions:', maximalSchedule.monday.split(' ').length); // 6

  // Test with weekday-optimized schedule
  const weekdaySchedule = createMockSchedule('weekday');
  const entity3 = createMockTRVZBEntity('weekday_test', weekdaySchedule);
  console.log('Weekday Monday:', weekdaySchedule.monday);
}

// ============================================================================
// Example 5: State Updates - Simulating state changes
// ============================================================================

export function example5_stateUpdates() {
  const scenario = createTestScenario();

  // Initial state
  console.log('Initial temp:', scenario.entity.attributes.temperature); // 21

  // Update temperature
  updateMockHassState(scenario.hass, scenario.entityId, {
    attributes: { temperature: 22, current_temperature: 21.5 },
  });

  // Verify update
  console.log('Updated temp:', scenario.hass.states[scenario.entityId].attributes.temperature); // 22

  // Change HVAC state
  updateMockHassState(scenario.hass, scenario.entityId, {
    state: 'off',
  });

  console.log('New state:', scenario.hass.states[scenario.entityId].state); // 'off'
}

// ============================================================================
// Example 6: Testing Component Integration
// ============================================================================

export async function example6_componentIntegration() {
  const scenario = createTestScenario('test_radiator');

  // Simulate a component loading the schedule
  const entity = scenario.hass.states[scenario.entityId];
  const schedule = entity.attributes.weekly_schedule;

  console.log('Loaded schedule for Monday:', schedule.monday);

  // Simulate a component modifying the schedule
  const modifiedSchedule = { ...schedule };
  modifiedSchedule.monday = "00:00/18 07:00/22 23:00/18";

  // Simulate saving the modified schedule
  await scenario.hass.callService('mqtt', 'publish', {
    topic: `zigbee2mqtt/test_radiator/set`,
    payload: JSON.stringify({ weekly_schedule: modifiedSchedule }),
  });

  // Verify the save operation
  const savedPayload = JSON.parse(
    scenario.recorder.getLastCall()!.data.payload as string
  );
  console.log('Saved Monday schedule:', savedPayload.weekly_schedule.monday);
}

// ============================================================================
// Example 7: Multiple Entities - Testing with several devices
// ============================================================================

export function example7_multipleEntities() {
  // Create multiple entities
  const livingRoom = createMockTRVZBEntity('living_room');
  const bedroom = createMockTRVZBEntity('bedroom');
  const kitchen = createMockTRVZBEntity('kitchen');

  // Create hass with all entities
  const hass = createMockHass({
    states: {
      [livingRoom.entity_id]: livingRoom,
      [bedroom.entity_id]: bedroom,
      [kitchen.entity_id]: kitchen,
    },
  });

  // Access different entities
  console.log('Entities:', Object.keys(hass.states));
  // Output: ['climate.living_room', 'climate.bedroom', 'climate.kitchen']
}

// ============================================================================
// Example 8: Assertion Patterns - Common test assertions
// ============================================================================

export async function example8_assertionPatterns() {
  const recorder = new MockServiceCallRecorder();
  const hass = createMockHass({ recorder });

  // Make multiple service calls
  await hass.callService('mqtt', 'publish', {
    topic: 'zigbee2mqtt/device1/set',
    payload: '{"schedule":"data1"}',
  });

  await hass.callService('climate', 'set_temperature', {
    entity_id: SAMPLE_ENTITY_ID,
    temperature: 22,
  });

  await hass.callService('mqtt', 'publish', {
    topic: 'zigbee2mqtt/device2/set',
    payload: '{"schedule":"data2"}',
  });

  // Various assertion patterns:

  // 1. Check if any call to a service was made
  console.log('MQTT called:', recorder.expectServiceCalled('mqtt', 'publish'));

  // 2. Check with specific data
  console.log('Device1 published:', recorder.expectServiceCalled('mqtt', 'publish', {
    topic: 'zigbee2mqtt/device1/set',
  }));

  // 3. Count calls
  console.log('Total MQTT publishes:', recorder.getCallCount('mqtt', 'publish')); // 2
  console.log('Total climate calls:', recorder.getCallCount('climate')); // 1

  // 4. Get filtered calls
  const mqttCalls = recorder.getCalls('mqtt', 'publish');
  console.log('MQTT topics:', mqttCalls.map(c => c.data.topic));

  // 5. Get last call of specific type
  const lastMqtt = recorder.getCalls('mqtt', 'publish').pop();
  console.log('Last MQTT topic:', lastMqtt?.data.topic);
}

// ============================================================================
// Example 9: Error Handling - Testing with invalid data
// ============================================================================

export function example9_errorHandling() {
  // Import error case helpers
  const { createMockClimateEntityWithoutSchedule, createMockEntityWithInvalidSchedule } =
    require('./hass-mock');

  // Entity without schedule (for error handling tests)
  const basicEntity = createMockClimateEntityWithoutSchedule('basic_thermostat');
  console.log('Has schedule:', 'weekly_schedule' in basicEntity.attributes); // false

  // Entity with invalid schedule data
  const invalidEntity = createMockEntityWithInvalidSchedule('broken_device');
  console.log('Invalid Sunday:', invalidEntity.attributes.weekly_schedule.sunday);
  // Output: "invalid/format/here"
}

// ============================================================================
// Example 10: Full Test Workflow - Complete testing pattern
// ============================================================================

export async function example10_fullWorkflow() {
  // Setup
  const scenario = createTestScenario('test_device');

  // Test 1: Read initial schedule
  const initialSchedule = scenario.entity.attributes.weekly_schedule;
  console.log('Initial Monday:', initialSchedule.monday);

  // Test 2: Modify schedule
  const newSchedule = { ...initialSchedule };
  newSchedule.monday = "00:00/19 06:00/22 08:00/20 22:00/18";

  // Test 3: Save modified schedule
  await scenario.hass.callService('mqtt', 'publish', {
    topic: 'zigbee2mqtt/test_device/set',
    payload: JSON.stringify({ weekly_schedule: newSchedule }),
  });

  // Test 4: Verify save was called
  console.log('Save called:', scenario.recorder.expectServiceCalled('mqtt', 'publish'));

  // Test 5: Update mock state to reflect the change
  updateMockHassState(scenario.hass, scenario.entityId, {
    attributes: { weekly_schedule: newSchedule },
  });

  // Test 6: Verify state was updated
  const updatedSchedule = scenario.hass.states[scenario.entityId].attributes.weekly_schedule;
  console.log('Updated Monday:', updatedSchedule.monday);

  // Test 7: Verify the exact payload
  const lastCall = scenario.recorder.getLastCall();
  const payload = JSON.parse(lastCall!.data.payload as string);
  console.log('Payload matches:', payload.weekly_schedule.monday === newSchedule.monday);
}

// ============================================================================
// Export all examples for reference
// ============================================================================

export const examples = {
  basicSetup: example1_basicSetup,
  serviceCallRecording: example2_serviceCallRecording,
  testScenario: example3_testScenario,
  customSchedules: example4_customSchedules,
  stateUpdates: example5_stateUpdates,
  componentIntegration: example6_componentIntegration,
  multipleEntities: example7_multipleEntities,
  assertionPatterns: example8_assertionPatterns,
  errorHandling: example9_errorHandling,
  fullWorkflow: example10_fullWorkflow,
};
