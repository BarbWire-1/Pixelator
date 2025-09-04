/** @format */

(() => {
	const resizer = document.getElementById('resizer');
	const sidebar = document.getElementById('sidebar');
	let isResizing = false;

	if (!resizer || !sidebar) return;

	resizer.addEventListener('mousedown', () => {
		isResizing = true;
		document.body.style.cursor = 'col-resize';
	});

	document.addEventListener('mousemove', e => {
		if (!isResizing) return;
		const newWidth = Math.min(
			Math.max(50, window.innerWidth - e.clientX),
			1000,
		);
		sidebar.style.width = newWidth + 'px';
	});

	document.addEventListener('mouseup', () => {
		if (!isResizing) return;
		isResizing = false;
		document.body.style.cursor = '';
	});
})();
