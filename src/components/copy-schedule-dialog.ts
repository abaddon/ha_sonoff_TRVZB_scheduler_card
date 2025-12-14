import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DayOfWeek } from '../models/types';
import { cardStyles } from '../styles/card-styles';

/**
 * Copy Schedule Dialog Component
 *
 * A modal dialog that allows users to copy a day's schedule to other days.
 * Includes quick selection buttons for weekdays, weekend, and all days.
 */
@customElement('copy-schedule-dialog')
export class CopyScheduleDialog extends LitElement {
  @property({ type: String })
  sourceDay: DayOfWeek = 'monday';

  @property({ type: Boolean })
  open = false;

  @state()
  private selectedDays = new Set<DayOfWeek>();

  // All days in the desired display order
  private readonly ALL_DAYS: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  private readonly WEEKDAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  private readonly WEEKEND: DayOfWeek[] = ['saturday', 'sunday'];

  static styles = [
    cardStyles,
    css`
      :host {
        display: block;
      }

      .quick-select-buttons {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .quick-select-button {
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        flex: 1;
        min-width: 80px;
        text-align: center;
      }

      .quick-select-button:hover {
        background: var(--primary-background-color, #f5f5f5);
        border-color: var(--primary-color);
      }

      .quick-select-button:active {
        transform: scale(0.98);
      }

      .copy-dialog-days {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }

      .day-checkbox {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border: 2px solid var(--divider-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
      }

      .day-checkbox:hover {
        background: var(--primary-background-color, #f5f5f5);
        border-color: var(--primary-color);
      }

      .day-checkbox.checked {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .day-checkbox input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        margin: 0;
        flex-shrink: 0;
      }

      .day-checkbox-label {
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        text-transform: capitalize;
        flex: 1;
      }

      .modal-footer {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      .modal-footer .button {
        min-width: 100px;
      }
    `,
  ];

  /**
   * Toggle a day in the selected days set
   */
  private _toggleDay(day: DayOfWeek): void {
    const newSelected = new Set(this.selectedDays);
    if (newSelected.has(day)) {
      newSelected.delete(day);
    } else {
      newSelected.add(day);
    }
    this.selectedDays = newSelected;
  }

  /**
   * Select all weekdays (Mon-Fri), excluding source day
   */
  private _selectWeekdays(): void {
    const newSelected = new Set<DayOfWeek>();
    this.WEEKDAYS.forEach(day => {
      if (day !== this.sourceDay) {
        newSelected.add(day);
      }
    });
    this.selectedDays = newSelected;
  }

  /**
   * Select weekend days (Sat-Sun), excluding source day
   */
  private _selectWeekend(): void {
    const newSelected = new Set<DayOfWeek>();
    this.WEEKEND.forEach(day => {
      if (day !== this.sourceDay) {
        newSelected.add(day);
      }
    });
    this.selectedDays = newSelected;
  }

  /**
   * Select all days except the source day
   */
  private _selectAll(): void {
    const newSelected = new Set<DayOfWeek>();
    this.ALL_DAYS.forEach(day => {
      if (day !== this.sourceDay) {
        newSelected.add(day);
      }
    });
    this.selectedDays = newSelected;
  }

  /**
   * Clear all selections
   */
  private _clearSelection(): void {
    this.selectedDays = new Set();
  }

  /**
   * Handle the copy action
   */
  private _handleCopy(): void {
    if (this.selectedDays.size === 0) {
      return;
    }

    const event = new CustomEvent('copy-confirmed', {
      detail: {
        sourceDay: this.sourceDay,
        targetDays: Array.from(this.selectedDays),
      },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
    this._clearSelection();
  }

  /**
   * Handle dialog close (cancel)
   */
  private _handleClose(): void {
    const event = new CustomEvent('dialog-closed', {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
    this._clearSelection();
  }

  /**
   * Handle overlay click to close dialog
   */
  private _handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      this._handleClose();
    }
  }

  /**
   * Handle checkbox change event
   */
  private _handleCheckboxChange(day: DayOfWeek, e: Event): void {
    e.stopPropagation();
    this._toggleDay(day);
  }

  /**
   * Capitalize first letter of a string
   */
  private _capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  render() {
    if (!this.open) {
      return html``;
    }

    const availableDays = this.ALL_DAYS.filter(day => day !== this.sourceDay);

    return html`
      <div class="modal-overlay" @click=${this._handleOverlayClick}>
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">Copy ${this._capitalize(this.sourceDay)} schedule to...</h2>
          </div>

          <div class="modal-content">
            <!-- Quick select buttons -->
            <div class="quick-select-buttons">
              <button
                class="quick-select-button"
                @click=${this._selectWeekdays}
                title="Select Monday through Friday"
              >
                Weekdays
              </button>
              <button
                class="quick-select-button"
                @click=${this._selectWeekend}
                title="Select Saturday and Sunday"
              >
                Weekend
              </button>
              <button
                class="quick-select-button"
                @click=${this._selectAll}
                title="Select all days except ${this._capitalize(this.sourceDay)}"
              >
                All
              </button>
              <button
                class="quick-select-button"
                @click=${this._clearSelection}
                title="Clear all selections"
              >
                Clear
              </button>
            </div>

            <!-- Day checkboxes -->
            <div class="copy-dialog-days">
              ${availableDays.map(
                day => html`
                  <label
                    class="day-checkbox ${this.selectedDays.has(day) ? 'checked' : ''}"
                    @click=${() => this._toggleDay(day)}
                  >
                    <input
                      type="checkbox"
                      .checked=${this.selectedDays.has(day)}
                      @change=${(e: Event) => this._handleCheckboxChange(day, e)}
                      @click=${(e: Event) => e.stopPropagation()}
                    />
                    <span class="day-checkbox-label">${this._capitalize(day)}</span>
                  </label>
                `
              )}
            </div>
          </div>

          <div class="modal-footer">
            <button class="button button-secondary" @click=${this._handleClose}>
              Cancel
            </button>
            <button
              class="button button-primary"
              @click=${this._handleCopy}
              ?disabled=${this.selectedDays.size === 0}
            >
              Copy to ${this.selectedDays.size} ${this.selectedDays.size === 1 ? 'day' : 'days'}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'copy-schedule-dialog': CopyScheduleDialog;
  }
}
