/**
 * Main TRVZB Scheduler Card Component
 * A Home Assistant custom card for managing Sonoff TRVZB thermostat schedules
 */

import { LitElement, html, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, TRVZBSchedulerCardConfig, WeeklySchedule, DayOfWeek, MQTTWeeklySchedule, DAYS_OF_WEEK } from './models/types';
import { getScheduleFromSensor, deriveDaySensorEntityId, saveSchedule, getEntityInfo, entityExists, isInvalidSensorState } from './services/ha-service';
import { createEmptyWeeklySchedule, serializeWeeklySchedule } from './models/schedule';
import { cardStyles } from './styles/card-styles';

// Import child components (they will be registered separately)
import './components/schedule-week-view';
import './components/schedule-graph-view';
import './components/day-schedule-editor';
import './components/copy-schedule-dialog';

@customElement('trvzb-scheduler-card')
export class TRVZBSchedulerCard extends LitElement {
  // Static styles
  static styles = cardStyles;

  // Static methods for Home Assistant integration
  public static getConfigElement() {
    return document.createElement('trvzb-scheduler-card-editor');
  }

  public static getStubConfig() {
    return { entity: '' };
  }

  // Public properties (set by Home Assistant)
  @property({ attribute: false }) public hass!: HomeAssistant;

  // Card configuration
  @state() private config!: TRVZBSchedulerCardConfig;

  // Internal state
  @state() private _schedule: WeeklySchedule | null = null;
  @state() private _originalSchedule: WeeklySchedule | null = null;
  @state() private _viewMode: 'week' | 'graph' = 'week';
  @state() private _editingDay: DayOfWeek | null = null;
  @state() private _showCopyDialog: boolean = false;
  @state() private _copySourceDay: DayOfWeek | null = null;
  @state() private _saving: boolean = false;
  @state() private _error: string | null = null;
  @state() private _hasUnsavedChanges: boolean = false;

  // Track previous entity ID for change detection
  private _previousEntityId: string | null = null;

  // Track the schedule we saved (in MQTT format) to ignore updates until sensors match
  private _pendingSaveSchedule: MQTTWeeklySchedule | null = null;

  // Timeout ID for clearing stale pending save (prevents indefinite blocking if sensors never update)
  private _pendingSaveTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Unique ID for current pending save operation (prevents race conditions on rapid saves)
  private _pendingSaveId: number = 0;

  // Timeout duration for pending save expiry (30 seconds)
  private static readonly PENDING_SAVE_TIMEOUT_MS = 30000;

  // Cached hash of sensor states for efficient change detection
  private _lastSensorStateHash: string | null = null;

  /**
   * Compute a simple hash of all day sensor states for efficient change detection
   * Returns a JSON string array to prevent collision issues with special characters
   */
  private _computeSensorStateHash(hass: HomeAssistant, entityId: string): string | null {
    const states: string[] = [];
    for (const day of DAYS_OF_WEEK) {
      const daySensorId = deriveDaySensorEntityId(entityId, day);
      const sensor = hass.states[daySensorId];
      // Include 'undefined' marker for missing sensors to detect appearance/disappearance
      states.push(sensor ? sensor.state : '\0');
    }
    return JSON.stringify(states);
  }

  /**
   * Clear pending save state and associated timeout
   * Call this when sensors have caught up or on error
   */
  private _clearPendingSave(): void {
    this._pendingSaveSchedule = null;
    this._pendingSaveId = 0;
    if (this._pendingSaveTimeoutId !== null) {
      clearTimeout(this._pendingSaveTimeoutId);
      this._pendingSaveTimeoutId = null;
    }
  }

  /**
   * Check if all day sensors match the pending save schedule
   * Returns true if sensors have caught up to what we saved
   */
  private _allDaySensorsMatch(entityId: string, pendingSchedule: MQTTWeeklySchedule): boolean {
    for (const day of DAYS_OF_WEEK) {
      const daySensorId = deriveDaySensorEntityId(entityId, day);
      const sensor = this.hass.states[daySensorId];
      const expectedState = pendingSchedule[day];

      if (!sensor || expectedState === undefined || sensor.state !== expectedState) {
        return false;
      }
    }
    return true;
  }

  /**
   * Detect if any day sensor has changed between old and new hass state
   * Uses hash-based comparison for efficiency (avoids looping on every update)
   * Also detects sensor appearance (was missing, now exists) or disappearance
   */
  private _hasDaySensorChanges(entityId: string, oldHass: HomeAssistant): boolean {
    if (!this.hass) return false;

    // Compute hashes for old and new states
    const oldHash = this._computeSensorStateHash(oldHass, entityId);
    const newHash = this._computeSensorStateHash(this.hass, entityId);

    // Quick comparison - if hashes match, nothing changed
    if (oldHash === newHash) {
      return false;
    }

    // Hashes differ - update cache and check if new state has valid data
    this._lastSensorStateHash = newHash;

    // Check if any sensor appeared with valid data (not just state changes)
    for (const day of DAYS_OF_WEEK) {
      const daySensorId = deriveDaySensorEntityId(entityId, day);
      const oldSensor = oldHass.states[daySensorId];
      const newSensor = this.hass.states[daySensorId];

      // Only trigger reload if sensor appeared with valid data
      if (!oldSensor && newSensor && !isInvalidSensorState(newSensor.state)) {
        return true;
      }

      // Trigger on disappearance or valid state change
      if (oldSensor && !newSensor) {
        return true;
      }

      if (oldSensor && newSensor && oldSensor.state !== newSensor.state) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get list of missing day sensors for error reporting
   */
  private _getMissingSensors(entityId: string): string[] {
    const missing: string[] = [];
    for (const day of DAYS_OF_WEEK) {
      const daySensorId = deriveDaySensorEntityId(entityId, day);
      if (!entityExists(this.hass, daySensorId)) {
        missing.push(daySensorId);
      }
    }
    return missing;
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
   * Set card configuration
   * Called by Home Assistant when the card is configured
   */
  public setConfig(config: TRVZBSchedulerCardConfig): void {
    if (!config.entity) {
      throw new Error('You must specify an entity');
    }

    this.config = {
      ...config,
      view_mode: config.view_mode || 'week'
    };

    // Set initial view mode from config
    this._viewMode = this.config.view_mode || 'week';
  }

  /**
   * Get card size for Home Assistant layout
   */
  public getCardSize(): number {
    return 4;
  }

  /**
   * Lifecycle: component disconnected from DOM
   * Clean up pending timeouts to prevent memory leaks
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._clearPendingSave();
  }

  /**
   * Lifecycle: component updated
   * Load schedule when hass or entity changes
   */
  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);

    if (changedProps.has('hass') && this.hass && this.config) {
      const currentEntityId = this.config.entity;

      // Check if entity changed or if this is the first load
      if (currentEntityId !== this._previousEntityId) {
        this._previousEntityId = currentEntityId;
        this._loadSchedule();
        return;
      }

      // Skip change detection if we're currently saving
      if (this._saving) {
        return;
      }

      // If we have a pending save, check if all sensors now match what we saved
      if (this._pendingSaveSchedule) {
        if (this._allDaySensorsMatch(currentEntityId, this._pendingSaveSchedule)) {
          // All sensors caught up - clear pending and resume normal operation
          this._clearPendingSave();
        }
        // Don't reload while we have a pending save
        return;
      }

      // Normal external change detection - check if any day sensor changed
      // Also detects sensor appearance (e.g., after Zigbee2MQTT restart)
      if (changedProps.has('hass')) {
        const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
        if (oldHass && this._hasDaySensorChanges(currentEntityId, oldHass)) {
          this._loadSchedule();
        }
      }
    }
  }

  /**
   * Load schedule from 7 day sensor entities
   */
  private _loadSchedule(): void {
    if (!this.hass || !this.config?.entity) {
      return;
    }

    // Clear error
    this._error = null;

    // Check if climate entity exists (still needed for saving and entity info)
    if (!entityExists(this.hass, this.config.entity)) {
      this._error = `Climate entity not found: ${this.config.entity}`;
      this._schedule = null;
      return;
    }

    // Check if all day sensors exist
    const missingSensors = this._getMissingSensors(this.config.entity);

    if (missingSensors.length > 0) {
      this._error = `Schedule sensors not found: ${missingSensors.join(', ')}`;
      this._schedule = null;
      return;
    }

    // Get schedule from all day sensors
    const schedule = getScheduleFromSensor(this.hass, this.config.entity);

    if (schedule) {
      this._schedule = schedule;
      // Store immutable copy as reference point for change detection
      this._originalSchedule = this._deepCopySchedule(schedule);
      this._hasUnsavedChanges = false;
    } else {
      // Sensors exist but have no valid schedule - use default
      this._schedule = createEmptyWeeklySchedule();
      this._originalSchedule = this._deepCopySchedule(this._schedule);
      this._hasUnsavedChanges = true;
      this._error = 'No valid schedule found on sensors. Using default schedule.';
    }
  }

  /**
   * Handle day selected from week/list view
   */
  private _handleDaySelected(e: CustomEvent<{ day: DayOfWeek }>): void {
    this._editingDay = e.detail.day;
  }

  /**
   * Handle schedule changed in day editor
   */
  private _handleScheduleChanged(e: CustomEvent<{ day: DayOfWeek; schedule: any }>): void {
    if (!this._schedule) {
      return;
    }

    // Update the schedule for the specific day
    this._schedule = {
      ...this._schedule,
      [e.detail.day]: e.detail.schedule
    };

    // Mark as having unsaved changes
    this._hasUnsavedChanges = true;
  }

  /**
   * Handle copy requested from day editor
   */
  private _handleCopyRequested(e: CustomEvent<{ day: DayOfWeek }>): void {
    this._copySourceDay = e.detail.day;
    this._showCopyDialog = true;
  }

  /**
   * Handle copy confirmed from copy dialog
   */
  private _handleCopyConfirmed(e: CustomEvent<{ targetDays: DayOfWeek[] }>): void {
    if (!this._schedule || !this._copySourceDay) {
      return;
    }

    // Get source day schedule
    const sourceSchedule = this._schedule[this._copySourceDay];

    // Copy to target days
    const updatedSchedule = { ...this._schedule };
    for (const day of e.detail.targetDays) {
      updatedSchedule[day] = {
        transitions: sourceSchedule.transitions.map(t => ({
          time: t.time,
          temperature: t.temperature
        }))
      };
    }

    this._schedule = updatedSchedule;
    this._hasUnsavedChanges = true;

    // Close dialog
    this._handleDialogClosed();
  }

  /**
   * Handle day editor closed
   */
  private _handleEditorClosed(): void {
    this._editingDay = null;
  }

  /**
   * Handle copy dialog closed
   */
  private _handleDialogClosed(): void {
    this._showCopyDialog = false;
    this._copySourceDay = null;
  }

  /**
   * Save schedule to device - updated to use bulk update
   */
  private async _saveSchedule(): Promise<void> {
    if (!this.hass || !this.config?.entity || !this._schedule || this._saving) {
      return;
    }

    // Explicit validation: originalSchedule must exist
    if (!this._originalSchedule) {
      this._error = 'Cannot save: no original schedule loaded. Please reload the card.';
      console.error('Save attempted with null _originalSchedule');
      return;
    }

    this._saving = true;
    this._error = null;

    // ATOMIC OPERATION: Generate new saveId and clear old timeout together
    // This ensures no stale callback can match the new saveId
    const saveId = Date.now();

    // Clear previous timeout FIRST (but don't reset saveId yet)
    if (this._pendingSaveTimeoutId !== null) {
      clearTimeout(this._pendingSaveTimeoutId);
      this._pendingSaveTimeoutId = null;
    }

    // NOW update the saveId - any old timeout callback checking the old saveId will fail
    this._pendingSaveId = saveId;

    // Store the schedule in MQTT format to compare with sensor updates
    this._pendingSaveSchedule = serializeWeeklySchedule(this._schedule);

    // Create timeout with closure over saveId
    // Only check saveId - it's the unique identifier for this save operation
    this._pendingSaveTimeoutId = setTimeout(() => {
      // Check if this is still the current pending save
      // If a new save started, _pendingSaveId will be different
      if (this._pendingSaveId === saveId) {
        console.warn(`Pending save timeout expired for saveId: ${saveId}`);
        this._clearPendingSave();
      }
    }, TRVZBSchedulerCard.PENDING_SAVE_TIMEOUT_MS);

    try {
      // Call updated saveSchedule with original reference
      const result = await saveSchedule(
        this.hass,
        this.config.entity,
        this._originalSchedule,
        this._schedule
      );

      // Handle discriminated union result
      if (result.status === 'success') {
        console.log(`Updated ${result.daysUpdated.length} day(s):`, result.daysUpdated);

        // Update original to match current (reset diff baseline)
        this._originalSchedule = this._deepCopySchedule(this._schedule);
        this._hasUnsavedChanges = false;
        this._error = null;
      } else if (result.status === 'skipped') {
        // No changes detected - provide user feedback
        console.log('No schedule changes detected, skipping save');
        this._hasUnsavedChanges = false;
        // Clear pending save since we didn't actually publish anything
        this._clearPendingSave();
      } else {
        // result.status === 'error'
        throw new Error(result.error);
      }
    } catch (error) {
      this._error = error instanceof Error ? error.message : 'Failed to save schedule';
      console.error('Save schedule error:', error);
      // Clear pending on error so we can detect external changes again
      // Must clear BEFORE updating _saving to false to prevent race condition
      this._clearPendingSave();
    } finally {
      this._saving = false;
    }
  }

  /**
   * Toggle view mode between week and graph
   */
  private _toggleViewMode(): void {
    this._viewMode = this._viewMode === 'week' ? 'graph' : 'week';
  }

  /**
   * Render the card
   */
  protected render() {
    if (!this.config) {
      return html`<ha-card>
        <div class="message message-error">
          Configuration required
        </div>
      </ha-card>`;
    }

    // Get entity info for display
    const entityInfo = this.hass ? getEntityInfo(this.hass, this.config.entity) : null;
    const cardTitle = this.config.name || entityInfo?.name || this.config.entity;

    return html`
      <ha-card>
        <div class="card-header">
          <span class="card-title">${cardTitle}</span>
          <div class="card-actions">
            <button
              class="button button-icon"
              @click=${this._toggleViewMode}
              title="Toggle view mode"
            >
              ${this._viewMode === 'week' ? '📅' : '📊'}
            </button>
            <button
              class="button button-primary save-button ${this._saving ? 'loading' : ''}"
              @click=${this._saveSchedule}
              ?disabled=${!this._hasUnsavedChanges || this._saving || !this._originalSchedule}
            >
              ${this._saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div class="card-content">
          ${this._error
            ? html`<div class="message message-error">${this._error}</div>`
            : ''}

          ${!this._schedule
            ? html`<div class="loading-spinner"><div class="spinner"></div></div>`
            : this._viewMode === 'week'
            ? html`
                <schedule-week-view
                  .schedule=${this._schedule}
                  @day-selected=${this._handleDaySelected}
                ></schedule-week-view>
              `
            : html`
                <schedule-graph-view
                  .schedule=${this._schedule}
                  @schedule-changed=${this._handleScheduleChanged}
                  @copy-requested=${this._handleCopyRequested}
                ></schedule-graph-view>
              `}
        </div>
      </ha-card>

      ${this._schedule && this._editingDay
        ? html`
            <day-schedule-editor
              .day=${this._editingDay}
              .schedule=${this._schedule[this._editingDay]}
              .open=${true}
              @schedule-changed=${this._handleScheduleChanged}
              @copy-requested=${this._handleCopyRequested}
              @editor-closed=${this._handleEditorClosed}
            ></day-schedule-editor>
          `
        : ''}

      ${this._showCopyDialog && this._copySourceDay
        ? html`
            <copy-schedule-dialog
              .sourceDay=${this._copySourceDay}
              .open=${true}
              @copy-confirmed=${this._handleCopyConfirmed}
              @dialog-closed=${this._handleDialogClosed}
            ></copy-schedule-dialog>
          `
        : ''}
    `;
  }
}

// Declare custom element for TypeScript
declare global {
  interface HTMLElementTagNameMap {
    'trvzb-scheduler-card': TRVZBSchedulerCard;
  }
}
