import { App, FuzzySuggestModal } from 'obsidian';
import { allCommands } from './commands';

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
