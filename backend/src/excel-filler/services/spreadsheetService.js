import ExcelJS from 'exceljs';
import Papa from 'papaparse';

/**
 * Returns a displayable cell value without using ExcelJS's `cell.text` getter.
 *
 * ExcelJS can throw from that getter for a merged follower whose merge master
 * is empty (`MergeValue.toString` calls `null.toString()`). Reading `value`
 * directly is safe for both regular and merged cells.
 */
function getCellText(cell) {
  const value = cell?.value;

  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (value instanceof Date) return value.toString();

  if (Array.isArray(value.richText)) {
    return value.richText.map(part => part?.text ?? '').join('');
  }
  if (value.text !== null && value.text !== undefined) return String(value.text);
  if (value.result !== null && value.result !== undefined) return String(value.result);
  if (value.error !== null && value.error !== undefined) return String(value.error);

  return '';
}

/**
 * Applies an explicit per-mapping transform.  This keeps source-to-template
 * mapping generic: a user may map one dimensions column to multiple target
 * columns without adding template-specific code.
 */
function applyValueTransform(value, transform = 'none') {
  if (value === null || value === undefined || transform === 'none') return value;

  const dimensionIndex = {
    dimension_length: 0,
    dimension_width: 1,
    dimension_height: 2,
  }[transform];

  if (dimensionIndex === undefined) return value;

  const parts = String(value)
    .split(/\s*(?:×|x|X|\*|by)\s*/)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length < 3 || !parts[dimensionIndex]) return value;

  // Units are commonly written only after the final component (e.g.
  // "26.5 × 13.5 × 5 cm"). Carry that unit to the selected component.
  const unitMatch = parts[parts.length - 1].match(/\s*([a-zA-Z]+)\s*$/);
  const selected = parts[dimensionIndex].replace(/\s*[a-zA-Z]+\s*$/, '').trim();
  return unitMatch && !/[a-zA-Z]+\s*$/.test(selected)
    ? `${selected} ${unitMatch[1]}`
    : selected;
}

function getRecordValue(record, fieldName) {
  if (!record || !fieldName) return null;
  if (record[fieldName] !== undefined) return record[fieldName];

  const normalizedField = String(fieldName).trim().toLowerCase();
  const matchingKey = Object.keys(record).find(key => String(key).trim().toLowerCase() === normalizedField);
  return matchingKey === undefined ? null : record[matchingKey];
}

/**
 * Parses raw CSV string or buffer into structured objects and detects columns
 */
export function parseCsv(csvBufferOrString) {
  const content = Buffer.isBuffer(csvBufferOrString)
    ? csvBufferOrString.toString('utf-8')
    : String(csvBufferOrString);

  const results = Papa.parse(content, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  if (results.errors && results.errors.length > 0) {
    const fatal = results.errors.find(e => e.type === 'Quotes' || e.code === 'UndetectableDelimiter');
    if (fatal) {
      throw new Error(`CSV Parsing Error on row ${fatal.row || 'unknown'}: ${fatal.message}`);
    }
  }

  const headers = results.meta.fields ? results.meta.fields.filter(Boolean) : [];
  if (headers.length === 0) {
    throw new Error('Uploaded CSV file does not contain any valid column headers.');
  }

  // Filter out empty records
  const allRows = (results.data || []).filter(row => {
    return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
  });

  // Detect SKU column if present (e.g. Variant SKU, SKU, Item Code)
  const skuHeader = headers.find(h => {
    const l = h.toLowerCase().trim();
    return l === 'variant sku' || l === 'sku' || l === 'item code' || l === 'sku code' || l === 'item sku' || l === 'product sku';
  }) || headers.find(h => h.toLowerCase().includes('sku'));

  // Only keep rows that have a non-empty SKU
  const rows = skuHeader
    ? allRows.filter(row => {
        const val = row[skuHeader];
        return val !== null && val !== undefined && String(val).trim() !== '';
      })
    : allRows;

  // Suggest primary keys (preferring SKU)
  const suggestedKeys = headers.filter(h => {
    const l = h.toLowerCase();
    return l.includes('sku') || l.includes('id') || l.includes('code') || l.includes('handle') || l.includes('key') || l.includes('item') || l.includes('product');
  });

  const suggestedPrimaryKey = skuHeader || suggestedKeys[0] || headers[0] || '';

  return {
    headers,
    rows,
    totalRows: rows.length,
    suggestedPrimaryKey,
    suggestedKeys: suggestedKeys.length > 0 ? suggestedKeys : (suggestedPrimaryKey ? [suggestedPrimaryKey] : []),
    preview: rows.slice(0, 10),
    previewRows: rows.slice(0, 10),
  };
}

/**
 * Parses uploaded Excel workbook (.xlsx/.xls) into a structured dataset for Step 1
 */
export async function parseExcelToDataset(excelBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Uploaded Excel workbook contains no worksheets.');
  }

  let headerRowNumber = 1;
  const headers = [];
  const colIndexMap = new Map();

  worksheet.eachRow((row, rowNumber) => {
    if (headers.length === 0) {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const val = getCellText(cell).trim();
        if (val) {
          headers.push(val);
          colIndexMap.set(colNumber, val);
        }
      });
      if (headers.length > 0) {
        headerRowNumber = rowNumber;
      }
    }
  });

  if (headers.length === 0) {
    throw new Error('Uploaded Excel workbook contains no column headers.');
  }

  const allRows = [];
  for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (row && row.hasValues) {
      const rowData = {};
      let hasData = false;
      colIndexMap.forEach((headerName, colIndex) => {
        const cell = row.getCell(colIndex);
        const textVal = getCellText(cell);
        rowData[headerName] = textVal;
        if (textVal && textVal.trim() !== '') hasData = true;
      });
      if (hasData) {
        allRows.push(rowData);
      }
    }
  }

  // Detect SKU column if present
  const skuHeader = headers.find(h => {
    const l = h.toLowerCase().trim();
    return l === 'variant sku' || l === 'sku' || l === 'item code' || l === 'sku code' || l === 'item sku' || l === 'product sku';
  }) || headers.find(h => h.toLowerCase().includes('sku'));

  // Only keep rows that have a non-empty SKU
  const rows = skuHeader
    ? allRows.filter(row => {
        const val = row[skuHeader];
        return val !== null && val !== undefined && String(val).trim() !== '';
      })
    : allRows;

  const suggestedKeys = headers.filter(h => {
    const l = h.toLowerCase();
    return l.includes('sku') || l.includes('id') || l.includes('code') || l.includes('handle') || l.includes('key') || l.includes('item') || l.includes('product');
  });

  const suggestedPrimaryKey = skuHeader || suggestedKeys[0] || headers[0] || '';

  return {
    headers,
    rows,
    totalRows: rows.length,
    suggestedPrimaryKey,
    suggestedKeys: suggestedKeys.length > 0 ? suggestedKeys : (suggestedPrimaryKey ? [suggestedPrimaryKey] : []),
    preview: rows.slice(0, 10),
    previewRows: rows.slice(0, 10),
  };
}

/**
 * Converts raw CSV string/buffer into an XLSX Excel workbook template for Step 2
 */
export async function convertCsvToExcelTemplate(csvContentOrBuffer) {
  const content = Buffer.isBuffer(csvContentOrBuffer)
    ? csvContentOrBuffer.toString('utf-8')
    : String(csvContentOrBuffer);

  const results = Papa.parse(content, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const headers = results.meta.fields ? results.meta.fields.filter(Boolean) : [];
  const allRows = (results.data || []).filter(row => {
    return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DataFill Automator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Sheet1', {
    views: [{ showGridLines: true }],
  });

  worksheet.columns = headers.map((h, idx) => ({
    header: h,
    key: `col_${idx}`,
    width: Math.max(16, h.length + 4),
  }));

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // Add all rows from CSV
  allRows.forEach(r => {
    worksheet.addRow(headers.map(h => r[h] ?? ''));
  });

  return await workbook.xlsx.writeBuffer();
}

/**
 * Converts a 1-based column number to Excel column letter (e.g. 1 -> A, 27 -> AA)
 */
function colIndexToLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    let mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Inspects uploaded Excel template (.xlsx) without modifying it
 * Returns sheets, dimensions, headers, sample row values, and formulas
 */
export async function inspectExcel(excelBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBuffer);

  const sheets = [];

  workbook.eachSheet((worksheet) => {
    // Find the header row (first non-empty row)
    let headerRowNumber = 1;
    let headers = [];

    worksheet.eachRow((row, rowNumber) => {
      if (headers.length === 0) {
        const cells = [];
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const val = getCellText(cell);
          if (val.trim()) {
            cells.push({ col: colNumber, name: val.trim() });
          }
        });
        if (cells.length > 0) {
          headerRowNumber = rowNumber;
          headers = cells;
        }
      }
    });

    // Detect existing rows, sample rows, and formulas
    const existingRows = [];
    const sampleRows = [];
    const detectedFormulas = [];

    for (let r = headerRowNumber + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      if (row && row.hasValues) {
        const rowData = {};
        let hasData = false;
        headers.forEach(({ col, name }) => {
          const cell = row.getCell(col);
          const val = getCellText(cell);
          rowData[name] = val;
          if (val.trim()) hasData = true;

          if (cell.formula || (cell.value && typeof cell.value === 'object' && cell.value.formula)) {
            detectedFormulas.push({
              row: r,
              column: name,
              formula: cell.formula || cell.value.formula,
            });
          }
        });
        if (hasData) {
          existingRows.push(rowData);
          if (sampleRows.length < 10) {
            sampleRows.push(rowData);
          }
        }
      }
    }

    const formattedHeaders = headers.map(({ col, name }) => ({
      colIndex: col,
      header: name,
      address: `${colIndexToLetter(col)}${headerRowNumber}`,
    }));

    sheets.push({
      id: worksheet.id,
      name: worksheet.name,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      headerRowNumber,
      headerRowIndex: headerRowNumber,
      headers: formattedHeaders,
      headerNames: headers.map(h => h.name),
      headerDetails: headers,
      previewRows: sampleRows,
      sampleRows,
      existingRows,
      hasFormulas: detectedFormulas.length > 0,
      detectedFormulas,
    });
  });

  return {
    sheetCount: sheets.length,
    sheets,
    defaultSheet: sheets[0]?.name || '',
  };
}

/**
 * Normalizes field values according to target data type
 */
function normalizeFieldValue(rawVal, dataType) {
  if (rawVal === null || rawVal === undefined || rawVal === '') return '';

  const str = String(rawVal).trim();

  switch (dataType) {
    case 'currency':
    case 'number': {
      // Remove currency symbols, commas, non-numeric characters except period and minus
      const cleaned = str.replace(/[^0-9.-]/g, '');
      const num = Number(cleaned);
      return isNaN(num) ? str : num;
    }
    case 'boolean': {
      const l = str.toLowerCase();
      return l === 'true' || l === 'yes' || l === '1' || l === 'in stock';
    }
    case 'url':
    case 'image':
      return str.startsWith('//') ? `https:${str}` : str;
    case 'date':
      return str;
    case 'string':
    default:
      return str;
  }
}

/**
 * Helper to resolve final field value from product, overrides, CSV, or webpage
 */
export function getFinalValue(prod, mapping) {
  const { targetColumn, source, csvField, webField, dataType, manualValue } = mapping;
  const manualVal = prod.manualOverrides?.[targetColumn] ?? prod.manualOverrides?.[webField];

  if (manualVal !== undefined && manualVal !== null && manualVal !== '') {
    return normalizeFieldValue(applyValueTransform(manualVal, mapping.transform), dataType);
  }

  if (source === 'Ignore (Do Not Change)' || source === 'Ignore') {
    return undefined; // Do not touch
  }

  let csvVal = getRecordValue(prod.csvData, csvField);
  // If csvVal is empty/null, try to find direct match in csvData by target column name
  if ((csvVal === null || csvVal === undefined || csvVal === '') && prod.csvData) {
    if (prod.csvData[targetColumn] !== undefined) {
      csvVal = prod.csvData[targetColumn];
    }
  }

  const webFieldObj = prod.extractedFields?.[webField || targetColumn];
  const webVal = applyValueTransform(webFieldObj?.value ?? null, mapping.transform);

  const lowerTarget = (targetColumn || '').toLowerCase().trim();
  const isUrlColumn = source === 'Product URL' || webField === 'productUrl' || lowerTarget.includes('product link') || lowerTarget.includes('product url') || lowerTarget === 'url' || lowerTarget === 'link' || lowerTarget.includes('webpage') || lowerTarget.includes('item url');

  if (isUrlColumn) {
    if (prod.url && String(prod.url).trim()) {
      return String(prod.url).trim();
    }
    if (csvVal && String(csvVal).trim()) {
      return String(csvVal).trim();
    }
    if (prod.csvData) {
      const foundUrl = Object.entries(prod.csvData).find(([k, v]) => {
        const l = k.toLowerCase().trim();
        return (l.includes('url') || l.includes('link') || l.includes('webpage') || l.includes('website')) && !l.includes('image') && v && String(v).trim();
      });
      if (foundUrl) return String(foundUrl[1]).trim();
    }
    if (prod.excelData) {
      const foundExcelUrl = Object.entries(prod.excelData).find(([k, v]) => {
        const l = k.toLowerCase().trim();
        return (l.includes('url') || l.includes('link') || l.includes('webpage') || l.includes('website')) && !l.includes('image') && v && String(v).trim();
      });
      if (foundExcelUrl) return String(foundExcelUrl[1]).trim();
    }
    return '';
  }

  // Weight transformation if source is Variant Grams
  if (csvField && (csvField.toLowerCase().includes('gram') || (targetColumn.toLowerCase().includes('weight') && csvVal))) {
    const trimmed = String(csvVal).trim();
    if (trimmed && !isNaN(Number(trimmed)) && !trimmed.toLowerCase().endsWith('g') && !trimmed.toLowerCase().endsWith('gm')) {
      csvVal = `${trimmed} gm`;
    }
  }

  if (source === 'Manual') {
    return applyValueTransform(manualValue || '', mapping.transform);
  }

  csvVal = applyValueTransform(csvVal, mapping.transform);

  if (source === 'CSV') {
    return csvVal !== null && csvVal !== undefined && csvVal !== '' ? (csvField?.toLowerCase().includes('gram') ? csvVal : normalizeFieldValue(csvVal, dataType)) : (webVal ? normalizeFieldValue(webVal, dataType) : '');
  }

  if (source === 'Webpage') {
    if (webVal !== null && webVal !== undefined && String(webVal).trim() !== '') {
      return normalizeFieldValue(webVal, dataType);
    }
    return csvVal !== null && csvVal !== undefined ? normalizeFieldValue(csvVal, dataType) : '';
  }

  if (source === 'CSV (Webpage Fallback)') {
    if (csvVal !== null && csvVal !== undefined && String(csvVal).trim() !== '') {
      return normalizeFieldValue(csvVal, dataType);
    }
    return webVal !== null && webVal !== undefined ? normalizeFieldValue(webVal, dataType) : '';
  }

  if (source === 'Webpage (CSV Fallback)') {
    if (webVal !== null && webVal !== undefined && String(webVal).trim() !== '') {
      return normalizeFieldValue(webVal, dataType);
    }
    return csvVal !== null && csvVal !== undefined ? normalizeFieldValue(csvVal, dataType) : '';
  }

  // Default fallback
  return webVal || csvVal || '';
}

/**
 * Resolves the SKU for a product from mappings, CSV data, overrides, or extracted fields
 */
export function getProductSku(prod, fieldMappings = []) {
  if (!prod) return '';

  // 1. Check mapped SKU field
  const skuMapping = fieldMappings.find(m => {
    const t = (m.targetColumn || '').toLowerCase();
    const w = (m.webField || '').toLowerCase();
    const c = (m.csvField || '').toLowerCase();
    return t.includes('sku') || t.includes('item code') || w === 'sku' || c.includes('sku');
  });

  if (skuMapping) {
    const val = getFinalValue(prod, skuMapping);
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }

  // 2. Check manual overrides
  if (prod.manualOverrides) {
    for (const [k, v] of Object.entries(prod.manualOverrides)) {
      if (k.toLowerCase().includes('sku') && v !== undefined && v !== null && String(v).trim()) {
        return String(v).trim();
      }
    }
  }

  // 3. Check CSV columns directly
  if (prod.csvData) {
    const skuKeys = ['Variant SKU', 'SKU', 'sku', 'Item Code', 'SKU Code', 'Item SKU', 'Product SKU', 'Code', 'sku_code', 'item_code'];
    for (const k of skuKeys) {
      if (prod.csvData[k] !== undefined && prod.csvData[k] !== null && String(prod.csvData[k]).trim() !== '') {
        return String(prod.csvData[k]).trim();
      }
    }
    for (const [k, v] of Object.entries(prod.csvData)) {
      if (k.toLowerCase().includes('sku') && v !== null && v !== undefined && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
  }

  // 4. Check extracted web fields
  if (prod.extractedFields?.sku?.value) {
    return String(prod.extractedFields.sku.value).trim();
  }

  return '';
}

/**
 * Evaluates whether a product's CSV row matches a skip rule
 */
export function evaluateSkipRule(row = {}, rule = {}) {
  if (!rule.column) return false;
  const rawCell = row[rule.column];
  const cellVal = rawCell !== undefined && rawCell !== null ? String(rawCell).trim().toLowerCase() : '';
  const targetVal = (rule.value || '').trim().toLowerCase();

  switch (rule.operator) {
    case 'equals':
      return cellVal === targetVal;
    case 'not_equals':
      return cellVal !== targetVal;
    case 'contains':
      return targetVal !== '' && cellVal.includes(targetVal);
    case 'not_contains':
      return targetVal !== '' && !cellVal.includes(targetVal);
    case 'starts_with':
      return targetVal !== '' && cellVal.startsWith(targetVal);
    case 'ends_with':
      return targetVal !== '' && cellVal.endsWith(targetVal);
    case 'is_empty':
      return cellVal === '';
    case 'is_not_empty':
      return cellVal !== '';
    default:
      return false;
  }
}

export function shouldSkipRow(row = {}, rules = []) {
  const activeRules = rules.filter(r => r.enabled !== false && r.column && r.column.trim() !== '');
  if (activeRules.length === 0) return false;
  return activeRules.some(r => evaluateSkipRule(row, r));
}

/**
 * Populates an Excel template with merged product data while strictly preserving:
 * - Existing sheets and metadata
 * - Header styling, fonts, colors, borders, and column widths
 * - Preserved formulas
 * - Number formatting
 */
export async function generatePopulatedExcel(templateBuffer, options) {
  const {
    sheetName,
    fieldMappings = [],
    productsData = [], // Array of { id, csvData, extractedFields, manualOverrides, url }
    primaryKeyMapping = { csvKey: '', excelKey: '', mode: 'identifier' }, // 'identifier' or 'row_order'
    skipRules = [],
  } = options;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!worksheet) {
    throw new Error(`Target sheet "${sheetName}" not found in template.`);
  }

  // Filter products: If dataset or field mappings contain SKU, only populate products that have a non-empty SKU
  const hasSkuField = fieldMappings.some(m => {
    const t = (m.targetColumn || '').toLowerCase();
    const w = (m.webField || '').toLowerCase();
    const c = (m.csvField || '').toLowerCase();
    return t.includes('sku') || w === 'sku' || c.includes('sku');
  }) || (productsData.length > 0 && Object.keys(productsData[0].csvData || {}).some(k => k.toLowerCase().includes('sku')));

  let eligibleProducts = hasSkuField
    ? productsData.filter(p => Boolean(getProductSku(p, fieldMappings)))
    : productsData;

  if (skipRules && skipRules.length > 0) {
    eligibleProducts = eligibleProducts.filter(p => !shouldSkipRow(p.csvData, skipRules));
  }

  // Detect header row and column positions
  let headerRowIdx = 1;
  const headerMap = new Map(); // colName.toLowerCase() -> { colNumber, originalName }

  worksheet.eachRow((row, rowNumber) => {
    if (headerMap.size === 0) {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = getCellText(cell).trim();
        if (text) {
          headerMap.set(text.toLowerCase(), { colNumber, originalName: text });
        }
      });
      if (headerMap.size > 0) {
        headerRowIdx = rowNumber;
      }
    }
  });

  // Map of existing Excel rows by multiple strategies
  const existingRows = [];
  let lastPopulatedRow = headerRowIdx;
  const existingKeyMap = new Map();
  const existingSkuMap = new Map();
  const existingTitleMap = new Map();
  const existingUrlMap = new Map();

  const excelKeyColIndex = primaryKeyMapping.excelKey
    ? headerMap.get(primaryKeyMapping.excelKey.toLowerCase())?.colNumber
    : null;

  let templateSkuCol = null;
  let templateTitleCol = null;
  let templateUrlCol = null;

  for (const [colNameLower, info] of headerMap.entries()) {
    if (!templateSkuCol && (colNameLower === 'sku' || colNameLower.includes('variant sku') || colNameLower.includes('item code') || colNameLower.includes('sku code'))) {
      templateSkuCol = info.colNumber;
    }
    if (!templateTitleCol && (colNameLower === 'title' || colNameLower.includes('product name') || colNameLower.includes('product title') || colNameLower === 'name')) {
      templateTitleCol = info.colNumber;
    }
    if (!templateUrlCol && (colNameLower.includes('url') || colNameLower.includes('link') || colNameLower.includes('webpage') || colNameLower.includes('website'))) {
      templateUrlCol = info.colNumber;
    }
  }

  for (let r = headerRowIdx + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || !row.hasValues) continue;

    existingRows.push(r);
    lastPopulatedRow = r;

    if (excelKeyColIndex) {
      const v = getCellText(row.getCell(excelKeyColIndex)).trim().toLowerCase();
      if (v) existingKeyMap.set(v, r);
    }
    if (templateSkuCol) {
      const v = getCellText(row.getCell(templateSkuCol)).trim().toLowerCase();
      if (v) existingSkuMap.set(v, r);
    }
    if (templateTitleCol) {
      const v = getCellText(row.getCell(templateTitleCol)).trim().toLowerCase();
      if (v) existingTitleMap.set(v, r);
    }
    if (templateUrlCol) {
      const v = getCellText(row.getCell(templateUrlCol)).trim().toLowerCase();
      if (v) existingUrlMap.set(v, r);
    }
  }

  const headerRow = worksheet.getRow(headerRowIdx);
  const columnMap = new Map(); // headerName.toLowerCase() -> colIndex

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = getCellText(cell).trim().toLowerCase();
    columnMap.set(text, colNumber);
  });

  const getColIndex = (targetColName) => {
    if (!targetColName) return null;
    const clean = targetColName.trim().toLowerCase();
    if (columnMap.has(clean)) return columnMap.get(clean);
    const alphaClean = clean.replace(/[^a-z0-9]/g, '');
    for (const [colName, idx] of columnMap.entries()) {
      if (colName.replace(/[^a-z0-9]/g, '') === alphaClean) {
        return idx;
      }
    }
    for (const [colName, idx] of columnMap.entries()) {
      if (colName.includes(clean) || clean.includes(colName)) {
        return idx;
      }
    }
    return null;
  };

  // Template style reference row for appending new rows
  const templateStyleRow = worksheet.getRow(headerRowIdx + 1);

  // Populate eligible products
  for (let i = 0; i < eligibleProducts.length; i++) {
    const prod = eligibleProducts[i];
    let targetRowNumber = null;

    // 1. Explicit primaryKeyMapping match
    if (primaryKeyMapping.mode === 'identifier' && excelKeyColIndex) {
      const csvKey = primaryKeyMapping.csvKey;
      const idVal = String(prod.csvData?.[csvKey] || prod.id || '').trim().toLowerCase();
      if (idVal && existingKeyMap.has(idVal)) {
        targetRowNumber = existingKeyMap.get(idVal);
      }
    }

    // 2. SKU match
    if (!targetRowNumber && existingSkuMap.size > 0) {
      const skuVal = String(getProductSku(prod, fieldMappings) || prod.csvData?.['Variant SKU'] || prod.csvData?.['SKU'] || prod.id || '').trim().toLowerCase();
      if (skuVal && existingSkuMap.has(skuVal)) {
        targetRowNumber = existingSkuMap.get(skuVal);
      }
    }

    // 3. Title match
    if (!targetRowNumber && existingTitleMap.size > 0) {
      const titleVal = String(prod.csvData?.['Title'] || prod.csvData?.['Product Name'] || prod.csvData?.['Name'] || '').trim().toLowerCase();
      if (titleVal && existingTitleMap.has(titleVal)) {
        targetRowNumber = existingTitleMap.get(titleVal);
      }
    }

    // 4. URL match
    if (!targetRowNumber && existingUrlMap.size > 0) {
      const urlVal = String(prod.url || prod.csvData?.['Product URL'] || prod.csvData?.['URL'] || '').trim().toLowerCase();
      if (urlVal && existingUrlMap.has(urlVal)) {
        targetRowNumber = existingUrlMap.get(urlVal);
      }
    }

    // 5. Existing row order match if template has existing rows
    if (!targetRowNumber && i < existingRows.length) {
      targetRowNumber = existingRows[i];
    }

    // 6. Append new row at bottom if more products than existing rows
    if (!targetRowNumber) {
      // A template can have hundreds of formatted-but-empty rows. Append
      // after the last row with data, not after worksheet.rowCount.
      targetRowNumber = lastPopulatedRow + 1;
    }

    const row = worksheet.getRow(targetRowNumber);

    // Apply values for each mapped field
    for (const mapping of fieldMappings) {
      const colIndex = getColIndex(mapping.targetColumn);
      if (!colIndex) continue;

      const cell = row.getCell(colIndex);

      if (mapping.source === 'Ignore (Do Not Change)' || mapping.source === 'Ignore') {
        // Explicitly ignored: leave template cell completely untouched. Do NOT overwrite or fill from CSV.
        continue;
      }

      const finalVal = getFinalValue(prod, mapping);
      if (finalVal === undefined) continue;

      // Only overwrite if cell is not an essential preserved formula or if user explicitly mapped it
      if (mapping.dataType === 'number' || mapping.dataType === 'currency') {
        const num = Number(finalVal);
        cell.value = isNaN(num) ? finalVal : num;
        if (mapping.dataType === 'currency' && !cell.numFmt) {
          cell.numFmt = '#,##0.00';
        }
      } else if (mapping.dataType === 'boolean') {
        cell.value = Boolean(finalVal);
      } else {
        const valStr = finalVal !== null && finalVal !== undefined ? String(finalVal).trim() : '';
        const existingText = getCellText(cell).trim();
        if (!valStr && existingText) {
          // Preserve existing template value
        } else {
          cell.value = valStr;
        }
      }

      // Copy basic styles if this is a newly created row
      if (templateStyleRow && targetRowNumber > worksheet.rowCount - eligibleProducts.length) {
        const refCell = templateStyleRow.getCell(colIndex);
        if (refCell.style && Object.keys(refCell.style).length > 0) {
          cell.style = Object.assign({}, refCell.style);
        }
      }
    }

    row.commit();
    lastPopulatedRow = Math.max(lastPopulatedRow, targetRowNumber);
  }

  // Generate binary XLSX buffer
  const outputBuffer = await workbook.xlsx.writeBuffer();
  return outputBuffer;
}

/**
 * Generates a populated CSV string based on field mappings and processed product records
 */
export function generatePopulatedCsv(options) {
  const {
    fieldMappings = [],
    productsData = [],
    skipRules = [],
  } = options;

  // Filter products: If dataset or field mappings contain SKU, only populate products that have a non-empty SKU
  const hasSkuField = fieldMappings.some(m => {
    const t = (m.targetColumn || '').toLowerCase();
    const w = (m.webField || '').toLowerCase();
    const c = (m.csvField || '').toLowerCase();
    return t.includes('sku') || w === 'sku' || c.includes('sku');
  }) || (productsData.length > 0 && Object.keys(productsData[0].csvData || {}).some(k => k.toLowerCase().includes('sku')));

  let eligibleProducts = hasSkuField
    ? productsData.filter(p => Boolean(getProductSku(p, fieldMappings)))
    : productsData;

  if (skipRules && skipRules.length > 0) {
    eligibleProducts = eligibleProducts.filter(p => !shouldSkipRow(p.csvData, skipRules));
  }

  // Headers are the targetColumns of field mappings
  const headers = fieldMappings.map(m => m.targetColumn);

  const dataRows = eligibleProducts.map(prod => {
    const row = {};
    fieldMappings.forEach(mapping => {
      if (mapping.source === 'Ignore (Do Not Change)' || mapping.source === 'Ignore') {
        // Keep existing template value if present, otherwise empty. Never pull CSV data when ignored!
        row[mapping.targetColumn] = prod.excelData?.[mapping.targetColumn] ?? '';
        return;
      }
      let val = getFinalValue(prod, mapping);
      row[mapping.targetColumn] = val !== undefined && val !== null ? val : '';
    });
    return row;
  });

  return Papa.unparse({
    fields: headers,
    data: dataRows.map(r => headers.map(h => r[h] ?? '')),
  });
}

