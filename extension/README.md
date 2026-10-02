# VRM Companion — Snapdeal Dispute Agent (Chrome Extension)

A **Manifest V3** Chrome Extension that automates verified return-dispute filing
on the Snapdeal Seller Portal, tightly coupled to evidence collected by the
VRM (Verified Returns Management) CMS.

---

## What It Does

When a VRM return inspection is completed and marked dispute-ready in the CMS,
the CMS sends a `postMessage` to the open Snapdeal Seller Portal tab.  The
extension intercepts that message and runs an **8-stage automated pipeline**:

| Stage | Name | Description |
|-------|------|-------------|
| 1 | **Search** | Sets search type to "Suborder ID", fills the search box, clicks Search |
| 2–3 | **Match & Verify** | Reads the first result row and cross-checks 4 attributes |
| 4 | **Prepare** | Clicks "Raise Dispute" on the verified row, waits for modal |
| 5 | **Evidence** | Fetches image blobs from VRM storage URLs and injects into file inputs |
| 6 | **Operator Confirm** | Shows a human-review overlay — human must approve before submission |
| 7 | **Submit** | Selects dispute category, fills description, clicks the modal submit button |
| 8 | **Verify Submission** | Waits for a success toast; posts `VRM_DISPUTE_RESULT` back to CMS |

---

## Project Structure

```
extension/
├── manifest.json        Chrome Extension manifest (MV3)
├── background.js        Service worker — log relay
├── content_script.js    Core pipeline agent (runs on seller.snapdeal.com)
├── popup.html           Toolbar popup UI (dark theme)
├── popup.js             Popup logic — shows portal activation status
└── icons/
    ├── README.md        Icon placement instructions
    ├── icon16.png       (place here — 16×16)
    ├── icon48.png       (place here — 48×48)
    └── icon128.png      (place here — 128×128)
```

---

## Installation (Developer Mode)

1. Open **Chrome** and navigate to `chrome://extensions`.
2. Enable **Developer Mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `c:\code\VRM\extension\` folder.
5. The **VRM Companion** extension will appear in your toolbar.

> **Before generating real disputes**, ensure placeholder PNG icons exist in
> `extension/icons/` (see `icons/README.md`).  Chrome will refuse to load the
> extension if the icon files are missing.

---

## How the VRM CMS Communicates with the Extension

The extension's content script is injected into every `seller.snapdeal.com`
page.  The VRM CMS (running on `localhost:5173` or production) communicates via
the **`window.postMessage` API** routed through the content script.

### Triggering a Dispute from VRM CMS

```js
// In the VRM CMS frontend (e.g., a React button click handler)
const snapdealTab = window.open('https://seller.snapdeal.com/returns', '_blank');

// Wait for the tab to load, then post the trigger message
setTimeout(() => {
  snapdealTab.postMessage(
    {
      type: 'VRM_RAISE_DISPUTE',
      payload: {
        suborderId:        '74794889565',
        awb:               '7269634188574',
        snapdealRefCode:   'SLP5132786666',
        sku:               '1807SDCORKBLACK',
        productTitle:      'Akiko Black Men Slipper',
        disputeCategory:   'Damaged Item Received',
        disputeDescription:'Product returned in damaged condition. Outer packaging crushed...',
        evidence: {
          outerPackagingUrl: 'https://cdn.vrm.example.com/evidence/outer_7479.jpg',
          innerPackagingUrl: 'https://cdn.vrm.example.com/evidence/inner_7479.jpg',
          productImageUrl:   'https://cdn.vrm.example.com/evidence/product_7479.jpg',
          podImageUrl:       'https://cdn.vrm.example.com/evidence/pod_7479.jpg',
        },
      },
    },
    'https://seller.snapdeal.com'
  );
}, 3000);
```

### Listening for the Result

```js
window.addEventListener('message', (event) => {
  if (event.data?.type === 'VRM_DISPUTE_RESULT') {
    if (event.data.success) {
      console.log('Dispute filed!', event.data.message);
    } else {
      console.error('Dispute failed at stage:', event.data.stage, event.data.error);
    }
  }
});
```

---

## Payload Schema

```ts
interface DisputePayload {
  suborderId:         string;   // e.g. '74794889565'
  awb:                string;   // e.g. '7269634188574'
  snapdealRefCode:    string;   // e.g. 'SLP5132786666'
  sku:                string;   // e.g. '1807SDCORKBLACK'
  productTitle:       string;   // e.g. 'Akiko Black Men Slipper'
  disputeCategory:    string;   // e.g. 'Damaged Item Received'
  disputeDescription: string;   // Free-text, injected into modal textarea
  evidence: {
    outerPackagingUrl: string;  // HTTPS URL to outer packaging photo
    innerPackagingUrl: string;  // HTTPS URL to inner packaging photo
    productImageUrl:   string;  // HTTPS URL to product photo
    podImageUrl:       string;  // HTTPS URL to proof-of-delivery photo
  };
}
```

---

## 8-Stage Pipeline Summary

```
VRM CMS postMessage
       │
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 1 — Search                                                │
│  Set search type ► Fill Suborder ID ► Click Search              │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 2-3 — Match & Verify                                      │
│  Wait for table ► Extract row cells ► Cross-check 4 fields      │
│  (suborderId ✓  awb ✓  productTitle ✓  snapdealRefCode ✓)       │
└─────────────────────────┬────────────────────────────────────────┘
                 FAIL ◄───┤►── PASS
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 4 — Prepare                                               │
│  Click "Raise Dispute" ► Wait for modal                         │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 5 — Evidence                                              │
│  Fetch blob per URL ► Inject into file inputs via DataTransfer  │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 6 — Operator Confirmation  ◄── HUMAN-IN-THE-LOOP         │
│  Show overlay with verification + evidence list                  │
│  Operator clicks ✅ Confirm or ✕ Abort                          │
└─────────────────────────┬────────────────────────────────────────┘
                 ABORT ◄──┤►── CONFIRM
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 7 — Submit                                                │
│  Select category ► Fill description ► Click submit              │
└─────────────────────────┬────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Stage 8 — Verify Submission                                     │
│  Wait for success toast ► postMessage VRM_DISPUTE_RESULT        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Security Notes

| Concern | Mitigation |
|---------|-----------|
| **XSS in overlay HTML** | All user-supplied strings are escaped with `escapeHtml()` before insertion |
| **Message origin** | The content script only handles `VRM_RAISE_DISPUTE` messages; any sensitive cross-origin restriction should be added by validating `event.origin` in production |
| **CORS on evidence URLs** | Evidence images must be served with `Access-Control-Allow-Origin: *` or from the same origin as the portal; otherwise `fetch()` will fail (non-fatal — pipeline continues) |
| **Human gate** | Stage 6 requires explicit operator confirmation before any form is submitted — no dispute can be filed without human approval |
| **No credentials stored** | The extension uses no passwords, tokens, or sensitive storage; it only reads DOM state of an already-authenticated portal session |
| **Manifest V3** | Service worker–based background (no persistent background page); `host_permissions` scoped to `seller.snapdeal.com` only |

---

## Development Tips

- **Reload the extension** after any code changes: `chrome://extensions` → click ↺ on VRM Companion.
- **Inspect the content script** in DevTools: open Snapdeal Seller Portal → F12 → Sources → Content scripts → `content_script.js`.
- **Background logs** appear in: `chrome://extensions` → VRM Companion → *Service Worker* → Inspect.
- To test without the full CMS, paste this in the browser console on `seller.snapdeal.com`:

```js
window.postMessage({
  type: 'VRM_RAISE_DISPUTE',
  payload: {
    suborderId: '74794889565',
    awb: '7269634188574',
    snapdealRefCode: 'SLP5132786666',
    sku: '1807SDCORKBLACK',
    productTitle: 'Akiko Black Men Slipper',
    disputeCategory: 'Damaged Item Received',
    disputeDescription: 'Test dispute from VRM Companion dev console.',
    evidence: {
      outerPackagingUrl: 'https://via.placeholder.com/400.jpg',
      innerPackagingUrl: 'https://via.placeholder.com/400.jpg',
      productImageUrl:   'https://via.placeholder.com/400.jpg',
      podImageUrl:       'https://via.placeholder.com/400.jpg',
    },
  },
}, '*');
```
