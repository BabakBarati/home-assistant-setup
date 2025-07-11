import { html, render } from "https://unpkg.com/lit-html@2.8.0/lit-html.js";

class AutoCard extends HTMLElement {
    green = '#65C466';
    gray = '#9c9c9c';


    /**
     * IMPORTANT: Do NOT perform DOM manipulation here, as the element might not be attached yet.
     */
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Internal state for the card
        this._config = {};
        this._hass = null;
        this._carId = '';
        this._trackedStates = new Map(); // Map to track state changes
        this._trackedEntityIds = new Set(); // Set to track entity IDs for state changes
    }

    setConfig(config) {
        if (!config.data_entity) {
            throw new Error('You need to define an entity for this card!');
        }

        this._config = config;
        this._carId = config.data_entity.split('.')[1].split('_data')[0];

        if (this._hass) {
            this.hass = this._hass;
        }

        this._updateContent();
    }

    set hass(hass) {
        this._hass = hass;

        if (this._trackedEntityIds.size === 0) {
            this._addEntityIdsToTrack();
        }

        if (this._statesChanged()) {
            this._updateEntityStates();
            this._updateContent();
        }
    }

    _addEntityIdsToTrack() {
        // binary sensors
        [
            'air_conditioner', 'back_left_door', 'back_right_door',
            'back_window_heater', 'defrost', 'engine', 'ev_battery_charge',
            'ev_battery_plug', 'ev_first_scheduled_departure', 'ev_second_scheduled_departure',
            'front_left_door', 'front_right_door', 'fuel_low_level', 'hood', 'tire_pressure_all',
            'tire_pressure_front_left', 'tire_pressure_front_right', 'tire_pressure_rear_left',
            'tire_pressure_rear_right', 'trunk'
        ].forEach((sensorName) => {
            // Add the sensor ID to the tracked entity IDs set.
            this._trackedEntityIds.add(this._getBinarySensorId(sensorName));
        });
        // sensors
        [
            'data', 'estimated_charge_duration', 'estimated_station_charge_duration',
            'ev_battery_level', 'ev_first_scheduled_departure_time',
            'ev_off_peak_end_time', 'ev_off_peak_start_time', 'ev_range',
            'ev_second_scheduled_departure_time', 'fuel_driving_range',
            'last_updated_at', 'odometer', 'set_temperature', 'total_driving_range',
            'vehicle_identification_number'
        ].forEach((sensorName) => {
            // Add the sensor ID to the tracked entity IDs set.
            this._trackedEntityIds.add(this._getSensorId(sensorName));
        });
        // other entities
        this._trackedEntityIds.add(`device_tracker.${this._carId}_location`);
        this._trackedEntityIds.add(`lock.${this._carId}_door_lock`);
    }

    _updateEntityStates() {
        if (this._trackedEntityIds.size === 0) {
            return;
        }
        this._trackedEntityIds.forEach((entityId) => {
            const entityState = this._hass ? this._hass.states[entityId] : null;
            if (!entityState) {
                console.warn(`Entity ${entityId} not found in Home Assistant states.`);
            }
            this._trackedStates.set(entityId, entityState ? entityState : null);
        });
    }
    
    connectedCallback() {
        this._updateContent();
    }

    _statesChanged() {
        const changedStates = [];
        this._trackedStates.forEach((oldState, entityId) => {
            const newState = this._hass.states[entityId];
            if (newState && newState.state !== oldState || !oldState) {
                changedStates.push({ entityId, oldState, newState });
            }
        });

        return this._trackedStates.size === 0 || changedStates.length > 0;
    }

    /**
     * Home Assistant specific method: Provides sizing hints for the older masonry layout.
     * A height of 1 is approximately 50 pixels.
     * @returns {number} The desired height of the card in masonry units.
     */
    getCardSize() {
        return 3;
    }

    /**
     * Home Assistant specific method: Provides sizing hints for the modern sections view grid.
     * This is the preferred method for sizing in newer dashboards.
     * @returns {object} An object defining grid options (rows, columns, min/max).
     */
    getGridOptions() {
        return {
            // Default number of rows the card takes.
            rows: 3,
            // Default number of columns the card takes (out of 12).
            // Multiples of 3 (3, 6, 9, 12) are recommended for better layout.
            columns: 12,
            // Optional: Minimal and maximal row/column sizes.
            min_rows: 3,
            max_rows: 5,
            min_columns: 2,
            max_columns: 12,
        };
    }

    _updateContent() {
        const carName = this._trackedStates.get(this._getSensorId('data'))?.attributes?.vehicle_name || 'Unknown Car';
        const milage = this._trackedStates.get(this._getSensorId('odometer'))?.state || 'N/A';
        const evRange = `${this._trackedStates.get(this._getSensorId('ev_range'))?.state || 'N/A'} km`;
        const totalRange = `${this._trackedStates.get(this._getSensorId('total_driving_range'))?.state || 'N/A'} km`;
        const pluggedIn = this._trackedStates.get(this._getBinarySensorId('ev_battery_plug'))?.state === 'on';
        const charging = this._trackedStates.get(this._getBinarySensorId('ev_battery_charge'))?.state === 'on';
        const batteryLevel = parseFloat(this._trackedStates.get(this._getSensorId('ev_battery_level'))?.state) || 0;
        const batteryInWh = (batteryLevel / 100 * 8900).toFixed(0);

        render(html`
        <style>
          :host {
            display: block;
            background-color: #1c1c1c;
            border-radius: var(--ha-card-border-radius, 12px);
            box-shadow: var(--ha-card-box-shadow, 0px 2px 4px 0px rgba(0,0,0,0.16));
            padding: 16px;
            box-sizing: border-box;
            font-family: var(--mdc-typography-body2-font-family, sans-serif);
            color: ${this.gray};
            margin: 8px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 100px;
          }
          .card-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
        }

        #flash-icon {
            position: relative;
            bottom: 4px;
            margin-left: -6px;
            color: ${this.green};
        }

        ha-icon#flash-icon {
           --mdc-icon-size: 10px;
        }

        #car-name {
            font-size: 1.5em;
            font-weight: bold;
            color: #ffffff;
            margin-bottom: 8px;
        }

        /* Responsive adjustments */
        @media (max-width: 600px) {
          :host {
            padding: 12px;
          }
        }
        </style>
        <div class="card-content">
            <div id="car-name">${carName}</div>
            <div>
                <ha-icon icon="mdi:speedometer"></ha-icon>
                <span>${milage} km</span>
            </div>
            <img src="/local/img/ioniq_side.png" alt="${carName}" style="width: 100%; height: auto; margin-top: -10%; margin-bottom: -15%;">
            <div style="display: flex; justify-content: space-between; width: 100%; margin: 10px 0px">
                <div style="padding-left: 20%"><ha-icon icon="mdi:road-variant"></ha-icon><ha-icon id="flash-icon" icon="mdi:flash"></ha-icon><span>${evRange}</span></div>
                <div style="padding-right: 20%"><ha-icon icon="mdi:road-variant"></ha-icon><span>${totalRange}</span></div>
            </div>
            <div style="display:flex;justify-content:space-evenly;width:100%;margin:10px 0">
                <div style="${pluggedIn ? `color:${this.green}` : ''}">
                    <ha-icon icon="${pluggedIn ? 'mdi:power-plug-battery' : 'mdi:power-plug-off'}"></ha-icon>
                    <div>${pluggedIn ? 'Plugged' : 'Unplugged'}</div>
                </div>
                <div style="${charging ? `color:${this.green}` : ''}">
                    <ha-icon icon="${charging ? 'mdi:ev-station' : 'mdi:ev-plug-type2'}"></ha-icon>
                    <div>${charging ? 'Charging' : 'Not Charging'}</div>
                </div>
                <div style="${charging && pluggedIn ? `color:${this.green}` : ''}">
                    <ha-icon icon="mdi:flash"></ha-icon>
                    <div>${batteryInWh} Wh</div>
                </div>
            </div>
            ${this._getChargingSection()}
        </div>
      `, this.shadowRoot);
    }

    _getSensorId(sensorName) {
        return `sensor.${this._carId}_${sensorName}`;
    }

    _getBinarySensorId(sensorName) {
        return `binary_sensor.${this._carId}_${sensorName}`;
    }

    _getChargingSection() {
        const charging = this._trackedStates.get(this._getBinarySensorId('ev_battery_charge'))?.state === 'on' || false;
        if (!charging) {
            return html``;
        }
        const batteryLevel = this._trackedStates.get(this._getSensorId('ev_battery_level'))?.state || 0;
        const batteryColor = batteryLevel > 20 ? this.green : '#FF0000'; // Green if above 20%, red otherwise
        const evRange = `${this._trackedStates.get(this._getSensorId('ev_range'))?.state || 'N/A'} km`;
        return html`
        <div style="width:100%;text-align:center;margin-top:10px">
            <div style="width:100%;background-color:${this.gray};border-radius:15px;overflow:hidden">
                <div style="width:${batteryLevel}%;background-color:${batteryColor};height:25px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:1.1em;font-weight:600;color:${this.green}">
                <div>${batteryLevel}%</div>
                <div>${evRange}</div>
            </div>
        </div>
        `;
    }
}


customElements.define('auto-card', AutoCard);

// Optional: Inform Home Assistant about your custom card for the card picker.
// This helps it show up in the "Add Card" dialog.
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'auto-card',
    name: 'Auto Card',
    description: 'A custom card for PHEV autos.',
});
