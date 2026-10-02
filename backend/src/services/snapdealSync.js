/**
 * snapdealSync.js
 * Snapdeal Seller API → VRM CMS Sync Service
 *
 * Calls Snapdeal's official Returns APIs and upserts results
 * into our local MongoDB Claim collection.
 *
 * Required ENV vars:
 *   SNAPDEAL_AUTH_TOKEN        — X-Auth-Token (API key from Snapdeal seller settings)
 *   SNAPDEAL_SELLER_TOKEN      — X-Seller-Authz-Token (OAuth token for the seller account)
 *
 * API Docs: https://seller.snapdeal.com/api/docs (login required)
 */

import Claim from '../models/Claim.js';

// Official Snapdeal Gateway Base URL (switches between production & staging)
const isSandbox = (process.env.SNAPDEAL_ENV || '').toLowerCase() === 'sandbox' || (process.env.SNAPDEAL_ENV || '').toLowerCase() === 'staging';
const SD_BASE_URL = process.env.SNAPDEAL_BASE_URL || (isSandbox 
  ? 'https://staging-apigateway.snapdeal.com/seller-api' 
  : 'https://apigateway.snapdeal.com/seller-api');

// Build standard Snapdeal API headers according to official spec:
// - clientId: ${yourBusinessName}
// - X-Auth-Token: partner auth token
// - X-Seller-AuthZ-Token: seller access token generated from Snapdeal Auth UI
export const getHeaders = () => {
  const authToken    = process.env.SNAPDEAL_AUTH_TOKEN;
  const sellerToken  = process.env.SNAPDEAL_SELLER_TOKEN;
  const clientId     = process.env.SNAPDEAL_CLIENT_ID || 'RunRave';

  if (!authToken || !sellerToken || authToken === 'YOUR_SNAPDEAL_AUTH_TOKEN_HERE' || sellerToken === 'YOUR_SNAPDEAL_SELLER_TOKEN_HERE') {
    throw new Error(
      'Snapdeal API tokens not configured. Set SNAPDEAL_AUTH_TOKEN and SNAPDEAL_SELLER_TOKEN in backend/.env'
    );
  }

  const headers = {
    'clientId':            clientId,
    'X-Auth-Token':        authToken,
    'X-Seller-AuthZ-Token': sellerToken,
    'Content-Type':        'application/json',
    'Accept':              'application/json',
  };

  return headers;
};

/**
 * Fetch a paginated list of returns from Snapdeal.
 * @param {'pending'|'completed'} type
 * @param {number} pageNumber  1-indexed
 * @param {number} pageSize    max 100
 */
async function fetchReturnPage(type, pageNumber = 1, pageSize = 50) {
  const url = `${SD_BASE_URL}/returns/${type}?pageNumber=${pageNumber}&pageSize=${pageSize}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Snapdeal API error (${res.status}) for /returns/${type}: ${body}`);
  }

  const data = await res.json();
  // Snapdeal wraps results — handle both { returns: [] } and { data: [] } shapes
  return data.returns || data.data || data.items || data || [];
}

/**
 * Fetch full details for a single suborder return.
 * @param {'pending'|'completed'} type
 * @param {string} subOrderId
 */
async function fetchReturnBySuborderId(type, subOrderId) {
  const url = `${SD_BASE_URL}/returns/${type}/suborder/${subOrderId}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Snapdeal API error (${res.status}) for suborder ${subOrderId}: ${body}`);
  }

  return await res.json();
}

/**
 * Map a raw Snapdeal return object to our Claim schema shape.
 * Field names are based on documented Snapdeal API response structure.
 */
function mapSnapdealReturnToClaim(item, type) {
  // Snapdeal field names (documented): subOrderId, awbNo / trackingCode,
  // sdReturnCode / returnReferenceCode, productTitle, skuCode, sellingPrice,
  // courierName, deliveredDate, returnCreatedDate
  const suborderId      = String(item.subOrderId || item.subOrderCode || item.id || '');
  const awb             = String(item.awbNo || item.trackingCode || item.awb || '');
  const snapdealRefCode = item.sdReturnCode || item.returnReferenceCode || item.referenceCode || '';
  const productTitle    = item.productTitle || item.title || item.name || '';
  const sku             = item.skuCode || item.sku || item.sellerSkuCode || '';
  const sellingPrice    = parseFloat(item.sellingPrice || item.price || 0) || 0;
  const courier         = item.courierName || item.courier || item.logisticPartner || '';
  const deliveredDate   = item.deliveredDate ? new Date(item.deliveredDate) : null;

  // Compute dispute deadline: Snapdeal allows 7 days from delivery to raise dispute
  let disputeDeadlineDate = null;
  if (deliveredDate) {
    disputeDeadlineDate = new Date(deliveredDate);
    disputeDeadlineDate.setDate(disputeDeadlineDate.getDate() + 7);
  }

  return {
    suborderId,
    awb,
    snapdealRefCode,
    marketplace: 'snapdeal',
    productTitle,
    sku,
    sellingPrice,
    courier,
    deliveredDate,
    disputeDeadlineDate,
    // Keep raw Snapdeal payload in notes for debugging
    notes: `Synced from Snapdeal /returns/${type}. Raw: ${JSON.stringify(item).substring(0, 300)}`,
    // Status stays pending_inspection — operator needs to inspect before filing
    status: 'pending_inspection',
  };
}

/**
 * Upsert a list of Snapdeal return objects into MongoDB Claim collection.
 * Uses suborderId as the unique key (will not duplicate on re-sync).
 *
 * @param {object[]} items    Raw Snapdeal API return objects
 * @param {'pending'|'completed'} type
 * @returns {{ created: number, updated: number, skipped: number, errors: string[] }}
 */
async function upsertReturns(items, type) {
  let created = 0, updated = 0, skipped = 0;
  const errors = [];

  for (const item of items) {
    try {
      const mapped = mapSnapdealReturnToClaim(item, type);

      if (!mapped.suborderId) {
        skipped++;
        continue;
      }

      const existing = await Claim.findOne({ suborderId: mapped.suborderId });

      if (existing) {
        // Only update "sync" fields — do NOT overwrite status, evidence, or
        // verificationLogs that an operator has already set
        await Claim.updateOne(
          { suborderId: mapped.suborderId },
          {
            $set: {
              awb:                 mapped.awb             || existing.awb,
              snapdealRefCode:     mapped.snapdealRefCode || existing.snapdealRefCode,
              productTitle:        mapped.productTitle    || existing.productTitle,
              sku:                 mapped.sku             || existing.sku,
              sellingPrice:        mapped.sellingPrice    || existing.sellingPrice,
              courier:             mapped.courier         || existing.courier,
              deliveredDate:       mapped.deliveredDate   || existing.deliveredDate,
              disputeDeadlineDate: mapped.disputeDeadlineDate || existing.disputeDeadlineDate,
            }
          }
        );
        updated++;
      } else {
        await Claim.create(mapped);
        created++;
      }
    } catch (err) {
      errors.push(`suborderId ${item.subOrderId || '?'}: ${err.message}`);
    }
  }

  return { created, updated, skipped, errors };
}

/**
 * Main sync function — fetches ALL pending + completed returns (paginated)
 * and upserts them into MongoDB.
 *
 * @returns {{ pending: object, completed: object, totalPages: number }}
 */
export async function syncSnapdealReturns() {
  const result = {
    pending:    { created: 0, updated: 0, skipped: 0, errors: [] },
    completed:  { created: 0, updated: 0, skipped: 0, errors: [] },
    totalSynced: 0,
    timestamp:  new Date().toISOString(),
  };

  const PAGE_SIZE = 50;

  // ── Sync Pending Returns ──────────────────────────────────────────────────
  let pendingPage = 1;
  let keepFetching = true;

  while (keepFetching) {
    const items = await fetchReturnPage('pending', pendingPage, PAGE_SIZE);
    if (!items || items.length === 0) {
      keepFetching = false;
      break;
    }

    const pageResult = await upsertReturns(items, 'pending');
    result.pending.created  += pageResult.created;
    result.pending.updated  += pageResult.updated;
    result.pending.skipped  += pageResult.skipped;
    result.pending.errors.push(...pageResult.errors);

    if (items.length < PAGE_SIZE) keepFetching = false;
    pendingPage++;
  }

  // ── Sync Completed Returns ────────────────────────────────────────────────
  let completedPage = 1;
  keepFetching = true;

  while (keepFetching) {
    const items = await fetchReturnPage('completed', completedPage, PAGE_SIZE);
    if (!items || items.length === 0) {
      keepFetching = false;
      break;
    }

    const pageResult = await upsertReturns(items, 'completed');
    result.completed.created  += pageResult.created;
    result.completed.updated  += pageResult.updated;
    result.completed.skipped  += pageResult.skipped;
    result.completed.errors.push(...pageResult.errors);

    if (items.length < PAGE_SIZE) keepFetching = false;
    completedPage++;
  }

  result.totalSynced = result.pending.created + result.pending.updated
                     + result.completed.created + result.completed.updated;

  console.log(`[SnapdealSync] Done. Total synced: ${result.totalSynced}`, result);
  return result;
}

/**
 * Fetch & upsert a single return by suborder ID.
 * Used for "Refresh" on a specific claim card.
 *
 * @param {string} suborderId
 */
export async function syncSingleReturn(suborderId) {
  // Try pending first, then completed
  let item = null;
  let type = 'pending';

  try {
    item = await fetchReturnBySuborderId('pending', suborderId);
  } catch {
    try {
      item = await fetchReturnBySuborderId('completed', suborderId);
      type = 'completed';
    } catch (err) {
      throw new Error(`Suborder ${suborderId} not found in Snapdeal pending or completed returns: ${err.message}`);
    }
  }

  const mapped = mapSnapdealReturnToClaim(item, type);
  const existing = await Claim.findOne({ suborderId: mapped.suborderId });

  if (existing) {
    await Claim.updateOne(
      { suborderId: mapped.suborderId },
      { $set: { awb: mapped.awb, snapdealRefCode: mapped.snapdealRefCode, productTitle: mapped.productTitle, sku: mapped.sku, sellingPrice: mapped.sellingPrice, courier: mapped.courier, deliveredDate: mapped.deliveredDate, disputeDeadlineDate: mapped.disputeDeadlineDate } }
    );
    return { action: 'updated', claim: await Claim.findOne({ suborderId: mapped.suborderId }) };
  } else {
    const claim = await Claim.create(mapped);
    return { action: 'created', claim };
  }
}
