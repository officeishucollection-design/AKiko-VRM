import React, { useState } from 'react';
import {
  Search,
  Globe,
  ExternalLink,
  RefreshCw,
  Eye,
  CheckCircle,
  AlertCircle,
  Code,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { MethodBadge } from '../common/Badge';
import { ConfidenceMeter } from '../common/ConfidenceMeter';

export const UrlInspectorView: React.FC = () => {
  const [url, setUrl] = useState('https://sample-store.mock/products/apple-iphone-15');
  const [productName, setProductName] = useState('Apple iPhone 15');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInspect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.previewExtraction(url.trim(), productName.trim());
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Inspection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const sampleUrls = [
    { label: 'iPhone 15 (Mock)', url: 'https://sample-store.mock/products/apple-iphone-15', name: 'iPhone 15' },
    { label: 'Galaxy S24 Ultra (Mock)', url: 'https://sample-store.mock/products/samsung-galaxy-s24-ultra', name: 'Galaxy S24 Ultra' },
    { label: 'Pixel 9 Pro (Mock)', url: 'https://sample-store.mock/products/google-pixel-9-pro', name: 'Pixel 9 Pro' },
    { label: 'Sony WH-1000XM5 (Mock)', url: 'https://sample-store.mock/products/sony-wh-1000xm5', name: 'Sony WH-1000XM5' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Standalone Webpage Extraction Inspector
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Test any live product URL or demo endpoint to verify JSON-LD schemas, OpenGraph metadata, and confidence scores.
          </p>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleInspect} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Target Webpage URL:</label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.example.com/product/..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Product Hint (Optional):</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. iPhone 15"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Preset quick test buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Quick Test:</span>
          {sampleUrls.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setUrl(s.url);
                setProductName(s.name);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 transition-all cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Inspecting Webpage...' : 'Inspect Webpage'}</span>
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded-2xl text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-in fade-in">
          {/* Metadata metric bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Average Confidence</span>
              <div className="mt-1">
                <ConfidenceMeter score={result.meta.averageConfidence} />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Fields Extracted</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {result.meta.foundFieldsCount} Fields Found
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Schema Structured</span>
              <span className="text-xs font-semibold text-slate-200">
                {result.meta.hasJsonLd ? '✓ JSON-LD Schema.org' : 'Microdata / OG'}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
              <span className="text-[11px] text-slate-400 block">Fetch Latency</span>
              <span className="text-base font-bold text-cyan-400 font-mono">
                {result.elapsedMs} ms
              </span>
            </div>
          </div>

          {/* Fields Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span>Extracted Product Fields</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                {result.meta.title}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-sans">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-slate-400 w-36">Field</th>
                    <th className="px-4 py-2.5 font-semibold text-emerald-400">Extracted Value</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-300 w-44">Method</th>
                    <th className="px-4 py-2.5 font-semibold text-slate-400 w-32">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Object.entries(result.fields).map(([key, f]: [string, any]) => {
                    const hasVal = f.value !== null && f.value !== undefined && f.value !== '';
                    return (
                      <tr key={key} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 font-sans font-semibold text-slate-300 capitalize">
                          {key}
                        </td>
                        <td className="px-4 py-2.5">
                          {hasVal ? (
                            <span className="text-emerald-300 font-semibold bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-500/20 inline-block max-w-lg truncate">
                              {String(f.value)}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic font-sans">null</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-sans">
                          <MethodBadge method={f.method} />
                        </td>
                        <td className="px-4 py-2.5 font-sans">
                          {hasVal ? (
                            <ConfidenceMeter score={f.confidence} size="sm" />
                          ) : (
                            <span className="text-slate-600 text-[11px]">0%</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
