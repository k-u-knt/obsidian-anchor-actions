# Anchor Actions

An Obsidian plugin that puts a small strip of icons next to whatever you select (text, an image, or canvas cards). Each icon runs a command from the command palette, and the command still sees your selection when it runs.

The strip has no built-in actions. You choose what goes on it.

## The strip

- **Live Preview and Source mode.** Select text and a vertical strip appears in the left margin, level with the first selected line. It stays clear of formatting toolbars that sit above the selection.
- **Reading view.** The same strip appears for a selection in the rendered note. Selections inside the Properties box are ignored.
- **Canvas.** The icons are added to the canvas's own menu for selected cards.
- **Right-click menu.** Strip commands also appear in the editor's right-click menu and in the canvas card menu.

Clicking an icon hides the strip and runs the command. The selection stays in place, so commands that work on the selection (for example *Toggle bold*, or a "copy link" command from another plugin) act on it as usual.

An icon is shown only when its command can run in the current place. A command that only works in an editor, for example, is hidden on a canvas.

## Adding commands with "+"

On a fresh install the strip shows only **+**. Click it (or run *Anchor Actions: Add a command to the selection strip*) and pick any command from the list. It is added to the end of the strip. Adding a command does not run it.

## Managing commands

- **Right-click an icon** on the strip and choose *Remove from strip*.
- **Settings → Anchor Actions → Strip commands** lists the strip in order. For each command you can:
  - move it up or down (↑ / ↓),
  - set a different icon by typing a [Lucide](https://lucide.dev/icons/) icon id (for example `star`); leave it empty to use the command's own icon,
  - remove it (✕).
- If a command's plugin is turned off or uninstalled, the command disappears from the strip without errors and is listed in settings as **(missing) plugin-id:command-id**. It is not deleted, and it comes back when the plugin does.

Other settings: *Show icons when text is selected* turns the margin strip on or off, and *Distance from text* moves it further from the text if it overlaps fold arrows.

## Migrating from version 0.4 or earlier

Up to 0.4, Anchor Actions had its own built-in actions: links back to the exact spot of a selection, and sending a selection to the Reminders app. Those now live in two separate plugins:

1. Install **Anchor Jump** (exact-spot links) and **Anchor Apple Reminders**.
2. Click **+** on the strip and add their commands.

Your existing links keep working once Anchor Jump is installed. Anchor Actions never deletes the data the older version saved.

## Development

```sh
npm install
npm test          # pure unit tests (node)
npm run typecheck
npm run build     # writes dist/main.js, manifest.json, styles.css
```

Copy the three files in `dist/` into `<vault>/.obsidian/plugins/anchor-actions/` to try it.

## License

MIT
