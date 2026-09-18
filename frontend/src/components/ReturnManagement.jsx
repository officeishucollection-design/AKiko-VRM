import { useState } from 'react';
import { 
  RotateCcw, 
  Search, 
  Filter, 
  Plus, 
  Video, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Boxes, 
  ArrowRight, 
  Layers,
  ShieldAlert,
  X
} from 'lucide-react';

const INITIAL_RETURNS = [
  {
    id: 'RET-2026-1049',
    awb: 'DEL9928172648',
    type: 'Customer Return',
    sku: 'IK-SR-SLK-04 (Silk Saree Red)',
    receivedDate: '2026-09-17',
    qcGrade: 'Fraud / Tampered',
    disposition: 'Push to CMS Claim',
    vrmRecordingId: 'VRM_RET_9928172',
    inspector: 'Rajesh K.',
    notes: 'Received duplicate soap bar instead of genuine saree.'
  },
  {
    id: 'RET-2026-1050',
    awb: 'AMZ7729104822',
    type: 'Courier RTO',
    sku: 'IK-KT-COT-12 (Cotton Kurti Blue)',
    receivedDate: '2026-09-18',
    qcGrade: 'Grade A (Pristine)',
    disposition: 'Restocked in Inventory',
    vrmRecordingId: 'VRM_RET_7729104',
    inspector: 'Priya M.',
    notes: 'Undelivered order. Outer packaging intact, original tags attached.'
  },
  {
    id: 'RET-2026-1051',
    awb: 'FK4471928371',
    type: 'Customer Return',
    sku: 'IK-DH-SLV-08 (Embroidered Dupatta)',
    receivedDate: '2026-09-16',
    qcGrade: 'Grade C (Damaged/Stained)',
    disposition: 'Salvage / Dispute',
    vrmRecordingId: 'VRM_RET_4471928',
    inspector: 'Rajesh K.',
    notes: 'Fabric torn near border; not eligible for restock.'
  },
  {
    id: 'RET-2026-1052',
    awb: 'DEL5519284729',
    type: 'Courier RTO',
    sku: 'IK-LG-BRD-01 (Bridal Lehenga Set)',
    receivedDate: '2026-09-18',
    qcGrade: 'Grade A (Pristine)',
    disposition: 'Ready for Binning',
    vrmRecordingId: 'VRM_RET_5519284',
    inspector: 'Amit S.',
    notes: 'Customer canceled at door. Completely sealed.'
  },
  {
    id: 'RET-2026-1053',
    awb: 'BLU8829104821',
    type: 'Customer Return',
    sku: 'IK-TP-WHT-03 (Tunic Top White)',
    receivedDate: '2026-09-15',
    qcGrade: 'Grade B (Repackaging Required)',
    disposition: 'Repackaging Station',
    vrmRecordingId: 'VRM_RET_8829104',
    inspector: 'Priya M.',
    notes: 'Garment good, original polybag torn. New barcode applied.'
  }
];

export default function ReturnManagement({ user, onSwitchToVrmReturns, onSwitchToCms }) {
  const [returnsList, setReturnsList] = useState(INITIAL_RETURNS);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);

  const [newReturn, setNewReturn] = useState({
    awb: '',
    type: 'Customer Return',
    sku: '',
    qcGrade: 'Grade A (Pristine)',
    disposition: 'Restocked in Inventory',
    vrmRecordingId: '',
    notes: ''
  });

  const handleLogReturn = (e) => {
    e.preventDefault();
    if (!newReturn.awb || !newReturn.sku) return;

    const created = {
      id: `RET-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      awb: newReturn.awb.trim(),
      type: newReturn.type,
      sku: newReturn.sku.trim(),
      receivedDate: new Date().toISOString().split('T')[0],
      qcGrade: newReturn.qcGrade,
      disposition: newReturn.disposition,
      vrmRecordingId: newReturn.vrmRecordingId || `VRM_RET_${newReturn.awb.slice(-6)}`,
      inspector: user?.fullName || 'Operator',
      notes: newReturn.notes || 'Inbound return processed.'
    };

    setReturnsList([created, ...returnsList]);
    setShowLogModal(false);
    setNewReturn({
      awb: '',
      type: 'Customer Return',
      sku: '',
      qcGrade: 'Grade A (Pristine)',
      disposition: 'Restocked in Inventory',
      vrmRecordingId: '',
      notes: ''
    });
  };

  const filteredReturns = returnsList.filter(item => {
    const matchesSearch = item.awb.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesGrade = gradeFilter === 'all' || item.qcGrade.includes(gradeFilter);
    return matchesSearch && matchesType && matchesGrade;
  });

  const gradeACount = returnsList.filter(r => r.qcGrade.includes('Grade A')).length;
  const fraudCount = returnsList.filter(r => r.qcGrade.includes('Fraud') || r.qcGrade.includes('Damaged')).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-dark-800 to-indigo-950/40 p-6 md:p-8 rounded-3xl border border-white/5 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 text-[10px] font-extrabold uppercase tracking-wider border border-brand-500/30 flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3" /> Module: RMS
              </span>
              <span className="text-xs text-slate-400 font-medium">OpsSuite Inbound Return & QC Triage</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Return Management System
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Track reverse logistics shipments, inspect items for tamper/damage, assign QC disposition, and coordinate with <strong className="text-white">VRM unboxing video streams</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onSwitchToVrmReturns && (
              <button
                onClick={onSwitchToVrmReturns}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-white/10 transition-colors"
              >
                <Video className="w-4 h-4 text-brand-400" />
                Go to VRM Unboxing Station
              </button>
            )}
            <button
              onClick={() => setShowLogModal(true)}
              className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Log Inbound Return
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-dark-800 p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Inbound Triage</span>
            <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-white">{returnsList.length} Packages</p>
          <span className="text-[11px] text-slate-500">Processed in current batch</span>
        </div>

        <div className="bg-dark-800 p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Restock Ready (Grade A)</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {Math.round((gradeACount / returnsList.length) * 100)}%
          </p>
          <span className="text-[11px] text-slate-500">{gradeACount} returned items intact</span>
        </div>

        <div className="bg-dark-800 p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tamper / Fraud Detected</span>
            <span className="p-2 rounded-xl bg-red-500/10 text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-red-400">{fraudCount} Flagged</p>
          <span className="text-[11px] text-red-400/80">Escalated with VRM unboxing proof</span>
        </div>

        <div className="bg-dark-800 p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connected Systems</span>
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-white">VRM + CMS</p>
          <span className="text-[11px] text-indigo-400">Real-time sync enabled</span>
        </div>
      </div>

      {/* Cross-Module Integration Alert */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-brand-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">RMS &rarr; CMS Dispute Pipeline</h4>
            <p className="text-xs text-slate-400">
              Damaged, empty, or counterfeit customer returns are automatically queued for carrier & marketplace claims with instant video evidence.
            </p>
          </div>
        </div>
        {onSwitchToCms && (
          <button
            onClick={onSwitchToCms}
            className="text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            Open CMS Claim Hub
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Controls Bar: Search & Filters */}
      <div className="bg-dark-800 p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search AWB, SKU, Return ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200 placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
            <span className="text-[10px] uppercase font-bold text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="Customer Return">Customer Return</option>
              <option value="Courier RTO">Courier RTO</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-slate-400">
            <span className="text-[10px] uppercase font-bold text-slate-500">QC Grade:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Grades</option>
              <option value="Grade A">Grade A (Pristine)</option>
              <option value="Grade B">Grade B (Repackage)</option>
              <option value="Grade C">Grade C (Damaged)</option>
              <option value="Fraud">Fraud / Tampered</option>
            </select>
          </div>
        </div>
      </div>

      {/* Return Records Table */}
      <div className="bg-dark-800 rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <th className="p-4">Return ID & Date</th>
                <th className="p-4">AWB Tracking</th>
                <th className="p-4">Inbound Type</th>
                <th className="p-4">Product SKU</th>
                <th className="p-4">QC Grade</th>
                <th className="p-4">Disposition</th>
                <th className="p-4">VRM Video</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredReturns.map((item) => (
                <tr key={item.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-white">{item.id}</p>
                    <span className="text-[10px] text-slate-500">{item.receivedDate}</span>
                  </td>
                  <td className="p-4 font-mono font-medium text-indigo-300">
                    {item.awb}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      item.type === 'Courier RTO' 
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300 font-medium truncate max-w-[180px]" title={item.sku}>
                    {item.sku}
                  </td>
                  <td className="p-4">
                    {item.qcGrade.includes('Grade A') && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Grade A
                      </span>
                    )}
                    {item.qcGrade.includes('Grade B') && (
                      <span className="inline-flex items-center gap-1 text-yellow-400 font-bold bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">
                        <Clock className="w-3 h-3" /> Grade B
                      </span>
                    )}
                    {item.qcGrade.includes('Grade C') && (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-bold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" /> Grade C
                      </span>
                    )}
                    {item.qcGrade.includes('Fraud') && (
                      <span className="inline-flex items-center gap-1 text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                        <ShieldAlert className="w-3 h-3" /> Fraud Alert
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-300 font-medium">
                    {item.disposition}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedReturn(item)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 font-semibold transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[110px]">{item.vrmRecordingId}</span>
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedReturn(item)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
              {filteredReturns.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-500 text-xs">
                    No returns match your current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Return Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white">Log Inbound Return Package</h3>
                <p className="text-xs text-slate-400">Record package triage and assign QC grade</p>
              </div>
              <button onClick={() => setShowLogModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogReturn} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase font-bold text-[10px]">AWB Tracking Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DEL9928172648"
                    value={newReturn.awb}
                    onChange={(e) => setNewReturn({ ...newReturn, awb: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase font-bold text-[10px]">Return Type</label>
                  <select
                    value={newReturn.type}
                    onChange={(e) => setNewReturn({ ...newReturn, type: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Customer Return">Customer Return (CIR)</option>
                    <option value="Courier RTO">Courier RTO (Undelivered)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px]">Product SKU / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IK-SR-SLK-04 (Silk Saree Red)"
                  value={newReturn.sku}
                  onChange={(e) => setNewReturn({ ...newReturn, sku: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase font-bold text-[10px]">QC Inspection Grade</label>
                  <select
                    value={newReturn.qcGrade}
                    onChange={(e) => setNewReturn({ ...newReturn, qcGrade: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Grade A (Pristine)">Grade A (Pristine / Resellable)</option>
                    <option value="Grade B (Repackaging Required)">Grade B (Minor Box Tear)</option>
                    <option value="Grade C (Damaged/Stained)">Grade C (Damaged / Stained)</option>
                    <option value="Fraud / Tampered">Fraud / Tampered (Wrong Item)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase font-bold text-[10px]">Disposition Workflow</label>
                  <select
                    value={newReturn.disposition}
                    onChange={(e) => setNewReturn({ ...newReturn, disposition: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Restocked in Inventory">Restocked in Inventory</option>
                    <option value="Repackaging Station">Repackaging Station</option>
                    <option value="Push to CMS Claim">Push to CMS Claim</option>
                    <option value="Salvage / Liquidate">Salvage / Liquidate</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px] flex items-center justify-between">
                  <span>VRM Unboxing Video Reference</span>
                  <span className="text-brand-400 lowercase text-[9px]">linked to VRM camera</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. VRM_RET_9928172 (auto-assigned from scan)"
                  value={newReturn.vrmRecordingId}
                  onChange={(e) => setNewReturn({ ...newReturn, vrmRecordingId: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px]">Inspector Notes</label>
                <textarea
                  rows={2}
                  placeholder="Condition notes, seal status, remarks..."
                  value={newReturn.notes}
                  onChange={(e) => setNewReturn({ ...newReturn, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all shadow-lg shadow-indigo-600/20"
                >
                  Confirm Inbound Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Detail Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-brand-400">Return Inspection Record</span>
                <h3 className="text-lg font-bold text-white">{selectedReturn.id}</h3>
              </div>
              <button onClick={() => setSelectedReturn(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                <div>
                  <span className="text-slate-500 font-semibold block">Type</span>
                  <span className="font-bold text-white">{selectedReturn.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">QC Grade</span>
                  <span className="font-bold text-amber-400">{selectedReturn.qcGrade}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">AWB Tracking</span>
                  <span className="font-mono text-indigo-300 font-bold">{selectedReturn.awb}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Disposition</span>
                  <span className="font-bold text-emerald-400">{selectedReturn.disposition}</span>
                </div>
              </div>

              <div className="bg-dark-900 p-4 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-brand-400" />
                    VRM Unboxing Footage
                  </span>
                  <span className="text-[10px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md font-bold">
                    Inspector: {selectedReturn.inspector}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] font-mono bg-slate-950 px-3 py-2 rounded-xl border border-white/5">
                  ID: {selectedReturn.vrmRecordingId}.mp4
                </p>
                <p className="text-slate-300 italic text-[11px]">
                  "{selectedReturn.notes}"
                </p>
              </div>

              {selectedReturn.qcGrade.includes('Fraud') && onSwitchToCms && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <span className="text-red-200 font-semibold text-[11px]">Flagged as Counterfeit / Tampered</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedReturn(null);
                      onSwitchToCms();
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-[10px] transition-colors"
                  >
                    Escalate to CMS
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedReturn(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
