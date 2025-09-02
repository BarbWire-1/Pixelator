
(function initSidebarUI() {
	const GRID_SIZE = 20;

	// --- Section data class ---
	class SectionBox {
		constructor (el) {
			this.el = el;
			const r = el.getBoundingClientRect();
			this.x = r.left;
			this.y = r.top;
			this.w = r.width;
			this.h = r.height;
		}

		updateFromDOM() {
			const r = this.el.getBoundingClientRect();
			this.x = r.left;
			this.y = r.top;
			this.w = r.width;
			this.h = r.height;
		}

		applyPosition() {
			this.el.style.left = this.x + "px";
			this.el.style.top = this.y + "px";
		}
	}

	// --- Central behavior logic ---
	const isOverlapping = (a, b) =>
		a.x < b.x + b.w &&
		a.x + a.w > b.x &&
		a.y < b.y + b.h &&
		a.y + a.h > b.y;

	const snapBackToSidebar = (section, sidebar, mouseY, sections) => {
		let closest = null;
		let minDist = Infinity;

		for (let s of sections) {
			if (s === section) continue;
			const dist = Math.abs(mouseY - (s.y + s.h / 2));
			if (dist < minDist) {
				minDist = dist;
				closest = s;
			}
		}

		if (closest) {
			if (mouseY < closest.y + closest.h / 2) {
				sidebar.insertBefore(section.el, closest.el);
			} else {
				sidebar.insertBefore(section.el, closest.el.nextSibling);
			}
		} else {
			sidebar.appendChild(section.el);
		}

		section.el.classList.remove("floating");
		section.el.classList.add("snapped");
		section.el.style=""
		
	};

	const resolveFloatingOverlap = (section, others) => {
		let collision = true;
		while (collision) {
			collision = false;
			for (let other of others) {
				if (other === section) continue;
				if (isOverlapping(section, other)) {
					section.y += GRID_SIZE;
					collision = true;
					break;
				}
			}
		}
	};

	// --- Initialize sections ---
	const sections = [];
	document.querySelectorAll(".sidebar-section").forEach((el) => {
		const section = new SectionBox(el);
		sections.push(section);

		const header = el.querySelector("h3");
		header.style.cursor = "grab";

		header.addEventListener("mousedown", (e) => {
			e.preventDefault();
			let isDragging = false;
			const startX = e.clientX;
			const startY = e.clientY;

			section.updateFromDOM();
			const offsetX = e.clientX - section.x;
			const offsetY = e.clientY - section.y;

			el.style.zIndex = 2000;

			const onMouseMove = (eMove) => {
				const dx = eMove.clientX - startX;
				const dy = eMove.clientY - startY;

				if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
					isDragging = true;
					el.classList.remove("floating");
					el.classList.add("floating");
					el.style.position = "absolute";
					document.body.appendChild(el);
				}

				if (isDragging) {
					section.x = eMove.clientX - offsetX;
					section.y = eMove.clientY - offsetY;
					section.applyPosition();
				}
			};

			const onMouseUp = (eUp) => {
				document.removeEventListener("mousemove", onMouseMove);
				document.removeEventListener("mouseup", onMouseUp);

				if (isDragging) {
					el.style.zIndex = "";
					const sidebar = document.getElementById("sidebar");
					section.updateFromDOM();

					const { left, top, width, height } = sidebar.getBoundingClientRect();
					const sidebarBox = { x: left, y: top, w: width, h: height };

					if (isOverlapping(section, sidebarBox)) {
						const sidebarSections = Array.from(sidebar.querySelectorAll(".sidebar-section"))
							.map((el) => sections.find((s) => s.el === el));
						snapBackToSidebar(section, sidebar, eUp.clientY, sidebarSections);
					} else {
						// floating on grid
						section.x = Math.round(section.x / GRID_SIZE) * GRID_SIZE;
						section.y = Math.round(section.y / GRID_SIZE) * GRID_SIZE;

						const floatingSections = sections.filter(s => s.el.classList.contains("floating") && s !== section);
						resolveFloatingOverlap(section, floatingSections);
						section.applyPosition();
					}
				} else {
					el.classList.toggle("collapsed");
				}
			};

			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		});
	});
})();
