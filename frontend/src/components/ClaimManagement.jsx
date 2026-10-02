import { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  Search,
  Filter,
  Plus,
  ExternalLink,
  Video,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  DollarSign,
  ArrowUpRight,
  FileText,
  ShieldCheck,
  X,
  PackageOpen,
  Bot,
  Eye,
  Zap,
  ChevronRight,
  CheckSquare,
  Square,
  Send,
  RefreshCw,
  Settings,
  KeyRound,
} from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

// ─── Status helpers ──────────────────────────────────────────────────────────
const STATUS_META = {
  pending_inspection: {
    label: 'Pending Inspection',
    classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: <Clock className="w-3 h-3" />,
  },
  inspection_complete: {
    label: 'Inspection Complete',
    classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  verification_mismatch: {
    label: 'Verification Mismatch',
    classes: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: <XCircle className="w-3 h-3" />,
  },
  ready_for_operator_confirmation: {
    label: 'Ready for Confirmation',
    classes: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: <ShieldCheck className="w-3 h-3" />,
  },
  dispute_raised: {
    label: 'Dispute Filed',
    classes: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    icon: <FileText className="w-3 h-3" />,
  },
  approved: {
    label: 'Approved',
    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  rejected: {
    label: 'Rejected',
    classes: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: <XCircle className="w-3 h-3" />,
  },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || {
    label: status || 'Unknown',
    classes: 'bg-slate-700/40 text-slate-400 border-slate-600/20',
    icon: <AlertTriangle className="w-3 h-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap ${meta.classes}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ─── Evidence check helper ───────────────────────────────────────────────────
const EVIDENCE_KEYS = [
  { key: 'outerPackagingUrl', label: 'Outer Pkg' },
  { key: 'innerPackagingUrl', label: 'Inner Pkg' },
  { key: 'productImageUrl', label: 'Product' },
  { key: 'podUrl', label: 'POD' },
];

function EvidenceChecks({ evidence }) {
  if (!evidence) {
    return (
      <div className="flex gap-1.5">
        {EVIDENCE_KEYS.map((e) => (
          <span key={e.key} title={e.label} className="text-slate-600 text-[10px]">✗</span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-1.5">
      {EVIDENCE_KEYS.map((e) => (
        <span
          key={e.key}
          title={e.label}
          className={`text-[11px] font-bold ${evidence[e.key] ? 'text-emerald-400' : 'text-slate-600'}`}
        >
          {evidence[e.key] ? '✓' : '✗'}
        </span>
      ))}
    </div>
  );
}

// ─── Dispute categories ──────────────────────────────────────────────────────
const DISPUTE_CATEGORIES = [
  'Item Not Received',
  'Wrong Item Received',
  'Damaged Item Received',
  'Item Missing from Package',
  'Used Item Received',
];

const CAN_RAISE_DISPUTE = (status) =>
  status === 'inspection_complete' || status === 'ready_for_operator_confirmation';

// ─── Add Return Modal ────────────────────────────────────────────────────────
function AddReturnModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    suborderId: '',
    awb: '',
    snapdealRefCode: '',
    productTitle: '',
    sku: '',
    sellingPrice: '',
    courier: '',
    disputeDeadlineDate: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.suborderId.trim() || !form.awb.trim()) {
      setError('Suborder ID and AWB Number are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('vrm_token');
      const res = await fetch(`${API_URL}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Server error ${res.status}`);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add return.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-brand-400">
              Snapdeal CMS
            </span>
            <h3 className="text-lg font-bold text-white">Add Return Claim</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 uppercase font-bold text-[10px]">
                Suborder ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SD-SUB-00123"
                value={form.suborderId}
                onChange={handleChange('suborderId')}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 uppercase font-bold text-[10px]">
                AWB Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. DEL9928172648"
                value={form.awb}
                onChange={handleChange('awb')}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 uppercase font-bold text-[10px]">
                Snapdeal Ref Code
              </label>
              <input
                type="text"
                placeholder="e.g. SLP..."
                value={form.snapdealRefCode}
                onChange={handleChange('snapdealRefCode')}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 uppercase font-bold text-[10px]">
                Selling Price ₹
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 1850"
                value={form.sellingPrice}
                onChange={handleChange('sellingPrice')}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 uppercase font-bold text-[10px]">
                Product Title
              </label>
              <input
                type="text"
                placeholder="e.g. Silk Saree Red"
                value={form.productTitle}
                onChange={handleChange('productTitle')}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 uppercase font-bold text-[10px]">SKU</label>
              <input
                type="text"
                placeholder="e.g. SKU-RED-SAREE-L"
                value={form.sku}
                onChange={handleChange('sku')}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 uppercase font-bold text-[10px]">Courier</label>
              <input
                type="text"
                placeholder="e.g. Delhivery"
                value={form.courier}
                onChange={handleChange('courier')}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 uppercase font-bold text-[10px]">
                Dispute Deadline
              </label>
              <input
                type="date"
                value={form.disputeDeadlineDate}
                onChange={handleChange('disputeDeadlineDate')}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-slate-400 uppercase font-bold text-[10px]">Notes</label>
            <textarea
              rows={3}
              placeholder="Inspection notes, tamper evidence observations..."
              value={form.notes}
              onChange={handleChange('notes')}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500 resize-none placeholder:text-slate-600"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Zap className="w-4 h-4 animate-pulse" /> Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add Return
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Snapdeal API & OAuth Configuration Modal ────────────────────────────────
function SnapdealConfigModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    clientId: 'RunRave',
    appId: '',
    authToken: '',
    sellerToken: '',
    envMode: 'production',
  });
  const [loading, setLoading] = useState(false);
  const [authUrlLoading, setAuthUrlLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch current status on open
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = localStorage.getItem('vrm_token');
        const res = await fetch(`${API_URL}/api/snapdeal/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setForm((prev) => ({
            ...prev,
            clientId: data.clientId || 'RunRave',
            envMode: data.envMode || 'production',
          }));
        }
      } catch (err) {
        console.error('Failed to load status:', err);
      }
    };
    fetchStatus();
  }, []);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Launch official Snapdeal Web Authorization
  const handleLaunchWebAuth = async () => {
    setAuthUrlLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('vrm_token');
      // If user typed appId, save it first
      if (form.appId) {
        await fetch(`${API_URL}/api/snapdeal/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ appId: form.appId, clientId: form.clientId, envMode: form.envMode }),
        });
      }

      const res = await fetch(`${API_URL}/api/snapdeal/auth-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate Snapdeal Authorization URL');

      // Open Snapdeal Login in a popup window
      const popup = window.open(
        data.authUrl,
        'SnapdealLogin',
        'width=650,height=750,scrollbars=yes,status=yes'
      );
      if (!popup) {
        // Fallback to direct redirect if popup was blocked
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthUrlLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('vrm_token');
      const res = await fetch(`${API_URL}/api/snapdeal/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      setSuccessMsg('Snapdeal settings saved successfully!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Snapdeal API &amp; OAuth Setup</h3>
              <p className="text-slate-400 text-xs">Configure developer credentials or authorize seller account</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Method 1: OAuth Web UI */}
        <div className="p-4 bg-indigo-950/30 border border-indigo-500/20 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Option 1: Official Snapdeal Web Login
            </span>
            <span className="text-[10px] text-slate-400">1-Click Auto Token</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Logs into Snapdeal authorization page, prompts for seller credentials, and returns the <code className="text-indigo-300 bg-black/40 px-1 py-0.5 rounded">X-Seller-AuthZ-Token</code> automatically.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Application ID (appId from Snapdeal)"
              value={form.appId}
              onChange={handleChange('appId')}
              className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={handleLaunchWebAuth}
              disabled={authUrlLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {authUrlLoading ? 'Launching...' : 'Authorize Seller'}
            </button>
          </div>
        </div>

        {/* Method 2: Manual Credentials Entry */}
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Option 2: Direct Token Entry
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">Client ID (Business Name)</label>
              <input
                type="text"
                value={form.clientId}
                onChange={handleChange('clientId')}
                placeholder="e.g. RunRave"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">Environment</label>
              <select
                value={form.envMode}
                onChange={handleChange('envMode')}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              >
                <option value="production">Production</option>
                <option value="sandbox">Sandbox / Staging</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 text-[10px] uppercase font-bold">X-Auth-Token (Partner Auth Token)</label>
            <input
              type="text"
              value={form.authToken}
              onChange={handleChange('authToken')}
              placeholder="e.g. 1e1f876d28284bae902d8dc0f1b47241"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 text-[10px] uppercase font-bold">X-Seller-AuthZ-Token (Seller Access Token)</label>
            <input
              type="text"
              value={form.sellerToken}
              onChange={handleChange('sellerToken')}
              placeholder="e.g. e9954813-c398-4619-bef4-2b81378a05ad"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[11px] focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save Credentials'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Claim Detail Modal ──────────────────────────────────────────────────────
function ClaimDetailModal({ claim, onClose }) {
  const [disputeStep, setDisputeStep] = useState(0); // 0=off, 1=category, 2=description
  const [selectedCategory, setSelectedCategory] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [dispatched, setDispatched] = useState(false);

  const canRaise = CAN_RAISE_DISPUTE(claim.status);
  const evidence = claim.evidence || {};

  const handleDispatch = () => {
    window.postMessage(
      {
        type: 'VRM_RAISE_DISPUTE',
        payload: {
          suborderId: claim.suborderId,
          awb: claim.awb,
          snapdealRefCode: claim.snapdealRefCode,
          sku: claim.sku,
          productTitle: claim.productTitle,
          disputeCategory: selectedCategory,
          disputeDescription: disputeDesc,
          evidence: claim.evidence,
        },
      },
      '*'
    );
    setDispatched(true);
  };

  const VERIFICATION_LOGS = [
    { label: 'Outer packaging inspected', value: claim.verificationLogs?.outerPackaging },
    { label: 'Inner packaging inspected', value: claim.verificationLogs?.innerPackaging },
    { label: 'Product condition verified', value: claim.verificationLogs?.productCondition },
    { label: 'Proof of delivery checked', value: claim.verificationLogs?.podVerified },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-2xl p-6 space-y-5 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/5">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-brand-400">
              Return Claim Dossier
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">
              {claim.suborderId || '—'}
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              AWB:{' '}
              <span className="font-mono text-indigo-300 font-bold">
                {claim.awb || '—'}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={claim.status} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Key fields grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
          {[
            { label: 'Snapdeal Ref', value: claim.snapdealRefCode || '—' },
            { label: 'Product', value: claim.productTitle || '—' },
            { label: 'SKU', value: claim.sku || '—' },
            {
              label: 'Selling Price',
              value: claim.sellingPrice != null ? `₹${Number(claim.sellingPrice).toLocaleString('en-IN')}` : '—',
            },
            { label: 'Courier', value: claim.courier || '—' },
            {
              label: 'Dispute Deadline',
              value: claim.disputeDeadlineDate
                ? new Date(claim.disputeDeadlineDate).toLocaleDateString('en-IN')
                : '—',
            },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
              <span className="text-slate-500 font-semibold block text-[10px] uppercase tracking-wide">
                {label}
              </span>
              <span className="font-bold text-white mt-0.5 block">{value}</span>
            </div>
          ))}
        </div>

        {/* Verification checklist */}
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 space-y-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            Verification Checklist
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {VERIFICATION_LOGS.map(({ label, value }) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px]">
                {value ? (
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
                <span className={value ? 'text-emerald-300' : 'text-slate-500'}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence links */}
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 space-y-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-400" />
            Evidence Files
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {EVIDENCE_KEYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1.5 text-[11px]">
                {evidence[key] ? (
                  <a
                    href={evidence[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-brand-300 hover:text-brand-200 underline underline-offset-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {label}
                  </a>
                ) : (
                  <span className="text-slate-600">✗ {label} missing</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {claim.notes && (
          <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Notes</span>
            <p className="text-slate-300 text-xs mt-1 leading-relaxed italic">"{claim.notes}"</p>
          </div>
        )}

        {/* Submission response */}
        {claim.submissionResponse && (
          <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
            <span className="text-slate-500 text-[10px] uppercase font-bold">
              Last Submission Response
            </span>
            <pre className="text-slate-300 text-[10px] mt-1 font-mono whitespace-pre-wrap break-all">
              {typeof claim.submissionResponse === 'string'
                ? claim.submissionResponse
                : JSON.stringify(claim.submissionResponse, null, 2)}
            </pre>
          </div>
        )}

        {/* Raise dispute via agent */}
        {canRaise && (
          <div className="border border-orange-500/20 bg-orange-500/5 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-orange-400" />
              <h4 className="text-sm font-bold text-white">🤖 Raise Dispute via Agent</h4>
            </div>

            {dispatched ? (
              <div className="flex items-center gap-2 text-sm text-amber-300 font-semibold">
                <Zap className="w-4 h-4 animate-pulse" />
                ⏳ Dispatched to VRM Agent. Watch the Snapdeal tab...
              </div>
            ) : disputeStep === 0 ? (
              <button
                onClick={() => setDisputeStep(1)}
                className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20"
              >
                <Bot className="w-4 h-4" />
                Begin Automated Dispute
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : disputeStep === 1 ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  Step 1 — Select Dispute Category
                </p>
                <div className="space-y-2">
                  {DISPUTE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setDisputeStep(2);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 hover:border-orange-500/40 text-slate-200 text-xs font-semibold flex items-center justify-between group transition-colors"
                    >
                      {cat}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-orange-400 transition-colors" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setDisputeStep(0)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ← Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  Step 2 — Add Description
                </p>
                <div className="px-3 py-2 rounded-xl bg-slate-900 border border-orange-500/20 text-orange-300 text-xs font-semibold">
                  Category: {selectedCategory}
                </div>
                <textarea
                  rows={3}
                  placeholder="Describe the issue in detail for the dispute filing..."
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-orange-500/50 resize-none placeholder:text-slate-600"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDisputeStep(1)}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleDispatch}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Dispatch to VRM Agent
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer close */}
        <div className="flex justify-end pt-2 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ClaimManagement({ user, onSwitchToVrmRecords }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);

  // ── Snapdeal Sync state ────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { totalSynced, pending, completed }
  const [sdConfigured, setSdConfigured] = useState(null); // null=unchecked, true/false
  const [authRedirectAlert, setAuthRedirectAlert] = useState(null);

  // Check if Snapdeal tokens are configured
  const checkSdStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('vrm_token');
      const res = await fetch(`${API_URL}/api/snapdeal/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSdConfigured(data.configured);
      }
    } catch {
      setSdConfigured(false);
    }
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('vrm_token');
      const res = await fetch(`${API_URL}/api/claims`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setClaims(Array.isArray(data) ? data : data.claims || []);
    } catch (err) {
      console.error('Claims fetch error:', err);
      setErrorMsg(err.message || 'Could not connect to backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial mount: fetch claims, check status, check for OAuth redirect
  useEffect(() => {
    fetchClaims();
    checkSdStatus();

    // Check if redirected from Snapdeal OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('snapdeal_auth') === 'success') {
      setAuthRedirectAlert({
        type: 'success',
        msg: 'Snapdeal seller account authorized successfully! Tokens are active and ready.',
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('snapdeal_auth') === 'error') {
      setAuthRedirectAlert({
        type: 'error',
        msg: `Snapdeal authorization failed: ${params.get('msg') || 'Unknown error'}`,
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchClaims, checkSdStatus]);

  // Trigger full Snapdeal returns sync
  const syncFromSnapdeal = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const token = localStorage.getItem('vrm_token');
      const res = await fetch(`${API_URL}/api/snapdeal/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`);
      setSyncResult(data.result);
      await fetchClaims(); // Refresh the list after sync
    } catch (err) {
      setSyncResult({ error: err.message });
    } finally {
      setSyncing(false);
    }
  };


  // ── KPI computations ───────────────────────────────────────────────────────
  const totalReturns = claims.length;
  const pendingInspection = claims.filter((c) => c.status === 'pending_inspection').length;
  const disputeFiled = claims.filter((c) => c.status === 'dispute_raised').length;
  const recoveryValue = claims
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + (Number(c.sellingPrice) || 0), 0);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredClaims = claims.filter((c) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      (c.suborderId || '').toLowerCase().includes(q) ||
      (c.awb || '').toLowerCase().includes(q) ||
      (c.productTitle || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── KPI Cards data ─────────────────────────────────────────────────────────
  const KPI_CARDS = [
    {
      label: 'Total Returns',
      value: totalReturns,
      subtext: 'All return claims',
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-400',
      icon: <FileText className="w-4 h-4" />,
      valueColor: 'text-white',
    },
    {
      label: 'Pending Inspection',
      value: pendingInspection,
      subtext: 'Awaiting warehouse check',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      icon: <Clock className="w-4 h-4" />,
      valueColor: 'text-amber-400',
    },
    {
      label: 'Dispute Filed',
      value: disputeFiled,
      subtext: 'Raised with Snapdeal',
      iconBg: 'bg-brand-500/10',
      iconColor: 'text-brand-400',
      icon: <ShieldCheck className="w-4 h-4" />,
      valueColor: 'text-white',
    },
    {
      label: 'Recovery Value',
      value: `₹${recoveryValue.toLocaleString('en-IN')}`,
      subtext: 'Approved claims total',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      icon: <DollarSign className="w-4 h-4" />,
      valueColor: 'text-emerald-400',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-dark-800 to-indigo-950/40 p-6 md:p-8 rounded-3xl border border-white/5 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 text-[10px] font-extrabold uppercase tracking-wider border border-brand-500/30 flex items-center gap-1.5">
                <Scale className="w-3 h-3" />
                CMS Module
              </span>
              <span className="text-xs text-slate-400 font-medium">Snapdeal Returns Hub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Snapdeal Returns &amp; Claim Management
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Track Snapdeal returns, link VRM evidence, and raise verified disputes
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 font-bold text-sm flex items-center gap-2 transition-all"
              title="Snapdeal API & OAuth Configuration"
            >
              <Settings className="w-4 h-4 text-brand-400" />
              <span className="hidden sm:inline">API Settings</span>
            </button>
            <button
              onClick={syncFromSnapdeal}
              disabled={syncing}
              className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 border transition-all ${
                sdConfigured === false
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/30 shadow-lg shadow-indigo-600/20'
              } disabled:opacity-50`}
              title={sdConfigured === false ? "Snapdeal API tokens not configured — click API Settings" : "Fetch latest returns from Snapdeal API"}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Snapdeal'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Return
            </button>
          </div>
        </div>

        {/* OAuth Redirect Alert */}
        {authRedirectAlert && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
              authRedirectAlert.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              <div className="flex items-center gap-2">
                {authRedirectAlert.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{authRedirectAlert.msg}</span>
              </div>
              <button onClick={() => setAuthRedirectAlert(null)} className="hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Sync Status Banner */}
        {syncResult && (
          <div className="mt-4 pt-4 border-t border-white/10">
            {syncResult.error ? (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  <span><strong>Sync Failed:</strong> {syncResult.error}</span>
                </div>
                <button onClick={() => setSyncResult(null)} className="text-red-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>
                    <strong>Sync Complete:</strong> {syncResult.totalSynced || 0} return(s) synchronized ({syncResult.pending?.created || 0} new pending, {syncResult.completed?.created || 0} new completed).
                  </span>
                </div>
                <button onClick={() => setSyncResult(null)} className="text-emerald-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {sdConfigured === false && !syncResult && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Snapdeal API Not Connected:</strong> To auto-fetch returns, click{' '}
                  <button
                    onClick={() => setShowConfigModal(true)}
                    className="underline font-bold text-amber-200 hover:text-white"
                  >
                    API Settings
                  </button>{' '}
                  to enter your credentials or authorize your seller account.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((card) => (
          <div
            key={card.label}
            className="bg-dark-800 p-5 rounded-2xl border border-white/5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {card.label}
              </span>
              <span className={`p-2 rounded-xl ${card.iconBg} ${card.iconColor}`}>
                {card.icon}
              </span>
            </div>
            <p className={`text-2xl font-black ${card.valueColor}`}>{card.value}</p>
            <span className="text-[11px] text-slate-500">{card.subtext}</span>
          </div>
        ))}
      </div>

      {/* ── Automation Banner ───────────────────────────────────────────────── */}
      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Snapdeal Automation</h4>
            <p className="text-xs text-slate-400">
              Install VRM Companion Extension to enable automated Snapdeal dispute filing
            </p>
          </div>
        </div>
        <a
          href="#"
          className="text-xs font-bold text-indigo-300 hover:text-indigo-200 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
        >
          Get Extension
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* ── Filters Bar ────────────────────────────────────────────────────── */}
      <div className="bg-dark-800 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search suborder ID, AWB, product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 placeholder:text-slate-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-400">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] uppercase font-bold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">All</option>
            <option value="pending_inspection">Pending Inspection</option>
            <option value="inspection_complete">Inspection Complete</option>
            <option value="ready_for_operator_confirmation">Ready for Confirmation</option>
            <option value="dispute_raised">Dispute Filed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <span className="sm:ml-auto text-[11px] text-slate-500 shrink-0">
          {filteredClaims.length} of {claims.length} records
        </span>
      </div>

      {/* ── Error State ─────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Failed to load claims</p>
            <p className="text-xs text-red-300 mt-0.5">{errorMsg}</p>
          </div>
          <button
            onClick={fetchClaims}
            className="bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg text-xs font-semibold px-3 py-1.5 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading State ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-brand-500/30 border-t-brand-400 animate-spin" />
          <p className="text-slate-400 text-sm">Loading Snapdeal returns...</p>
        </div>
      ) : filteredClaims.length === 0 ? (
        /* ── Empty State ─────────────────────────────────────────────────── */
        <div className="bg-dark-800 rounded-3xl border border-white/5 py-24 flex flex-col items-center justify-center space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700/50 text-slate-500">
            <PackageOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-white text-lg">No returns found</h4>
            <p className="text-slate-400 text-sm max-w-xs">
              Add your first Snapdeal return to get started.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Return
          </button>
        </div>
      ) : (
        /* ── Claims Table ────────────────────────────────────────────────── */
        <div className="bg-dark-800 rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-4 whitespace-nowrap">Suborder / Ref</th>
                  <th className="p-4 whitespace-nowrap">AWB</th>
                  <th className="p-4 whitespace-nowrap">Product / SKU</th>
                  <th className="p-4 whitespace-nowrap">Status</th>
                  <th className="p-4 whitespace-nowrap">Price</th>
                  <th className="p-4 whitespace-nowrap">Evidence</th>
                  <th className="p-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredClaims.map((claim) => {
                  const canRaise = CAN_RAISE_DISPUTE(claim.status);
                  return (
                    <tr
                      key={claim._id || claim.id || claim.suborderId}
                      className="hover:bg-slate-700/20 transition-colors"
                    >
                      {/* Suborder / Ref */}
                      <td className="p-4">
                        <p className="font-bold text-white">{claim.suborderId || '—'}</p>
                        {claim.snapdealRefCode && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {claim.snapdealRefCode}
                          </span>
                        )}
                      </td>

                      {/* AWB */}
                      <td className="p-4 font-mono font-medium text-indigo-300 whitespace-nowrap">
                        {claim.awb || '—'}
                      </td>

                      {/* Product / SKU */}
                      <td className="p-4">
                        <p className="text-slate-200 font-medium max-w-[160px] truncate">
                          {claim.productTitle || '—'}
                        </p>
                        {claim.sku && (
                          <span className="text-[10px] text-slate-500">{claim.sku}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <StatusBadge status={claim.status} />
                      </td>

                      {/* Price */}
                      <td className="p-4 font-bold text-white whitespace-nowrap">
                        {claim.sellingPrice != null
                          ? `₹${Number(claim.sellingPrice).toLocaleString('en-IN')}`
                          : '—'}
                      </td>

                      {/* Evidence */}
                      <td className="p-4">
                        <EvidenceChecks evidence={claim.evidence} />
                        <div className="text-[9px] text-slate-600 mt-1 flex gap-1.5">
                          {EVIDENCE_KEYS.map((e) => (
                            <span key={e.key}>{e.label.split(' ')[0]}</span>
                          ))}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedClaim(claim)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            onClick={() => setSelectedClaim(claim)}
                            disabled={!canRaise}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                              canRaise
                                ? 'bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400'
                                : 'bg-slate-800/30 text-slate-600 cursor-not-allowed border border-white/5'
                            }`}
                            title={
                              canRaise
                                ? 'Raise dispute via VRM Agent'
                                : 'Only available after inspection is complete'
                            }
                          >
                            <Bot className="w-3.5 h-3.5" />
                            Raise Dispute
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Return Modal ────────────────────────────────────────────────── */}
      {showAddModal && (
        <AddReturnModal
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchClaims}
        />
      )}

      {/* ── Snapdeal API & OAuth Config Modal ───────────────────────────────── */}
      {showConfigModal && (
        <SnapdealConfigModal
          onClose={() => setShowConfigModal(false)}
          onSuccess={() => {
            checkSdStatus();
            fetchClaims();
          }}
        />
      )}

      {/* ── Claim Detail Modal ──────────────────────────────────────────────── */}
      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
        />
      )}
    </div>
  );
}
