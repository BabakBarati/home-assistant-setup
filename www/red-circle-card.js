class RedCircleCard extends HTMLElement {
    _modeToIconMap = new Map([
        ["pollution", "pollution_mode"],
        ["allergen", "allergen_mode"],
        ["bacteria", "bacteria_virus_mode"],
        ["sleep", "sleep_mode"],
        ["speed_1", "speed_1"],
        ["speed_2", "speed_2"],
        ["speed_3", "speed_3"],
        ["turbo", "fan_speed_button"]
    ]);
    constructor() {
        super();
        console.log('RedCircleCard: Constructor called.'); // Debug log
        try {
            // Attach a shadow DOM to encapsulate styles and markup
            this.attachShadow({ mode: 'open' });
            this._config = {}; // Initialize config
            this._isAnimating = false; // Add a flag to prevent re-entry during animation

            // The HTML structure and styles for the card
            this.shadowRoot.innerHTML = `
                <style>
                    /* Basic reset and font */
                    :host {
                        display: flex; /* Make the host element a flex container */
                        justify-content: center; /* Center content horizontally */
                        align-items: center; /* Center content vertically */
                        font-family: "Inter", sans-serif;
                        height: 100%; /* Take full height of its parent container in Lovelace */
                        width: 100%; /* Take full width of its parent container in Lovelace */
                        background-color: var(--card-background-color, #f0f0f0); /* Use HA theme background or fallback */
                        border-radius: var(--ha-card-border-radius, 12px); /* Use HA theme border radius */
                        box-shadow: var(--ha-card-box-shadow, 0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)); /* Use HA theme shadow */
                        overflow: hidden; /* Prevent scrollbars if circles go slightly out of bounds */
                    }

                    /* Custom styles for all circles */
                    .circle {
                        border-radius: 50%; /* Makes it a perfect circle */
                        position: absolute; /* Allows precise positioning within the container */
                        cursor: pointer;
                        /* Apply transform for centering all circles */
                        transform: translate(-50%, -50%);
                        /* Add transitions for smooth animation of position only (no opacity transition) */
                        transition: left 0.6s ease-out, top 0.6s ease-out, background-color 0.3s ease;
                    }

                    /* Styling for the main red circle */
                    #mainCircle {
                        background-color: #ffffff; /* Changed to white */
                        width: 50px; /* Changed to 50px diameter */
                        height: 50px; /* Changed to 50px diameter */
                        border: 2px solid #000000; /* Added black 2px border */
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* Shadow */
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #000000; /* Changed icon color to black */
                        font-weight: bold;
                        font-size: 1.5rem; /* Increased font size for icon */
                        /* Center the main circle using top/left 50% and transform */
                        top: 50%;
                        left: 50%;
                        z-index: 1;
                    }

                    /* Styling for the new smaller circles */
                    .new-circle {
                        background-color: #ffffff; /* Changed to white */
                        border: 2px solid #000000; /* Added black 2px border */
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* Shadow */
                        display: flex; /* To center the icon */
                        align-items: center; /* To center the icon */
                        justify-content: center; /* To center the icon */
                        color: #000000; /* Icon color for small circles */
                        font-size: 1rem; /* Adjust icon size for small circles */
                    }

                    /* Container for the main circle and new circles */
                    .circle-container {
                        position: relative; /* Essential for absolute positioning of child circles */
                        display: flex; /* Used to center the content within this container */
                        justify-content: center;
                        align-items: center;
                        width: 300px; /* Fixed width for the container */
                        height: 300px; /* Fixed height for the container */
                    }
                </style>
                <div class="circle-container">
                    <!-- Main Red Circle -->
                    <div id="mainCircle" class="circle">
                        <ha-icon icon=""></ha-icon>
                    </div>
                </div>
            `;

            // Define properties for the new circles (these are instance properties now)
            this.numberOfNewCircles = 7;
            this.newCircleDiameter = 30; // Diameter of the smaller circles in pixels (unchanged)

            // Updated mainCircleRadius for 50px diameter
            this.mainCircleRadius = 25; // Radius of the main circle (50px diameter / 2)

            // Calculate distribution radius:
            // Distance from the center of the main circle to the center of new circles.
            // This includes main circle's radius + new circle's radius + a small gap.
            this.distributionRadius = this.mainCircleRadius + (this.newCircleDiameter / 2) + 5; // 25 + 15 + 5 = 45px

            // The center of the circleContainer (and thus the mainCircle) in pixels
            // This should be half of the container's fixed width/height.
            this.containerCenterX = 150; // 300px / 2
            this.containerCenterY = 150; // 300px / 2

            console.log('RedCircleCard: Constructor finished successfully.'); // Debug log
        } catch (e) {
            console.error('RedCircleCard: Error in constructor:', e); // Catch errors during construction
        }
    }

    // Web Component lifecycle callback: called when the element is inserted into the DOM
    connectedCallback() {
        console.log('RedCircleCard: connectedCallback called.'); // Debug log
        try {
            // Get references to elements within the shadow DOM
            // It's safer to get these references here, after the shadow DOM content is attached
            this.mainCircle = this.shadowRoot.getElementById('mainCircle');
            this.circleContainer = this.shadowRoot.querySelector('.circle-container');

            // Bind event listeners here
            if (this.mainCircle) {
                // Use capture phase for mainCircle listener to ensure it runs first
                this.mainCircle.addEventListener('click', this._handleMainCircleClick.bind(this), true);
                console.log('RedCircleCard: mainCircle event listener added (capture phase).');
            } else {
                console.error('RedCircleCard: mainCircle element not found in connectedCallback!');
            }

            if (this.shadowRoot) {
                this.shadowRoot.addEventListener('click', this._handleShadowRootClick.bind(this));
                console.log('RedCircleCard: shadowRoot event listener added.');
            } else {
                console.error('RedCircleCard: shadowRoot not available in connectedCallback!');
            }
            console.log('RedCircleCard: connectedCallback finished successfully.'); // Debug log
        } catch (e) {
            console.error('RedCircleCard: Error in connectedCallback:', e); // Catch errors during connectedCallback
        }
    }

    // Web Component lifecycle callback: called when the element is removed from the DOM
    disconnectedCallback() {
        console.log('RedCircleCard: disconnectedCallback called.'); // Debug log
        // Clean up event listeners to prevent memory leaks
        if (this.mainCircle) {
            this.mainCircle.removeEventListener('click', this._handleMainCircleClick.bind(this), true); // Remove with capture phase
        }
        if (this.shadowRoot) {
            this.shadowRoot.removeEventListener('click', this._handleShadowRootClick.bind(this));
        }
    }

    // Standard Home Assistant custom card method to receive configuration
    setConfig(config) {
        try {
            this._config = config;
            if (this._hass) {
                this.hass = this._hass; // Re-run hass setter to update content
            }
        } catch (e) {
            console.error('RedCircleCard: Error in setConfig:', e);
        }
    }

    set hass(hass) {
        this._hass = hass; // Store the hass object
        if (this._config && this._config.entity_id) {
            const normalizedDeviceName = this._config.entity_id ? this._config.entity_id.split('fan.')[1] : '';
            const fanEntity = this._hass.states[this._config.entity_id];
            this._handleMode(fanEntity);
        } else {
            this._deviceNameDisplay.textContent = 'No entity configured'; // Fallback if no entity in config
        }
    }

    _handleMode(fanEntity) {
        if (fanEntity && fanEntity.attributes && fanEntity.attributes.preset_modes) {
            this._allModes = fanEntity.attributes.preset_modes;
        }
        if (fanEntity && fanEntity.attributes && fanEntity.attributes.preset_mode) {
            this._selectedMode = fanEntity.attributes.preset_mode;
            this._setSelectedModeIcon(this._selectedMode); // Set the icon based on the selected mode
        } else {
            this._selectedMode = 'unknown'; // Default to unknown if no mode is set
            console.warn('RedCircleCard: No preset_mode found in fan entity attributes.'); // Warning log
        }
    }

    _getModeIcon(mode) {
        return `pap:${this._modeToIconMap.get(mode) || 'circle'}`;
    }

    _setSelectedModeIcon(mode) {
        const icon = this._getModeIcon(mode);
        if (this.mainCircle) {
            const iconElement = this.mainCircle.querySelector('ha-icon');
            if (iconElement) {
                iconElement.setAttribute('icon', icon);
                console.log(`RedCircleCard: Icon set to ${icon}`); // Debug log
            } else {
                console.error('RedCircleCard: ha-icon element not found in mainCircle!'); // Error log
            }
        } else {
            console.error('RedCircleCard: mainCircle element not found when setting icon!'); // Error log
        }
    }

    /**
     * Clears any existing smaller circles from the container.
     */
    _clearNewCircles() {
        const existingNewCircles = this.shadowRoot.querySelectorAll('.new-circle');
        existingNewCircles.forEach(circle => {
            circle.remove();
        });
    }

    /**
     * Triggers the reverse animation for existing small circles,
     * moving them back to the center and then instantly disappearing.
     */
    _reverseAndRemoveCircles() {
        console.log('RedCircleCard: _reverseAndRemoveCircles called.'); // Debug log
        const existingNewCircles = this.shadowRoot.querySelectorAll('.new-circle');
        if (existingNewCircles.length > 0) {
            existingNewCircles.forEach(circle => {
                circle.style.left = `${this.containerCenterX}px`;
                circle.style.top = `${this.containerCenterY}px`;
            });

            setTimeout(() => {
                console.log('RedCircleCard: _reverseAndRemoveCircles - transition complete, setting opacity to 0.'); // Debug log
                existingNewCircles.forEach(circle => {
                    circle.style.opacity = '0'; // Instantly disappear
                });
                setTimeout(() => {
                    console.log('RedCircleCard: _reverseAndRemoveCircles - clearing circles.'); // Debug log
                    this._clearNewCircles();
                    this._isAnimating = false; // Reset flag after animation is fully complete
                }, 50);
            }, 600);
        } else {
            this._isAnimating = false; // Reset flag if no circles to animate
        }
    }

    /**
     * Handles the click event on the main circle.
     * Creates new circles if none exist, or triggers reverse animation if they do.
     */
    _handleMainCircleClick(event) {
        console.log('RedCircleCard: _handleMainCircleClick called.'); // Debug log
        event.stopPropagation(); // Prevent the click from bubbling up to the shadowRoot

        if (this._isAnimating) {
            console.log('RedCircleCard: _handleMainCircleClick - Animation in progress, ignoring click.'); // Debug log
            return; // Ignore clicks if an animation is already in progress
        }

        this._isAnimating = true; // Set flag to true at the start of the interaction

        const existingNewCircles = this.shadowRoot.querySelectorAll('.new-circle');

        if (existingNewCircles.length > 0) {
            this._reverseAndRemoveCircles();
        } else {
            this._clearNewCircles(); // Ensure no lingering circles from previous states

            this._allModes
                .filter(mode => mode !== this._selectedMode)
                .forEach((mode, i) => {
                    const icon = this._getModeIcon(mode);

                    const newCircle = document.createElement('div');
                    newCircle.classList.add(
                        'circle',
                        'new-circle'
                    );
                    newCircle.style.width = `${this.newCircleDiameter}px`;
                    newCircle.style.height = `${this.newCircleDiameter}px`;

                    newCircle.style.left = `${this.containerCenterX}px`;
                    newCircle.style.top = `${this.containerCenterY}px`;
                    newCircle.style.opacity = '1';

                    // Add the pap:speed_2 icon to the new small circle
                    newCircle.innerHTML = `<ha-icon icon="${icon}"></ha-icon>`;

                    this.circleContainer.appendChild(newCircle);

                    const angle = (i / this.numberOfNewCircles) * 2 * Math.PI;
                    const xOffset = this.distributionRadius * Math.cos(angle);
                    const yOffset = this.distributionRadius * Math.sin(angle);

                    const finalLeftCenter = this.containerCenterX + xOffset;
                    const finalTopCenter = this.containerCenterY + yOffset;

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            newCircle.style.left = `${finalLeftCenter}px`;
                            newCircle.style.top = `${finalTopCenter}px`;
                        });
                    });
                });
            // After creating circles, allow a short delay before resetting the flag
            // to prevent immediate re-triggering, but still allow interaction after motion starts.
            setTimeout(() => {
                this._isAnimating = false;
            }, 600); // Match animation duration
        }
    }

    /**
     * Handles clicks on the shadow root (the card area) to reverse animation.
     */
    _handleShadowRootClick(event) {
        console.log('RedCircleCard: _handleShadowRootClick called.'); // Debug log

        // If an animation is already in progress, ignore this click
        if (this._isAnimating) {
            console.log('RedCircleCard: _handleShadowRootClick - Animation in progress, ignoring click.'); // Debug log
            return;
        }

        const path = event.composedPath();
        const isClickOnMainCircle = path.includes(this.mainCircle);

        if (!isClickOnMainCircle && this.shadowRoot.querySelectorAll('.new-circle').length > 0) {
            this._isAnimating = true; // Set flag to true when starting reverse animation
            this._reverseAndRemoveCircles();
        } else {
            console.log('RedCircleCard: _handleShadowRootClick - Click ignored (on main circle or no new circles).'); // Debug log
        }
    }

    // Required for Home Assistant card size calculation
    getCardSize() {
        return 5; // Approximate height in 50px increments
    }
}

console.log('RedCircleCard: Attempting to define custom element.'); // Debug log before definition
customElements.define('red-circle-card', RedCircleCard);
console.log('RedCircleCard: Custom element definition attempted.'); // Debug log after definition
