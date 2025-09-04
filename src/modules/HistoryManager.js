/**
 * /*
 * MIT License
 * Copyright(c) 2025 Barbara Kälin aka BarbWire - 1
 *
 * @format
 */

window.DEBUG = false;

export function debug(...args) {
	if (!DEBUG) return;
	console.log('[DEBUG]', ...args);
}

export class HistoryManager {
	constructor(limit = 50) {
		this.limit = limit;
		this.stack = [];
		this.index = -1; // -1 means "no current state yet"
		debug('HistoryManager initialized, limit:', limit);
	}

	push(state) {
		// If we undid some steps, drop all "future" states
		if (this.index < this.stack.length - 1) {
			this.stack = this.stack.slice(0, this.index + 1);
			debug('Redo states cleared');
		}

		this.stack.push(state);

		// Enforce limit
		if (this.stack.length > this.limit) {
			this.stack.shift();
			if (this.index > 0) this.index--;
		} else {
			this.index++;
		}

		debug(
			'State pushed',
			'index:',
			this.index,
			'stack length:',
			this.stack.length,
			'desc:',
			state.desc || '<no description>',
		);
	}

	undo() {
		if (this.canUndo()) {
			this.index--;
			const state = this.stack[this.index];
			debug(
				'Undo -> index:',
				this.index,
				'desc:',
				state.desc || '<no description>',
			);
			return state;
		}
		debug('Undo not possible');
		return null;
	}

	redo() {
		if (this.canRedo()) {
			this.index++;
			const state = this.stack[this.index];
			debug(
				'Redo -> index:',
				this.index,
				'desc:',
				state.desc || '<no description>',
			);
			return state;
		}
		debug('Redo not possible');
		return null;
	}

	canUndo() {
		return this.index > 0;
	}

	canRedo() {
		return this.index < this.stack.length - 1;
	}

	current() {
		return this.stack[this.index] || null;
	}
}
