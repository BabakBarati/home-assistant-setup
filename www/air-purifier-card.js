// Define the custom element class
class AirPurifierCard extends HTMLElement {
    _modeToIconMap = new Map([
        ["pollution", "purification_only_mode"],
        ["allergen", "allergen_mode"],
        ["bacteria", "bacteria_virus_mode"],
        ["sleep", "sleep_mode"],
        ["speed_1", "speed_1"],
        ["speed_2", "speed_2"],
        ["speed_3", "speed_3"],
        ["turbo", "fan_speed_button"]
    ]);
    constructor() {
        super(); // Call the constructor of HTMLElement
        this.attachShadow({ mode: 'open' }); // Attach a shadow DOM to the custom element
        this._isAnimating = false; // Add a flag to prevent re-entry during animation
        this._allModes = ["pollution", "allergen", "bacteria", "sleep", "speed_1", "speed_2", "speed_3", "turbo"];
        this._newCircleDiameter = 30; // Diameter of the smaller circles in pixels (unchanged)

        // Updated mainCircleRadius for 50px diameter (this is the *shrunk* state radius)
        this._mainCircleShrunkRadius = 25; // Radius of the main circle when shrunk (50px diameter / 2)
        this._mainCircleInitialRadius = 60; // Radius of the main circle initially (120px diameter / 2)

        // Define icon sizes for different states (using pixels for width/height)
        this._mainIconShrunkSize = '24px'; // Size for icon when main circle is small
        this._mainIconInitialSize = '60px'; // Size for icon when main circle is large

        // Calculate distribution radius:
        // Distance from the center of the main circle to the center of new circles.
        // This includes main circle's radius + new circle's radius + a small gap.
        // Use the shrunk radius for distribution calculation as circles appear when main circle shrinks
        this._distributionRadius = this._mainCircleShrunkRadius + (this._newCircleDiameter / 2) + 5; // 25 + 15 + 5 = 45px

        // The center of the circleContainer (and thus the mainCircle) in pixels
        // This should be half of the container's fixed width/height.
        this._containerCenterX = 85;
        this._containerCenterY = 150;

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
                    /* padding: 1rem; Add some padding around the content */
                    font-family: "Inter", sans-serif; /* Ensure consistent font */
                    overflow: hidden;
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

                .card-container {
                    display: flex;
                    flex-direction: row;
                    justify-content: center;
                    align-items: stretch;
                    width: 100%;
                }

                .controllers {
                    flex-grow: 1;
                    color: #333;
                }

                .device-container {
                    flex-grow: 2;
                    display: flex;
                    flex-direction: row-reverse;
                }
                
                /* Styling for the main image and its container */
                .image-container {
                    position: relative;
                    width: 250px;
                    height: 250px;
                    display: flex;
                    align-items: center;
                }

                #main-image {
                    height: 200px;
                    object-fit: contain;
                    cursor: pointer;
                }

                /* Styling for the stack of green squares */
                .squares-stack-container {
                    position: absolute;
                    left: 65px; /* Based on your provided immersive artifact */
                    bottom: 31px; /* Based on your provided immersive artifact */
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
                .metrics {
                    background: white;
                    display: flex;
                    width: 100%;
                }
                .metric-item {
                    flex: 1;
                }
            </style>

            <!-- controller styles -->
            <style>
                /* Custom styles for all circles */
                .circle {
                    border-radius: 50%; /* Makes it a perfect circle */
                    position: absolute; /* Allows precise positioning within the container */
                    cursor: pointer;
                    /* Apply transform for centering all circles */
                    transform: translate(-50%, -50%);
                    /* Add transitions for smooth animation of position, size, and background-color */
                    transition: left 0.6s ease-out, top 0.6s ease-out, width 0.3s ease, height 0.3s ease, background-color 0.3s ease;
                }

                /* Styling for the main red circle */
                #mainCircle {
                    background-color: #ffffff; /* Changed to white */
                    width: 120px; /* Initial diameter */
                    height: 120px; /* Initial diameter */
                    border: 2px solid #000000; /* Added black 2px border */
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* Shadow */
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #000000; /* Changed icon color to black */
                    font-weight: bold;
                    /* Center the main circle using top/left 50% and transform */
                    top: 50%;
                    left: 50%;
                    z-index: 1;
                }

                /* Set initial width and height for ha-icon using the CSS variable */
                #mainCircle ha-icon {
                    --mdc-icon-size: ${this._mainIconInitialSize}; /* Initial size for icon */
                    transition: --mdc-icon-size 0.3s ease; /* Animate the CSS variable */
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
                    width: ${this._containerCenterX * 2}px; /* Fixed width for the container */
                    height: 300px; /* Fixed height for the container */
                }
            </style>
            <div class="metrics">
                <div class="metric-item">
                    <div>PM2.5</div>
                    <div>40 µg/m³</div>
                </div>
                <div class="metric-item">
                    <div>AIA</div>
                    <div>2/12</div>
                </div>
                <div class="metric-item">
                    <div>Gas</div>
                    <div>L1</div>
                </div>
            </div>
            <div id="entity-name-display" class="entity-name-display">
                <span id="device-name"></span>
            </div>
            <div class="card-container">
                <div class="controllers">
                    <div class="circle-container">
                        <div id="mainCircle" class="circle">
                            <ha-icon icon=""></ha-icon>
                        </div>
                    </div>
                </div>
                <div class="device-container">
                    <div class="image-container">
                        <img id="main-image" src="/local/philips_ap/philips-air-purifier-web.png" alt="Philips Air Purifier">
                        <div class="squares-stack-container">
                            <img id="hepa-filter" src="/local/philips_ap/philips-hepa-filter-web.svg" alt="HEPA Filter" class="square-item animated-square" style="z-index: 1;">
                            <img id="carbon-filter" src="/local/philips_ap/philips-carbon-filter-web.svg" alt="Carbon Filter" class="square-item animated-square" style="z-index: 2;">
                            <img id="pre-filter" src="/local/philips_ap/philips-pre-filter-web.svg" alt="Pre-Filter" class="square-item animated-square" style="z-index: 3;">
                            <img id="cover-open" src="/local/philips_ap/philips-cover-web.svg" alt="Cover Open" class="square-item animated-square" style="z-index: 4;">
                            <img id="cover-closed" src="/local/philips_ap/philips-cover-closed-web.svg" alt="Cover Closed" class="square-item animated-square" style="z-index: 5;">
                        </div>
                    </div>
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
        this._deviceNameDisplay = this.shadowRoot.getElementById('device-name'); // New element reference

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

        // handle the mode controller
        try {
            // Get references to elements within the shadow DOM
            // It's safer to get these references here, after the shadow DOM content is attached
            this.mainCircle = this.shadowRoot.getElementById('mainCircle');
            this.circleContainer = this.shadowRoot.querySelector('.circle-container');

            // Bind event listeners here
            if (this.mainCircle) {
                // Use capture phase for mainCircle listener to ensure it runs first
                this.mainCircle.addEventListener('click', this._handleMainCircleClick.bind(this), true);
                console.log('ModeControl: mainCircle event listener added (capture phase).');
            } else {
                console.error('ModeControl: mainCircle element not found in connectedCallback!');
            }

            if (this.shadowRoot) {
                this.shadowRoot.addEventListener('click', this._handleShadowRootClick.bind(this));
                console.log('ModeControl: shadowRoot event listener added.');
            } else {
                console.error('ModeControl: shadowRoot not available in connectedCallback!');
            }
            console.log('ModeControl: connectedCallback finished successfully.'); // Debug log
        } catch (e) {
            console.error('ModeControl: Error in connectedCallback:', e); // Catch errors during connectedCallback
        }
    }

    // Called when the custom element is removed from the DOM
    disconnectedCallback() {
        if (this._mainImage) {
            this._mainImage.removeEventListener('click', this._handleClick.bind(this));
        }

        if (this.mainCircle) {
            this.mainCircle.removeEventListener('click', this._handleMainCircleClick.bind(this), true); // Remove with capture phase
        }
        if (this.shadowRoot) {
            this.shadowRoot.removeEventListener('click', this._handleShadowRootClick.bind(this));
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
            const fanEntity = this._hass.states[this._config.entity_id];
            this._handleEntityName(fanEntity);
            this._handleMode(fanEntity);
            this._handleSensors(normalizedDeviceName);
        } else {
            this._deviceNameDisplay.textContent = 'No entity configured'; // Fallback if no entity in config
        }
    }

    _handleEntityName(fanEntity) {
        if (fanEntity && fanEntity.attributes) {
            if (fanEntity.attributes.name) {
                this._deviceNameDisplay.textContent = fanEntity.attributes.name;
            }
            if (fanEntity.attributes.preset_modes) {
                this._allModes = fanEntity.attributes.preset_modes;
                this._numberOfNewCircles = this._allModes.length - 1;
            }
            if (fanEntity.attributes.preset_mode) {
                this._selectedMode = fanEntity.attributes.preset_mode;
                this._setSelectedModeIcon(this._selectedMode); // Set the icon based on the selected mode
            }
        }
        else {
            this._deviceNameDisplay.textContent = "Fan Entity not found"; // Fallback if entity not found
            // TODO: remove testing data from here
            // console.warn("ModeControl: Fan entity not found, using testing data.");
            // this._selectedMode = "pollution"; // Default mode if not set
            // this._setSelectedModeIcon(this._selectedMode); // Set the icon based on the default mode
            // this._numberOfNewCircles = 7;
            // console.warn("ModeControl: No preset_mode found, using default 'pollution' mode.");
            // end of testing data
        }
    }

    _handleMode(fanEntity) {
        // TODO: remove testing data from here

        // return;
        // end of testing data
        console.log('ModeControl: _handleMode called with fanEntity:', fanEntity); // Debug log
        if (fanEntity && fanEntity.attributes && fanEntity.attributes.preset_mode) {
            const mode = fanEntity.attributes.preset_mode;
            // You can add logic here to handle different modes if needed
            console.log(`Current mode for ${fanEntity}: ${mode}`);
        } else {
            console.warn(`Mode attribute not found for entity: ${fanEntity}`); // Fallback if mode not found
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

    /**
     * Handles clicks on the shadow root (the card area) to reverse animation.
     */
    _handleShadowRootClick(event) {
        // If an animation is already in progress, ignore this click
        if (this._isAnimating) {
            console.log('ModeControl: _handleShadowRootClick - Animation in progress, ignoring click.'); // Debug log
            return;
        }

        const path = event.composedPath();
        const isClickOnMainCircle = path.includes(this.mainCircle);

        // Find if the clicked element or any of its ancestors has the 'new-circle' class
        const clickedNewCircle = path.find(el => el.classList && el.classList.contains('new-circle'));

        if (clickedNewCircle) {
            const mode = clickedNewCircle.dataset.mode;
            console.log('ModeControl: .new-circle clicked! Mode:', mode);
            
            this._changeMode(mode);
        }

        if (!isClickOnMainCircle && this.shadowRoot.querySelectorAll('.new-circle').length > 0) {
            this._isAnimating = true; // Set flag to true when starting reverse animation
            console.log('ModeControl: [ANIMATION ON]  _handleShadowRootClick - Click detected outside main circle, starting reverse animation.'); // Debug log
            this._reverseAndRemoveCircles();
        } else {
            console.log('ModeControl: _handleShadowRootClick - Click ignored (on main circle or no new circles).'); // Debug log
        }
    }

    _handleSensors(deviceName) {
        // TODO: remove testing data from here

        // return; // Temporarily disable sensor handling
        // end of testing data

        this._sensors = new Map();

        const indoorAllergenIndexSensor = this._hass.states[`sensor.${deviceName}_indoor_allergen_index`];
        const pm2_5Sensor = this._hass.states[`sensor.${deviceName}_pm2_5`];
        const vocSensor = this._hass.states[`sensor.${deviceName}_total_volatile_organic_compounds`];

        const _rssiSensor = this._hass.states[`sensor.${deviceName}_rssi`];

        const preFilterSensor = this._hass.states[`sensor.${deviceName}_pre_filter`];
        const activeCarbonFilterSensor = this._hass.states[`sensor.${deviceName}_active_carbon_filter`];
        const hepaFilterSensor = this._hass.states[`sensor.${deviceName}_hepa_filter`];

        this._sensors.set('iai', {
            name: indoorAllergenIndexSensor.attributes.friendly_name || 'Indoor Allergen Index',
            value: indoorAllergenIndexSensor.state || 'N/A',
        });
        this._sensors.set('pm2_5', {
            name: pm2_5Sensor.attributes.friendly_name || 'PM2.5',
            value: pm2_5Sensor.state || 'N/A',
            unit: pm2_5Sensor.attributes.unit_of_measurement || '',
        });
        this._sensors.set('voc', {
            name: vocSensor.attributes.friendly_name || 'Volatile Organic Compounds',
            value: vocSensor.state || 'N/A',
            unit: vocSensor.attributes.unit_of_measurement || '',
        });
        this._sensors.set('rssi', {
            name: _rssiSensor.attributes.friendly_name || 'RSSI',
            value: _rssiSensor.state || 'N/A',
            unit: _rssiSensor.attributes.unit_of_measurement || '',
        });
        this._sensors.set('pre_filter', {
            name: preFilterSensor.attributes.friendly_name || 'Active Carbon Filter',
            type: preFilterSensor.attributes.type || 'unknown',
            value: preFilterSensor.state || 'N/A',
            percentage: `${Math.round((parseFloat(preFilterSensor.state) / 720 || 0) * 100)}%`,
            unit: preFilterSensor.attributes.unit_of_measurement || '',
            icon: preFilterSensor.attributes.icon || 'mdi:filter'
        });
        this._sensors.set('carbon_filter', {
            name: activeCarbonFilterSensor.attributes.friendly_name || 'Active Carbon Filter',
            type: activeCarbonFilterSensor.attributes.type || 'unknown',
            value: activeCarbonFilterSensor.state || 'N/A',
            percentage: `${Math.round((parseFloat(activeCarbonFilterSensor.state) / 4800 || 0) * 100)}%`,
            unit: activeCarbonFilterSensor.attributes.unit_of_measurement || '',
            icon: activeCarbonFilterSensor.attributes.icon || 'mdi:filter'
        });
        this._sensors.set('hepa_filter', {
            name: hepaFilterSensor.attributes.friendly_name || 'Hepa Filter',
            type: hepaFilterSensor.attributes.type || 'unknown',
            value: hepaFilterSensor.state || 'N/A',
            percentage: `${Math.round((parseFloat(hepaFilterSensor.state) / 4800 || 0) * 100)}%`,
            unit: hepaFilterSensor.attributes.unit_of_measurement || '',
            icon: hepaFilterSensor.attributes.icon || 'mdi:filter'
        });

        console.log('ModeControl: Sensors handled:', this._sensors); // Debug log
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
                console.log(`ModeControl: Icon set to ${icon}`); // Debug log
            } else {
                console.error('ModeControl: ha-icon element not found in mainCircle!'); // Error log
            }
        } else {
            console.error('ModeControl: mainCircle element not found when setting icon!'); // Error log
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
        console.log('ModeControl: _reverseAndRemoveCircles called.'); // Debug log
        const existingNewCircles = this.shadowRoot.querySelectorAll('.new-circle');
        if (existingNewCircles.length > 0) {
            existingNewCircles.forEach(circle => {
                circle.style.left = `${this._containerCenterX}px`;
                circle.style.top = `${this._containerCenterY}px`;
            });

            // Expand main circle back to original size
            this.mainCircle.style.width = `${this._mainCircleInitialRadius * 2}px`;
            this.mainCircle.style.height = `${this._mainCircleInitialRadius * 2}px`;
            // Expand icon size by setting the --mdc-icon-size CSS variable
            const mainCircleIcon = this.mainCircle.querySelector('ha-icon');
            if (mainCircleIcon) {
                mainCircleIcon.style.setProperty('--mdc-icon-size', this._mainIconInitialSize);
            }

            setTimeout(() => {
                console.log('ModeControl: _reverseAndRemoveCircles - transition complete, setting opacity to 0.'); // Debug log
                existingNewCircles.forEach(circle => {
                    circle.style.opacity = '0'; // Instantly disappear
                });
                setTimeout(() => {
                    console.log('ModeControl: _reverseAndRemoveCircles - clearing circles.'); // Debug log
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
        console.log('ModeControl: _handleMainCircleClick called.'); // Debug log
        event.stopPropagation(); // Prevent the click from bubbling up to the shadowRoot

        if (this._isAnimating) {
            console.log('ModeControl: _handleMainCircleClick - Animation in progress, ignoring click.'); // Debug log
            return; // Ignore clicks if an animation is already in progress
        }

        this._isAnimating = true; // Set flag to true at the start of the interaction
        console.log('ModeControl: [ANIMATION ON] _handleMainCircleClick - Click detected on main circle, starting animation.'); // Debug log

        const existingNewCircles = this.shadowRoot.querySelectorAll('.new-circle');

        if (existingNewCircles.length > 0) {
            this._reverseAndRemoveCircles();
        } else {
            this._clearNewCircles(); // Ensure no lingering circles from previous states

            // Shrink main circle
            this.mainCircle.style.width = `${this._mainCircleShrunkRadius * 2}px`;
            this.mainCircle.style.height = `${this._mainCircleShrunkRadius * 2}px`;
            // Shrink icon size by setting the --mdc-icon-size CSS variable
            const mainCircleIcon = this.mainCircle.querySelector('ha-icon');
            if (mainCircleIcon) {
                mainCircleIcon.style.setProperty('--mdc-icon-size', this._mainIconShrunkSize);
            }

            this._allModes
                .filter(mode => mode !== this._selectedMode)
                .forEach((mode, i) => {
                    const icon = this._getModeIcon(mode);

                    const newCircle = document.createElement('div');
                    newCircle.classList.add(
                        'circle',
                        'new-circle'
                    );
                    newCircle.dataset.mode = mode;
                    newCircle.style.width = `${this._newCircleDiameter}px`;
                    newCircle.style.height = `${this._newCircleDiameter}px`;

                    newCircle.style.left = `${this._containerCenterX}px`;
                    newCircle.style.top = `${this._containerCenterY}px`;
                    newCircle.style.opacity = '1';

                    // Add the pap:speed_2 icon to the new small circle
                    newCircle.innerHTML = `<ha-icon icon="${icon}"></ha-icon>`;

                    this.circleContainer.appendChild(newCircle);

                    const angle = (i / this._numberOfNewCircles) * 2 * Math.PI;
                    const xOffset = this._distributionRadius * Math.cos(angle);
                    const yOffset = this._distributionRadius * Math.sin(angle);
                    console.log(`ModeControl: New circle ${mode} at angle ${angle} with offsets (${xOffset}, ${yOffset})`); // Debug log

                    const finalLeftCenter = this._containerCenterX + xOffset;
                    const finalTopCenter = this._containerCenterY + yOffset;

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

    getCardSize() {
        return 5;
    }

    /**
     * Calls a Home Assistant service.
     * @param {string} domain The domain of the service (e.g., 'fan', 'light').
     * @param {string} service The service to call (e.g., 'set_preset_mode', 'turn_on').
     * @param {object} serviceData The data payload for the service call.
     */
    _callService(domain, service, serviceData) {
        if (this._hass) {
            this._hass.callService(domain, service, serviceData)
                .then(() => {
                    console.log(`ModeControl: Service called successfully: ${domain}.${service} with data:`, serviceData);
                })
                .catch(error => {
                    console.error(`ModeControl: Error calling service ${domain}.${service}:`, error);
                });
        } else {
            console.error('ModeControl: Home Assistant object (hass) not available to call service.');
        }
    }

    _changeMode(mode) {
        if (this._hass && this._config && this._config.entity_id) {
            const serviceData = {
                entity_id: this._config.entity_id,
                preset_mode: mode
            };
            this._callService('fan', 'set_preset_mode', serviceData);
            this._setSelectedModeIcon(mode); // Update the icon based on the new mode
        } else {
            console.error('ModeControl: Cannot change mode, hass or config not available.');
        }
    }
}

// Register the custom element with a unique tag name
customElements.define('air-purifier-card', AirPurifierCard);
