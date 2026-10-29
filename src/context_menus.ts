export const MENU_BLOCK_PAGE: string = 'block-page'
export const MENU_BLOCK_SITE: string = 'block-site'

export default function createContextMenus(): void {
  const contexts: chrome.contextMenus.CreateProperties['contexts'] = ['action', 'page']
  chrome.contextMenus.create({ id: 'block', title: 'Block this:', contexts })
  chrome.contextMenus.create({ parentId: 'block', id: MENU_BLOCK_PAGE, title: 'Page', contexts })
  chrome.contextMenus.create({ parentId: 'block', id: MENU_BLOCK_SITE, title: 'Domain', contexts })
}
