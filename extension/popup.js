document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const statusEl = document.getElementById('status');
    if (tab && tab.url && tab.url.includes('seller.snapdeal.com')) {
      statusEl.textContent = 'Active on Snapdeal Seller Portal';
      statusEl.style.color = '#34d399';
    } else {
      statusEl.textContent = 'Navigate to seller.snapdeal.com to activate';
      statusEl.style.color = '#fbbf24';
    }
  });
});
