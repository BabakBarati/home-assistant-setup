// philips-tower-fan-control.js

class PhilipsTowerFanControl extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Attach a shadow DOM to encapsulate styles and markup
        this._config = {}; // Initialize config
        this._hass = null; // Initialize Home Assistant object
    }

    // Home Assistant will set this.hass property automatically
    set hass(hass) {
        this._hass = hass;
        // Re-render the card when the hass object is updated.
        // This ensures that any interactions relying on hass are correctly bound.
        this.render();
    }

    // Set the configuration for the card
    setConfig(config) {
        if (!config.name) {
            console.error("Configuration missing 'name' for Philips Tower Fan Control card.");
            this.shadowRoot.innerHTML = `<style>
                :host { display: block; padding: 16px; background-color: #ffe0b2; border: 1px solid #ff9800; border-radius: 8px; }
                p { color: #d32f2f; font-family: "Inter", sans-serif; }
            </style><p>Error: Card configuration missing 'name'.</p>`;
            return;
        }

        // Check for all expected script IDs and warn if missing
        const requiredScripts = [
            'power_script_id', 'rotation_script_id', 'mode_script_id',
            'fan_increase_script_id', 'fan_decrease_script_id',
            'timer_script_id', 'lock_script_id'
        ];
        requiredScripts.forEach(scriptKey => {
            if (!config[scriptKey]) {
                console.warn(`Configuration missing '${scriptKey}'. Corresponding button will not function.`);
            }
        });

        this._config = config;
        // Call render here as well to update content based on config changes
        // The hass setter will also call render if hass is updated later.
        this.render();
    }

    // Called when the element is inserted into the DOM
    connectedCallback() {
        this.render();
    }

    // Render the card's content
    render() {
        // Clear existing shadow DOM content before rendering
        this.shadowRoot.innerHTML = `
            <style>
                /* Host styles for the custom card itself */
                :host {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0;
                    background-color: transparent; /* Card background */
                    font-family: "Inter", sans-serif; /* Using Inter font */
                    padding: 16px; /* Padding around the card content */
                }

                /* Styles for the grey rectangle with background image */
                .rectangle {
                    width: 177px;
                    height: 240px;
                    border-radius: 8px; /* Rounded corners */
                    /* box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); */
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: white;
                    font-size: 1.125rem; /* Equivalent to text-lg */
                    font-weight: bold;
                    position: relative; /* Needed for absolute positioning of the circle */
                    overflow: hidden; /* Hide anything that overflows the rectangle */

                    /* Background image properties */
                    background-image: url('/local/tower-fan-controller.svg'); /* Path to your SVG in Home Assistant's www folder */
                    background-repeat: no-repeat; /* Do not repeat the image */
                    background-position: center; /* Center the image */
                    /* Calculate background-size to create a 10px margin on all sides */
                    background-size: 157px 220px; /* Set specific size to create the margin effect */
                }

                /* Styles for the action buttons (circles) inside the rectangle */
                .top-button {
                    top: 10px;
                }

                .top-button.right {
                    right: 28px; /* Aligns the circle to the right */
                }

                .top-button.left {
                    left: 28px; /* Aligns the circle to the left */
                }

                .clickable {
                    cursor: pointer; /* Changes cursor to pointer when hovering over the circle */
                }

                .action-button {
                    position: absolute; /* Position relative to the .rectangle parent */
                    border-radius: 50%; /* Makes the div a circle */
                    overflow: hidden; /* Crucial for clipping the ripple effect */
                    display: flex; /* Use flexbox to center content if any */
                    justify-content: center;
                    align-items: center;
                }

                .action-button.small {
                    width: 35px;
                    height: 35px;
                }

                .action-button.large {
                    width: 60px;
                    height: 60px;
                }

                .dial-button.left {
                    left: 16px;
                    bottom: 70px;
                }

                .dial-button.right {
                    right: 16px;
                    bottom: 70px;
                }

                .dial-button.bottom {
                    left: 71px;
                    bottom: 18px;
                }

                .dial-button.top {
                    left: 71px;
                    bottom: 123px;
                }

                .dial-button.middle {
                    left: 58.5px;
                    bottom: 58px;
                }

                /* Styles for the ripple effect */
                .ripple {
                    position: absolute;
                    border-radius: 50%;
                    background-color: rgba(0, 0, 0, 0.3); /* Darker ripple for light buttons */
                    transform: scale(0);
                    animation: ripple-effect 0.6s linear;
                    pointer-events: none; /* So the ripple doesn't interfere with clicks on elements below */
                }

                @keyframes ripple-effect {
                    to {
                        transform: scale(2.5); /* Expand beyond button size */
                        opacity: 0;
                    }
                }
            </style>
            <div class="rectangle">
                <div class="action-button small top-button left clickable" data-button-id="rotation-toggle"></div>
                <div class="action-button small top-button right clickable" data-button-id="power-toggle"></div>

                <div class="action-button small dial-button top clickable" data-button-id="mode-toggle"></div>
                <div class="action-button small dial-button right clickable" data-button-id="fan-increase"></div>
                <div class="action-button small dial-button bottom clickable" data-button-id="fan-decrease"></div>
                <div class="action-button small dial-button left clickable" data-button-id="timer"></div>

                <div class="action-button large dial-button middle clickable" data-button-id="lock-toggle"></div>
            </div>
        `;

        // Attach event listeners for the ripple effect and service calls in the shadow DOM
        this.addInteractions();
    }

    addInteractions() {
        const buttons = this.shadowRoot.querySelectorAll('.action-button');

        buttons.forEach(button => {
            button.addEventListener('click', (e) => { // Use arrow function to preserve 'this' context
                // Ripple effect logic
                const existingRipple = button.querySelector('.ripple');
                if (existingRipple) {
                    existingRipple.remove();
                }

                const ripple = document.createElement('span');
                ripple.classList.add('ripple');

                const rect = button.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);

                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
                ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

                button.appendChild(ripple);

                ripple.addEventListener('animationend', () => {
                    ripple.remove();
                });

                // Home Assistant service call logic
                if (this._hass) {
                    const buttonId = button.dataset.buttonId;
                    let scriptId;

                    switch (buttonId) {
                        case 'power-toggle':
                            scriptId = this._config.power_script_id;
                            break;
                        case 'rotation-toggle':
                            scriptId = this._config.rotation_script_id;
                            break;
                        case 'mode-toggle':
                            scriptId = this._config.mode_script_id;
                            break;
                        case 'fan-increase':
                            scriptId = this._config.fan_increase_script_id;
                            break;
                        case 'fan-decrease':
                            scriptId = this._config.fan_decrease_script_id;
                            break;
                        case 'timer':
                            scriptId = this._config.timer_script_id;
                            break;
                        case 'lock-toggle':
                            scriptId = this._config.lock_script_id;
                            break;
                        default:
                            console.warn(`No action defined for button with ID: ${buttonId}`);
                            return; // Exit if no action is defined
                    }

                    if (scriptId) {
                        this._send_action(scriptId);
                    } else {
                        console.warn(`No script ID configured for button with ID: ${buttonId}`);
                    }

                } else {
                    console.warn('Home Assistant object (hass) not available. Cannot call service.');
                }
            });
        });
    }

    _send_action(scriptId) {
        if (this._hass) {
            this._hass.callService('homeassistant', 'turn_on', {
                entity_id: `script.${scriptId}`
            });
            console.log(`Home Assistant script '${scriptId}' called.`);
        } else {
            console.warn(`Home Assistant object (hass) not available. Cannot call script '${scriptId}'.`);
        }
    }

    // Optional: Define card size for Home Assistant layout
    getCardSize() {
        return 5; // A typical size, adjust as needed
    }
}

// Register the custom element with the browser
customElements.define('philips-tower-fan-control', PhilipsTowerFanControl);
