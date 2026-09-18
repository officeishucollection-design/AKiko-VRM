import * as cheerio from 'cheerio';
import { EXTRACTION_METHODS } from '../config/constants.js';

/**
 * Robust JSON-LD parser that recursively searches for Product, Offer, and related Schema.org objects
 */
function extractJsonLdData($, url) {
  const products = [];
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const rawText = $(el).html();
      if (!rawText) return;
      const parsed = JSON.parse(rawText.trim());
      
      const inspectItem = (item) => {
        if (!item || typeof item !== 'object') return;
        
        if (Array.isArray(item)) {
          item.forEach(inspectItem);
          return;
        }
        if (item['@graph'] && Array.isArray(item['@graph'])) {
          item['@graph'].forEach(inspectItem);
          return;
        }
        
        const type = item['@type'];
        if (type === 'Product' || type === 'IndividualProduct' || type === 'ProductGroup' || (Array.isArray(type) && type.includes('Product'))) {
          products.push(item);
        } else if (item.offers && item.name) {
          products.push(item);
        }
      };
      
      inspectItem(parsed);
    } catch (e) {
      // Ignore JSON parse errors in individual script tags
    }
  });

  if (products.length === 0) return null;
  const product = products[0]; // Take primary product schema

  // Extract structured values
  let price = null;
  let currency = null;
  let availability = null;
  let mrp = null;

  if (product.offers) {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    if (offer) {
      price = offer.price || offer.lowPrice || offer.highPrice;
      currency = offer.priceCurrency || offer.currency;
      availability = offer.availability ? offer.availability.replace('https://schema.org/', '').replace('http://schema.org/', '') : null;
      mrp = offer.priceSpecification?.price || offer.highPrice;
    }
  }

  let brand = null;
  if (typeof product.brand === 'string') {
    brand = product.brand;
  } else if (product.brand && typeof product.brand === 'object') {
    brand = product.brand.name || product.brand.legalName;
  }

  let image = null;
  if (typeof product.image === 'string') {
    image = product.image;
  } else if (Array.isArray(product.image)) {
    image = typeof product.image[0] === 'string' ? product.image[0] : product.image[0]?.url;
  } else if (product.image && typeof product.image === 'object') {
    image = product.image.url || product.image.contentUrl;
  }

  let rating = null;
  if (product.aggregateRating) {
    const r = product.aggregateRating;
    rating = `${r.ratingValue || ''} (${r.reviewCount || r.ratingCount || ''} reviews)`.trim();
  }

  let weight = product.weight?.value ? `${product.weight.value} ${product.weight.unitText || product.weight.unitCode || 'g'}` : (typeof product.weight === 'string' ? product.weight : null);
  let color = product.color || null;
  let material = product.material || null;
  let finish = product.finish || product.pattern || null;
  let sku = product.sku || product.mpn || product.gtin || product.gtin13 || product.identifier || null;
  let description = product.description || null;
  let dimensions = (product.height && product.width) ? `${product.height} x ${product.width} ${product.depth ? 'x ' + product.depth : ''}` : null;
  let careInstruction = product.careInstructions || null;

  // Additional Properties
  if (product.additionalProperty && Array.isArray(product.additionalProperty)) {
    product.additionalProperty.forEach(prop => {
      const pName = (prop.name || '').toLowerCase();
      const pVal = prop.value || '';
      if (!finish && (pName.includes('finish') || pName.includes('surface'))) finish = pVal;
      if (!material && (pName.includes('material') || pName.includes('fabric'))) material = pVal;
      if (!dimensions && (pName.includes('dimension') || pName.includes('size'))) dimensions = pVal;
      if (!careInstruction && (pName.includes('care') || pName.includes('cleaning'))) careInstruction = pVal;
    });
  }

  return {
    productName: product.name || null,
    brand,
    price: price ? String(price) : null,
    mrp: mrp ? String(mrp) : null,
    currency: currency || null,
    availability,
    sku,
    weight,
    color,
    material,
    finish,
    dimensions,
    description,
    careInstruction,
    rating,
    imageUrl: image,
    productUrl: url,
  };
}

/**
 * OpenGraph & Twitter metadata extractor
 */
function extractOpenGraphData($) {
  const getMeta = (props) => {
    for (const prop of props) {
      const val = $(`meta[property="${prop}"]`).attr('content') ||
                  $(`meta[name="${prop}"]`).attr('content') ||
                  $(`meta[itemprop="${prop}"]`).attr('content');
      if (val && val.trim()) return val.trim();
    }
    return null;
  };

  return {
    productName: getMeta(['og:title', 'twitter:title']),
    brand: getMeta(['og:brand', 'product:brand', 'twitter:brand']),
    price: getMeta(['og:price:amount', 'product:price:amount', 'twitter:data1']),
    currency: getMeta(['og:price:currency', 'product:price:currency']),
    availability: getMeta(['og:availability', 'product:availability']),
    description: getMeta(['og:description', 'twitter:description']),
    imageUrl: getMeta(['og:image', 'og:image:secure_url', 'twitter:image']),
    color: getMeta(['product:color']),
    material: getMeta(['product:material']),
    finish: getMeta(['product:finish', 'product:pattern']),
    weight: getMeta(['product:weight:value']) ? `${getMeta(['product:weight:value'])} ${getMeta(['product:weight:units']) || 'g'}` : null,
  };
}

/**
 * Microdata and Standard HTML Meta tag extractor
 */
function extractMicrodata($) {
  const getMicro = (prop) => {
    const val = $(`[itemprop="${prop}"]`).attr('content') ||
                $(`[itemprop="${prop}"]`).text() ||
                $(`meta[name="${prop}"]`).attr('content');
    return val ? val.trim() : null;
  };

  return {
    productName: getMicro('name') || $('h1').first().text().trim() || null,
    price: getMicro('price'),
    currency: getMicro('priceCurrency'),
    sku: getMicro('sku') || getMicro('mpn'),
    brand: getMicro('brand'),
    material: getMicro('material'),
    description: getMicro('description') || $('meta[name="description"]').attr('content') || null,
    imageUrl: $('[itemprop="image"]').attr('src') || $('[itemprop="image"]').attr('href') || null,
  };
}

/**
 * CSS Selector & E-commerce DOM heuristic parser
 */
function extractFromDom($) {
  // Title
  const titleSelectors = [
    'h1.product-title', 'h1.product-name', '.product-title', '.pdp-title',
    '#productTitle', 'h1[data-testid="product-name"]', 'h1',
  ];
  let productName = null;
  for (const s of titleSelectors) {
    const text = $(s).first().text().trim();
    if (text && text.length > 2) {
      productName = text;
      break;
    }
  }

  // Price
  const priceSelectors = [
    '[data-testid="product-price"]', '.product-price', '.price', '#priceblock_ourprice',
    '#priceblock_dealprice', '.a-price-whole', '.current-price', '.selling-price',
    'span.price', 'div.price', '.pdp-price',
  ];
  let rawPrice = null;
  for (const s of priceSelectors) {
    const text = $(s).first().text().trim();
    if (text) {
      rawPrice = text;
      break;
    }
  }

  // Brand
  const brandSelectors = [
    '.product-brand', '.brand', '[data-brand]', '.vendor', '.brand-badge',
    'a.brand', '#bylineInfo',
  ];
  let brand = null;
  for (const s of brandSelectors) {
    const text = $(s).first().text().trim();
    if (text && text.length > 1 && text.length < 50) {
      brand = text.replace(/^By\s+/i, '').replace(/^Brand:\s*/i, '').trim();
      break;
    }
  }

  // Parse Spec Table & Definition lists
  const specs = {};
  $('table, dl, .specs-table, .specification-list, .product-details, .tech-specs, .accordion-content').find('tr, .spec-row, div.spec, dt, li').each((_, row) => {
    const key = $(row).find('th, dt, .spec-label, .name, strong').first().text().trim().toLowerCase().replace(/[:]/g, '');
    const val = $(row).find('td, dd, .spec-value, .val, span').first().text().trim();
    if (key && val && key !== val) {
      specs[key] = val;
    }
  });

  // Extract from parsed specs table
  let weight = specs['weight'] || specs['item weight'] || specs['net weight'] || specs['package weight'] || specs['product weight'] || null;
  let dimensions = specs['dimensions'] || specs['product dimensions'] || specs['item dimensions'] || specs['size'] || specs['overall dimensions'] || specs['dimensions (inch/cm) - l x b x h'] || specs['dimensions - l x b x h'] || specs['dimensions (l x b x h)'] || null;
  let color = specs['color'] || specs['colour'] || specs['shade'] || null;
  let material = specs['material'] || specs['primary material'] || specs['fabric'] || specs['secondary material'] || specs['construction'] || null;
  let finish = specs['finish'] || specs['surface finish'] || specs['color finish'] || specs['finish type'] || specs['polish'] || null;
  let careInstruction = specs['care instruction'] || specs['care instructions'] || specs['care guide'] || specs['cleaning instructions'] || specs['wash care'] || null;
  let sku = specs['sku'] || specs['model'] || specs['model number'] || specs['item model number'] || specs['item code'] || null;
  let availability = specs['availability'] || specs['stock'] || null;

  // Description from text paragraphs if not found
  let description = null;
  const descSelectors = ['.product-description', '#description', '.pdp-description', '.desc', 'div[itemprop="description"]'];
  for (const s of descSelectors) {
    const text = $(s).first().text().trim();
    if (text && text.length > 15) {
      description = text;
      break;
    }
  }

  return {
    productName,
    rawPrice,
    brand,
    weight,
    dimensions,
    color,
    material,
    finish,
    careInstruction,
    description,
    sku,
    availability,
    specsTable: specs,
  };
}

/**
 * Regex Heuristics from full text body
 */
function extractHeuristics(bodyText) {
  const results = {};

  // Clean Price regex: ₹69,999 or $1,199.00 or €499
  const priceMatch = bodyText.match(/(?:₹|INR|Rs\.?|\$|USD|€|EUR|£|GBP)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
  if (priceMatch) {
    results.price = priceMatch[1].replace(/,/g, '');
    results.rawPrice = priceMatch[0];
  }

  // Weight regex: 171 g, 1.24 kg, 250 grams, 5.5 lbs
  const weightMatch = bodyText.match(/([0-9]+(?:\.[0-9]+)?)\s*(g|gm|grams|kg|kilograms|lbs|pounds|oz|ounces)\b/i);
  if (weightMatch) {
    results.weight = `${weightMatch[1]} ${weightMatch[2]}`;
  }

  // Dimensions regex: 147.6 x 71.6 x 7.8 mm / cm / inches / in
  const dimMatch = bodyText.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:x|×|by)\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(?:x|×|by)\s*([0-9]+(?:\.[0-9]+)?))?\s*(mm|cm|inches|in|ft)\b/i);
  if (dimMatch) {
    results.dimensions = dimMatch[3]
      ? `${dimMatch[1]} x ${dimMatch[2]} x ${dimMatch[3]} ${dimMatch[4]}`
      : `${dimMatch[1]} x ${dimMatch[2]} ${dimMatch[4]}`;
  }

  // Finish heuristics
  const finishMatch = bodyText.match(/\b(matte|glossy|satin|brushed|polished|antique|lacquered|natural finish|powder coated|anodized|distressed|oiled|waxed)\b/i);
  if (finishMatch) {
    results.finish = finishMatch[1];
  }

  // Material heuristics
  const materialMatch = bodyText.match(/\b(solid wood|teak wood|sheesham wood|oak wood|walnut|engineered wood|stainless steel|brass|aluminum|iron|ceramic|glass|leather|cotton|velvet|linen|titanium)\b/i);
  if (materialMatch) {
    results.material = materialMatch[1];
  }

  return results;
}

/**
 * Normalize and clean extracted values based on target data types
 */
export function normalizeFieldValue(value, dataType = 'string') {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();

  switch (dataType) {
    case 'currency':
    case 'number': {
      const numMatch = str.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (numMatch) {
        return Number(numMatch[1]);
      }
      const cleaned = str.replace(/[^0-9.]/g, '');
      return cleaned ? Number(cleaned) : str;
    }
    case 'boolean': {
      const lower = str.toLowerCase();
      return ['true', 'yes', 'instock', '1', 'in stock', 'available'].includes(lower);
    }
    case 'string':
    default:
      return str.replace(/\s+/g, ' ');
  }
}

/**
 * Master Extraction Function
 */
export function extractProductDataFromHtml(html, url, customSelectors = {}) {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ');

  // 1. JSON-LD (Highest accuracy for e-commerce)
  const jsonLd = extractJsonLdData($, url);

  // 2. OpenGraph
  const og = extractOpenGraphData($);

  // 3. Microdata / Meta
  const micro = extractMicrodata($);

  // 4. DOM & Specs table
  const dom = extractFromDom($);

  // 5. Heuristic Regex
  const heuristics = extractHeuristics(bodyText);

  // 6. User Custom Selectors
  const custom = {};
  if (customSelectors && typeof customSelectors === 'object') {
    for (const [key, selector] of Object.entries(customSelectors)) {
      if (selector) {
        try {
          const val = $(selector).first().text().trim() || $(selector).first().attr('content');
          if (val) custom[key] = val;
        } catch (e) {
          // Selector error ignored
        }
      }
    }
  }

  // Build field results map with source attribution and confidence calculation
  const fields = {};

  const resolveField = (fieldKey, dataType = 'string') => {
    // URL direct field
    if (fieldKey === 'productUrl') {
      fields.productUrl = {
        value: url,
        source: 'webpage',
        method: EXTRACTION_METHODS.PRODUCT_URL,
        confidence: 1.0,
        raw: url,
      };
      return;
    }

    // 0. Check custom selector
    if (custom[fieldKey]) {
      fields[fieldKey] = {
        value: normalizeFieldValue(custom[fieldKey], dataType),
        source: 'webpage',
        method: EXTRACTION_METHODS.CSS_SELECTOR,
        confidence: 0.95,
        raw: custom[fieldKey],
      };
      return;
    }

    // 1. Check JSON-LD
    if (jsonLd && jsonLd[fieldKey]) {
      fields[fieldKey] = {
        value: normalizeFieldValue(jsonLd[fieldKey], dataType),
        source: 'webpage',
        method: EXTRACTION_METHODS.JSON_LD,
        confidence: 0.98,
        raw: String(jsonLd[fieldKey]),
      };
      return;
    }

    // 2. Check OpenGraph
    if (og && og[fieldKey]) {
      fields[fieldKey] = {
        value: normalizeFieldValue(og[fieldKey], dataType),
        source: 'webpage',
        method: EXTRACTION_METHODS.OPEN_GRAPH,
        confidence: 0.91,
        raw: String(og[fieldKey]),
      };
      return;
    }

    // 3. Check Microdata
    if (micro && micro[fieldKey]) {
      fields[fieldKey] = {
        value: normalizeFieldValue(micro[fieldKey], dataType),
        source: 'webpage',
        method: EXTRACTION_METHODS.MICRODATA,
        confidence: 0.86,
        raw: String(micro[fieldKey]),
      };
      return;
    }

    // 4. Check DOM / Spec Table
    if (dom && dom[fieldKey]) {
      fields[fieldKey] = {
        value: normalizeFieldValue(dom[fieldKey], dataType),
        source: 'webpage',
        method: EXTRACTION_METHODS.HEURISTIC,
        confidence: 0.82,
        raw: String(dom[fieldKey]),
      };
      return;
    }

    // Special Price resolution
    if (fieldKey === 'price' && dom.rawPrice) {
      fields.price = {
        value: normalizeFieldValue(dom.rawPrice, 'currency'),
        source: 'webpage',
        method: EXTRACTION_METHODS.CSS_SELECTOR,
        confidence: 0.85,
        raw: dom.rawPrice,
      };
      return;
    }

    // 5. Check Heuristics
    if (heuristics && heuristics[fieldKey]) {
      fields[fieldKey] = {
        value: normalizeFieldValue(heuristics[fieldKey], dataType),
        source: 'webpage',
        method: EXTRACTION_METHODS.REGEX,
        confidence: 0.72,
        raw: String(heuristics[fieldKey]),
      };
      return;
    }

    // Field not found
    fields[fieldKey] = {
      value: null,
      source: 'webpage',
      method: null,
      confidence: 0,
      raw: null,
    };
  };

  // Resolve standard fields
  const standardKeys = [
    'productName', 'brand', 'price', 'compareAtPrice', 'mrp', 'currency', 'sku',
    'productUrl', 'weight', 'dimensions', 'color', 'material', 'finish',
    'description', 'careInstruction', 'availability', 'rating', 'imageUrl',
  ];

  standardKeys.forEach(k => {
    const isNumber = ['price', 'compareAtPrice', 'mrp', 'discount'].includes(k);
    resolveField(k, isNumber ? 'currency' : 'string');
  });

  const foundFields = Object.values(fields).filter(f => f.value !== null && f.value !== '');
  const avgConfidence = foundFields.length > 0
    ? foundFields.reduce((acc, f) => acc + f.confidence, 0) / foundFields.length
    : 0;

  return {
    url,
    fields,
    meta: {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || null,
      foundFieldsCount: foundFields.length,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      hasJsonLd: !!jsonLd,
      hasOpenGraph: !!og.productName || !!og.price,
    },
  };
}
