/**
 * Mintu Chrome Extension — Background Service Worker
 */

// Enable side panel opening on extension icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("[Mintu SW] setPanelBehavior error:", error));

// Set up Context Menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "mintu-explain-selection",
    title: 'Ask Mintu: "%s"',
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "mintu-summarize-page",
    title: "Mintu: Summarize this page",
    contexts: ["page"],
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (e) {
    console.warn("Failed to open sidePanel:", e);
  }

  if (info.menuItemId === "mintu-explain-selection" && info.selectionText) {
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: "mintu:context-action",
        action: "explain",
        text: info.selectionText,
      }).catch(() => {});
    }, 450);
  } else if (info.menuItemId === "mintu-summarize-page") {
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: "mintu:context-action",
        action: "summarize-page",
      }).catch(() => {});
    }, 450);
  }
});

// Handle messages sent from content script (e.g. selection pill or floating pet bubble)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "mintu:context-action") {
    if (sender && sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
        setTimeout(() => {
          chrome.runtime.sendMessage(message).catch(() => {});
        }, 450);
      }).catch((e) => console.warn(e));
    }
  }
});
