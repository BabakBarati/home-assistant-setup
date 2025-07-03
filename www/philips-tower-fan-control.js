// philips-tower-fan-control.js

class PhilipsTowerFanControl extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Attach a shadow DOM to encapsulate styles and markup
        this._config = {}; // Initialize config
    }

    // Home Assistant will set this.hass property automatically
    set hass(hass) {
        this._hass = hass;
    }

    // Set the configuration for the card
    setConfig(config) {
        if (!config.name) {
            console.error("Configuration missing 'name' for Philips Tower Fan Control card.");
            // You might want to display an error message on the card itself
            this.shadowRoot.innerHTML = `<style>
                :host { display: block; padding: 16px; background-color: #ffe0b2; border: 1px solid #ff9800; border-radius: 8px; }
                p { color: #d32f2f; font-family: "Inter", sans-serif; }
            </style><p>Error: Card configuration missing 'name'.</p>`;
            return;
        }
        this._config = config;
        this.render(); // Call render to update the content based on config
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
                    /* min-height: 100vh; */ /* Not needed for a custom card */
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

        // Attach event listeners for the ripple effect in the shadow DOM
        this.addRippleEffect();
    }

    addRippleEffect() {
        const buttons = this.shadowRoot.querySelectorAll('.action-button');

        buttons.forEach(button => {
            button.addEventListener('click', function (e) {
                // Remove any existing ripples to prevent multiple animations on rapid clicks
                const existingRipple = this.querySelector('.ripple');
                if (existingRipple) {
                    existingRipple.remove();
                }

                const ripple = document.createElement('span');
                ripple.classList.add('ripple');

                // Get the click position relative to the button
                const rect = this.getBoundingClientRect();
                // Use the largest dimension for the ripple size to ensure it covers the button
                const size = Math.max(rect.width, rect.height);

                // Position the ripple at the click coordinates relative to the button
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
                ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

                this.appendChild(ripple);

                // Remove the ripple element after the animation completes
                ripple.addEventListener('animationend', () => {
                    ripple.remove();
                });

                // Home Assistant service call logic
                if (this._hass) {
                    // Check if the clicked button is the specific one for the MQTT action
                    if (button.dataset.buttonId === 'power-toggle') {
                        this._send_action(this._config.power_script_id);
                    } else if (button.dataset.buttonId === 'rotation-toggle') {
                        this._send_action(this._config.rotation_script_id);
                    } else if (button.dataset.buttonId === 'mode-toggle') {
                        this._send_action(this._config.mode_script_id);
                    }
                    else if (button.dataset.buttonId === 'fan-increase') {
                        this._send_action(this._config.fan_increase_script_id);
                    }
                    else if (button.dataset.buttonId === 'fan-decrease') {
                        this._send_action(this._config.fan_decrease_script_id);
                    }
                    else if (button.dataset.buttonId === 'timer') {
                        this._send_action(this._config.timer_script_id);
                    }
                    else if (button.dataset.buttonId === 'lock-toggle') {
                        this._send_action(this._config.lock_script_id);
                    }
                    else {
                        console.warn(`No action defined for button with ID: ${button.dataset.buttonId}`);
                    }

                } else {
                    console.warn('Home Assistant object (hass) not available. Cannot call service.');
                }
            });
        });
    }

    _send_action(scriptId) {
        // This method can be used to send actions to Home Assistant or MQTT
        if (this._hass) {
            this._hass.callService('homeassistant', 'turn_on', {
                entity_id: `script.${scriptId}`
            });
            console.log(`Home Assistant script '${this._config.power_script_id}' called for top-left button.`);
        } else {
            console.warn('No power_script_id configured for the top-left button.');
        }
    }


    // Optional: Define card size for Home Assistant layout
    getCardSize() {
        return 5; // A typical size, adjust as needed
    }
}

// Register the custom element with the browser
customElements.define('philips-tower-fan-control', PhilipsTowerFanControl);
