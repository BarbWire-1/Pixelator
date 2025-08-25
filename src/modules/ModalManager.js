// ModalManager.js
export class DimensionModal {
	constructor (modalId, widthId, heightId, lockId, cancelId, confirmId) {
		this.modal = document.getElementById(modalId);
		this.widthInput = document.getElementById(widthId);
		this.heightInput = document.getElementById(heightId);
		this.lock = document.getElementById(lockId);
		this.cancelBtn = document.getElementById(cancelId);
		this.confirmBtn = document.getElementById(confirmId);

		this._aspectRatio = 1;
		this._confirmCallback = null;

		// attach listeners once
		this.widthInput.addEventListener("input", () => {
			if (this.lock.checked) this.heightInput.value = Math.round(this.widthInput.value / this._aspectRatio);
		});
		this.heightInput.addEventListener("input", () => {
			if (this.lock.checked) this.widthInput.value = Math.round(this.heightInput.value * this._aspectRatio);
		});
		this.cancelBtn.addEventListener("click", () => this.modal.style.display = "none");
		this.confirmBtn.addEventListener("click", () => {
			const w = parseInt(this.widthInput.value);
			const h = parseInt(this.heightInput.value);
			this._confirmCallback?.(w, h);
			this.modal.style.display = "none";
		});
	}

	open(initialWidth, initialHeight, callback, maintainAspect = true) {
		this.widthInput.value = initialWidth;
		this.heightInput.value = initialHeight;
		this.lock.checked = maintainAspect;
		this._aspectRatio = initialWidth / initialHeight;
		this._confirmCallback = callback;
		this.modal.style.display = "flex";
	}
}
