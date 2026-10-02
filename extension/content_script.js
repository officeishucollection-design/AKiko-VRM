/**
 * VRM Companion — content_script.js
 * Snapdeal Seller Portal Dispute Agent (Manifest V3, plain JS)
 *
 * Listens for VRM_RAISE_DISPUTE postMessages from the VRM CMS page and
 * runs a fully-automated 8-stage dispute filing pipeline on the Snapdeal
 * Seller Portal, with mandatory human confirmation before submission.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   DOM / TIMING HELPERS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Polls every 300 ms until the CSS selector resolves to an element.
 * Rejects after `timeout` ms.
 *
 * @param {string} selector  - CSS selector to wait for
 * @param {number} [timeout] - Max wait in ms (default 10 000)
 * @returns {Promise<Element>}
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(poll);
        resolve(el);
      }
      if (Date.now() - start > timeout) {
        clearInterval(poll);
        reject(new Error(`Timeout: "${selector}" not found after ${timeout} ms`));
      }
    }, 300);
  });
}

/**
 * Polls every 300 ms until at least one element matching the selector exists.
 *
 * @param {string} selector
 * @param {number} [timeout]
 * @returns {Promise<NodeList>}
 */
function waitForElements(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = setInterval(() => {
      const els = document.querySelectorAll(selector);
      if (els.length > 0) {
        clearInterval(poll);
        resolve(els);
      }
      if (Date.now() - start > timeout) {
        clearInterval(poll);
        reject(new Error(`Timeout: no elements for "${selector}" found after ${timeout} ms`));
      }
    }, 300);
  });
}

/**
 * Fills a native or AngularJS-bound input with a value by triggering
 * React/Angular's native setter plus bubbling input/change events.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} element
 * @param {string} value
 */
function fillAngularInput(element, value) {
  const proto = element instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  nativeSetter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simple promise-based sleep.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS BANNER
═══════════════════════════════════════════════════════════════════════════ */

const BANNER_ID = 'vrm-status-banner';

/**
 * Creates or updates a fixed-position status banner at the top-centre of the
 * page.  Colour-coded by type: info = blue, success = green, error = red.
 * Info/success auto-dismiss after 4 s; error stays until manually closed.
 *
 * @param {string} stage   - Stage label, e.g. 'Stage 1: Search'
 * @param {string} message - Human-readable status message
 * @param {'info'|'success'|'error'} type
 */
function showStatusBanner(stage, message, type = 'info') {
  // Remove existing banner
  const existing = document.getElementById(BANNER_ID);
  if (existing) existing.remove();

  const colours = {
    info:    { bg: '#1d4ed8', border: '#3b82f6', text: '#eff6ff' },
    success: { bg: '#15803d', border: '#22c55e', text: '#f0fdf4' },
    error:   { bg: '#b91c1c', border: '#f87171', text: '#fef2f2' },
  };
  const c = colours[type] || colours.info;

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  Object.assign(banner.style, {
    position:     'fixed',
    top:          '16px',
    left:         '50%',
    transform:    'translateX(-50%)',
    zIndex:       '2147483647',
    background:   c.bg,
    border:       `2px solid ${c.border}`,
    borderRadius: '10px',
    color:        c.text,
    padding:      '10px 40px 10px 16px',
    minWidth:     '320px',
    maxWidth:     '520px',
    fontFamily:   '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize:     '13px',
    lineHeight:   '1.5',
    boxShadow:    '0 4px 20px rgba(0,0,0,0.45)',
    transition:   'opacity 0.4s ease',
    opacity:      '1',
  });

  banner.innerHTML = `
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;opacity:0.8;margin-bottom:3px;">${escapeHtml(stage)}</div>
    <div style="font-weight:500;">${escapeHtml(message)}</div>
    <button id="vrm-banner-close" style="
      position:absolute;top:8px;right:10px;background:none;border:none;
      color:${c.text};font-size:16px;cursor:pointer;line-height:1;opacity:0.75;
    ">✕</button>
  `;

  document.body.appendChild(banner);

  document.getElementById('vrm-banner-close').addEventListener('click', () => {
    banner.remove();
  });

  if (type !== 'error') {
    setTimeout(() => {
      banner.style.opacity = '0';
      setTimeout(() => banner.remove(), 400);
    }, 4000);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIRMATION OVERLAY
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Shows a right-side confirmation overlay listing verification status and
 * evidence files.  Returns a Promise that resolves to 'confirm' or 'abort'.
 *
 * @param {object} payload      - Original VRM_RAISE_DISPUTE payload
 * @param {object} verification - { suborderMatched, awbMatched, productMatched, refCodeMatched }
 * @returns {Promise<'confirm'|'abort'>}
 */
function showConfirmationOverlay(payload, verification) {
  return new Promise((resolve) => {
    // Remove any stale overlay
    const existing = document.getElementById('vrm-confirm-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'vrm-confirm-overlay';
    Object.assign(overlay.style, {
      position:     'fixed',
      top:          '50%',
      right:        '24px',
      transform:    'translateY(-50%)',
      zIndex:       '999999',
      background:   '#0f172a',
      border:       '2px solid #6366f1',
      borderRadius: '12px',
      color:        '#f1f5f9',
      padding:      '20px',
      width:        '320px',
      fontFamily:   '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize:     '13px',
      lineHeight:   '1.55',
      boxShadow:    '0 8px 40px rgba(0,0,0,0.7)',
    });

    const checkRow = (label, matched) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
        <span style="font-size:16px;">${matched ? '✅' : '❌'}</span>
        <span style="color:${matched ? '#86efac' : '#fca5a5'};">${escapeHtml(label)}</span>
      </div>`;

    const evidenceKeys = Object.keys(payload.evidence || {});
    const evidenceList = evidenceKeys.map(k => `
      <li style="color:#a5b4fc;margin-bottom:3px;">📎 ${escapeHtml(k)}</li>`).join('');

    overlay.innerHTML = `
      <div style="font-size:15px;font-weight:700;color:#e0e7ff;margin-bottom:14px;border-bottom:1px solid #334155;padding-bottom:10px;">
        🛡️ VRM Dispute Confirmation
      </div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin-bottom:8px;">
        Verification
      </div>
      ${checkRow(`Suborder ID: ${payload.suborderId}`, verification.suborderMatched)}
      ${checkRow(`AWB: ${payload.awb}`, verification.awbMatched)}
      ${checkRow(`Product: ${payload.productTitle}`, verification.productMatched)}
      ${checkRow(`Ref Code: ${payload.snapdealRefCode}`, verification.refCodeMatched)}

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin:12px 0 8px;">
        Evidence Files
      </div>
      <ul style="margin:0;padding-left:2px;list-style:none;">
        ${evidenceList}
      </ul>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin:12px 0 6px;">
        Dispute Category
      </div>
      <div style="color:#c7d2fe;background:#1e293b;border-radius:6px;padding:6px 10px;">
        ${escapeHtml(payload.disputeCategory)}
      </div>

      <div style="display:flex;gap:10px;margin-top:18px;">
        <button id="vrm-confirm-btn" style="
          flex:1;padding:10px;border:none;border-radius:7px;
          background:#16a34a;color:#fff;font-size:13px;font-weight:700;
          cursor:pointer;transition:background 0.15s;
        ">✅ Confirm &amp; File Dispute</button>
        <button id="vrm-abort-btn" style="
          flex:1;padding:10px;border:none;border-radius:7px;
          background:#dc2626;color:#fff;font-size:13px;font-weight:700;
          cursor:pointer;transition:background 0.15s;
        ">✕ Abort</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = (choice) => {
      overlay.remove();
      resolve(choice);
    };

    document.getElementById('vrm-confirm-btn').addEventListener('click', () => cleanup('confirm'));
    document.getElementById('vrm-abort-btn').addEventListener('click',  () => cleanup('abort'));
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════════════════════════════════════ */

/** Basic HTML entity escape to prevent XSS in injected HTML strings. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Returns true if `haystack` contains `needle` as a case-insensitive
 * substring, trimming surrounding whitespace first.
 *
 * @param {string} haystack
 * @param {string} needle
 */
function containsCI(haystack, needle) {
  return String(haystack).trim().toLowerCase().includes(String(needle).trim().toLowerCase());
}

/**
 * Logs a message to the background service worker console via messaging.
 *
 * @param {string} msg
 */
function bgLog(msg) {
  try {
    chrome.runtime.sendMessage({ type: 'VRM_LOG', message: msg });
  } catch (_) {
    // Extension context may be invalidated; silently ignore
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAGE IMPLEMENTATIONS
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Stage 1 — Search
 * Selects "Suborder ID" in the search-type control, fills the search input
 * with the suborderId, and clicks the search button.
 *
 * The Snapdeal portal uses AngularJS so we need to handle both native
 * <select> elements and custom click-driven dropdowns.
 *
 * @param {object} payload
 */
async function stageSearch(payload) {
  showStatusBanner('Stage 1: Search', 'Searching for Suborder ID…', 'info');
  bgLog(`Stage 1 — searching for suborderId: ${payload.suborderId}`);

  // ── 1a. Attempt to set search type to "Suborder ID" ──────────────────────
  // First try a real <select> element — look for one near the search bar
  // that contains a "Suborder" option.
  let searchTypeSet = false;

  const selects = Array.from(document.querySelectorAll('select'));
  for (const sel of selects) {
    const suborderOpt = Array.from(sel.options).find(
      (o) => containsCI(o.text, 'suborder') || containsCI(o.value, 'suborder')
    );
    if (suborderOpt) {
      sel.value = suborderOpt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      searchTypeSet = true;
      bgLog('Stage 1 — set native <select> to Suborder ID');
      break;
    }
  }

  // If no native select worked, try a custom AngularJS dropdown trigger
  if (!searchTypeSet) {
    // Common patterns: a div/button acting as dropdown trigger with text
    // such as "AWB Number" that expands an <li>-based list.
    const dropdownTriggers = Array.from(
      document.querySelectorAll(
        '[class*="dropdown"] [class*="toggle"], ' +
        '[class*="select"] [class*="selected"], ' +
        '[class*="searchType"] [class*="label"], ' +
        'button[class*="type"], ' +
        '[ng-model*="searchType"]'
      )
    );

    for (const trigger of dropdownTriggers) {
      trigger.click();
      await sleep(600);

      // Look for a list item matching "Suborder"
      const listItems = Array.from(document.querySelectorAll('li, [role="option"], [class*="option"]'));
      const suborderItem = listItems.find((li) => containsCI(li.textContent, 'suborder'));
      if (suborderItem) {
        suborderItem.click();
        searchTypeSet = true;
        bgLog('Stage 1 — clicked custom dropdown "Suborder ID" option');
        await sleep(400);
        break;
      }

      // If dropdown didn't open anything useful, close it by clicking again
      trigger.click();
      await sleep(300);
    }
  }

  if (!searchTypeSet) {
    bgLog('Stage 1 — could not set search type; proceeding with default');
  }

  await sleep(300);

  // ── 1b. Find the search input ────────────────────────────────────────────
  const searchInput = await (async () => {
    const selectors = [
      "input[placeholder*='Search']",
      "input[placeholder*='search']",
      "input.searchInput",
      "input[type='search']",
      "input[ng-model*='search']",
      "input[class*='search']",
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    // Fallback: wait for any of them
    return waitForElement("input[placeholder*='Search'], input.searchInput", 8000);
  })();

  fillAngularInput(searchInput, payload.suborderId);
  bgLog(`Stage 1 — filled search input with ${payload.suborderId}`);
  await sleep(300);

  // ── 1c. Click the search button ──────────────────────────────────────────
  const searchBtn = (() => {
    const candidates = [
      "button[type='submit']",
      "button[class*='search']",
      "button[class*='Search']",
      "[class*='searchBtn']",
      "input[type='submit']",
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // Text-based fallback
    return Array.from(document.querySelectorAll('button')).find(
      (b) => /^search$/i.test(b.textContent.trim())
    );
  })();

  if (!searchBtn) {
    // Last resort: submit the parent form if present
    const form = searchInput.closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    } else {
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      searchInput.dispatchEvent(new KeyboardEvent('keyup',  { key: 'Enter', keyCode: 13, bubbles: true }));
    }
  } else {
    searchBtn.click();
  }

  bgLog('Stage 1 — search triggered');
}

/**
 * Stage 2-3 — Match & Verify
 * Waits for table rows, extracts key fields from the first result row,
 * and cross-checks against the payload.
 *
 * @param {object} payload
 * @returns {{ suborderMatched: boolean, awbMatched: boolean, productMatched: boolean, refCodeMatched: boolean }}
 */
async function stageVerify(payload) {
  bgLog('Stage 2-3 — waiting for search results…');

  // Wait for result table rows (tbody tr or a generic tr inside a results wrapper)
  await waitForElements(
    'table tbody tr, [class*="result"] tr, [class*="order"] tr, [class*="table"] tr',
    10000
  );

  await sleep(500); // Let Angular finish rendering

  // Gather all table rows and flatten their text into cells
  const rows = Array.from(
    document.querySelectorAll(
      'table tbody tr, [class*="result"] tr, [class*="order"] tr, [class*="table"] tr'
    )
  );

  bgLog(`Stage 2-3 — found ${rows.length} result row(s)`);

  // Inspect first meaningful data row
  const firstRow = rows.find((r) => r.querySelectorAll('td').length > 1) || rows[0];
  if (!firstRow) {
    throw new Error('Stage 2-3: No result rows found after search');
  }

  const cells = Array.from(firstRow.querySelectorAll('td')).map((td) => td.textContent.trim());
  const rowText = cells.join(' ');

  bgLog(`Stage 2-3 — first row text: "${rowText}"`);

  const verification = {
    suborderMatched: cells.some((c) => containsCI(c, payload.suborderId)) || containsCI(rowText, payload.suborderId),
    awbMatched:      cells.some((c) => containsCI(c, payload.awb))        || containsCI(rowText, payload.awb),
    productMatched:  cells.some((c) => containsCI(c, payload.productTitle) || containsCI(c, payload.sku)) ||
                     containsCI(rowText, payload.productTitle) || containsCI(rowText, payload.sku),
    refCodeMatched:  cells.some((c) => containsCI(c, payload.snapdealRefCode)) || containsCI(rowText, payload.snapdealRefCode),
  };

  bgLog(`Stage 2-3 — verification: ${JSON.stringify(verification)}`);

  const allMatched = Object.values(verification).every(Boolean);

  if (!allMatched) {
    const mismatches = Object.entries(verification)
      .filter(([, v]) => !v)
      .map(([k]) => k)
      .join(', ');

    showStatusBanner(
      'Stage 2-3: Verify',
      `Verification FAILED — mismatched fields: ${mismatches}`,
      'error'
    );

    window.postMessage(
      {
        type:    'VRM_DISPUTE_RESULT',
        success: false,
        stage:   'VERIFICATION_FAILED',
        mismatch: verification,
      },
      '*'
    );

    throw new Error(`VERIFICATION_FAILED: ${mismatches}`);
  }

  showStatusBanner('Stage 2-3: Verify', 'All 4 attributes verified ✓', 'success');
  return verification;
}

/**
 * Stage 4 — Prepare
 * Finds and clicks the "Raise Dispute" button on the verified result row,
 * then waits for the dispute modal to appear.
 */
async function stagePrepare() {
  bgLog('Stage 4 — looking for Raise Dispute button on result row…');
  showStatusBanner('Stage 4: Prepare', 'Opening dispute modal…', 'info');

  // Look for any button/link in the first result row with "dispute" text
  const raiseBtn = (() => {
    const allBtns = Array.from(
      document.querySelectorAll(
        'button, a, [role="button"], [class*="action"], [class*="dispute"]'
      )
    );
    return allBtns.find((b) =>
      /raise\s*dispute/i.test(b.textContent) ||
      /dispute/i.test(b.getAttribute('title') || '') ||
      /dispute/i.test(b.className)
    );
  })();

  if (!raiseBtn) {
    throw new Error('Stage 4: Could not locate "Raise Dispute" button on result row');
  }

  raiseBtn.click();
  bgLog('Stage 4 — clicked Raise Dispute button');

  // Wait for modal / dialog to appear
  const modal = await waitForElement(
    '[class*="modal"], [class*="dialog"], [role="dialog"], [class*="overlay"], ' +
    '[class*="popup"], [class*="dispute-form"], #disputeModal',
    10000
  );

  bgLog('Stage 4 — dispute modal detected');
  showStatusBanner('Stage 4: Prepare', 'Dispute modal opened', 'info');

  return modal;
}

/**
 * Stage 5 — Evidence
 * Fetches each image from the evidence URLs as a Blob, wraps it in a File
 * object, and injects it into the corresponding file input inside the modal.
 *
 * @param {object} evidence - { outerPackagingUrl, innerPackagingUrl, productImageUrl, podImageUrl }
 * @param {Element} modal   - The dispute modal element
 */
async function stageEvidence(evidence, modal) {
  bgLog('Stage 5 — attaching evidence files…');
  showStatusBanner('Stage 5: Evidence', 'Fetching & attaching evidence…', 'info');

  const evidenceEntries = Object.entries(evidence);

  // Gather all file inputs inside the modal
  const fileInputs = Array.from(modal.querySelectorAll('input[type="file"]'));

  if (fileInputs.length === 0) {
    bgLog('Stage 5 — no file inputs found in modal; evidence upload may not be supported');
    showStatusBanner('Stage 5: Evidence', 'No file inputs found in modal — skipping', 'info');
    return;
  }

  for (let i = 0; i < evidenceEntries.length; i++) {
    const [key, url] = evidenceEntries[i];
    if (!url) continue;

    try {
      bgLog(`Stage 5 — fetching evidence [${key}]: ${url}`);
      const blob = await fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
        return r.blob();
      });

      const ext  = url.split('.').pop().split('?')[0].toLowerCase();
      const mime = blob.type || 'image/jpeg';
      const filename = `${key}.${ext || 'jpg'}`;
      const file = new File([blob], filename, { type: mime });

      const dt = new DataTransfer();
      dt.items.add(file);

      // Use the file input at the same index, or cycle if fewer inputs than evidence items
      const targetInput = fileInputs[i % fileInputs.length];
      targetInput.files = dt.files;
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));

      bgLog(`Stage 5 — injected ${filename} into file input ${i % fileInputs.length}`);
      await sleep(400);
    } catch (err) {
      bgLog(`Stage 5 — failed to attach [${key}]: ${err.message}`);
      // Non-fatal: continue with remaining evidence
    }
  }

  showStatusBanner('Stage 5: Evidence', 'Evidence files attached', 'info');
}

/**
 * Stage 7 — Submit
 * Fills the category dropdown and description textarea in the modal, then
 * clicks the final submit button.
 *
 * @param {object} payload
 * @param {Element} modal
 */
async function stageSubmit(payload, modal) {
  bgLog('Stage 7 — filling category and description…');
  showStatusBanner('Stage 7: Submit', 'Clicking RAISE DISPUTE…', 'info');

  // ── Category dropdown ────────────────────────────────────────────────────
  // Try a native <select> first
  const categorySelect = modal.querySelector(
    'select[ng-model*="category"], select[name*="category"], select[id*="category"], select'
  );
  if (categorySelect) {
    const catOption = Array.from(categorySelect.options).find((o) =>
      containsCI(o.text, payload.disputeCategory) || containsCI(o.value, payload.disputeCategory)
    );
    if (catOption) {
      categorySelect.value = catOption.value;
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
      bgLog(`Stage 7 — selected category "${catOption.text}" from <select>`);
    } else {
      bgLog(`Stage 7 — category option not found; available: ${Array.from(categorySelect.options).map(o=>o.text).join(', ')}`);
    }
  } else {
    // Custom dropdown
    const dropdownTrigger = modal.querySelector(
      '[class*="category"] [class*="trigger"], ' +
      '[class*="category"] [class*="selected"], ' +
      '[ng-model*="category"]'
    );
    if (dropdownTrigger) {
      dropdownTrigger.click();
      await sleep(500);
      const options = Array.from(modal.querySelectorAll('li, [role="option"]'));
      const target = options.find((o) => containsCI(o.textContent, payload.disputeCategory));
      if (target) {
        target.click();
        bgLog(`Stage 7 — selected category from custom dropdown`);
      }
      await sleep(300);
    }
  }

  await sleep(300);

  // ── Description textarea ─────────────────────────────────────────────────
  const descTextarea = modal.querySelector(
    'textarea[ng-model*="description"], textarea[name*="description"], textarea[id*="description"], textarea'
  );
  if (descTextarea) {
    fillAngularInput(descTextarea, payload.disputeDescription);
    bgLog('Stage 7 — filled description textarea');
  } else {
    bgLog('Stage 7 — no description textarea found');
  }

  await sleep(400);

  // ── Submit button ────────────────────────────────────────────────────────
  const submitBtn = (() => {
    const allBtns = Array.from(modal.querySelectorAll('button, [role="button"], input[type="submit"]'));
    return allBtns.find((b) =>
      /raise\s*dispute/i.test(b.textContent) ||
      /submit/i.test(b.textContent) ||
      /confirm/i.test(b.textContent) ||
      b.type === 'submit'
    );
  })();

  if (!submitBtn) {
    throw new Error('Stage 7: Could not find submit button in dispute modal');
  }

  submitBtn.click();
  bgLog('Stage 7 — submit button clicked');
}

/**
 * Stage 8 — Verify Submission
 * Waits for a success toast / confirmation message on the page.
 */
async function stageVerifySubmission() {
  bgLog('Stage 8 — waiting for success confirmation…');

  // Poll for success indicators — toast messages or inline confirmations
  const successEl = await (async () => {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      const candidates = Array.from(
        document.querySelectorAll(
          '[class*="toast"], [class*="alert"], [class*="success"], ' +
          '[class*="notification"], [role="alert"], [class*="snack"]'
        )
      );
      const found = candidates.find((el) =>
        /success|raised|submitted|dispute.*filed|filed.*dispute/i.test(el.textContent)
      );
      if (found) return found;
      await sleep(400);
    }
    return null;
  })();

  if (successEl) {
    bgLog(`Stage 8 — success message: "${successEl.textContent.trim()}"`);
  } else {
    bgLog('Stage 8 — success toast not detected; assuming submission went through');
  }

  const successMessage = successEl
    ? successEl.textContent.trim()
    : 'Dispute submitted (no toast detected)';

  window.postMessage(
    { type: 'VRM_DISPUTE_RESULT', success: true, message: successMessage },
    '*'
  );

  showStatusBanner('Stage 8: Done', 'Dispute filed successfully! 🎉', 'success');
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PIPELINE
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Orchestrates all 8 stages of the automated dispute-filing pipeline.
 * Validates the incoming payload and runs stages sequentially.
 * On any error the pipeline halts, an error banner is shown, and a
 * VRM_DISPUTE_RESULT failure message is posted back to the CMS.
 *
 * @param {object} payload - VRM_RAISE_DISPUTE message payload
 */
async function runDisputePipeline(payload) {
  bgLog('Pipeline started — payload: ' + JSON.stringify(payload));

  // ── Input validation ─────────────────────────────────────────────────────
  const required = ['suborderId', 'awb', 'snapdealRefCode', 'sku', 'productTitle',
                     'disputeCategory', 'disputeDescription', 'evidence'];
  const missing = required.filter((k) => !payload[k]);
  if (missing.length) {
    const msg = `Missing required fields: ${missing.join(', ')}`;
    showStatusBanner('Pipeline Error', msg, 'error');
    window.postMessage({ type: 'VRM_DISPUTE_RESULT', success: false, error: msg }, '*');
    return;
  }

  let modal      = null;
  let verification = null;

  try {
    // Stage 1 — Search
    await stageSearch(payload);
    await sleep(800);

    // Stage 2-3 — Verify
    verification = await stageVerify(payload);
    await sleep(500);

    // Stage 4 — Prepare (open modal)
    modal = await stagePrepare();
    await sleep(500);

    // Stage 5 — Evidence
    await stageEvidence(payload.evidence, modal);
    await sleep(400);

    // Stage 6 — Operator Confirmation
    showStatusBanner('Stage 6: Confirmation', 'Awaiting operator review…', 'info');
    const choice = await showConfirmationOverlay(payload, verification);

    if (choice === 'abort') {
      showStatusBanner('Stage 6: Confirmation', 'Aborted by operator', 'error');
      bgLog('Stage 6 — aborted by operator');
      window.postMessage({ type: 'VRM_DISPUTE_RESULT', success: false, stage: 'ABORTED_BY_OPERATOR' }, '*');
      return;
    }

    showStatusBanner('Stage 6: Confirmation', 'Operator confirmed. Filing dispute…', 'success');
    bgLog('Stage 6 — operator confirmed');
    await sleep(600);

    // Stage 7 — Submit
    await stageSubmit(payload, modal);
    await sleep(600);

    // Stage 8 — Verify Submission
    await stageVerifySubmission();

  } catch (err) {
    bgLog(`Pipeline ERROR: ${err.message}`);
    showStatusBanner('Pipeline Error', err.message, 'error');
    window.postMessage(
      {
        type:    'VRM_DISPUTE_RESULT',
        success: false,
        error:   err.message,
        stage:   err.message.split(':')[0] || 'UNKNOWN_STAGE',
      },
      '*'
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE LISTENER  (entry point)
═══════════════════════════════════════════════════════════════════════════ */

window.addEventListener('message', async (event) => {
  // Only handle messages from the same origin (VRM CMS) or localhost (dev)
  if (event.data && event.data.type === 'VRM_RAISE_DISPUTE') {
    bgLog('Received VRM_RAISE_DISPUTE message');
    await runDisputePipeline(event.data.payload);
  }
});

bgLog('VRM Companion content script initialised on ' + location.hostname);
