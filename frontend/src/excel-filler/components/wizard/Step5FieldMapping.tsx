import React, { useState, useEffect } from 'react';
import {
  TableProperties,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  Globe,
  FileText,
  Edit3,
  SlidersHorizontal,
  Plus,
  Trash2,
  HelpCircle,
  Code,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import {
  CsvData,
  ExcelSheetInfo,
  FieldMapping,
  FieldSource,
  DataType,
  ValueTransform,
  StandardField,
} from '../../types';

interface Step5FieldMappingProps {
  csvData: CsvData;
  excelSheet: ExcelSheetInfo;
  fieldMappings: FieldMapping[];
  customSelectors: Record<string, string>;
  standardFields: StandardField[];
  skipWebExtraction?: boolean;
  onUpdateMappings: (mappings: FieldMapping[]) => void;
  onUpdateCustomSelectors: (selectors: Record<string, string>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step5FieldMapping: React.FC<Step5FieldMappingProps> = ({
  csvData,
  excelSheet,
  fieldMappings,
  customSelectors,
  standardFields,
  skipWebExtraction = false,
  onUpdateMappings,
  onUpdateCustomSelectors,
  onNext,
  onBack,
}) => {
  const [mappings, setMappings] = useState<FieldMapping[]>(fieldMappings);
  const [showAdvancedSelectors, setShowAdvancedSelectors] = useState(false);

  // Initialize or re-sync mappings with template headers
  useEffect(() => {
    const sheetHeaders = (excelSheet?.headers || []).map(h => (typeof h === 'string' ? h : h?.header || '').trim()).filter(Boolean);
    const mappedCols = mappings.map(m => m.targetColumn.trim());

    const isOutOfSync = sheetHeaders.length !== mappedCols.length ||
      sheetHeaders.some((hName, idx) => hName !== mappedCols[idx]);

    if (isOutOfSync && sheetHeaders.length > 0) {
      applyCustomShopifyRules();
    }
  }, [excelSheet]);

  /**
   * Applies the exact field mapping rules requested:
   * - Title -> CSV Title
   * - SKU -> CSV Variant SKU
   * - Product Link -> Product URL / CSV URL
   * - Description -> Webpage or CSV description
   * - Material -> Webpage or CSV material
   * - Finish -> Webpage or CSV finish
   * - Dimensions (inch/cm) - L x B x H -> Webpage or CSV dimensions
   * - Price -> CSV Variant Price
   * - Compare At Price -> CSV Variant Compare At Price
   * - Weight (kg/g) -> CSV Variant Grams (with 'gm' suffix)
   * - Care Instruction -> CSV Care guide
   * - Ignore all other fields
   */
  const applyCustomShopifyRules = () => {
    const csvHeaders = csvData?.headers || [];

    const findCsvCol = (...candidates: string[]) => {
      for (const cand of candidates) {
        const found = csvHeaders.find(h => h.trim().toLowerCase() === cand.toLowerCase());
        if (found) return found;
      }
      for (const cand of candidates) {
        const found = csvHeaders.find(h => h.toLowerCase().includes(cand.toLowerCase()));
        if (found) return found;
      }
      return '';
    };

    const generated: FieldMapping[] = (excelSheet?.headers || []).map((h) => {
      const colName = (typeof h === 'string' ? h : h?.header || '').trim();
      const lower = colName.toLowerCase();

      // 1. Title / Product Name -> CSV Title
      if (lower === 'title' || lower.includes('product title') || lower.includes('product name')) {
        return {
          targetColumn: colName,
          source: 'CSV',
          csvField: findCsvCol('Title', 'Product Name', 'Handle') || csvHeaders[0],
          webField: 'productName',
          dataType: 'string',
        };
      }

      // 2. SKU -> CSV Variant SKU
      if (lower === 'sku' || lower.includes('variant sku') || lower.includes('item code') || lower.includes('sku code')) {
        return {
          targetColumn: colName,
          source: 'CSV',
          csvField: findCsvCol('Variant SKU', 'SKU', 'Handle') || csvHeaders[0],
          webField: 'sku',
          dataType: 'string',
        };
      }

      // 3. Product Link / URL -> User provided URL or CSV column
      if (lower.includes('product link') || lower.includes('product url') || lower.includes('webpage url') || lower === 'url' || lower === 'link' || lower.includes('item url')) {
        const foundUrlCol = findCsvCol('Product URL', 'Product Link', 'URL', 'Link', 'Webpage', 'Website', 'Item URL', 'Page URL', 'product_url', 'product_link');
        return {
          targetColumn: colName,
          source: 'Product URL',
          csvField: foundUrlCol || '',
          webField: 'productUrl',
          dataType: 'string',
        };
      }

      // 4. Description -> Webpage description (or CSV if web extraction skipped)
      if (lower.includes('description') || lower.includes('desc') || lower.includes('product details')) {
        const csvDesc = findCsvCol('Body (HTML)', 'Description', 'Details', 'Body', 'Summary', 'Text');
        return {
          targetColumn: colName,
          source: skipWebExtraction ? (csvDesc ? 'CSV' : 'Ignore (Do Not Change)') : 'Webpage',
          csvField: csvDesc,
          webField: 'description',
          dataType: 'string',
        };
      }

      // 5. Material -> Webpage material (or CSV if web extraction skipped)
      if (lower.includes('material') || lower.includes('fabric') || lower.includes('primary material')) {
        const csvMat = findCsvCol('Material', 'Fabric', 'Primary Material');
        return {
          targetColumn: colName,
          source: skipWebExtraction ? (csvMat ? 'CSV' : 'Ignore (Do Not Change)') : 'Webpage',
          csvField: csvMat,
          webField: 'material',
          dataType: 'string',
        };
      }

      // 6. Finish -> Webpage finish (or CSV if web extraction skipped)
      if (lower.includes('finish') || lower.includes('surface finish') || lower.includes('polish')) {
        const csvFin = findCsvCol('Finish', 'Surface Finish', 'Polish');
        return {
          targetColumn: colName,
          source: skipWebExtraction ? (csvFin ? 'CSV' : 'Ignore (Do Not Change)') : 'Webpage',
          csvField: csvFin,
          webField: 'finish',
          dataType: 'string',
        };
      }

      // 7. Dimensions (inch/cm) - L x B x H -> Webpage dimensions (or CSV if web extraction skipped)
      if (lower.includes('dimension') || lower.includes('l x b x h') || lower.includes('l x w x h') || lower.includes('size')) {
        const csvDim = findCsvCol('Dimensions', 'Dimension', 'Size', 'L x B x H');
        return {
          targetColumn: colName,
          source: skipWebExtraction ? (csvDim ? 'CSV' : 'Ignore (Do Not Change)') : 'Webpage',
          csvField: csvDim,
          webField: 'dimensions',
          dataType: 'string',
        };
      }

      // 8. Compare At Price -> CSV Variant Compare At Price
      if (lower.includes('compare at price') || lower.includes('variant compare at price') || lower.includes('mrp')) {
        return {
          targetColumn: colName,
          source: 'CSV',
          csvField: findCsvCol('Variant Compare At Price', 'Compare At Price', 'MRP') || csvHeaders[0],
          webField: 'compareAtPrice',
          dataType: 'currency',
        };
      }

      // 9. Price -> CSV Variant Price
      if (lower.includes('price') || lower.includes('selling price') || lower.includes('variant price')) {
        return {
          targetColumn: colName,
          source: 'CSV',
          csvField: findCsvCol('Variant Price', 'Price') || csvHeaders[0],
          webField: 'price',
          dataType: 'currency',
        };
      }

      // 10. Weight (kg/g) -> CSV Variant Grams (with 'gm' suffix)
      if (lower.includes('weight') || lower.includes('grams') || lower.includes('variant grams')) {
        return {
          targetColumn: colName,
          source: 'CSV',
          csvField: findCsvCol('Variant Grams', 'Weight', 'Grams') || csvHeaders[0],
          webField: 'weight',
          dataType: 'string',
        };
      }

      // 11. Care Instruction -> CSV Care guide
      if (lower.includes('care instruction') || lower.includes('care guide') || lower.includes('wash care') || lower.includes('cleaning')) {
        return {
          targetColumn: colName,
          source: 'CSV',
          csvField: findCsvCol('Care guide', 'Care Guide', 'Care instructions', 'Care Instructions', 'Care') || csvHeaders[0],
          webField: 'careInstruction',
          dataType: 'string',
        };
      }

      // 12. Ignore all other fields - do not change anything else!
      return {
        targetColumn: colName,
        source: 'Ignore (Do Not Change)',
        csvField: '',
        webField: '',
        dataType: 'string',
      };
    });

    setMappings(generated);
    onUpdateMappings(generated);
  };

  /**
   * Automatically maps all matching Excel headers directly from CSV columns
   */
  const applyMapAllFromCsv = () => {
    const csvHeaders = csvData.headers;
    const generated: FieldMapping[] = excelSheet.headers.map((h) => {
      const colName = h.header.trim();
      const lower = colName.toLowerCase();

      // Find exact or partial matching CSV column
      let matchedCsv = csvHeaders.find(c => c.trim().toLowerCase() === lower);
      if (!matchedCsv) {
        matchedCsv = csvHeaders.find(c => {
          const cl = c.toLowerCase();
          return cl.includes(lower) || lower.includes(cl);
        });
      }

      if (matchedCsv) {
        let dataType: DataType = 'string';
        if (lower.includes('price') || lower.includes('mrp') || lower.includes('cost')) dataType = 'currency';
        else if (lower.includes('qty') || lower.includes('count') || lower.includes('number')) dataType = 'number';
        else if (lower.includes('image') || lower.includes('photo')) dataType = 'image_url';

        return {
          targetColumn: colName,
          source: 'CSV' as FieldSource,
          csvField: matchedCsv,
          webField: '',
          dataType,
        };
      }

      return {
        targetColumn: colName,
        source: 'Ignore (Do Not Change)' as FieldSource,
        csvField: '',
        webField: '',
        dataType: 'string' as DataType,
      };
    });

    setMappings(generated);
    onUpdateMappings(generated);
  };

  const handleUpdateSingleMapping = (index: number, updates: Partial<FieldMapping>) => {
    // Use the current state, not the render-time closure. Multiple dropdown
    // changes made one after another must all reach the job payload.
    setMappings(currentMappings => {
      const updated = [...currentMappings];
      const newMapping = { ...updated[index], ...updates };
      if (newMapping.source === 'Ignore (Do Not Change)' || (newMapping.source as string) === 'Ignore') {
        newMapping.csvField = '';
        newMapping.webField = '';
      }
      // When one dimensions source is mapped to a split destination, start
      // with the useful L × B × H component. The control below remains fully
      // editable for any other template convention.
      if (updates.csvField && /dimension|l\s*x\s*(b|w)\s*x\s*h/i.test(updates.csvField) && !newMapping.transform) {
        const target = newMapping.targetColumn.toLowerCase().trim();
        if (target === 'height' || target.includes('height')) newMapping.transform = 'dimension_height';
        else if (target === 'width' || target.includes('width') || target.includes('breadth')) newMapping.transform = 'dimension_width';
        else if (target === 'depth' || target.includes('depth') || target === 'length' || target.includes('length')) newMapping.transform = 'dimension_length';
      }
      updated[index] = newMapping;
      onUpdateMappings(updated);
      return updated;
    });
  };

  const handleCustomSelectorChange = (fieldKey: string, selector: string) => {
    const updated = { ...customSelectors, [fieldKey]: selector };
    onUpdateCustomSelectors(updated);
  };

  const activeMappedCount = mappings.filter(m => m.source !== 'Ignore (Do Not Change)').length;
  const ignoredCount = mappings.length - activeMappedCount;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              5
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Configure Field Sources & Excel Mapping
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Specify which fields to populate from CSV vs Webpage, and ignore all other columns.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={applyMapAllFromCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-300 bg-blue-950/80 hover:bg-blue-900/80 border border-blue-500/50 rounded-xl transition-all cursor-pointer shadow-md"
            title="Auto-maps all Excel columns to matching CSV headers (CSV-Only)"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Map All from CSV</span>
          </button>

          <button
            type="button"
            onClick={applyCustomShopifyRules}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/50 rounded-xl transition-all cursor-pointer shadow-md"
            title="Auto-applies your exact custom mapping rules"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auto-Map (Web + CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdvancedSelectors(!showAdvancedSelectors)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
              showAdvancedSelectors
                ? 'bg-purple-950/80 text-purple-300 border-purple-500/50'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>CSS Selectors</span>
          </button>
        </div>
      </div>

      {/* Mapping Rule Summary Banner */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>{activeMappedCount} Columns Selected for Population</span>
          </div>

          {ignoredCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-mono text-[11px] border border-slate-700">
              <Shield className="w-3 h-3 text-slate-400" />
              <span>{ignoredCount} Columns Protected (Ignored / Untouched)</span>
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-400">
          💡 Fields set to 'Webpage' will only extract if a URL exists for that product; otherwise CSV data is safely used.
        </span>
      </div>

      {/* Advanced Custom CSS Selectors Panel */}
      {showAdvancedSelectors && (
        <div className="bg-slate-900 border border-purple-900/50 rounded-2xl p-5 space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              Custom CSS Selector Rules (Optional)
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Specify custom CSS selectors for specific webpage elements if JSON-LD or standard meta tags are unavailable.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {['description', 'material', 'finish', 'dimensions', 'price'].map((fKey) => (
              <div key={fKey} className="space-y-1">
                <label className="text-xs font-mono text-purple-300 capitalize">{fKey} Selector:</label>
                <input
                  type="text"
                  placeholder={`.product-${fKey}, [data-${fKey}]`}
                  value={customSelectors[fKey] || ''}
                  onChange={(e) => handleCustomSelectorChange(fKey, e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field Mapping Master Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <TableProperties className="w-4 h-4 text-emerald-400" />
            <span>Target Column Mapping Matrix</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {mappings.length} Excel Target Columns
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-400 w-52">
                  Excel Target Column
                </th>
                <th className="px-4 py-3 font-semibold text-emerald-400 w-52">
                  Data Source
                </th>
                <th className="px-4 py-3 font-semibold text-slate-300">
                  Source Configuration / Field
                </th>
                <th className="px-4 py-3 font-semibold text-slate-400 w-32">
                  Data Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {mappings.map((mapping, idx) => {
                const isCsv = mapping.source === 'CSV';
                const isWeb = mapping.source === 'Webpage';
                const isProductUrl = mapping.source === 'Product URL';
                const isFallback = mapping.source === 'CSV (Webpage Fallback)' || mapping.source === 'Webpage (CSV Fallback)';
                const isManual = mapping.source === 'Manual';
                const isIgnored = mapping.source === 'Ignore (Do Not Change)';

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      isIgnored
                        ? 'opacity-60 bg-slate-950/30'
                        : 'hover:bg-slate-800/30'
                    }`}
                  >
                    {/* Excel Column */}
                    <td className="px-4 py-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isIgnored ? 'bg-slate-600' : 'bg-teal-400'
                          }`}
                        />
                        <span className={isIgnored ? 'text-slate-500 line-through' : 'text-slate-100'}>
                          {mapping.targetColumn}
                        </span>
                      </div>
                    </td>

                    {/* Source Dropdown */}
                    <td className="px-4 py-2">
                      <select
                        value={mapping.source}
                        onChange={(e) => handleUpdateSingleMapping(idx, { source: e.target.value as FieldSource })}
                        className={`w-full text-xs font-semibold rounded-xl px-3 py-2 border outline-none cursor-pointer ${
                          isCsv
                            ? 'bg-blue-950/40 text-blue-300 border-blue-800/50'
                            : isWeb
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                            : isProductUrl
                            ? 'bg-teal-950/40 text-teal-300 border-teal-800/50'
                            : isFallback
                            ? 'bg-purple-950/40 text-purple-300 border-purple-800/50'
                            : isIgnored
                            ? 'bg-slate-950 text-slate-500 border-slate-800'
                            : 'bg-slate-950 text-slate-300 border-slate-700'
                        }`}
                      >
                        <option value="CSV">📄 CSV File</option>
                        <option value="Webpage">🌐 Webpage Extraction</option>
                        <option value="Product URL">🔗 User Provided URL</option>
                        <option value="CSV (Webpage Fallback)">📄 CSV (Webpage Fallback)</option>
                        <option value="Webpage (CSV Fallback)">🌐 Webpage (CSV Fallback)</option>
                        <option value="Manual">✍ Manual Constant</option>
                        <option value="Ignore (Do Not Change)">🚫 Ignore (Do Not Change)</option>
                      </select>
                    </td>

                    {/* Dynamic Source Options */}
                    <td className="px-4 py-2">
                      {isIgnored ? (
                        <span className="text-slate-600 italic text-xs font-mono">
                          Leave untouched in Excel template
                        </span>
                      ) : isProductUrl ? (
                        <span className="text-teal-400 text-xs font-mono">
                          🔗 Populates user-provided product webpage URL
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {(isCsv || isFallback) && (
                            <div className="flex-1">
                              <span className="text-[10px] text-slate-500 block mb-0.5 font-mono">CSV Column:</span>
                              <select
                                value={mapping.csvField}
                                onChange={(e) => handleUpdateSingleMapping(idx, { csvField: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-blue-300 font-mono focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                              >
                                {csvData.headers.map(h => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                              <select
                                value={mapping.transform || 'none'}
                                onChange={(e) => handleUpdateSingleMapping(idx, { transform: e.target.value as ValueTransform })}
                                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-mono focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                                aria-label={`Value transform for ${mapping.targetColumn}`}
                              >
                                <option value="none">Use whole source value</option>
                                <option value="dimension_length">Dimensions: Length (1st)</option>
                                <option value="dimension_width">Dimensions: Breadth / Width (2nd)</option>
                                <option value="dimension_height">Dimensions: Height (3rd)</option>
                              </select>
                            </div>
                          )}

                          {(isWeb || isFallback) && (
                            <div className="flex-1">
                              <span className="text-[10px] text-slate-500 block mb-0.5 font-mono">Web Extraction Field:</span>
                              <select
                                value={mapping.webField}
                                onChange={(e) => handleUpdateSingleMapping(idx, { webField: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-mono focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                              >
                                {standardFields.map(sf => (
                                  <option key={sf.key} value={sf.key}>{sf.label}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {isManual && (
                            <div className="flex-1">
                              <span className="text-[10px] text-slate-500 block mb-0.5 font-mono">Constant Value:</span>
                              <input
                                type="text"
                                value={mapping.manualValue || ''}
                                onChange={(e) => handleUpdateSingleMapping(idx, { manualValue: e.target.value })}
                                placeholder="Enter constant value..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Data Type */}
                    <td className="px-4 py-2">
                      {isIgnored ? (
                        <span className="text-slate-600 font-mono text-[11px]">—</span>
                      ) : (
                        <select
                          value={mapping.dataType}
                          onChange={(e) => handleUpdateSingleMapping(idx, { dataType: e.target.value as DataType })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono outline-none cursor-pointer"
                        >
                          <option value="string">Text (String)</option>
                          <option value="currency">Currency / Price</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean (Yes/No)</option>
                          <option value="image_url">Image URL</option>
                          <option value="date">Date</option>
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white font-medium text-xs rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back: Provide URLs</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <span>Step 6: Preview & Test Extraction</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
