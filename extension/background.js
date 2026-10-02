chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'VRM_LOG') {
    console.log('[VRM Companion BG]', request.message);
    sendResponse({ ok: true });
  }
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('VRM Companion Extension v1.0.0 installed.');
});
