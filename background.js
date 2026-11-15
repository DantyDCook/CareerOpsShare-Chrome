/* Manifest V3 service worker. No network access or job-posting persistence. */
const MENUS = [
  ['quick-analyze', 'CareerOps: Quick Analyze'],
  ['build-store', 'CareerOps: Build & Store'],
  ['full-application', 'CareerOps: Full Application'],
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const [id, title] of MENUS) {
      chrome.contextMenus.create({id, title, contexts: ['page', 'selection', 'link']});
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!MENUS.some(([id]) => id === info.menuItemId)) return;
  // Link context captures the LINK, never accidentally the listing page.
  const sharingLink = typeof info.linkUrl === 'string' && /^https?:\/\//i.test(info.linkUrl);
  let capture = {
    pageUrl: sharingLink ? info.linkUrl : (info.pageUrl || tab?.url || ''),
    title: sharingLink ? '' : (tab?.title || ''),
    jobTitle: '', company: '', description: '',
    selectedText: info.selectionText || '',
    wasTruncated: false,
  };
  if (!sharingLink && Number.isInteger(tab?.id)) {
    try {
      const results = await chrome.scripting.executeScript({
        target: {tabId: tab.id}, files: ['capture.js'],
      });
      if (results?.[0]?.result) capture = {
        ...capture, ...results[0].result,
        selectedText: info.selectionText || results[0].result.selectedText || '',
      };
    } catch { /* Restricted pages fall back to URL/title/selection. */ }
  }
  const id = crypto.randomUUID();
  await chrome.storage.session.set({['stage:' + id]: {capture, preset: info.menuItemId}});
  await chrome.tabs.create({url: chrome.runtime.getURL('review.html?staged=' + encodeURIComponent(id))});
});
