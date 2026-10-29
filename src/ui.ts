export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T
}

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
