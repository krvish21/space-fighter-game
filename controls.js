class Controls {
    constructor(obj) {
        this.obj = obj;
        this.keysPressed = new Set();
        // Touch state
        this.touchActive = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchAxisX = 0;
        this.touchAxisY = 0;
		this.touchRadius = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ? 50 : 60; // px for full input (tighter on mobile)

		// Pointer state (covers mouse + touch)
		this.pointerActive = false;
		this.pointerId = null;
		this.pointerStartX = 0;
		this.pointerStartY = 0;
		this.pointerAxisX = 0;
		this.pointerAxisY = 0;

        // Store bound event handlers for cleanup
        this.boundEventHandlers = {
            keydown: null,
            keyup: null,
            touchstart: null,
            touchmove: null,
            touchend: null,
            touchcancel: null,
            pointerdown: null,
            pointermove: null,
            pointerup: null,
            pointercancel: null
        };

        this.#eventHandler();
    }

    moveUp = () => {
        this.obj.velocityY = Math.max(-this.obj.maxSpeed, this.obj.velocityY - this.obj.acceleration);
        this.obj.targetRotation = -Math.PI / 2; // Face up
    }

    moveDown = () => {
        this.obj.velocityY = Math.min(this.obj.maxSpeed, this.obj.velocityY + this.obj.acceleration);
        this.obj.targetRotation = Math.PI / 2; // Face down
    }

    moveLeft = () => {
        this.obj.velocityX = Math.max(-this.obj.maxSpeed, this.obj.velocityX - this.obj.acceleration);
        this.obj.targetRotation = Math.PI; // Face left
    }

    moveRight = () => {
        this.obj.velocityX = Math.min(this.obj.maxSpeed, this.obj.velocityX + this.obj.acceleration);
        this.obj.targetRotation = 0; // Face right
    }

    keys = new Map([
        ['ArrowUp', this.moveUp],
        ['ArrowDown', this.moveDown],
        ['ArrowLeft', this.moveLeft],
        ['ArrowRight', this.moveRight]
    ])

    update(dt) {
		// Aggregate input axes (pointer > touch > keys)
        let ax = 0, ay = 0;
		if (this.pointerActive) {
			ax = this.pointerAxisX;
			ay = this.pointerAxisY;
		} else if (this.touchActive) {
            ax = this.touchAxisX;
            ay = this.touchAxisY;
        } else {
            if (this.keysPressed.has('ArrowLeft')) ax -= 1;
            if (this.keysPressed.has('ArrowRight')) ax += 1;
            if (this.keysPressed.has('ArrowUp')) ay -= 1;
            if (this.keysPressed.has('ArrowDown')) ay += 1;
        }
        // Normalize diagonal
        if (ax !== 0 && ay !== 0) { ax *= Math.SQRT1_2; ay *= Math.SQRT1_2; }
        this.obj.inputAxisX = ax;
        this.obj.inputAxisY = ay;
        // Update facing
        if (ax !== 0 || ay !== 0) {
            this.obj.targetRotation = Math.atan2(ay, ax);
        }
    }

    #eventHandler() {
        // Store bound handlers for cleanup
        this.boundEventHandlers.keydown = (e) => {
            const pressedKey = e.key;
            if (this.keys.has(pressedKey) && !this.keysPressed.has(pressedKey)) {
                this.keysPressed.add(pressedKey);
            }
        };

        this.boundEventHandlers.keyup = (e) => {
            const releasedKey = e.key;
            if (this.keysPressed.has(releasedKey)) {
                this.keysPressed.delete(releasedKey);
            }
        };

        document.addEventListener('keydown', this.boundEventHandlers.keydown);
        document.addEventListener('keyup', this.boundEventHandlers.keyup);

		// Touch + Pointer controls: drag anywhere to steer
        const canvasEl = document.getElementById('myCanvas');
        if (!canvasEl) return;
		try { canvasEl.style.touchAction = 'none'; } catch (e) {}

        const getTouch = (ev) => (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]);
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

        this.boundEventHandlers.touchstart = (ev) => {
            const t = getTouch(ev);
            if (!t) return;
            ev.preventDefault();
            this.touchActive = true;
            this.touchStartX = t.clientX;
            this.touchStartY = t.clientY;
            this.touchAxisX = 0;
            this.touchAxisY = 0;
        };

        this.boundEventHandlers.touchmove = (ev) => {
            if (!this.touchActive) return;
            const t = getTouch(ev);
            if (!t) return;
            ev.preventDefault();
            const dx = t.clientX - this.touchStartX;
            const dy = t.clientY - this.touchStartY;
            const ax = clamp(dx / this.touchRadius, -1, 1);
            const ay = clamp(dy / this.touchRadius, -1, 1);
            this.touchAxisX = ax;
            this.touchAxisY = ay;
        };

        const endTouch = (ev) => {
            if (!this.touchActive) return;
            ev.preventDefault();
            this.touchActive = false;
            this.touchAxisX = 0;
            this.touchAxisY = 0;
        };

        this.boundEventHandlers.touchend = endTouch;
        this.boundEventHandlers.touchcancel = endTouch;

        canvasEl.addEventListener('touchstart', this.boundEventHandlers.touchstart, { passive: false });
        canvasEl.addEventListener('touchmove', this.boundEventHandlers.touchmove, { passive: false });
        canvasEl.addEventListener('touchend', this.boundEventHandlers.touchend, { passive: false });
        canvasEl.addEventListener('touchcancel', this.boundEventHandlers.touchcancel, { passive: false });

		// Pointer Events (covers modern mobile + desktop)
		this.boundEventHandlers.pointerdown = (ev) => {
			// Only capture primary pointer
			if (this.pointerActive) return;
			this.pointerActive = true;
			this.pointerId = ev.pointerId;
			this.pointerStartX = ev.clientX;
			this.pointerStartY = ev.clientY;
			this.pointerAxisX = 0;
			this.pointerAxisY = 0;
			try { canvasEl.setPointerCapture(ev.pointerId); } catch (e) {}
			if (ev.cancelable) ev.preventDefault();
		};

		this.boundEventHandlers.pointermove = (ev) => {
			if (!this.pointerActive || ev.pointerId !== this.pointerId) return;
			const dx = ev.clientX - this.pointerStartX;
			const dy = ev.clientY - this.pointerStartY;
			this.pointerAxisX = clamp(dx / this.touchRadius, -1, 1);
			this.pointerAxisY = clamp(dy / this.touchRadius, -1, 1);
			if (ev.cancelable) ev.preventDefault();
		};

		const endPointer = (ev) => {
			if (!this.pointerActive || ev.pointerId !== this.pointerId) return;
			this.pointerActive = false;
			this.pointerId = null;
			this.pointerAxisX = 0;
			this.pointerAxisY = 0;
			if (ev.cancelable) ev.preventDefault();
		};

		this.boundEventHandlers.pointerup = endPointer;
		this.boundEventHandlers.pointercancel = endPointer;

		canvasEl.addEventListener('pointerdown', this.boundEventHandlers.pointerdown, { passive: false });
		canvasEl.addEventListener('pointermove', this.boundEventHandlers.pointermove, { passive: false });
		canvasEl.addEventListener('pointerup', this.boundEventHandlers.pointerup, { passive: false });
		canvasEl.addEventListener('pointercancel', this.boundEventHandlers.pointercancel, { passive: false });
    }

    // Clean up all event listeners
    cleanup() {
        // Remove document event listeners
        if (this.boundEventHandlers.keydown) {
            document.removeEventListener('keydown', this.boundEventHandlers.keydown);
        }
        if (this.boundEventHandlers.keyup) {
            document.removeEventListener('keyup', this.boundEventHandlers.keyup);
        }

        // Remove canvas event listeners
        const canvasEl = document.getElementById('myCanvas');
        if (canvasEl) {
            if (this.boundEventHandlers.touchstart) {
                canvasEl.removeEventListener('touchstart', this.boundEventHandlers.touchstart);
            }
            if (this.boundEventHandlers.touchmove) {
                canvasEl.removeEventListener('touchmove', this.boundEventHandlers.touchmove);
            }
            if (this.boundEventHandlers.touchend) {
                canvasEl.removeEventListener('touchend', this.boundEventHandlers.touchend);
            }
            if (this.boundEventHandlers.touchcancel) {
                canvasEl.removeEventListener('touchcancel', this.boundEventHandlers.touchcancel);
            }
            if (this.boundEventHandlers.pointerdown) {
                canvasEl.removeEventListener('pointerdown', this.boundEventHandlers.pointerdown);
            }
            if (this.boundEventHandlers.pointermove) {
                canvasEl.removeEventListener('pointermove', this.boundEventHandlers.pointermove);
            }
            if (this.boundEventHandlers.pointerup) {
                canvasEl.removeEventListener('pointerup', this.boundEventHandlers.pointerup);
            }
            if (this.boundEventHandlers.pointercancel) {
                canvasEl.removeEventListener('pointercancel', this.boundEventHandlers.pointercancel);
            }
        }

        // Clear references
        this.boundEventHandlers = {};
        this.keysPressed.clear();
        this.keys.clear();
    }
}