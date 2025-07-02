// Define the custom element class
class AirPurifierCard extends HTMLElement {
    constructor() {
        super(); // Call the constructor of HTMLElement
        this.attachShadow({ mode: 'open' }); // Attach a shadow DOM to the custom element

        // Create the HTML structure for the card using a template literal
        // All styling is now embedded directly or converted from Tailwind classes to standard CSS
        this.shadowRoot.innerHTML = `
            <style>
                /* Basic styling for the card container */
                :host {
                    display: flex;
                    flex-direction: column; /* Stack children vertically */
                    justify-content: center;
                    align-items: center;
                    min-height: 250px; /* Adjust height as needed for the card */
                    background-color: #f0f2f5; /* Light grey background for the card area */
                    border-radius: 0.5rem; /* Equivalent to Tailwind's rounded-lg */
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* Equivalent to Tailwind's shadow-lg */
                    padding: 1rem; /* Add some padding around the content */
                    font-family: "Inter", sans-serif; /* Ensure consistent font */
                }

                /* Custom CSS for smooth transitions on the small squares */
                .animated-square {
                    transition: transform 0.5s ease-out, opacity 0.5s ease-in-out;
                }

                /* Initial state for squares that need to be invisible */
                #hepa-filter,
                #carbon-filter,
                #pre-filter,
                #cover-open {
                    opacity: 0;
                }

                /* Styling for the main image and its container */
                .image-container {
                    position: relative;
                    width: 200px;
                    height: 200px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .main-image {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    cursor: pointer;
                }

                /* Styling for the stack of green squares */
                .squares-stack-container {
                    position: absolute;
                    left: 90px; /* Based on your provided immersive artifact */
                    top: 124px; /* Based on your provided immersive artifact */
                    transform: translateY(-50%); /* Vertically center the stack relative to its parent's top 124px */
                    width: 100px;
                    height: 140px; /* Height of the stack container from your previous code */
                }

                .square-item {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    object-fit: contain; /* Ensure SVG scales correctly */
                }

                /* Styling for the entity name display */
                .entity-name-display {
                    margin-top: 1rem; /* Space below the image/animation area */
                    font-size: 1.1rem;
                    font-weight: bold;
                    color: #333;
                    text-align: center;
                    width: 100%; /* Ensures text is centered within the card's width */
                    padding: 0 1rem; /* Add horizontal padding */
                    box-sizing: border-box; /* Include padding in width calculation */
                }
            </style>
            <div id="entity-name-display" class="entity-name-display">
                <ha-icon id="mode-icon" icon=""></ha-icon>
                <span id="friendly-name-text"></span>
            </div>
            <div class="image-container">
                <img id="main-image" src="/local/philips_ap/philips-air-purifier-web.png" alt="Philips Air Purifier" class="main-image">

                <div class="squares-stack-container">
                    <img id="hepa-filter" src="/local/philips_ap/philips-hepa-filter-web.svg" alt="HEPA Filter" class="square-item animated-square" style="z-index: 1;">
                    <img id="carbon-filter" src="/local/philips_ap/philips-carbon-filter-web.svg" alt="Carbon Filter" class="square-item animated-square" style="z-index: 2;">
                    <img id="pre-filter" src="/local/philips_ap/philips-pre-filter-web.svg" alt="Pre-Filter" class="square-item animated-square" style="z-index: 3;">
                    <img id="cover-open" src="/local/philips_ap/philips-cover-web.svg" alt="Cover Open" class="square-item animated-square" style="z-index: 4;">
                    <img id="cover-closed" src="/local/philips_ap/philips-cover-closed-web.svg" alt="Cover Closed" class="square-item animated-square" style="z-index: 5;">
                </div>
            </div>
        `;

        // Get references to the elements within the shadow DOM
        this._mainImage = this.shadowRoot.getElementById('main-image');
        this._coverClosed = this.shadowRoot.getElementById('cover-closed');
        this._coverOpen = this.shadowRoot.getElementById('cover-open');
        this._preFilter = this.shadowRoot.getElementById('pre-filter');
        this._carbonFilter = this.shadowRoot.getElementById('carbon-filter');
        this._hepaFilter = this.shadowRoot.getElementById('hepa-filter');
        this._deviceNameDisplay = this.shadowRoot.getElementById('friendly-name-text'); // New element reference
        this._modeIcon = this.shadowRoot.getElementById('mode-icon'); // Reference to the icon element

        // Define animation distances
        this._squaresToAnimate = [
            { element: this._coverOpen, xDistance: 90, yDistance: 40 },
            { element: this._preFilter, xDistance: 70, yDistance: 30 },
            { element: this._carbonFilter, xDistance: 50, yDistance: 20 },
            { element: this._hepaFilter, xDistance: 30, yDistance: 10 }
        ];

        // Animation state flags
        this._squaresMovedOut = false;
        this._animationInProgress = false;
    }

    // Called when the custom element is inserted into the DOM
    connectedCallback() {
        if (this._mainImage) {
            this._mainImage.addEventListener('click', this._handleClick.bind(this));
        }
    }

    // Called when the custom element is removed from the DOM
    disconnectedCallback() {
        if (this._mainImage) {
            this._mainImage.removeEventListener('click', this._handleClick.bind(this));
        }
    }

    // Home Assistant Lovelace calls this method to pass configuration
    setConfig(config) {
        this._config = config;
        // If the entity changes, we might want to update the display immediately
        if (this._hass) {
            this.hass = this._hass; // Re-run hass setter to update content
        }
    }

    // Home Assistant Lovelace calls this method to pass the hass object (state)
    set hass(hass) {
        this._hass = hass; // Store the hass object
        if (this._config && this._config.entity_id) {
            const normalizedDeviceName = this._config.entity_id ? this._config.entity_id.split('fan.')[1] : '';
            this._handleEntityName(normalizedDeviceName);
            this._handleMode(normalizedDeviceName);
        } else {
            this._deviceNameDisplay.textContent = 'No entity configured'; // Fallback if no entity in config
        }
    }

    _handleEntityName(normalizedDeviceName) {
        const fanEntityId = `fan.${normalizedDeviceName}`;
        const fanEntity = this._hass.states[fanEntityId];

        if (fanEntity && fanEntity.attributes) {
            if (fanEntity.attributes.name) {
                this._deviceNameDisplay.textContent = fanEntity.attributes.name;
            }
            if (fanEntity.attributes.icon) {
                this._modeIcon.setAttribute("icon", fanEntity.attributes.icon);
            }
        }
        else {
            this._deviceNameDisplay.textContent = `Entity not found: ${fanEntityId}`; // Fallback if entity not found
        }
    }

    _handleMode(normalizedDeviceName) {
        const fanEntityId = `fan.${normalizedDeviceName}`;
        const state = this._hass.states[fanEntityId];
        if (state && state.attributes && state.attributes.mode) {
            const mode = state.attributes.mode;
            // You can add logic here to handle different modes if needed
            console.log(`Current mode for ${fanEntityId}: ${mode}`);
        } else {
            console.warn(`Mode attribute not found for entity: ${fanEntityId}`); // Fallback if mode not found
        }
    }

    // Handle click event on the main image
    _handleClick() {
        if (this._animationInProgress) {
            return;
        }
        this._animationInProgress = true;

        let delay = 0;
        const delayIncrement = 200;

        if (!this._squaresMovedOut) {
            // Animate outwards
            this._squaresToAnimate.forEach((square, index) => {
                setTimeout(() => {
                    square.element.style.transform = `translate(${square.xDistance}px, ${square.yDistance}px)`;
                    square.element.style.opacity = '1';
                    if (index === 0) { // This is the cover-open element
                        this._coverClosed.style.opacity = '0'; // Hide the cover-closed
                    }
                    if (index === this._squaresToAnimate.length - 1) {
                        square.element.addEventListener('transitionend', this._handleTransitionEnd.bind(this), { once: true });
                    }
                }, delay);
                delay += delayIncrement;
            });
        } else {
            // Animate inwards
            for (let i = this._squaresToAnimate.length - 1; i >= 0; i--) {
                const square = this._squaresToAnimate[i];
                setTimeout(() => {
                    square.element.style.transform = `translate(0px, 0px)`;
                    // Only hide elements that are not the main cover (cover-open)
                    if (square.element !== this._coverOpen) {
                        square.element.style.opacity = '0';
                    } else {
                        // The cover-open itself should fade out when cover-closed fades in
                        square.element.style.opacity = '0';
                    }

                    if (i === 0) { // This is the last element to animate back (hepa-filter)
                        square.element.addEventListener('transitionend', this._handleTransitionEnd.bind(this), { once: true });
                        this._coverClosed.style.opacity = '1'; // Show the cover-closed when animation finishes
                    }
                }, delay);
                delay += delayIncrement;
            }
        }
    }

    // Handle the end of the transition
    _handleTransitionEnd() {
        this._animationInProgress = false;
        this._squaresMovedOut = !this._squaresMovedOut; // Toggle state
    }
}

// Register the custom element with a unique tag name
customElements.define('air-purifier-card', AirPurifierCard);
