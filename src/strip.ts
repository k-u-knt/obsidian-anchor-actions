/**
 * Pure strip logic: settings shape, merging, and list edits.
 * No Obsidian imports, so it runs under plain node in the tests.
 */

/** One strip entry: a command id, with an optional icon that overrides the command's own. */
export interface StripItem { id: string; icon?: string }

export interface ActionsSettings {
	showSelectionBar: boolean;
	barGap: number;            // px between strip and text
	commands: StripItem[];     // in strip order
	[k: string]: unknown;      // keys written by other versions are kept as they are
}

export const DEFAULTS: ActionsSettings = { showSelectionBar: true, barGap: 30, commands: [] };

export const FALLBACK_ICON = 'square-terminal';

function isItem(x: unknown): x is StripItem {
	return !!x && typeof x === 'object' && typeof (x as StripItem).id === 'string' && !!(x as StripItem).id;
}

/** Saved data → settings. Every key we don't know about is kept, so saving never drops it. */
export function mergeSettings(loaded: unknown): ActionsSettings {
	const d = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? (loaded as Record<string, unknown>) : {};
	const commands = Array.isArray(d.commands)
		? d.commands.filter(isItem).map(c => (typeof c.icon === 'string' && c.icon ? { id: c.id, icon: c.icon } : { id: c.id }))
		: [];
	return {
		...d,
		showSelectionBar: typeof d.showSelectionBar === 'boolean' ? d.showSelectionBar : DEFAULTS.showSelectionBar,
		barGap: typeof d.barGap === 'number' && Number.isFinite(d.barGap) ? d.barGap : DEFAULTS.barGap,
		commands,
	};
}

/** Match strip items against the command registry. Unknown ids are reported, not dropped. */
export function resolveStrip(
	items: StripItem[],
	known: Record<string, { name: string; icon?: string }>,
): { present: { id: string; name: string; icon: string }[]; missing: string[] } {
	const present: { id: string; name: string; icon: string }[] = [];
	const missing: string[] = [];
	for (const it of items) {
		const cmd = Object.prototype.hasOwnProperty.call(known, it.id) ? known[it.id] : undefined;
		if (!cmd) { missing.push(it.id); continue; }
		present.push({ id: it.id, name: cmd.name, icon: it.icon || cmd.icon || FALLBACK_ICON });
	}
	return { present, missing };
}

export function addItem(items: StripItem[], id: string): StripItem[] {
	return items.some(i => i.id === id) ? [...items] : [...items, { id }];
}

export function moveItem(items: StripItem[], from: number, to: number): StripItem[] {
	const out = [...items];
	const ok = (i: number) => Number.isInteger(i) && i >= 0 && i < out.length;
	if (!ok(from) || !ok(to)) return out;
	const [x] = out.splice(from, 1);
	out.splice(to, 0, x);
	return out;
}

export function removeItem(items: StripItem[], id: string): StripItem[] {
	return items.filter(i => i.id !== id);
}

/** Set (or, with an empty icon, clear) one item's icon override. */
export function setItemIcon(items: StripItem[], id: string, icon: string | undefined): StripItem[] {
	const v = icon?.trim();
	return items.map(i => (i.id !== id ? i : v ? { id: i.id, icon: v } : { id: i.id }));
}

/** An icon id as people read it: Obsidian lists Lucide icons as "lucide-<name>". */
export function iconName(id: string): string {
	return id.startsWith('lucide-') ? id.slice('lucide-'.length) : id;
}
