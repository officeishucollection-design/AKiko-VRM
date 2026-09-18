import axios from 'axios';
import { validateSafeUrl } from '../middleware/security.js';

// Domain rate-limiting timestamps
const domainLastRequestTime = new Map();
const MIN_DOMAIN_INTERVAL_MS = 600; // 600ms between requests to the same domain

// Realistic browser user agents
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

/**
 * Throttle requests to the same domain to prevent getting IP banned or overwhelming target
 */
async function throttleDomain(hostname) {
  const lastTime = domainLastRequestTime.get(hostname) || 0;
  const now = Date.now();
  const elapsed = now - lastTime;
  if (elapsed < MIN_DOMAIN_INTERVAL_MS) {
    const delay = MIN_DOMAIN_INTERVAL_MS - elapsed;
    await new Promise(r => setTimeout(r, delay));
  }
  domainLastRequestTime.set(hostname, Date.now());
}

/**
 * Generate rich simulated HTML for sample demo products or mock domains
 */
export function getMockHtmlForProduct(url, productName = '') {
  const u = url.toLowerCase();
  const name = productName || (u.includes('iphone') ? 'Apple iPhone 15 (128GB, Black)'
    : u.includes('galaxy') ? 'Samsung Galaxy S24 Ultra (256GB, Titanium Black)'
    : u.includes('pixel') ? 'Google Pixel 9 Pro (128GB, Hazel)'
    : u.includes('oneplus') ? 'OnePlus 12 5G (16GB RAM, Silky Black)'
    : u.includes('macbook') ? 'Apple MacBook Air M3 (16GB, 512GB SSD, Midnight)'
    : u.includes('sony') ? 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones'
    : u.includes('nike') ? 'Nike Air Zoom Pegasus 40 Running Shoes'
    : 'Premium Smart Device Pro');

  const brand = u.includes('iphone') || u.includes('macbook') ? 'Apple'
    : u.includes('galaxy') || u.includes('samsung') ? 'Samsung'
    : u.includes('pixel') || u.includes('google') ? 'Google'
    : u.includes('oneplus') ? 'OnePlus'
    : u.includes('sony') ? 'Sony'
    : u.includes('nike') ? 'Nike'
    : 'TechCorp';

  const price = u.includes('iphone') ? '69999'
    : u.includes('galaxy') ? '129999'
    : u.includes('pixel') ? '79999'
    : u.includes('oneplus') ? '64999'
    : u.includes('macbook') ? '114900'
    : u.includes('sony') ? '29990'
    : u.includes('nike') ? '11995'
    : '49999';

  const mrp = Math.round(Number(price) * 1.15).toString();
  const weight = u.includes('iphone') ? '171 g'
    : u.includes('galaxy') ? '232 g'
    : u.includes('pixel') ? '198 g'
    : u.includes('macbook') ? '1.24 kg'
    : u.includes('sony') ? '250 g'
    : '185 g';

  const color = u.includes('iphone') ? 'Black'
    : u.includes('galaxy') ? 'Titanium Gray'
    : u.includes('pixel') ? 'Hazel'
    : u.includes('macbook') ? 'Midnight Blue'
    : u.includes('sony') ? 'Silver'
    : 'Space Grey';

  const dimensions = u.includes('iphone') ? '147.6 x 71.6 x 7.8 mm'
    : u.includes('galaxy') ? '162.3 x 79 x 8.6 mm'
    : u.includes('pixel') ? '152.8 x 72 x 8.5 mm'
    : '150 x 70 x 8 mm';

  const sku = 'SKU-' + Math.abs(hashString(url)).toString().substring(0, 6);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${name} - Official Store</title>
  <meta name="description" content="Buy ${name} at best price with warranty, fast shipping and easy returns.">
  
  <!-- OpenGraph Metadata -->
  <meta property="og:title" content="${name}">
  <meta property="og:description" content="Flagship ${brand} product featuring state of the art performance.">
  <meta property="og:price:amount" content="${price}">
  <meta property="og:price:currency" content="INR">
  <meta property="og:brand" content="${brand}">
  <meta property="og:availability" content="instock">
  <meta property="og:image" content="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80">
  
  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "${name}",
    "image": [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80"
    ],
    "description": "The latest ${brand} device built with cutting-edge craftsmanship and unmatched performance.",
    "sku": "${sku}",
    "mpn": "${sku}-MPN",
    "brand": {
      "@type": "Brand",
      "name": "${brand}"
    },
    "color": "${color}",
    "weight": "${weight}",
    "offers": {
      "@type": "Offer",
      "url": "${url}",
      "priceCurrency": "INR",
      "price": "${price}",
      "priceValidUntil": "2026-12-31",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "${brand} Official"
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "1420"
    }
  }
  </script>
</head>
<body>
  <div class="product-page">
    <h1 class="product-title" data-testid="product-name">${name}</h1>
    <div class="brand-badge">${brand}</div>
    <div class="pricing-section">
      <span class="currency">₹</span>
      <span class="price" data-price="${price}">₹${Number(price).toLocaleString('en-IN')}</span>
      <span class="mrp" style="text-decoration: line-through;">₹${Number(mrp).toLocaleString('en-IN')}</span>
      <span class="stock-status in-stock">In Stock (Ready to Ship)</span>
    </div>
    
    <div class="specifications-box">
      <h2>Technical Specifications</h2>
      <table class="specs-table">
        <tr><th>Brand</th><td>${brand}</td></tr>
        <tr><th>Model / SKU</th><td>${sku}</td></tr>
        <tr><th>Color</th><td>${color}</td></tr>
        <tr><th>Item Weight</th><td>${weight}</td></tr>
        <tr><th>Dimensions</th><td>${dimensions}</td></tr>
        <tr><th>Material</th><td>Aerospace-grade Titanium & Ceramic Shield Glass</td></tr>
        <tr><th>Warranty</th><td>1 Year Manufacturer Warranty</td></tr>
      </table>
    </div>

    <div class="description-section">
      <p>Experience the next level of mobile technology with advanced AI, incredible battery life, and pro camera system.</p>
    </div>
  </div>
</body>
</html>`;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * Converts Shopify product JSON into standard structured HTML for extraction
 */
export function convertShopifyJsonToHtml(shopifyJson, productUrl) {
  const prod = shopifyJson?.product || shopifyJson || {};
  const title = prod.title || '';
  const bodyHtml = prod.body_html || '';
  const vendor = prod.vendor || '';
  const productType = prod.product_type || '';
  const tags = Array.isArray(prod.tags) ? prod.tags.join(', ') : (prod.tags || '');
  const variants = prod.variants || [];
  const primaryVariant = variants[0] || {};

  const sku = primaryVariant.sku || '';
  const price = primaryVariant.price || '';
  const compareAtPrice = primaryVariant.compare_at_price || '';
  const grams = primaryVariant.grams || primaryVariant.weight || '';
  const weight = grams ? (typeof grams === 'number' ? `${grams} g` : String(grams)) : '';
  const available = primaryVariant.available !== false;
  const images = (prod.images || []).map(img => img.src || img);
  const primaryImage = images[0] || '';

  const options = prod.options || [];
  let color = '';
  let material = '';
  let dimensions = '';

  options.forEach(opt => {
    const name = (opt.name || '').toLowerCase();
    const val = Array.isArray(opt.values) ? opt.values[0] : '';
    if (name.includes('color') || name.includes('finish')) color = val;
    if (name.includes('material')) material = val;
    if (name.includes('size') || name.includes('dimension')) dimensions = val;
  });

  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: title,
    image: images,
    description: bodyHtml.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim(),
    sku: sku,
    brand: {
      '@type': 'Brand',
      name: vendor,
    },
    category: productType,
    color: color,
    material: material,
    weight: weight,
    offers: {
      '@type': 'Offer',
      url: productUrl,
      price: price,
      priceCurrency: 'INR',
      availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${jsonLd.description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${jsonLd.description}">
  <meta property="og:image" content="${primaryImage}">
  <meta property="og:price:amount" content="${price}">
  <meta property="product:brand" content="${vendor}">
  <meta property="product:category" content="${productType}">
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd)}
  </script>
</head>
<body>
  <h1 class="product-title" data-testid="product-name">${title}</h1>
  <div class="brand">${vendor}</div>
  <div class="category">${productType}</div>
  <div class="price">${price}</div>
  <div class="mrp">${compareAtPrice}</div>
  <div class="sku">${sku}</div>
  <div class="weight">${weight}</div>
  <div class="color">${color}</div>
  <div class="material">${material}</div>
  <div class="dimensions">${dimensions}</div>
  <div class="tags">${tags}</div>
  <div class="description">${bodyHtml}</div>
</body>
</html>`;
}

/**
 * Safely fetches raw HTML from a given URL with SSRF protection,
 * Shopify JSON API optimization, domain rate limiting, exponential backoff, and mock fallback.
 */
export async function fetchWebpage(rawUrl, options = {}) {
  const { timeout = 10000, maxRetries = 2, customProductName = '' } = options;

  // SSRF and protocol validation
  const validation = await validateSafeUrl(rawUrl);
  if (!validation.isValid) {
    throw new Error(`Security validation failed: ${validation.error}`);
  }

  const url = validation.normalizedUrl;
  const parsed = new URL(url);

  // If this is a mock or demo domain (or example.com), return simulated rich HTML directly
  if (parsed.hostname.includes('mock') || parsed.hostname.includes('example.com') || parsed.hostname.includes('sample-store')) {
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
    return {
      html: getMockHtmlForProduct(url, customProductName),
      statusCode: 200,
      url,
      headers: { 'content-type': 'text/html' },
      isMock: true,
    };
  }

  // Domain rate-limiting
  await throttleDomain(parsed.hostname);

  // 1. FAST-PATH for Shopify Stores: Try .json endpoint
  // Shopify endpoints (e.g. /products/handle) support fast .json queries that bypass Cloudflare 429 bot blocks
  if (parsed.pathname.includes('/products/')) {
    try {
      const cleanPath = parsed.pathname.replace(/\/+$/, '');
      const jsonUrl = `${parsed.origin}${cleanPath}.json`;
      const jsonRes = await axios.get(jsonUrl, {
        timeout: 6000,
        headers: {
          'User-Agent': USER_AGENTS[0],
          'Accept': 'application/json, text/plain, */*',
        },
      });

      if (jsonRes.data && (jsonRes.data.product || jsonRes.data.title)) {
        const generatedHtml = convertShopifyJsonToHtml(jsonRes.data, url);
        return {
          html: generatedHtml,
          statusCode: 200,
          url,
          headers: jsonRes.headers,
          isMock: false,
          isShopifyJson: true,
        };
      }
    } catch {
      // If .json is not available (non-Shopify), seamlessly fall through to full HTML fetch
    }
  }

  let attempt = 0;
  let lastError;

  while (attempt <= maxRetries) {
    try {
      const userAgent = USER_AGENTS[attempt % USER_AGENTS.length];
      const response = await axios.get(url, {
        timeout,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1',
        },
        maxRedirects: 5,
        responseType: 'text',
      });

      return {
        html: response.data,
        statusCode: response.status,
        url: response.request?.res?.responseUrl || url,
        headers: response.headers,
        isMock: false,
      };
    } catch (err) {
      lastError = err;
      attempt++;

      // If rate-limited (HTTP 429), adaptively increase domain backoff
      const is429 = err.response?.status === 429;
      if (is429) {
        // Increase domain interval
        domainLastRequestTime.set(parsed.hostname, Date.now() + 2000);
      }

      if (attempt <= maxRetries) {
        const backoffDelay = is429 ? (2500 * attempt) : (800 * Math.pow(2, attempt));
        await new Promise(r => setTimeout(r, backoffDelay));
      }
    }
  }

  // If real fetch failed with 403 or network issue on a demo/sample run, or real error
  const errMsg = lastError.response
    ? `HTTP ${lastError.response.status} (${lastError.response.statusText})`
    : (lastError.code || lastError.message);

  throw new Error(`Failed to fetch webpage at ${url}: ${errMsg}`);
}
