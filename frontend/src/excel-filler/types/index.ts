export interface CsvData {
  headers: string[];
  totalRows: number;
  rows: Record<string, any>[];
  preview: Record<string, any>[];
  previewRows?: Record<string, any>[];
  suggestedPrimaryKey: string;
  suggestedKeys: string[];
}

export interface ExcelHeader {
  colIndex: number;
  header: string;
  address: string;
}

export interface ExcelSheetInfo {
  id: number;
  name: string;
  rowCount: number;
  columnCount: number;
  headers: ExcelHeader[];
  headerRowIndex: number;
  previewRows: Record<string, any>[];
  sampleRows?: Record<string, any>[];
  existingRows?: Record<string, any>[];
  hasFormulas: boolean;
}

export interface ExcelInfo {
  sheets: ExcelSheetInfo[];
  sheetCount: number;
  defaultSheet: string;
}

export type FieldSource =
  | 'CSV'
  | 'Webpage'
  | 'Product URL'
  | 'CSV (Webpage Fallback)'
  | 'Webpage (CSV Fallback)'
  | 'Manual'
  | 'Ignore (Do Not Change)';

export type DataType =
  | 'string'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'image_url';

export type ValueTransform =
  | 'none'
  | 'dimension_length'
  | 'dimension_width'
  | 'dimension_height';

export interface FieldMapping {
  targetColumn: string;
  source: FieldSource;
  csvField: string;
  webField: string;
  dataType: DataType;
  transform?: ValueTransform;
  manualValue?: string;
  customSelector?: string;
}

export interface ExtractedField {
  value: any;
  source: string;
  method: string | null;
  confidence: number;
  raw: string | null;
}

export interface Conflict {
  field: string;
  csvValue: any;
  webValue: any;
  confidence: number;
  chosenSource: 'csv' | 'webpage' | 'manual';
}

export type ProductStatus =
  | 'URL Missing'
  | 'URL Invalid'
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Partial'
  | 'Failed'
  | 'Needs Review';

export interface ProductItem {
  id: string;
  index: number;
  csvData: Record<string, any>;
  url: string;
  status: ProductStatus;
  error: string | null;
  extractedFields: Record<string, ExtractedField>;
  manualOverrides: Record<string, any>;
  conflicts: Conflict[];
  chosenSources: Record<string, string>;
  processedAt?: string;
  durationMs?: number;
}

export interface JobProgress {
  total: number;
  completed: number;
  partial: number;
  failed: number;
  urlMissing: number;
  pending: number;
  processing: number;
  percentage: number;
}

export interface JobLog {
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface Job {
  id: string;
  createdAt: string;
  state: 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';
  progress: JobProgress;
  currentProduct?: { id: string; name: string; url: string } | null;
  primaryKeyMapping: {
    csvKey: string;
    excelKey: string;
    mode: 'identifier' | 'row_order';
  };
  fieldMappings: FieldMapping[];
  excelInfo?: ExcelInfo;
  items: ProductItem[];
  logs: JobLog[];
}

export interface StandardField {
  key: string;
  label: string;
  defaultType: DataType;
  category: string;
}

export type SkipOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with';

export interface SkipRule {
  id: string;
  column: string;
  operator: SkipOperator;
  value: string;
  enabled?: boolean;
}

