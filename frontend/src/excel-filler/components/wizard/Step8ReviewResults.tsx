import React, { useState } from 'react';
import {
  CheckSquare,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Edit2,
  Check,
  X,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { Job, ProductItem, FieldMapping, Conflict } from '../../types';
import { StatusBadge, MethodBadge } from '../common/Badge';
import { ConfidenceMeter } from '../common/ConfidenceMeter';
import { api } from '../../services/api';

function getCsvValue(row: Record<string, any> | undefined, fieldName: string) {
  if (!row || !fieldName) return null;
  if (row[fieldName] !== undefined) return row[fieldName];

  const normalizedField = fieldName.trim().toLowerCase();
  const matchingKey = Object.keys(row).find(key => key.trim().toLowerCase() === normalizedField);
  return matchingKey === undefined ? null : row[matchingKey];
}

function applyDisplayTransform(value: any, transform?: string) {
  if (value === null || value === undefined || !transform || transform === 'none') return value;

  const partIndex: Record<string, number> = {
    dimension_length: 0,
    dimension_width: 1,
    dimension_height: 2,
  };
  const index = partIndex[transform];
  if (index === undefined) return value;

  const parts = String(value).split(/\s*(?:×|x|X|\*|by)\s*/).map(part => part.trim()).filter(Boolean);
  if (parts.length < 3 || !parts[index]) return value;

  const unitMatch = parts[parts.length - 1].match(/\s*([a-zA-Z]+)\s*$/);
  const selected = parts[index].replace(/\s*[a-zA-Z]+\s*$/, '').trim();
  return unitMatch && !/[a-zA-Z]+\s*$/.test(selected) ? `${selected} ${unitMatch[1]}` : selected;
}

interface Step8ReviewResultsProps {
  job: Job;
  fieldMappings: FieldMapping[];
  onJobUpdated: (job: Job) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step8ReviewResults: React.FC<Step8ReviewResultsProps> = ({
  job,
  fieldMappings,
  onJobUpdated,
  onNext,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingCell, setEditingCell] = useState<{ productId: string; fieldKey: string; value: string } | null>(null);
  const [activeConflictItem, setActiveConflictItem] = useState<ProductItem | null>(null);

  const items = job.items || [];

  // Filter items
  const filteredItems = items.filter(item => {
    const pName = String(item.csvData?.['Product Name'] || item.csvData?.['title'] || item.id);
    const id = item.id;
    const url = item.url || '';

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = id.toLowerCase().includes(q) || pName.toLowerCase().includes(q) || url.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Status filter
    if (statusFilter === 'conflicts') return item.conflicts && item.conflicts.length > 0;
    if (statusFilter === 'web_enriched') return item.url && Object.keys(item.extractedFields || {}).length > 0;
    if (statusFilter === 'csv_only') return !item.url || Object.keys(item.extractedFields || {}).length === 0;
    if (statusFilter === 'completed') return item.status === 'Completed';
    if (statusFilter === 'partial') return item.status === 'Partial';
    if (statusFilter === 'failed') return item.status === 'Failed';
    if (statusFilter === 'missing_url') return item.status === 'URL Missing';

    return true;
  });

  const totalConflicts = items.reduce((acc, i) => acc + (i.conflicts?.length || 0), 0);
  const webEnrichedCount = items.filter(i => i.url && Object.keys(i.extractedFields || {}).length > 0).length;
  const csvOnlyCount = items.length - webEnrichedCount;

  // Save manual cell edit
  const handleSaveCellEdit = async () => {
    if (!editingCell) return;
    const { productId, fieldKey, value } = editingCell;

    try {
      await api.updateItemField(job.id, productId, fieldKey, value, 'manual');
      const updated = await api.getJob(job.id);
      onJobUpdated(updated);
      setEditingCell(null);
    } catch (e) {
      console.error('Failed to save cell edit', e);
    }
  };

  // Conflict quick resolver
  const handleResolveConflict = async (productId: string, fieldKey: string, chosenVal: any, chosenSource: string) => {
    try {
      await api.updateItemField(job.id, productId, fieldKey, chosenVal, chosenSource);
      const updated = await api.getJob(job.id);
      onJobUpdated(updated);

      if (activeConflictItem) {
        const freshItem = updated.items.find(i => i.id === productId);
        setActiveConflictItem(freshItem || null);
      }
    } catch (e) {
      console.error('Failed to resolve conflict', e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
              8
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Review Results & Resolve Conflicts
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Spreadsheet review grid. Click any cell to edit directly. Conflicted CSV vs Web values are flagged for resolution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {totalConflicts > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-950/80 border border-purple-600/40 text-purple-300 rounded-xl text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-purple-400" />
              <span>{totalConflicts} Data Conflicts to Review</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search products, IDs, URLs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 outline-none w-56 sm:w-64"
            />
          </div>

          {/* Quick status filters */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs flex-wrap">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({items.length})
            </button>

            {webEnrichedCount > 0 && (
              <button
                onClick={() => setStatusFilter('web_enriched')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'web_enriched' ? 'bg-emerald-950/80 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Web Enriched ({webEnrichedCount})
              </button>
            )}

            {csvOnlyCount > 0 && (
              <button
                onClick={() => setStatusFilter('csv_only')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'csv_only' ? 'bg-blue-950/80 text-blue-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                CSV Only ({csvOnlyCount})
              </button>
            )}

            {totalConflicts > 0 && (
              <button
                onClick={() => setStatusFilter('conflicts')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'conflicts' ? 'bg-purple-900/60 text-purple-300' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Conflicts ({totalConflicts})
              </button>
            )}

            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                statusFilter === 'completed' ? 'bg-emerald-950/80 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Completed ({job.progress.completed})
            </button>

            {job.progress.partial > 0 && (
              <button
                onClick={() => setStatusFilter('partial')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'partial' ? 'bg-amber-950/80 text-amber-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Partial ({job.progress.partial})
              </button>
            )}

            {job.progress.failed > 0 && (
              <button
                onClick={() => setStatusFilter('failed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'failed' ? 'bg-rose-950/80 text-rose-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Failed ({job.progress.failed})
              </button>
            )}
          </div>
        </div>

        <span className="text-[11px] text-slate-400">
          Showing {filteredItems.length} Products
        </span>
      </div>

      {/* Spreadsheet TanStack-style Review Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="sticky top-0 z-20 bg-slate-950 text-slate-400 border-b border-slate-800 font-sans">
              <tr>
                <th className="px-3 py-3 font-semibold w-10 text-slate-500">#</th>
                <th className="px-3 py-3 font-semibold text-center w-28">
                  Status
                </th>

                {/* Dynamic Mapped Excel Target Columns */}
                {fieldMappings.map((m) => (
                  <th
                    key={m.targetColumn}
                    className="px-4 py-3 font-semibold text-slate-200 min-w-[140px]"
                  >
                    <div className="flex flex-col">
                      <span>{m.targetColumn}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        ({m.source})
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {filteredItems.length > 0 ? (
                filteredItems.map((item, idx) => {
                  const hasConflict = item.conflicts && item.conflicts.length > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        hasConflict ? 'bg-purple-950/15' : item.status === 'Failed' ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 text-slate-500 font-sans text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 text-center font-sans">
                        <StatusBadge status={item.status} size="sm" />
                      </td>

                      {/* Dynamic Field Values */}
                      {fieldMappings.map((m) => {
                        const { targetColumn, source, csvField, webField } = m;
                        const fieldKey = webField || targetColumn;
                        const isEditingThis = editingCell?.productId === item.id && editingCell?.fieldKey === fieldKey;

                        const manualVal = item.manualOverrides?.[targetColumn] ?? item.manualOverrides?.[fieldKey];
                        const csvVal = applyDisplayTransform(getCsvValue(item.csvData, csvField), m.transform);
                        const webFieldObj = item.extractedFields?.[fieldKey];
                        const webVal = webFieldObj?.value;

                        let displayVal: any = '';
                        const lowerTarget = (targetColumn || '').toLowerCase().trim();
                        const isUrlColumn = source === 'Product URL' || webField === 'productUrl' || lowerTarget.includes('product link') || lowerTarget.includes('product url') || lowerTarget === 'url' || lowerTarget === 'link' || lowerTarget.includes('webpage') || lowerTarget.includes('item url');

                        const isIgnored = source === 'Ignore (Do Not Change)' || (source as string) === 'Ignore';
                        const templateVal = (item as any).excelData?.[targetColumn] ?? '';
                        const excelRowVal = (item as any).excelData?.[targetColumn] || (csvField ? (item as any).excelData?.[csvField] : '') || '';

                        if (manualVal !== undefined && manualVal !== null && manualVal !== '') {
                          displayVal = manualVal;
                        } else if (isIgnored) {
                          displayVal = templateVal;
                        } else if (isUrlColumn) {
                          displayVal = item.url || csvVal || item.csvData?.['Product URL'] || item.csvData?.['URL'] || item.csvData?.['Product Link'] || item.csvData?.['Link'] || item.csvData?.['Webpage'] || (item as any).excelData?.[targetColumn] || (item as any).excelData?.['Product Page URL'] || (item as any).excelData?.['Product Link'] || (item as any).excelData?.['URL'] || '';
                        } else if (source === 'CSV') {
                          displayVal = csvVal !== null && csvVal !== undefined && csvVal !== '' ? csvVal : (webVal || excelRowVal || '');
                        } else if (source === 'Webpage') {
                          displayVal = webVal !== null && webVal !== undefined && webVal !== '' ? webVal : (csvVal || excelRowVal || '');
                        } else if (source === 'CSV (Webpage Fallback)') {
                          displayVal = csvVal || webVal || excelRowVal || '';
                        } else if (source === 'Webpage (CSV Fallback)') {
                          displayVal = webVal || csvVal || excelRowVal || '';
                        } else if (source === 'Manual') {
                          displayVal = m.manualValue || '';
                        }

                        const conflict = item.conflicts?.find(c => c.field === targetColumn);
                        const isMissing = !isIgnored && (displayVal === null || displayVal === undefined || displayVal === '');

                        return (
                          <td
                            key={targetColumn}
                            className={`px-4 py-2 relative group cursor-pointer ${
                              conflict ? 'bg-purple-900/20' : isMissing ? 'bg-amber-950/10' : ''
                            }`}
                            onClick={() => {
                              if (!isEditingThis) {
                                setEditingCell({
                                  productId: item.id,
                                  fieldKey,
                                  value: displayVal !== null && displayVal !== undefined ? String(displayVal) : '',
                                });
                              }
                            }}
                          >
                            {isEditingThis ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingCell.value}
                                  onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCellEdit();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full bg-slate-950 border border-emerald-500 rounded px-2 py-1 text-xs text-white outline-none"
                                />
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSaveCellEdit(); }}
                                  className="p-1 text-emerald-400 hover:bg-slate-800 rounded"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingCell(null); }}
                                  className="p-1 text-slate-400 hover:bg-slate-800 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1">
                                {isIgnored ? (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50">
                                    <span className="text-slate-300 font-mono">{displayVal ? String(displayVal) : 'Template Value'}</span>
                                    <span className="text-[9px] text-teal-400 font-medium px-1 bg-teal-500/15 rounded">Preserved</span>
                                  </span>
                                ) : (
                                  <span className={`${isMissing ? 'text-slate-600 italic font-sans' : 'text-slate-200'}`}>
                                    {isMissing ? 'missing' : String(displayVal)}
                                  </span>
                                )}

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {conflict && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveConflictItem(item);
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-sans font-semibold border border-purple-500/40"
                                      title="Review Data Conflict"
                                    >
                                      Conflict
                                    </button>
                                  )}

                                  <Edit2 className="w-3 h-3 text-slate-500 hover:text-emerald-400" />
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={fieldMappings.length + 4}
                    className="px-4 py-8 text-center text-slate-500 italic"
                  >
                    No products match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conflict Resolution Modal / Drawer */}
      {activeConflictItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-4">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Resolve CSV vs Webpage Data Conflict
                </h3>
              </div>
              <button
                onClick={() => setActiveConflictItem(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-400">
                Product: <strong className="text-white">{activeConflictItem.id}</strong> (
                {activeConflictItem.csvData?.['Product Name'] || activeConflictItem.id})
              </div>

              {activeConflictItem.conflicts?.map((c) => (
                <div key={c.field} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-slate-300 block">
                    Field: {c.field}
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    {/* CSV Option */}
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                      <span className="text-[10px] text-blue-400 font-bold block uppercase tracking-wider">
                        From CSV Record
                      </span>
                      <div className="text-xs font-mono text-white font-semibold break-all">
                        {String(c.csvValue)}
                      </div>
                      <button
                        onClick={() => handleResolveConflict(activeConflictItem.id, c.field, c.csvValue, 'csv')}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold cursor-pointer"
                      >
                        Use CSV Value
                      </button>
                    </div>

                    {/* Webpage Option */}
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                      <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">
                        From Webpage ({Math.round(c.confidence * 100)}% Conf)
                      </span>
                      <div className="text-xs font-mono text-white font-semibold break-all">
                        {String(c.webValue)}
                      </div>
                      <button
                        onClick={() => handleResolveConflict(activeConflictItem.id, c.field, c.webValue, 'webpage')}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold cursor-pointer"
                      >
                        Use Webpage Value
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                onClick={() => setActiveConflictItem(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white font-medium text-xs rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back: Background Processing</span>
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
        >
          <span>Step 9: Populate Excel & Download</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
