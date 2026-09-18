import axios from 'axios';
import {
  CsvData,
  ExcelInfo,
  FieldMapping,
  Job,
  StandardField,
} from '../types';

const API_BASE = ((import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api');

export const api = {
  // CSV Upload
  async uploadCsv(file: File): Promise<{ filename: string; data: CsvData }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/upload/csv`, formData);
    return res.data;
  },

  async uploadCsvText(csvText: string): Promise<{ filename: string; data: CsvData }> {
    const res = await axios.post(`${API_BASE}/upload/csv`, { csvText });
    return res.data;
  },

  // Excel Upload
  async uploadExcel(file: File): Promise<{ templateId: string; filename: string; data: ExcelInfo }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/upload/excel`, formData);
    return res.data;
  },

  // Extraction Preview
  async previewExtraction(url: string, productName = '', customSelectors = {}) {
    const res = await axios.post(`${API_BASE}/preview/extract`, {
      url,
      productName,
      customSelectors,
    });
    return res.data;
  },

  // Standard Fields Catalog
  async getStandardFields(): Promise<StandardField[]> {
    const res = await axios.get(`${API_BASE}/config/standard-fields`);
    return res.data.fields;
  },

  // Jobs
  async createJob(payload: {
    csvData: CsvData;
    templateId?: string;
    isSample?: boolean;
    sheetName?: string;
    primaryKeyMapping: { csvKey: string; excelKey: string; mode: string };
    fieldMappings: FieldMapping[];
    products: { id: string; csvData: any; url: string }[];
    customSelectors?: Record<string, string>;
    concurrency?: number;
    skipWebExtraction?: boolean;
  }): Promise<{ jobId: string; job: any }> {
    const res = await axios.post(`${API_BASE}/jobs`, payload);
    return res.data;
  },

  async getAllJobs(): Promise<any[]> {
    const res = await axios.get(`${API_BASE}/jobs`);
    return res.data.jobs;
  },

  async getJob(id: string): Promise<Job> {
    const res = await axios.get(`${API_BASE}/jobs/${id}`);
    return res.data.job;
  },

  async startJob(id: string) {
    const res = await axios.post(`${API_BASE}/jobs/${id}/start`);
    return res.data;
  },

  async pauseJob(id: string) {
    const res = await axios.post(`${API_BASE}/jobs/${id}/pause`);
    return res.data;
  },

  async resumeJob(id: string) {
    const res = await axios.post(`${API_BASE}/jobs/${id}/resume`);
    return res.data;
  },

  async cancelJob(id: string) {
    const res = await axios.post(`${API_BASE}/jobs/${id}/cancel`);
    return res.data;
  },

  async retryFailed(id: string) {
    const res = await axios.post(`${API_BASE}/jobs/${id}/retry-failed`);
    return res.data;
  },

  async retrySelected(id: string, productIds: string[]) {
    const res = await axios.post(`${API_BASE}/jobs/${id}/retry-selected`, { productIds });
    return res.data;
  },

  async updateItemField(jobId: string, productId: string, fieldKey: string, value: any, source = 'manual') {
    const res = await axios.put(`${API_BASE}/jobs/${jobId}/items/${productId}`, {
      fieldKey,
      value,
      source,
    });
    return res.data;
  },

  async updateItemUrl(jobId: string, productId: string, url: string) {
    const res = await axios.put(`${API_BASE}/jobs/${jobId}/items/${productId}/url`, { url });
    return res.data;
  },

  async bulkAssignUrls(jobId: string, payload: { urls?: string[]; urlMap?: Record<string, string> }) {
    const res = await axios.post(`${API_BASE}/jobs/${jobId}/urls/bulk`, payload);
    return res.data;
  },

  // Export Populated File (Excel or CSV)
  async exportCatalog(jobId: string, format: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> {
    const res = await axios.post(`${API_BASE}/jobs/${jobId}/export?format=${format}`, { format }, {
      responseType: 'blob',
    });
    return res.data;
  },

  async exportExcel(jobId: string, format: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> {
    return this.exportCatalog(jobId, format);
  },

  // Samples
  async loadSmartphoneSample(): Promise<any> {
    const res = await axios.get(`${API_BASE}/samples/smartphone`);
    return res.data;
  },

  getDownloadCsvUrl(): string {
    return `${API_BASE}/samples/download/csv`;
  },

  getDownloadTemplateUrl(): string {
    return `${API_BASE}/samples/download/template`;
  },
};
