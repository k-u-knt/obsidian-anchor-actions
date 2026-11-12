import assert from 'node:assert/strict';
import { DEFAULTS, mergeSettings, resolveStrip, addItem, moveItem, removeItem } from '../src/strip';

let n = 0;
function t(name: string, fn: () => void) { fn(); n++; console.log('ok -', name); }
const ids = (xs: { id: string }[]) => xs.map(x => x.id);

t('mergeSettings keeps unknown keys from older versions', () => {
	const links = { a: 1 }, actions = { reminder: {} }, enabled = { x: true };
	const s = mergeSettings({ links, actions, enabled, barGap: 40 });
	assert.equal(s.barGap, 40);
	assert.equal(s.showSelectionBar, true);
	assert.deepEqual(s.commands, []);
	assert.deepEqual(s.links, { a: 1 });
	assert.deepEqual(s.actions, { reminder: {} });
	assert.deepEqual(s.enabled, { x: true });
});

t('mergeSettings(null) gives the defaults', () => {
	assert.deepEqual(mergeSettings(null), DEFAULTS);
	assert.deepEqual(DEFAULTS, { showSelectionBar: true, barGap: 30, commands: [] });
});

t('mergeSettings does not share the default commands array', () => {
	const s = mergeSettings(undefined);
	s.commands.push({ id: 'x' });
	assert.deepEqual(DEFAULTS.commands, []);
});

t('mergeSettings drops malformed command entries', () => {
	const s = mergeSettings({ commands: [{ id: 'a' }, 'b', null, { id: 'c', icon: 'star' }, { icon: 'x' }] });
	assert.deepEqual(s.commands, [{ id: 'a' }, { id: 'c', icon: 'star' }]);
	assert.deepEqual(mergeSettings({ commands: 'oops' }).commands, []);
});

t('resolveStrip splits present and missing, with icon overrides', () => {
	const r = resolveStrip([{ id: 'a' }, { id: 'gone' }, { id: 'b', icon: 'star' }], { a: { name: 'A', icon: 'link' }, b: { name: 'B' } });
	assert.deepEqual(r.present, [{ id: 'a', name: 'A', icon: 'link' }, { id: 'b', name: 'B', icon: 'star' }]);
	assert.deepEqual(r.missing, ['gone']);
});

t('resolveStrip falls back to square-terminal', () => {
	const r = resolveStrip([{ id: 'b' }], { b: { name: 'B' } });
	assert.deepEqual(r.present, [{ id: 'b', name: 'B', icon: 'square-terminal' }]);
	assert.deepEqual(r.missing, []);
});

t('addItem appends without duplicates', () => {
	assert.equal(addItem([{ id: 'a' }], 'a').length, 1);
	assert.deepEqual(ids(addItem([{ id: 'a' }], 'b')), ['a', 'b']);
});

t('moveItem reorders and ignores out-of-range', () => {
	const xs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
	assert.deepEqual(ids(moveItem(xs, 2, 0)), ['c', 'a', 'b']);
	assert.deepEqual(ids(xs), ['a', 'b', 'c']);
	const same = moveItem(xs, 0, 3);
	assert.deepEqual(ids(same), ['a', 'b', 'c']);
	assert.notEqual(same, xs);
	assert.deepEqual(ids(moveItem(xs, -1, 1)), ['a', 'b', 'c']);
});

t('removeItem removes only the matching id', () => {
	assert.deepEqual(ids(removeItem([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'b')), ['a', 'c']);
	assert.deepEqual(ids(removeItem([{ id: 'a' }], 'z')), ['a']);
});

console.log(`\n${n} tests passed`);
