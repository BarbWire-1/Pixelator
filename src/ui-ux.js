// TODO refactor
(function initSidebarUI() {

	document.querySelectorAll(".sidebar-section").forEach((section) => {
		const header = section.querySelector("h3");
		let isDragging = false;
		let offsetX, offsetY;
		let startX, startY;

		header.style.cursor = "grab";

		header.addEventListener("mousedown", (e) => {
			e.preventDefault();
			isDragging = false;
			startX = e.clientX;
			startY = e.clientY;

			const rect = section.getBoundingClientRect();
			offsetX = e.clientX - rect.left;
			offsetY = e.clientY - rect.top;

		
			section.style.zIndex = 2000; // above sidebar

			const onMouseMove = (eMove) => {
				const dx = eMove.clientX - startX;
				const dy = eMove.clientY - startY;

				if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
					isDragging = true;

					section.classList.add("floating");
					section.style.position = "absolute";
					section.style.width = rect.width + "px";
					document.body.appendChild(section);
				}

				if (isDragging) {
					section.style.left = eMove.clientX - offsetX + "px";
					section.style.top = eMove.clientY - offsetY + "px";
				}
			};

			const onMouseUp = (eUp) => {
				document.removeEventListener("mousemove", onMouseMove);
				document.removeEventListener("mouseup", onMouseUp);

				if (isDragging) {
					section.style.zIndex = "";

					const sidebar = document.getElementById("sidebar");
					const sidebarRect = sidebar.getBoundingClientRect();
					const sectionRect = section.getBoundingClientRect();
					const snapMargin = 50;

					const overlapX =
						sectionRect.right > sidebarRect.left - snapMargin &&
						sectionRect.left < sidebarRect.right + snapMargin;
					const overlapY =
						sectionRect.bottom > sidebarRect.top - snapMargin &&
						sectionRect.top < sidebarRect.bottom + snapMargin;

					if (overlapX && overlapY) {
						// Find closest sidebar section
						const sections = Array.from(sidebar.querySelectorAll(".sidebar-section"))
							.filter((s) => s !== section);

						let closest = null;
						let minDistance = Infinity;

						sections.forEach((s) => {
							const r = s.getBoundingClientRect();
							const distance = Math.abs(eUp.clientY - (r.top + r.height / 2));
							if (distance < minDistance) {
								minDistance = distance;
								closest = s;
							}
						});

						if (closest) {
							if (eUp.clientY < closest.getBoundingClientRect().top + closest.offsetHeight / 2) {
								sidebar.insertBefore(section, closest);
							} else {
								sidebar.insertBefore(section, closest.nextSibling);
							}
						} else {
							sidebar.appendChild(section);
						}

						section.classList.remove("floating");
						section.style.position = "";
						section.style.left = "";
						section.style.top = "";
						section.style.width = "";
					}
				} else {
					// This was a click, not a drag → toggle collapse
					section.classList.toggle("collapsed");
				}
			};

			document.addEventListener("mousemove", onMouseMove);
			document.addEventListener("mouseup", onMouseUp);
		});
	});

})();
