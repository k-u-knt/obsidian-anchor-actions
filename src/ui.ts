import { setIcon, MarkdownView, Menu } from 'obsidian';
import { ViewPlugin, EditorView, ViewUpdate } from '@codemirror/view';
import type AnchorActionsPlugin from './main';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The canvas object behind a canvas view (internal API, so guarded). */
export function getCanvas(leafOrView: any): any | null {
	const view = leafOrView?.view ?? leafOrView;
	return view?.getViewType?.() === 'canvas' ? view.canvas ?? null : null;
}

interface ButtonSpec { label: string; icon: string; onClick: () => void; onContextMenu?: (e: MouseEvent) => void }

function makeButton(parent: HTMLElement, spec: ButtonSpec, cls: string) {
	const b = parent.createEl('button', { cls: `clickable-icon ${cls}`, attr: { 'aria-label': spec.label, 'data-tooltip-position': 'left', type: 'button' } });
	setIcon(b, spec.icon);
	// keep the selection (and editor focus) alive, so the command still sees it
	b.addEventListener('mousedown', e => e.preventDefault());
	b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); spec.onClick(); });
	if (spec.onContextMenu) {
		const handler = spec.onContextMenu;
		b.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); handler(e); });
	}
	return b;
}

/**
 * One button per runnable strip command, in order, then "+".
 * `hide` runs before the command, so the strip is gone when the command opens anything.
 */
function fillStrip(plugin: AnchorActionsPlugin, parent: HTMLElement, cls: string, hide: () => void) {
	for (const c of plugin.stripButtons()) {
		makeButton(parent, {
			label: c.name,
			icon: c.icon,
			onClick: () => { hide(); plugin.runFromStrip(c.id); },
			onContextMenu: e => {
				const menu = new Menu();
				menu.addItem(i => i.setTitle('Remove from strip').setIcon('trash-2').onClick(() => { hide(); void plugin.removeFromStrip(c.id); }));
				menu.showAtMouseEvent(e);
			},
		}, cls);
	}
	makeButton(parent, {
		label: 'Add a command to this strip',
		icon: 'plus',
		onClick: () => { hide(); plugin.openPicker(); },
	}, `${cls} anchor-actions-add`);
}

/**
 * Floating vertical icon strip in the left margin, level with the first
 * selected line (the formatting toolbar keeps the space above the selection).
 */
export function selectionBarExtension(plugin: AnchorActionsPlugin) {
	return ViewPlugin.fromClass(class {
		bar: HTMLElement | null = null;
		barVersion = -1;
		dragging = false;
		frame = 0;
		private down = (e: PointerEvent) => { if (!this.bar?.contains(e.target as Node)) { this.dragging = true; this.hide(); } };
		private up = () => { if (this.dragging) { this.dragging = false; this.schedule(); } };
		private onScroll = () => this.schedule();

		constructor(readonly view: EditorView) {
			view.dom.addEventListener('pointerdown', this.down);
			view.dom.ownerDocument.addEventListener('pointerup', this.up);
			view.scrollDOM.addEventListener('scroll', this.onScroll, { passive: true });
		}

		update(u: ViewUpdate) {
			if (u.selectionSet || u.docChanged || u.geometryChanged || u.focusChanged || u.viewportChanged) this.schedule();
		}

		schedule() {
			cancelAnimationFrame(this.frame);
			this.frame = requestAnimationFrame(() => this.render());
		}

		hide() { this.bar?.remove(); this.bar = null; }

		render() {
			const v = this.view;
			const sel = v.state.selection.main;
			if (!plugin.settings.showSelectionBar || sel.empty || this.dragging || !v.hasFocus) return this.hide();
			const coords = v.coordsAtPos(sel.from, 1) ?? v.coordsAtPos(sel.from);
			if (!coords) return this.hide();

			if (this.bar && this.barVersion !== plugin.stripVersion) this.hide();   // strip edited meanwhile
			if (!this.bar) {
				this.bar = v.dom.ownerDocument.body.createDiv({ cls: 'anchor-actions-bar' });
				this.barVersion = plugin.stripVersion;
				fillStrip(plugin, this.bar, 'anchor-actions-btn', () => this.hide());
			}
			const scroller = v.scrollDOM.getBoundingClientRect();
			const content = v.contentDOM.getBoundingClientRect();
			const barRect = this.bar.getBoundingClientRect();
			const lineHeight = Math.max(coords.bottom - coords.top, 16);
			let top = coords.top + lineHeight / 2 - 14;
			// selection start scrolled out of view: pin to the top of the pane
			top = Math.max(scroller.top + 6, Math.min(top, scroller.bottom - barRect.height - 6));
			let left = content.left - barRect.width - plugin.settings.barGap;
			left = Math.max(scroller.left + 4, left);
			this.bar.style.top = `${Math.round(top)}px`;
			this.bar.style.left = `${Math.round(left)}px`;
		}

		destroy() {
			cancelAnimationFrame(this.frame);
			this.view.dom.removeEventListener('pointerdown', this.down);
			this.view.dom.ownerDocument.removeEventListener('pointerup', this.up);
			this.view.scrollDOM.removeEventListener('scroll', this.onScroll);
			this.hide();
		}
	});
}

/**
 * Reading view: the same strip, driven by the DOM selection
 * (there is no CodeMirror editor in Reading view).
 */
export class ReadingSelectionBar {
	private bar: HTMLElement | null = null;
	private barVersion = -1;
	private frame = 0;
	private dragging = false;

	constructor(private plugin: AnchorActionsPlugin) {}

	/** wire up with plugin.registerDomEvent so everything is removed on unload */
	attach(doc: Document) {
		this.plugin.registerDomEvent(doc, 'selectionchange', () => this.schedule());
		this.plugin.registerDomEvent(doc, 'pointerdown', e => {
			if (this.bar?.contains(e.target as Node)) return;
			this.dragging = true; this.hide();
		});
		this.plugin.registerDomEvent(doc, 'pointerup', () => { if (this.dragging) { this.dragging = false; this.schedule(); } });
		this.plugin.registerDomEvent(doc, 'scroll', () => { if (this.bar) this.schedule(); }, { capture: true, passive: true });
	}

	schedule() {
		cancelAnimationFrame(this.frame);
		this.frame = requestAnimationFrame(() => this.render());
	}

	hide() { this.bar?.remove(); this.bar = null; }

	/** The active note's rendered preview element, when it is in Reading view. */
	private previewEl(): HTMLElement | null {
		const v = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!v || v.getMode() !== 'preview') return null;
		const root: HTMLElement | undefined = (v as any).previewMode?.containerEl;
		const el = root?.classList.contains('markdown-preview-view') ? root : (root ?? v.contentEl).querySelector('.markdown-preview-view');
		return (el as HTMLElement | null) ?? null;
	}

	/** A non-empty selection inside the preview, but not inside the Properties box. */
	private selectedRange(preview: HTMLElement): Range | null {
		const sel = window.getSelection();
		if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
		const range = sel.getRangeAt(0);
		const inside = (n: Node | null) => {
			if (!n || !preview.contains(n)) return false;
			const el = n instanceof Element ? n : n.parentElement;
			return !el?.closest('.metadata-container');
		};
		return inside(sel.anchorNode) && inside(sel.focusNode) ? range : null;
	}

	private render() {
		const preview = this.previewEl();
		const range = preview ? this.selectedRange(preview) : null;
		if (!preview || !range || this.dragging || !this.plugin.settings.showSelectionBar) return this.hide();
		const rects = range.getClientRects();
		const r = rects.length ? rects[0] : range.getBoundingClientRect();
		if (!r || (!r.width && !r.height)) return this.hide();

		if (this.bar && this.barVersion !== this.plugin.stripVersion) this.hide();
		if (!this.bar) {
			this.bar = document.body.createDiv({ cls: 'anchor-actions-bar' });
			this.barVersion = this.plugin.stripVersion;
			fillStrip(this.plugin, this.bar, 'anchor-actions-btn', () => this.hide());
		}
		const scroller = preview.getBoundingClientRect();
		const sizer = preview.querySelector('.markdown-preview-sizer') as HTMLElement | null;
		const contentLeft = (sizer ?? preview).getBoundingClientRect().left;
		const barRect = this.bar.getBoundingClientRect();
		let top = r.top + Math.max(r.height, 16) / 2 - 14;
		top = Math.max(scroller.top + 6, Math.min(top, scroller.bottom - barRect.height - 6));
		const left = Math.max(scroller.left + 4, contentLeft - barRect.width - this.plugin.settings.barGap);
		this.bar.style.top = `${Math.round(top)}px`;
		this.bar.style.left = `${Math.round(left)}px`;
	}

	unload() { cancelAnimationFrame(this.frame); this.hide(); }
}

/**
 * Canvas: add the strip's icons to the canvas's own floating selection menu
 * (the bar that appears above selected cards). Internal DOM, so guarded.
 */
export class CanvasMenuPatcher {
	private observers = new Map<HTMLElement, MutationObserver>();

	constructor(private plugin: AnchorActionsPlugin) {}

	scan() {
		for (const [root, obs] of this.observers) {
			if (!root.isConnected) { obs.disconnect(); this.observers.delete(root); }
		}
		this.plugin.app.workspace.iterateAllLeaves(leaf => {
			const view: any = leaf.view;
			if (!getCanvas(view)) return;
			const root: HTMLElement = view.containerEl;
			if (this.observers.has(root)) return;
			let pending = 0;
			const obs = new MutationObserver(() => {
				cancelAnimationFrame(pending);
				pending = requestAnimationFrame(() => this.ensure(view));
			});
			obs.observe(root, { childList: true, subtree: true });
			this.observers.set(root, obs);
			this.ensure(view);
		});
	}

	private ensure(view: any) {
		const menu: HTMLElement | null = view.containerEl?.querySelector('.canvas-menu') ?? null;
		const canvas = getCanvas(view);
		if (!menu || !canvas || !canvas.selection?.size) return;
		if (menu.querySelector('.anchor-actions-canvas-btn')) return;
		menu.createDiv({ cls: 'anchor-actions-canvas-sep' });
		// the canvas menu stays open after a click; Obsidian redraws it when the selection changes
		fillStrip(this.plugin, menu, 'anchor-actions-canvas-btn', () => {});
	}

	private clear() {
		document.querySelectorAll('.anchor-actions-canvas-btn, .anchor-actions-canvas-sep').forEach(el => el.remove());
	}

	refresh() {
		// re-render buttons after the strip changed
		// (removing them also wakes each canvas's observer, which redraws them)
		this.clear();
		this.scan();
	}

	unload() {
		this.observers.forEach(o => o.disconnect());
		this.observers.clear();
		this.clear();
	}
}
