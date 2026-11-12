import { App, Command, MarkdownView } from 'obsidian';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Obsidian's command registry (internal, so every access is guarded). */
function registry(app: App): Record<string, Command> {
	const cmds = (app as any).commands?.commands;
	return cmds && typeof cmds === 'object' ? cmds : {};
}

/** Every command-palette command: id → name and icon. */
export function allCommands(app: App): Record<string, { name: string; icon?: string }> {
	const out: Record<string, { name: string; icon?: string }> = Object.create(null);
	for (const [id, c] of Object.entries(registry(app))) {
		if (!c) continue;
		out[id] = { name: typeof c.name === 'string' ? c.name : id, icon: typeof c.icon === 'string' ? c.icon : undefined };
	}
	return out;
}

/**
 * Would the command run right now? Asks the command's own check where it has one.
 * Unknown ids are not runnable; a check that throws counts as runnable
 * (running it will report the problem better than hiding it would).
 */
export function isRunnable(app: App, id: string): boolean {
	const reg = registry(app);
	const c = Object.prototype.hasOwnProperty.call(reg, id) ? reg[id] : undefined;
	if (!c) return false;
	try {
		if (typeof c.checkCallback === 'function') return !!c.checkCallback(true);
		// Editor commands only make sense with an editable editor: Source or Live Preview
		// (both report 'source'). In Reading view the editor still exists but is hidden,
		// so these commands must not show.
		if (typeof c.editorCheckCallback === 'function') {
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			if (!view?.editor || view.getMode() !== 'source') return false;
			return !!c.editorCheckCallback(true, view.editor, view);
		}
		if (typeof c.editorCallback === 'function') {
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			return !!view && view.getMode() === 'source';
		}
		return true;
	} catch {
		return true;
	}
}

export function run(app: App, id: string): void {
	try {
		(app as any).commands?.executeCommandById?.(id);
	} catch (e) {
		console.error('[anchor-actions]', id, e);
	}
}
