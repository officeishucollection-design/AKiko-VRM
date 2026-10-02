/**
 * snapdealRoutes.js
 * Routes for Snapdeal Returns Sync and Seller OAuth Authorization
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncSnapdealReturns, syncSingleReturn } from '../services/snapdealSync.js';
import { protect, authorize } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '..', '.env');

const router = express.Router();

// Helper to persist updated env vars to .env file
function updateEnvFile(updates) {
  try {
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }
    
    for (const [key, val] of Object.entries(updates)) {
      process.env[key] = val;
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${val}`);
      } else {
        content += `\n${key}=${val}`;
      }
    }

    fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
    console.log('[SnapdealConfig] Successfully updated .env with:', Object.keys(updates));
  } catch (err) {
    console.warn('[SnapdealConfig] Could not write to .env:', err.message);
  }
}

// ── Health check — are tokens configured? ────────────────────────────────────
// @route   GET /api/snapdeal/status
// @access  Private
router.get('/snapdeal/status', protect, (req, res) => {
  const authToken   = process.env.SNAPDEAL_AUTH_TOKEN;
  const sellerToken = process.env.SNAPDEAL_SELLER_TOKEN;
  const appId       = process.env.SNAPDEAL_APP_ID;
  const clientId    = process.env.SNAPDEAL_CLIENT_ID || 'RunRave';
  const envMode     = process.env.SNAPDEAL_ENV || 'production';

  const configured = !!(authToken && sellerToken
    && authToken   !== 'YOUR_SNAPDEAL_AUTH_TOKEN_HERE'
    && sellerToken !== 'YOUR_SNAPDEAL_SELLER_TOKEN_HERE');

  res.json({
    configured,
    clientId,
    hasAppId: !!(appId && appId !== 'YOUR_SNAPDEAL_APP_ID_HERE'),
    hasAuthToken: !!(authToken && authToken !== 'YOUR_SNAPDEAL_AUTH_TOKEN_HERE'),
    hasSellerToken: configured,
    envMode,
    message: configured
      ? 'Snapdeal API tokens are active and ready.'
      : 'Snapdeal API credentials required.',
  });
});

// ── Generate Snapdeal OAuth Authorization Web UI URL ─────────────────────────
// @route   GET /api/snapdeal/auth-url
// @access  Private
router.get('/snapdeal/auth-url', protect, (req, res) => {
  const appId = process.env.SNAPDEAL_APP_ID;
  const isSandbox = (process.env.SNAPDEAL_ENV || '').toLowerCase() === 'sandbox' || (process.env.SNAPDEAL_ENV || '').toLowerCase() === 'staging';

  if (!appId || appId === 'YOUR_SNAPDEAL_APP_ID_HERE') {
    return res.status(400).json({
      error: 'SNAPDEAL_APP_ID is not configured in backend/.env. Snapdeal provides this after partner registration.',
    });
  }

  const host = req.get('host');
  const protocol = req.protocol;
  const returnURL = `${protocol}://${host}/api/snapdeal/callback`;

  const baseUrl = isSandbox
    ? 'https://stg-authorize.snapdeal.com/authserverui/login'
    : 'https://authorize.snapdeal.com/authserverui/login';

  const authUrl = `${baseUrl}?returnURL=${encodeURIComponent(returnURL)}&appId=${encodeURIComponent(appId)}`;

  res.json({ authUrl, returnURL, isSandbox });
});

// ── OAuth Callback — Receives redirect from Snapdeal Web UI with token ───────
// @route   GET /api/snapdeal/callback
// @access  Public (called via browser redirect from Snapdeal)
router.get('/snapdeal/callback', (req, res) => {
  try {
    console.log('[SnapdealAuth] Callback received with query:', req.query);

    // Snapdeal passes token in query parameters
    const token = req.query['X-Seller-Authz-Token'] 
      || req.query['X-Seller-Authz'] 
      || req.query['sellerToken'] 
      || req.query['token'] 
      || req.query['code'];

    if (token) {
      updateEnvFile({ SNAPDEAL_SELLER_TOKEN: token });
      console.log('[SnapdealAuth] Saved new Seller Access Token successfully.');

      // Redirect back to frontend with success flag
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${frontendUrl}/?snapdeal_auth=success`);
    }

    // In case no token in query, check if error was passed
    const errorDesc = req.query.error || req.query.message || 'No token provided in redirect';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/?snapdeal_auth=error&msg=${encodeURIComponent(errorDesc)}`);
  } catch (err) {
    console.error('[SnapdealAuth] Callback error:', err);
    res.status(500).send('Authorization failed: ' + err.message);
  }
});

// ── Manual Config Update — update credentials from frontend modal ────────────
// @route   POST /api/snapdeal/config
// @access  Private (admin only)
router.post('/snapdeal/config', protect, authorize('admin'), (req, res) => {
  try {
    const { clientId, appId, authToken, sellerToken, envMode } = req.body;
    const updates = {};

    if (clientId) updates.SNAPDEAL_CLIENT_ID = clientId.trim();
    if (appId) updates.SNAPDEAL_APP_ID = appId.trim();
    if (authToken) updates.SNAPDEAL_AUTH_TOKEN = authToken.trim();
    if (sellerToken) updates.SNAPDEAL_SELLER_TOKEN = sellerToken.trim();
    if (envMode) updates.SNAPDEAL_ENV = envMode.trim();

    updateEnvFile(updates);

    res.json({
      success: true,
      message: 'Snapdeal settings updated successfully.',
      configured: !!(process.env.SNAPDEAL_AUTH_TOKEN && process.env.SNAPDEAL_SELLER_TOKEN),
    });
  } catch (error) {
    console.error('[SnapdealConfig] Failed to update config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Full sync — fetch all pending + completed returns and upsert into MongoDB ─
// @route   POST /api/snapdeal/sync
// @access  Private (admin or operator)
router.post('/snapdeal/sync', protect, authorize('admin', 'operator'), async (req, res) => {
  try {
    console.log(`[SnapdealSync] Manual sync triggered by ${req.user?.username || 'unknown'}`);
    const result = await syncSnapdealReturns();
    res.json({ success: true, result });
  } catch (error) {
    console.error('[SnapdealSync] Sync failed:', error.message);

    if (error.message.includes('not configured')) {
      return res.status(503).json({
        success: false,
        error: error.message,
        hint: 'Go to Snapdeal Seller Panel → Settings → API & Integrations to generate tokens, or use the Connect Snapdeal dialog.',
      });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Single suborder sync — refresh one specific return by suborder ID ─────────
// @route   POST /api/snapdeal/sync/:suborderId
// @access  Private
router.post('/snapdeal/sync/:suborderId', protect, async (req, res) => {
  try {
    const { suborderId } = req.params;
    const result = await syncSingleReturn(suborderId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[SnapdealSync] Single sync failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
