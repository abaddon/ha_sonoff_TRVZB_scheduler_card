# TRVZB Scheduler Card

[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2023.x%2B-blue.svg)](https://www.home-assistant.io/)
[![Zigbee2MQTT](https://img.shields.io/badge/Zigbee2MQTT-Compatible-green.svg)](https://www.zigbee2mqtt.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Home Assistant custom card for managing weekly heating schedules on **Sonoff TRVZB** thermostatic radiator valves integrated via Zigbee2MQTT.

## Features

- **Two View Modes**: Switch between a visual weekly calendar grid and a detailed list view
- **Full Schedule Control**: Edit up to 6 temperature transitions per day
- **Copy Schedules**: Easily copy a day's schedule to other days (weekdays, weekend, or custom selection)
- **Temperature Range**: Set temperatures from 4°C to 35°C in 0.5°C increments
- **Smart Defaults**: Automatically adds midnight (00:00) transition if missing
- **Theme Integration**: Follows your Home Assistant theme colors
- **Temperature Color Coding**: Visual temperature indicators (blue for cold, red for hot)
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Screenshots

<!-- Add screenshots here -->
| Week View | List View | Day Editor |
|-----------|-----------|------------|
| ![Week View](screenshots/week-view.png) | ![List View](screenshots/list-view.png) | ![Day Editor](screenshots/day-editor.png) |

## Requirements

- **Home Assistant** 2023.x or later
- **Zigbee2MQTT** with Sonoff TRVZB device integrated
- **MQTT Integration** enabled in Home Assistant

## Installation

### HACS Installation (Recommended)

*Coming soon - once published to HACS*

1. Open HACS in Home Assistant
2. Go to "Frontend" section
3. Click "+ Explore & Download Repositories"
4. Search for "TRVZB Scheduler Card"
5. Click "Download"
6. Restart Home Assistant

### Manual Installation

1. Download `trvzb-scheduler-card.js` from the [latest release](https://github.com/your-username/trvzb-scheduler-card/releases)

2. Copy the file to your Home Assistant config directory:
   ```
   /config/www/trvzb-scheduler-card.js
   ```

3. Add the resource to your dashboard:
   - Go to **Settings** → **Dashboards**
   - Click the three-dot menu → **Resources**
   - Click **Add Resource**
   - Enter URL: `/local/trvzb-scheduler-card.js`
   - Select **JavaScript Module**
   - Click **Create**

4. Add the card to your dashboard (see Configuration below)

## Configuration

### Basic Configuration

```yaml
type: custom:trvzb-scheduler-card
entity: climate.living_room_trvzb
```

### Full Configuration

```yaml
type: custom:trvzb-scheduler-card
entity: climate.living_room_trvzb
name: Living Room Heating
view_mode: week
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `entity` | string | Yes | - | The climate entity ID of your TRVZB device |
| `name` | string | No | Entity friendly name | Custom title for the card |
| `view_mode` | string | No | `week` | Default view mode: `week` or `list` |

### Visual Card Editor

You can also configure the card using the visual editor:

1. Click **Add Card** on your dashboard
2. Search for "TRVZB Scheduler Card"
3. Select your climate entity
4. Optionally set a custom name and default view mode
5. Click **Save**

## Usage

### Switching Views

Click the view toggle button in the card header to switch between:
- **Week View**: Visual 7-day calendar with colored temperature blocks
- **List View**: Expandable accordion showing each day's transitions

### Editing a Day's Schedule

1. Click on any day (in week view) or the "Edit" button (in list view)
2. The day editor modal will open showing all transitions
3. Modify times and temperatures as needed
4. Click **Save** to apply changes to the card

### Adding Transitions

1. Open the day editor
2. Click **Add Transition** (max 6 per day)
3. Set the time and temperature
4. Click **Save**

### Removing Transitions

1. Open the day editor
2. Click the **X** button next to any transition (except the first one at 00:00)
3. Click **Save**

### Copying Schedules

1. Open the day editor for the day you want to copy
2. Click **Copy to Other Days...**
3. Select target days using checkboxes or quick buttons:
   - **Weekdays**: Monday through Friday
   - **Weekend**: Saturday and Sunday
   - **All**: All days except the source
4. Click **Copy**
5. Click **Save** on the main card to apply to the device

### Saving to Device

After making changes, click the **Save** button in the card header to send the schedule to your TRVZB device via MQTT.

## Schedule Format

The TRVZB device uses the following schedule format:

- Each day can have up to **6 transitions**
- Each transition specifies a **time** (HH:mm) and **temperature** (4-35°C)
- The first transition must be at **00:00** (midnight)
- Temperature steps are **0.5°C**
- The temperature remains active until the next transition

Example: `00:00/18 06:00/21 08:00/18 17:00/22 22:00/18`
- Midnight to 6:00 AM: 18°C
- 6:00 AM to 8:00 AM: 21°C
- 8:00 AM to 5:00 PM: 18°C
- 5:00 PM to 10:00 PM: 22°C
- 10:00 PM to midnight: 18°C

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/trvzb-scheduler-card.git
cd trvzb-scheduler-card

# Install dependencies
npm install
```

### Development Mode

```bash
# Start development server with watch mode
npm run dev
```

The built file will be in `dist/trvzb-scheduler-card.js`. You can symlink this to your HA config for live development.

### Production Build

```bash
# Build for production (minified)
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Project Structure

```
src/
├── index.ts                    # Entry point
├── card.ts                     # Main card component
├── editor.ts                   # Card configuration editor
├── components/
│   ├── schedule-week-view.ts   # Weekly calendar view
│   ├── schedule-list-view.ts   # Accordion list view
│   ├── day-schedule-editor.ts  # Day editing modal
│   ├── transition-editor.ts    # Single transition editor
│   └── copy-schedule-dialog.ts # Copy schedule dialog
├── models/
│   ├── types.ts                # TypeScript interfaces
│   └── schedule.ts             # Schedule parsing/serialization
├── services/
│   └── ha-service.ts           # Home Assistant integration
├── utils/
│   ├── time.ts                 # Time utilities
│   └── validation.ts           # Validation logic
└── styles/
    └── card-styles.ts          # Shared CSS styles
```

## Troubleshooting

### Card Not Showing

1. Ensure the resource is added correctly in Dashboard → Resources
2. Clear your browser cache
3. Check the browser console for errors

### Entity Not Found

1. Verify your TRVZB is properly integrated with Zigbee2MQTT
2. Check that the climate entity exists in Home Assistant
3. Ensure the entity ID in the card config matches exactly

### Schedule Not Saving

1. Check that MQTT integration is working
2. Verify the Zigbee2MQTT device is online
3. Check Home Assistant logs for MQTT errors

### Schedule Not Loading

1. The schedule is read from entity attributes (`schedule` or `weekly_schedule`)
2. Ensure Zigbee2MQTT is exposing the schedule attribute
3. Try requesting the schedule: publish to `zigbee2mqtt/DEVICE_NAME/get` with `{"weekly_schedule":""}`

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Home Assistant](https://www.home-assistant.io/) - The home automation platform
- [Zigbee2MQTT](https://www.zigbee2mqtt.io/) - Zigbee to MQTT bridge
- [LitElement](https://lit.dev/) - Web components library
- [Sonoff](https://sonoff.tech/) - TRVZB thermostatic radiator valve

---

Made with care for the Home Assistant community
