// ui.ts holds small helpers shared by reflect's popup and options pages

// typed document.getElementById
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

// show the on/off keyboard shortcut, e.g. "⇧⌘O turns reflect on or off."
export async function showToggleShortcut(el: HTMLElement, whenUnset: string = ''): Promise<void> {
  const commands = await chrome.commands.getAll()
  const shortcut = commands.find((c) => c.name === 'toggle-blocker')?.shortcut
  if (shortcut) {
    const kbd = document.createElement('kbd')
    kbd.textContent = shortcut
    el.replaceChildren(kbd, ' turns reflect on or off.')
  } else {
    el.textContent = whenUnset
  }
}
