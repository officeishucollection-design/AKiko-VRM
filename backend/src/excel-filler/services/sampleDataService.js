import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export const SAMPLE_SMARTPHONES = [
  {
    'Product ID': 'PH-101',
    'Product Name': 'iPhone 15',
    'Category': 'Smartphone',
    'Brand': 'Apple',
    'Default Storage': '128GB',
    'sampleUrl': 'https://sample-store.mock/products/apple-iphone-15',
  },
  {
    'Product ID': 'PH-102',
    'Product Name': 'Galaxy S24 Ultra',
    'Category': 'Smartphone',
    'Brand': 'Samsung',
    'Default Storage': '256GB',
    'sampleUrl': 'https://sample-store.mock/products/samsung-galaxy-s24-ultra',
  },
  {
    'Product ID': 'PH-103',
    'Product Name': 'Pixel 9 Pro',
    'Category': 'Smartphone',
    'Brand': 'Google',
    'Default Storage': '128GB',
    'sampleUrl': 'https://sample-store.mock/products/google-pixel-9-pro',
  },
  {
    'Product ID': 'PH-104',
    'Product Name': 'OnePlus 12',
    'Category': 'Smartphone',
    'Brand': 'OnePlus',
    'Default Storage': '512GB',
    'sampleUrl': 'https://sample-store.mock/products/oneplus-12-5g',
  },
  {
    'Product ID': 'PH-105',
    'Product Name': 'MacBook Air M3',
    'Category': 'Laptop',
    'Brand': 'Apple',
    'Default Storage': '512GB',
    'sampleUrl': 'https://sample-store.mock/products/apple-macbook-air-m3',
  },
  {
    'Product ID': 'PH-106',
    'Product Name': 'WH-1000XM5 Headphones',
    'Category': 'Audio',
    'Brand': 'Sony',
    'Default Storage': 'N/A',
    'sampleUrl': 'https://sample-store.mock/products/sony-wh-1000xm5',
  },
  {
    'Product ID': 'PH-107',
    'Product Name': 'Air Zoom Pegasus 40',
    'Category': 'Footwear',
    'Brand': 'Nike',
    'Default Storage': 'Size 10',
    'sampleUrl': 'https://sample-store.mock/products/nike-air-zoom-pegasus-40',
  },
];

export async function createSampleExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DataFill Automator';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Master Product Catalog', {
    views: [{ showGridLines: true }],
  });

  // Headers
  worksheet.columns = [
    { header: 'SKU Code', key: 'sku', width: 16 },
    { header: 'Product Title', key: 'title', width: 28 },
    { header: 'Category', key: 'category', width: 18 },
    { header: 'Manufacturer', key: 'brand', width: 18 },
    { header: 'Selling Price (INR)', key: 'price', width: 20 },
    { header: 'MRP (INR)', key: 'mrp', width: 18 },
    { header: 'Item Weight', key: 'weight', width: 16 },
    { header: 'Primary Color', key: 'color', width: 16 },
    { header: 'Dimensions', key: 'dimensions', width: 22 },
    { header: 'Stock Availability', key: 'stock', width: 20 },
    { header: 'Detailed Description', key: 'desc', width: 45 },
  ];

  // Header Styling (Professional Modern Slate/Navy look)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Add 2 pre-existing template rows to demonstrate matching existing SKU codes
  const sampleRows = [
    {
      sku: 'PH-101',
      title: 'iPhone 15 (Template Pre-entry)',
      category: 'Smartphone',
      brand: 'Apple Inc.',
      price: 0,
      mrp: 0,
      weight: '',
      color: '',
      dimensions: '',
      stock: 'Pending',
      desc: '',
    },
    {
      sku: 'PH-102',
      title: 'Galaxy S24 Ultra',
      category: 'Smartphone',
      brand: 'Samsung',
      price: 0,
      mrp: 0,
      weight: '',
      color: '',
      dimensions: '',
      stock: 'Pending',
      desc: '',
    },
  ];

  sampleRows.forEach(row => {
    const r = worksheet.addRow(row);
    r.height = 22;
    r.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 5 || colNumber === 6 ? 'right' : 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (colNumber === 5 || colNumber === 6) {
        cell.numFmt = '#,##0.00';
      }
    });
  });

  return await workbook.xlsx.writeBuffer();
}

export function createSampleCsvString() {
  const csvData = SAMPLE_SMARTPHONES.map(({ sampleUrl, ...rest }) => rest);
  return Papa.unparse(csvData);
}

export function getSampleUrlsMap() {
  const map = {};
  SAMPLE_SMARTPHONES.forEach(p => {
    map[p['Product ID']] = p.sampleUrl;
  });
  return map;
}
