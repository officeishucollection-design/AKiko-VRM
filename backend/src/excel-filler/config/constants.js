export const STATUS = {
  URL_MISSING: 'URL Missing',
  URL_INVALID: 'URL Invalid',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  PARTIAL: 'Partial',
  FAILED: 'Failed',
  NEEDS_REVIEW: 'Needs Review',
};

export const SOURCES = {
  CSV: 'CSV',
  WEBPAGE: 'Webpage',
  PRODUCT_URL: 'Product URL',
  CSV_THEN_WEBPAGE: 'CSV (Webpage Fallback)',
  WEBPAGE_THEN_CSV: 'Webpage (CSV Fallback)',
  MANUAL: 'Manual',
  IGNORE: 'Ignore (Do Not Change)',
};

export const DATA_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  CURRENCY: 'currency',
  DATE: 'date',
  BOOLEAN: 'boolean',
  IMAGE_URL: 'image_url',
  ARRAY: 'array',
};

export const EXTRACTION_METHODS = {
  JSON_LD: 'JSON-LD / Schema.org',
  OPEN_GRAPH: 'OpenGraph Meta',
  MICRODATA: 'HTML Microdata',
  CSS_SELECTOR: 'CSS Selector',
  HEURISTIC: 'Heuristic Spec Table',
  REGEX: 'Regex Pattern',
  AI_FALLBACK: 'AI Heuristic Parser',
  CSV: 'CSV Record',
  PRODUCT_URL: 'User Provided URL',
  MANUAL: 'Manual Override',
};

export const STANDARD_FIELDS = [
  { key: 'productName', label: 'Product Name / Title', defaultType: 'string', category: 'General' },
  { key: 'brand', label: 'Brand / Manufacturer', defaultType: 'string', category: 'General' },
  { key: 'category', label: 'Category', defaultType: 'string', category: 'General' },
  { key: 'sku', label: 'SKU / Model Number', defaultType: 'string', category: 'General' },
  { key: 'productUrl', label: 'Product Webpage URL', defaultType: 'string', category: 'General' },
  { key: 'price', label: 'Price / Variant Price', defaultType: 'currency', category: 'Pricing' },
  { key: 'compareAtPrice', label: 'Compare At Price / MRP', defaultType: 'currency', category: 'Pricing' },
  { key: 'mrp', label: 'MRP / Original Price', defaultType: 'currency', category: 'Pricing' },
  { key: 'discount', label: 'Discount %', defaultType: 'number', category: 'Pricing' },
  { key: 'currency', label: 'Currency', defaultType: 'string', category: 'Pricing' },
  { key: 'weight', label: 'Weight (kg/g / Grams)', defaultType: 'string', category: 'Physical' },
  { key: 'dimensions', label: 'Dimensions (inch/cm) - L x B x H', defaultType: 'string', category: 'Physical' },
  { key: 'color', label: 'Color', defaultType: 'string', category: 'Physical' },
  { key: 'material', label: 'Material', defaultType: 'string', category: 'Physical' },
  { key: 'finish', label: 'Finish / Surface Finish', defaultType: 'string', category: 'Physical' },
  { key: 'size', label: 'Size', defaultType: 'string', category: 'Physical' },
  { key: 'description', label: 'Description', defaultType: 'string', category: 'Content' },
  { key: 'careInstruction', label: 'Care Instruction / Guide', defaultType: 'string', category: 'Content' },
  { key: 'specifications', label: 'Specifications', defaultType: 'string', category: 'Content' },
  { key: 'availability', label: 'Availability / Stock', defaultType: 'string', category: 'Inventory' },
  { key: 'rating', label: 'Rating / Reviews', defaultType: 'string', category: 'Social' },
  { key: 'imageUrl', label: 'Product Image URL', defaultType: 'image_url', category: 'Media' },
];
