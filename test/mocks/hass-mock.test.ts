import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockHass,
  createMockTRVZBEntity,
  createMockSchedule,
  createTestScenario,
  MockServiceCallRecorder,
  SAMPLE_ENTITY_ID,
  SAMPLE_DAY_SCHEDULE_STRING,
  SAMPLE_WEEKLY_SCHEDULE,
  updateMockHassState,
  createMockClimateEntityWithoutSchedule,
  createMockEntityWithInvalidSchedule,
} from './hass-mock';

describe('hass-mock', () => {
  describe('createMockHass', () => {
    it('should create a mock HomeAssistant object with empty states', () => {
      const hass = createMockHass();

      expect(hass.states).toBeDefined();
      expect(hass.callService).toBeDefined();
      expect(typeof hass.callService).toBe('function');
    });

    it('should create a mock with provided states', () => {
      const entity = createMockTRVZBEntity();
      const hass = createMockHass({
        states: { [entity.entity_id]: entity },
      });

      expect(hass.states[entity.entity_id]).toEqual(entity);
    });

    it('should record service calls', async () => {
      const recorder = new MockServiceCallRecorder();
      const hass = createMockHass({ recorder });

      await hass.callService('mqtt', 'publish', {
        topic: 'test/topic',
        payload: 'test',
      });

      expect(recorder.calls).toHaveLength(1);
      expect(recorder.calls[0]).toEqual({
        domain: 'mqtt',
        service: 'publish',
        data: { topic: 'test/topic', payload: 'test' },
      });
    });
  });

  describe('createMockTRVZBEntity', () => {
    it('should create a TRVZB entity with default values', () => {
      const entity = createMockTRVZBEntity();

      expect(entity.entity_id).toBe('climate.living_room_trvzb');
      expect(entity.state).toBe('heat');
      expect(entity.attributes.min_temp).toBe(4);
      expect(entity.attributes.max_temp).toBe(35);
      expect(entity.attributes.target_temp_step).toBe(0.5);
      expect(entity.attributes.weekly_schedule).toBeDefined();
    });

    it('should create entity with custom friendly name', () => {
      const entity = createMockTRVZBEntity('bedroom_radiator');

      expect(entity.entity_id).toBe('climate.bedroom_radiator');
      expect(entity.attributes.friendly_name).toBe('Bedroom Radiator');
    });

    it('should include provided schedule', () => {
      const customSchedule = createMockSchedule('minimal');
      const entity = createMockTRVZBEntity('test', customSchedule);

      expect(entity.attributes.weekly_schedule).toEqual(customSchedule);
    });
  });

  describe('MockServiceCallRecorder', () => {
    let recorder: MockServiceCallRecorder;

    beforeEach(() => {
      recorder = new MockServiceCallRecorder();
    });

    it('should record service calls', () => {
      recorder.record('mqtt', 'publish', { topic: 'test' });

      expect(recorder.calls).toHaveLength(1);
    });

    it('should get last call', () => {
      recorder.record('mqtt', 'publish', { topic: 'test1' });
      recorder.record('climate', 'set_temperature', { temperature: 20 });

      const lastCall = recorder.getLastCall();
      expect(lastCall).toEqual({
        domain: 'climate',
        service: 'set_temperature',
        data: { temperature: 20 },
      });
    });

    it('should filter calls by domain', () => {
      recorder.record('mqtt', 'publish', { topic: 'test1' });
      recorder.record('climate', 'set_temperature', { temperature: 20 });
      recorder.record('mqtt', 'publish', { topic: 'test2' });

      const mqttCalls = recorder.getCalls('mqtt');
      expect(mqttCalls).toHaveLength(2);
      expect(mqttCalls.every(call => call.domain === 'mqtt')).toBe(true);
    });

    it('should filter calls by domain and service', () => {
      recorder.record('mqtt', 'publish', { topic: 'test1' });
      recorder.record('mqtt', 'subscribe', { topic: 'test2' });
      recorder.record('mqtt', 'publish', { topic: 'test3' });

      const publishCalls = recorder.getCalls('mqtt', 'publish');
      expect(publishCalls).toHaveLength(2);
    });

    it('should reset calls', () => {
      recorder.record('mqtt', 'publish', { topic: 'test' });
      expect(recorder.calls).toHaveLength(1);

      recorder.reset();
      expect(recorder.calls).toHaveLength(0);
    });

    it('should assert service was called', () => {
      recorder.record('mqtt', 'publish', {
        topic: 'zigbee2mqtt/test/set',
        payload: '{"schedule":"test"}',
      });

      expect(recorder.expectServiceCalled('mqtt', 'publish')).toBe(true);
      expect(recorder.expectServiceCalled('climate', 'set_temperature')).toBe(false);
    });

    it('should assert service was called with specific data', () => {
      recorder.record('mqtt', 'publish', {
        topic: 'zigbee2mqtt/test/set',
        payload: '{"schedule":"test"}',
      });

      expect(
        recorder.expectServiceCalled('mqtt', 'publish', {
          topic: 'zigbee2mqtt/test/set',
        })
      ).toBe(true);

      expect(
        recorder.expectServiceCalled('mqtt', 'publish', {
          topic: 'wrong/topic',
        })
      ).toBe(false);
    });

    it('should count calls', () => {
      recorder.record('mqtt', 'publish', { topic: 'test1' });
      recorder.record('mqtt', 'publish', { topic: 'test2' });
      recorder.record('climate', 'set_temperature', { temperature: 20 });

      expect(recorder.getCallCount()).toBe(3);
      expect(recorder.getCallCount('mqtt')).toBe(2);
      expect(recorder.getCallCount('mqtt', 'publish')).toBe(2);
      expect(recorder.getCallCount('climate')).toBe(1);
    });
  });

  describe('createMockSchedule', () => {
    it('should create default schedule', () => {
      const schedule = createMockSchedule();
      expect(schedule).toEqual(SAMPLE_WEEKLY_SCHEDULE);
    });

    it('should create weekday schedule variant', () => {
      const schedule = createMockSchedule('weekday');
      expect(schedule.monday).toContain('06:00/21');
      expect(schedule.monday).toContain('17:00/22');
    });

    it('should create minimal schedule variant', () => {
      const schedule = createMockSchedule('minimal');
      expect(schedule.monday).toBe('00:00/20');
      expect(schedule.tuesday).toBe('00:00/20');
    });

    it('should create maximal schedule variant (6 transitions)', () => {
      const schedule = createMockSchedule('maximal');
      const transitions = schedule.monday.split(' ');
      expect(transitions).toHaveLength(6);
    });
  });

  describe('createTestScenario', () => {
    it('should create complete test scenario', () => {
      const scenario = createTestScenario();

      expect(scenario.hass).toBeDefined();
      expect(scenario.recorder).toBeDefined();
      expect(scenario.entity).toBeDefined();
      expect(scenario.entityId).toBe('climate.living_room_trvzb');
      expect(scenario.hass.states[scenario.entityId]).toEqual(scenario.entity);
    });

    it('should create scenario with custom entity', () => {
      const scenario = createTestScenario('bedroom_trvzb');

      expect(scenario.entityId).toBe('climate.bedroom_trvzb');
      expect(scenario.hass.states[scenario.entityId]).toBeDefined();
    });

    it('should create scenario with custom schedule', () => {
      const customSchedule = createMockSchedule('minimal');
      const scenario = createTestScenario('test', customSchedule);

      expect(scenario.entity.attributes.weekly_schedule).toEqual(customSchedule);
    });
  });

  describe('updateMockHassState', () => {
    it('should update entity state', () => {
      const scenario = createTestScenario();

      updateMockHassState(scenario.hass, scenario.entityId, {
        state: 'off',
      });

      expect(scenario.hass.states[scenario.entityId].state).toBe('off');
    });

    it('should update entity attributes', () => {
      const scenario = createTestScenario();

      updateMockHassState(scenario.hass, scenario.entityId, {
        attributes: { temperature: 22 },
      });

      expect(scenario.hass.states[scenario.entityId].attributes.temperature).toBe(22);
    });

    it('should merge attributes without losing existing ones', () => {
      const scenario = createTestScenario();
      const originalMinTemp = scenario.entity.attributes.min_temp;

      updateMockHassState(scenario.hass, scenario.entityId, {
        attributes: { temperature: 22 },
      });

      expect(scenario.hass.states[scenario.entityId].attributes.min_temp).toBe(originalMinTemp);
      expect(scenario.hass.states[scenario.entityId].attributes.temperature).toBe(22);
    });
  });

  describe('edge cases', () => {
    it('should create entity without schedule', () => {
      const entity = createMockClimateEntityWithoutSchedule();

      expect(entity.entity_id).toBe('climate.basic_thermostat');
      expect(entity.attributes.weekly_schedule).toBeUndefined();
      expect(entity.attributes.schedule).toBeUndefined();
    });

    it('should create entity with invalid schedule', () => {
      const entity = createMockEntityWithInvalidSchedule();

      expect(entity.attributes.weekly_schedule).toBeDefined();
      expect(entity.attributes.weekly_schedule.sunday).toBe('invalid/format/here');
    });
  });

  describe('sample data constants', () => {
    it('should export SAMPLE_ENTITY_ID', () => {
      expect(SAMPLE_ENTITY_ID).toBe('climate.living_room_trvzb');
    });

    it('should export SAMPLE_DAY_SCHEDULE_STRING', () => {
      expect(SAMPLE_DAY_SCHEDULE_STRING).toContain('00:00/18');
      expect(SAMPLE_DAY_SCHEDULE_STRING).toContain('22:00/18');
    });

    it('should export SAMPLE_WEEKLY_SCHEDULE', () => {
      expect(SAMPLE_WEEKLY_SCHEDULE.monday).toBeDefined();
      expect(SAMPLE_WEEKLY_SCHEDULE.sunday).toBeDefined();
    });
  });
});
