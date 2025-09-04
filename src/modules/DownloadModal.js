/** @format */

// ModalManager.js
export class DownloadModal {

	#aspectRatio = 1;#confirmCallback = null;

	constructor(modalId, widthId, heightId, lockId, cancelId, confirmId) {
		this.modal = document.getElementById(modalId);
		this.widthInput = document.getElementById(widthId);
		this.heightInput = document.getElementById(heightId);
		this.lock = document.getElementById(lockId);
		this.cancelBtn = document.getElementById(cancelId);
		this.confirmBtn = document.getElementById(confirmId);


		this.initListeners();

	}

	initListeners() {
		// attach listeners once
		this.widthInput.addEventListener('input', () => {
			if (this.lock.checked)
				this.heightInput.value = Math.round(
					this.widthInput.value / this.#aspectRatio,
				);
		});
		this.heightInput.addEventListener('input', () => {
			if (this.lock.checked)
				this.widthInput.value = Math.round(
					this.heightInput.value * this.#aspectRatio,
				);
		});
		this.cancelBtn.addEventListener(
			'click',
			() => (this.modal.style.display = 'none'),
		);
		this.confirmBtn.addEventListener('click', () => {
			const w = parseInt(this.widthInput.value);
			const h = parseInt(this.heightInput.value);
			this.#confirmCallback?.(w, h);
			this.modal.style.display = 'none';
		});
	}

	open(initW, initH, callback, maintainAspect = true) {
		this.widthInput.value = initW;
		this.heightInput.value = initH;
		this.lock.checked = maintainAspect;
		this.#aspectRatio = initW / initH;
		this.#confirmCallback = callback;
		this.modal.style.display = 'flex';
	}
}
