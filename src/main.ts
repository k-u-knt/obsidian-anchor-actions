import { App, Menu, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { ActionsSettings, FALLBACK_ICON, addItem, mergeSettings, moveItem, removeItem, resolveStrip, setItemIcon } from './strip';
import { allCommands, isRunnable, run } from './commands';
import { selectionBarExtension, CanvasMenuPatcher, ReadingSelectionBar, getCanvas } from './ui';
import { CommandPickerModal, IconPickerModal } from './picker';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default class AnchorActionsPlugin extends Plugin {
	settings!: ActionsSettings;
	/** bumped whenever the strip's commands change, so open strips rebuild */
	stripVersion = 0;
	private canvasPatcher!: CanvasMenuPatcher;
	private readingBar!: ReadingSelectionBar;

	async onload() {
		this.settings = mergeSettings(await this.loadData());

		this.registerEditorExtension(selectionBarExtension(this));

		this.readingBar = new ReadingSelectionBar(this);
		this.readingBar.attach(document);
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.readingBar.schedule()));
		this.register(() => this.readingBar.unload());

		this.canvasPatcher = new CanvasMenuPatcher(this);
		this.app.workspace.onLayoutReady(() => this.canvasPatcher.scan());
		this.registerEvent(this.app.workspace.on('layout-change', () => this.canvasPatcher.scan()));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.canvasPatcher.scan()));

		this.addCommand({
			id: 'add-command',
			name: 'Add a command to the selection strip',
			icon: 'plus',
			callback: () => this.openPicker(),
		});

		this.registerEvent(this.app.workspace.on('editor-menu', (menu: Menu) => this.addMenuItems(menu)));
		const canvasMenu = (menu: Menu) => {
			if (getCanvas(this.app.workspace.getMostRecentLeaf()?.view)) this.addMenuItems(menu);
		};
		this.registerEvent((this.app.workspace as any).on('canvas:node-menu', canvasMenu));
		this.registerEvent((this.app.workspace as any).on('canvas:selection-menu', canvasMenu));

		this.addSettingTab(new AnchorSettingTab(this.app, this));
	}

	onunload() {
		this.canvasPatcher?.unload();
	}

	/** Strip commands that exist and can run right now, in strip order. */
	stripButtons(): { id: string; name: string; icon: string }[] {
		return resolveStrip(this.settings.commands, allCommands(this.app)).present.filter(c => isRunnable(this.app, c.id));
	}

	runFromStrip(id: string) {
		run(this.app, id);
	}

	/** Command ids the picker should not offer: already on the strip, or this plugin's own. */
	private isExcluded = (id: string) => id.startsWith(`${this.manifest.id}:`) || this.settings.commands.some(c => c.id === id);

	openPicker(onAdded?: () => void) {
		new CommandPickerModal(this.app, this.isExcluded, async id => {
			this.settings.commands = addItem(this.settings.commands, id);
			await this.saveSettings();
			onAdded?.();
		}).open();
	}

	async removeFromStrip(id: string) {
		this.settings.commands = removeItem(this.settings.commands, id);
		await this.saveSettings();
	}

	/** True when the user has set their own icon for this strip command. */
	hasCustomIcon(id: string): boolean {
		return !!this.settings.commands.find(c => c.id === id)?.icon;
	}

	/** The icon the command's plugin gave it, or the fallback. */
	defaultIcon(id: string): string {
		return allCommands(this.app)[id]?.icon || FALLBACK_ICON;
	}

	/** Pass undefined to go back to the command's own icon. */
	async setStripIcon(id: string, icon: string | undefined) {
		this.settings.commands = setItemIcon(this.settings.commands, id, icon);
		await this.saveSettings();
	}

	openIconPicker(id: string, onPicked?: () => void) {
		const name = allCommands(this.app)[id]?.name ?? id;
		new IconPickerModal(this.app, name, async icon => {
			await this.setStripIcon(id, icon);
			onPicked?.();
		}).open();
	}

	private addMenuItems(menu: Menu) {
		for (const c of this.stripButtons()) {
			menu.addItem(i => i.setTitle(c.name).setIcon(c.icon).setSection('action').onClick(() => run(this.app, c.id)));
		}
	}

	/** Saves the whole object, so keys written by other versions survive. */
	async saveSettings() {
		await this.saveData(this.settings);
		this.stripVersion++;
		this.readingBar?.hide();
		this.canvasPatcher?.refresh();
	}
}

class AnchorSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: AnchorActionsPlugin) { super(app, plugin); }

	display() {
		const { containerEl } = this;
		const s = this.plugin.settings;
		const save = () => this.plugin.saveSettings();
		containerEl.empty();

		new Setting(containerEl).setName('Show icons when text is selected')
			.setDesc('A small vertical strip in the left margin, next to the first selected line.')
			.addToggle(t => t.setValue(s.showSelectionBar).onChange(async v => { s.showSelectionBar = v; await save(); }));
		new Setting(containerEl).setName('Distance from text (px)')
			.setDesc('Increase if the icons overlap fold arrows.')
			.addSlider(sl => sl.setLimits(8, 80, 2).setValue(s.barGap).setDynamicTooltip()
				.onChange(async v => { s.barGap = v; await save(); }));

		new Setting(containerEl).setName('Strip commands').setHeading()
			.setDesc('Shown in this order. A command whose plugin is turned off is kept here as missing and comes back when the plugin does.');

		const known = allCommands(this.plugin.app);
		const items = s.commands;
		items.forEach((item, i) => {
			const cmd = known[item.id];
			const row = new Setting(containerEl)
				.setName(cmd ? cmd.name : `(missing) ${item.id}`)
				.setDesc(item.id);
			row.addExtraButton(b => b.setIcon('arrow-up').setTooltip('Move up').setDisabled(i === 0)
				.onClick(async () => { s.commands = moveItem(s.commands, i, i - 1); await save(); this.display(); }));
			row.addExtraButton(b => b.setIcon('arrow-down').setTooltip('Move down').setDisabled(i === items.length - 1)
				.onClick(async () => { s.commands = moveItem(s.commands, i, i + 1); await save(); this.display(); }));
			const current = item.icon || cmd?.icon || FALLBACK_ICON;
			row.addExtraButton(b => b.setIcon(current)
				.setTooltip(item.icon ? `Icon: ${item.icon} (yours). Click to change.` : `Icon: ${current} (default). Click to change.`)
				.onClick(() => this.plugin.openIconPicker(item.id, () => this.display())));
			if (item.icon) {
				row.addExtraButton(b => b.setIcon('rotate-ccw').setTooltip('Use default icon')
					.onClick(async () => { await this.plugin.setStripIcon(item.id, undefined); this.display(); }));
			}
			row.addExtraButton(b => b.setIcon('x').setTooltip('Remove from strip')
				.onClick(async () => { s.commands = removeItem(s.commands, item.id); await save(); this.display(); }));
		});

		new Setting(containerEl)
			.setDesc('Click a command\'s icon to pick a different one.')
			.addButton(b => b.setButtonText('Add command').setCta().onClick(() => this.plugin.openPicker(() => this.display())));
	}
}
