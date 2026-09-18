import dns from 'dns/promises';
import { URL } from 'url';

// SSRF IP Blacklists (RFC 1918, RFC 3927, Loopback, Cloud Metadata)
const PRIVATE_IP_RANGES = [
  /^127\./,                         // Loopback IPv4
  /^10\./,                          // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
  /^192\.168\./,                    // Class C private
  /^169\.254\./,                    // Link-local / Cloud Metadata
  /^0\./,                           // Broadcast / Zero
  /^::1$/,                          // Loopback IPv6
  /^fc00:/i,                        // Unique Local Address IPv6
  /^fe80:/i,                        // Link-local IPv6
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
  'metadata',
  'local',
];

/**
 * Validates a target URL against SSRF and protocol vulnerabilities
 * @param {string} rawUrl
 * @returns {Promise<{ isValid: boolean, error?: string, normalizedUrl?: string }>}
 */
export async function validateSafeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'URL is required and must be a string' };
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { isValid: false, error: `Access to internal host "${hostname}" is forbidden (SSRF Protection)` };
  }

  // Check if hostname is an explicit IP address
  for (const regex of PRIVATE_IP_RANGES) {
    if (regex.test(hostname)) {
      return { isValid: false, error: `Access to private IP range "${hostname}" is forbidden (SSRF Protection)` };
    }
  }

  // Optional: Resolve DNS to verify underlying IP is not a private IP (DNS Rebinding protection)
  try {
    // Only resolve if not a mock or simulated demo domain
    if (!hostname.includes('example.com') && !hostname.includes('sample-store.mock')) {
      const addresses = await dns.lookup(hostname, { all: true });
      for (const addr of addresses) {
        for (const regex of PRIVATE_IP_RANGES) {
          if (regex.test(addr.address)) {
            return { isValid: false, error: `Host "${hostname}" resolved to private IP "${addr.address}" (SSRF Protection)` };
          }
        }
      }
    }
  } catch (dnsErr) {
    // If DNS resolution fails, allow if simulated or mark error
    if (!hostname.includes('mock') && !hostname.includes('example.com')) {
      return { isValid: false, error: `DNS lookup failed for host "${hostname}": ${dnsErr.message}` };
    }
  }

  return { isValid: true, normalizedUrl: parsed.toString() };
}

/**
 * Express error handler middleware
 */
export function errorHandler(err, req, res, next) {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error occurred',
  });
}
