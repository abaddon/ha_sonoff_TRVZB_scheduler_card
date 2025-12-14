import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { cardStyles, getTemperatureColor } from '../styles/card-styles.js';
import { WeeklySchedule, DayOfWeek, Transition } from '../models/types.js';

/**
 * Schedule List View Component
 * Displays the weekly schedule as an accordion list with expandable days
 */
@customElement('schedule-list-view')
export class ScheduleListView extends LitElement {
  static styles = [
    cardStyles,
    css`
      :host {
        display: block;
      }

      .list-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .day-accordion {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        overflow: hidden;
        background: var(--card-background-color);
        transition: all 0.2s ease;
      }

      .day-accordion:hover {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .day-accordion-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        cursor: pointer;
        background: var(--primary-background-color, #f5f5f5);
        transition: background 0.2s ease;
        user-select: none;
      }

      .day-accordion-header:hover {
        background: var(--secondary-background-color, #e8e8e8);
      }

      .day-accordion-header.expanded {
        background: var(--primary-color);
        color: white;
      }

      .day-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
      }

      .expand-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        transition: transform 0.3s ease;
      }

      .expand-icon.expanded {
        transform: rotate(180deg);
      }

      .day-name {
        font-weight: 600;
        font-size: 14px;
        text-transform: capitalize;
        min-width: 90px;
      }

      .day-summary {
        font-size: 12px;
        color: var(--secondary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .day-accordion-header.expanded .day-summary {
        color: rgba(255, 255, 255, 0.9);
      }

      .day-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .edit-button {
        padding: 6px 12px;
        border: 1px solid var(--divider-color);
        background: var(--card-background-color);
        color: var(--primary-text-color);
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      .edit-button:hover:not(:disabled) {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
      }

      .day-accordion-header.expanded .edit-button {
        background: white;
        color: var(--primary-color);
        border-color: white;
      }

      .day-accordion-header.expanded .edit-button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.9);
      }

      .edit-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .day-accordion-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
        background: var(--card-background-color);
      }

      .day-accordion-content.expanded {
        max-height: 1000px;
        padding: 16px;
      }

      .transitions-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .transition-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        background: var(--primary-background-color, #f5f5f5);
        border-radius: 6px;
        border-left: 4px solid transparent;
      }

      .transition-index {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--divider-color);
        color: var(--primary-text-color);
        font-size: 11px;
        font-weight: 600;
        flex-shrink: 0;
      }

      .time-badge {
        display: flex;
        align-items: center;
        padding: 4px 10px;
        background: var(--card-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        font-weight: 600;
        color: var(--primary-text-color);
        min-width: 55px;
        justify-content: center;
      }

      .transition-arrow {
        color: var(--secondary-text-color);
        font-size: 12px;
        margin: 0 4px;
      }

      .temperature-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
      }

      .temperature-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }

      .temperature-value {
        font-weight: 600;
        font-size: 14px;
        color: var(--primary-text-color);
        min-width: 45px;
      }

      .transition-until {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-left: auto;
      }

      .no-transitions {
        text-align: center;
        padding: 20px;
        color: var(--secondary-text-color);
        font-size: 14px;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .day-summary {
          display: none;
        }

        .transition-row {
          flex-wrap: wrap;
        }

        .transition-until {
          width: 100%;
          margin-left: 36px;
          margin-top: 4px;
        }
      }

      @media (max-width: 480px) {
        .day-accordion-header {
          padding: 10px 12px;
        }

        .day-name {
          min-width: auto;
          font-size: 13px;
        }

        .edit-button {
          padding: 4px 8px;
          font-size: 11px;
        }

        .day-accordion-content.expanded {
          padding: 12px;
        }

        .transition-row {
          padding: 8px 10px;
        }
      }
    `,
  ];

  @property({ type: Object })
  schedule: WeeklySchedule | null = null;

  @property({ type: Boolean })
  disabled = false;

  @state()
  private expandedDays: Set<DayOfWeek> = new Set();

  // Day order for display
  private readonly dayOrder: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  /**
   * Toggle day expansion
   */
  private toggleDay(day: DayOfWeek, event: Event): void {
    event.stopPropagation();
    const newExpanded = new Set(this.expandedDays);
    if (newExpanded.has(day)) {
      newExpanded.delete(day);
    } else {
      newExpanded.add(day);
    }
    this.expandedDays = newExpanded;
  }

  /**
   * Handle edit button click
   */
  private handleEdit(day: DayOfWeek, event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;

    this.dispatchEvent(
      new CustomEvent('day-selected', {
        detail: { day },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Get summary for a day's schedule
   */
  private getDaySummary(day: DayOfWeek): string {
    if (!this.schedule) return '';

    const daySchedule = this.schedule[day];
    const transitions = daySchedule?.transitions || [];

    if (transitions.length === 0) {
      return 'No transitions';
    }

    const transitionCount = transitions.length;
    const temperatures = transitions.map((t) => t.temperature);
    const minTemp = Math.min(...temperatures);
    const maxTemp = Math.max(...temperatures);

    if (minTemp === maxTemp) {
      return `${transitionCount} transition${transitionCount !== 1 ? 's' : ''} • ${minTemp}°C`;
    }

    return `${transitionCount} transition${transitionCount !== 1 ? 's' : ''} • ${minTemp}°C - ${maxTemp}°C`;
  }

  /**
   * Get the next transition time or "midnight" for the last one
   */
  private getUntilTime(transitions: Transition[], index: number): string {
    if (index < transitions.length - 1) {
      return transitions[index + 1].time;
    }
    return 'midnight';
  }

  /**
   * Format day name for display
   */
  private formatDayName(day: DayOfWeek): string {
    return day.charAt(0).toUpperCase() + day.slice(1);
  }

  /**
   * Render expand/collapse icon
   */
  private renderExpandIcon(isExpanded: boolean) {
    return html`
      <div class="expand-icon ${isExpanded ? 'expanded' : ''}">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 6l4 4 4-4z" />
        </svg>
      </div>
    `;
  }

  /**
   * Render a single day's accordion
   */
  private renderDay(day: DayOfWeek) {
    if (!this.schedule) return null;

    const daySchedule = this.schedule[day];
    const transitions = daySchedule?.transitions || [];
    const isExpanded = this.expandedDays.has(day);
    const summary = this.getDaySummary(day);

    return html`
      <div class="day-accordion">
        <div
          class="day-accordion-header ${isExpanded ? 'expanded' : ''}"
          @click="${(e: Event) => this.toggleDay(day, e)}"
        >
          <div class="day-info">
            ${this.renderExpandIcon(isExpanded)}
            <span class="day-name">${this.formatDayName(day)}</span>
            <span class="day-summary">${summary}</span>
          </div>
          <div class="day-actions">
            <button
              class="edit-button"
              @click="${(e: Event) => this.handleEdit(day, e)}"
              ?disabled="${this.disabled}"
            >
              Edit
            </button>
          </div>
        </div>
        <div class="day-accordion-content ${isExpanded ? 'expanded' : ''}">
          ${this.renderTransitions(transitions)}
        </div>
      </div>
    `;
  }

  /**
   * Render transitions list for a day
   */
  private renderTransitions(transitions: Transition[]) {
    if (transitions.length === 0) {
      return html`
        <div class="no-transitions">No transitions configured for this day</div>
      `;
    }

    return html`
      <div class="transitions-list">
        ${transitions.map((transition, index) => this.renderTransition(transition, index, transitions))}
      </div>
    `;
  }

  /**
   * Render a single transition row
   */
  private renderTransition(transition: Transition, index: number, allTransitions: Transition[]) {
    const color = getTemperatureColor(transition.temperature);
    const untilTime = this.getUntilTime(allTransitions, index);

    return html`
      <div class="transition-row">
        <div class="transition-index">${index + 1}</div>
        <div class="time-badge">${transition.time}</div>
        <span class="transition-arrow">→</span>
        <div class="temperature-info">
          <div class="temperature-dot" style="background-color: ${color}"></div>
          <span class="temperature-value">${transition.temperature}°C</span>
        </div>
        <span class="transition-until">until ${untilTime}</span>
      </div>
    `;
  }

  render() {
    if (!this.schedule) {
      return html`
        <div class="empty-state">
          <div class="empty-state-text">No schedule data available</div>
        </div>
      `;
    }

    return html`
      <div class="list-container">
        ${this.dayOrder.map((day) => this.renderDay(day))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'schedule-list-view': ScheduleListView;
  }
}
