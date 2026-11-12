import { App, FuzzyMatch, FuzzySuggestModal, getIconIds, setIcon } from 'obsidian';
import { allCommands } from './commands';
import { iconName } from './strip';

interface Choice { id: string; name: string }

/** Pick any command-palette command to add to the strip. */
export class CommandPickerModal extends FuzzySuggestModal<Choice> {
	constructor(app: App, private exclude: (id: string) => boolean, private onPick: (id: string) => void) {
		super(app);
		this.setPlaceholder('Pick a command to add to the selection strip');
	}

	getItems(): Choice[] {
		return Object.entries(allCommands(this.app))
			.filter(([id]) => !this.exclude(id))
			.map(([id, c]) => ({ id, name: c.name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	getItemText(c: Choice): string { return c.name; }

	onChooseItem(c: Choice): void { this.onPick(c.id); }
}

/** Search Obsidian's Lucide icons by name, with each icon drawn beside its name. */
export class IconPickerModal extends FuzzySuggestModal<string> {
	constructor(app: App, commandName: string, private onPick: (icon: string) => void) {
		super(app);
		this.setPlaceholder(`Pick an icon for "${commandName}"`);
	}

	getItems(): string[] {
		const ids = getIconIds();
		const lucide = ids.filter(id => id.startsWith('lucide-'));
		return [...new Set((lucide.length ? lucide : ids).map(iconName))].sort();
	}

	getItemText(name: string): string { return name.replace(/-/g, ' '); }

	renderSuggestion(m: FuzzyMatch<string>, el: HTMLElement): void {
		el.addClass('anchor-actions-icon-choice');
		setIcon(el.createSpan({ cls: 'anchor-actions-icon-preview' }), m.item);
		el.createSpan({ text: m.item });
	}

	onChooseItem(name: string): void { this.onPick(name); }
}
