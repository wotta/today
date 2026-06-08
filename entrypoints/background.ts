export default defineBackground(() => {
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'open-today',
      title: 'Open Today',
      contexts: ['action'],
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'open-today' && tab?.windowId != null) {
      browser.sidePanel.open({ windowId: tab.windowId });
    }
  });
});
