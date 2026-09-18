import { useState } from 'react';
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
  X
} from 'lucide-react';

const INITIAL_CLAIMS = [
  {
    id: 'CLM-2026-0891',
    awb: 'DEL9928172648',
    channel: 'Meesho',
    reason: 'Wrong Item in Return (Fake Product)',
    amount: 1850,
    status: 'Approved',
    vrmRecordingId: 'VRM_RET_9928172',
    date: '2026-09-17',
    notes: 'Customer returned cheap soap instead of Silk Saree. Video inspection verified tamper-proof tape.'
  },
  {
    id: 'CLM-2026-0892',
    awb: 'AMZ8810293841',
    channel: 'Amazon EasyShip',
    reason: 'Damaged in Transit by Courier',
    amount: 3499,
    status: 'Under Review',
    vrmRecordingId: 'VRM_ORD_8810293',
    date: '2026-09-18',
    notes: 'Outbound packing video proves item was intact and packed with double bubble wrap.'
  },
  {
    id: 'CLM-2026-0893',
    awb: 'FK4471928371',
    channel: 'Flipkart',
    reason: 'Empty Box Received (Missing Inventory)',
    amount: 2200,
    status: 'Evidence Submitted',
    vrmRecordingId: 'VRM_RET_4471928',
    date: '2026-09-16',
    notes: 'Box seal was cut from bottom. Unboxing station video captures exact seal breach.'
  },
  {
    id: 'CLM-2026-0894',
    awb: 'BLU7718293012',
    channel: 'BlueDart Direct',
    reason: 'Courier Lost in Transit (RTO)',
    amount: 4100,
    status: 'Action Required',
    vrmRecordingId: 'VRM_ORD_7718293',
    date: '2026-09-15',
    notes: 'Carrier marked package as delivered to hub, but never delivered back to seller.'
  },
  {
    id: 'CLM-2026-0895',
    awb: 'DEL6629103948',
    channel: 'Delhivery Surface',
    reason: 'Customer Used & Returned Damaged',
    amount: 1690,
    status: 'Rejected',
    vrmRecordingId: 'VRM_RET_6629103',
    date: '2026-09-14',
    notes: 'Re-appeal filed with high-definition frame captures from VRM return camera.'
  }
];

export default function ClaimManagement({ user, onSwitchToVrmRecords }) {
  const [claims, setClaims] = useState(INITIAL_CLAIMS);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);

  // New claim form state
  const [newClaim, setNewClaim] = useState({
    awb: '',
    channel: 'Meesho',
    reason: 'Wrong Item in Return (Fake Product)',
    amount: '',
    vrmRecordingId: '',
    notes: ''
  });

  const handleCreateClaim = (e) => {
    e.preventDefault();
    if (!newClaim.awb || !newClaim.amount) return;

    const created = {
      id: `CLM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      awb: newClaim.awb.trim(),
      channel: newClaim.channel,
      reason: newClaim.reason,
      amount: parseFloat(newClaim.amount),
      status: 'Evidence Submitted',
      vrmRecordingId: newClaim.vrmRecordingId || `VRM_PROOF_${newClaim.awb.slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      filedBy: user?.fullName || 'Claims Officer',
      notes: newClaim.notes || 'Evidence linked from VRM system.'
    };

    setClaims([created, ...claims]);
    setShowNewModal(false);
    setNewClaim({
      awb: '',
      channel: 'Meesho',
      reason: 'Wrong Item in Return (Fake Product)',
      amount: '',
      vrmRecordingId: '',
      notes: ''
    });
  };

  const filteredClaims = claims.filter(item => {
    const matchesSearch = item.awb.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesChannel = channelFilter === 'all' || item.channel.toLowerCase().includes(channelFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesChannel && matchesStatus;
  });

  const totalClaimAmount = claims.reduce((acc, curr) => acc + curr.amount, 0);
  const totalApproved = claims.filter(c => c.status === 'Approved').reduce((acc, curr) => acc + curr.amount, 0);
  const approvalRate = Math.round((claims.filter(c => c.status === 'Approved').length / claims.length) * 100);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-dark-800 to-indigo-950/40 p-6 md:p-8 rounded-3xl border border-white/5 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-300 text-[10px] font-extrabold uppercase tracking-wider border border-brand-500/30 flex items-center gap-1.5">
                <Scale className="w-3 h-3" /> Module: CMS
              </span>
              <span className="text-xs text-slate-400 font-medium">OpsSuite Integrated Dispute Hub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Claim Management System
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Automate marketplace claim submissions (Meesho, Amazon, Flipkart, Courier) backed by indisputable video evidence from the <strong className="text-white">VRM Station</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowNewModal(true)}
              className="px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              File New Dispute Claim
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-dark-800 p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Disputes</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-white">{claims.filter(c => c.status !== 'Approved' && c.status !== 'Rejected').length} Pending</p>
          <span className="text-[11px] text-slate-500">Across {new Set(claims.map(c => c.channel)).size} channels</span>
        </div>

        <div className="bg-dark-800 p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Disputed Value</span>
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-white">₹{totalClaimAmount.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> 100% video-backed
          </span>
        </div>

        <div className="bg-dark-800 p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recovered Payouts</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-400">₹{totalApproved.toLocaleString('en-IN')}</p>
          <span className="text-[11px] text-slate-500">Approved claims credited</span>
        </div>

        <div className="bg-dark-800 p-5 rounded-2xl border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">VRM Win Rate</span>
            <span className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-white">{approvalRate}%</p>
          <span className="text-[11px] text-brand-400">Boosted by tamper recording</span>
        </div>
      </div>

      {/* VRM Integration Cross-Link Highlight */}
      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Automatic VRM Evidence Linker</h4>
            <p className="text-xs text-slate-400">
              Every dispute is synchronized with high-definition unboxing & packing recordings from your warehouse cameras.
            </p>
          </div>
        </div>
        {onSwitchToVrmRecords && (
          <button
            onClick={onSwitchToVrmRecords}
            className="text-xs font-bold text-brand-300 hover:text-brand-200 bg-brand-500/20 hover:bg-brand-500/30 border border-brand-500/30 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            Open VRM Video Vault
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Controls Bar: Search & Filters */}
      <div className="bg-dark-800 p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search AWB, Claim ID, reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-brand-500 text-slate-200 placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
            <span className="text-[10px] uppercase font-bold text-slate-500">Channel:</span>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Channels</option>
              <option value="Meesho">Meesho</option>
              <option value="Amazon">Amazon</option>
              <option value="Flipkart">Flipkart</option>
              <option value="Delhivery">Delhivery</option>
              <option value="BlueDart">BlueDart</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-slate-400">
            <span className="text-[10px] uppercase font-bold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Under Review">Under Review</option>
              <option value="Evidence Submitted">Evidence Submitted</option>
              <option value="Action Required">Action Required</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Claims Records Table */}
      <div className="bg-dark-800 rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-slate-900/60 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <th className="p-4">Claim ID & Date</th>
                <th className="p-4">Channel / Marketplace</th>
                <th className="p-4">AWB Tracking</th>
                <th className="p-4">Dispute Category</th>
                <th className="p-4">Claim Value</th>
                <th className="p-4">VRM Video Evidence</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredClaims.map((claim) => (
                <tr key={claim.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-white">{claim.id}</p>
                    <span className="text-[10px] text-slate-500">{claim.date}</span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-slate-300 border border-white/5">
                      {claim.channel}
                    </span>
                  </td>
                  <td className="p-4 font-mono font-medium text-slate-300">
                    {claim.awb}
                  </td>
                  <td className="p-4 text-slate-300 font-medium">
                    {claim.reason}
                  </td>
                  <td className="p-4 font-bold text-white">
                    ₹{claim.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedClaim(claim)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 font-semibold transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[110px]">{claim.vrmRecordingId}</span>
                    </button>
                  </td>
                  <td className="p-4">
                    {claim.status === 'Approved' && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </span>
                    )}
                    {claim.status === 'Under Review' && (
                      <span className="inline-flex items-center gap-1 text-yellow-400 font-bold bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">
                        <Clock className="w-3 h-3" /> Reviewing
                      </span>
                    )}
                    {claim.status === 'Evidence Submitted' && (
                      <span className="inline-flex items-center gap-1 text-indigo-400 font-bold bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
                        <FileText className="w-3 h-3" /> Submitted
                      </span>
                    )}
                    {claim.status === 'Action Required' && (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-bold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" /> Re-appeal
                      </span>
                    )}
                    {claim.status === 'Rejected' && (
                      <span className="inline-flex items-center gap-1 text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedClaim(claim)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClaims.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-500 text-xs">
                    No claims match your current search and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Claim Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white">File New Marketplace Dispute</h3>
                <p className="text-xs text-slate-400">Link courier AWB and attach VRM recorded video</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClaim} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px]">AWB Tracking Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DEL9928172648"
                  value={newClaim.awb}
                  onChange={(e) => setNewClaim({ ...newClaim, awb: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase font-bold text-[10px]">Channel / Platform</label>
                  <select
                    value={newClaim.channel}
                    onChange={(e) => setNewClaim({ ...newClaim, channel: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Meesho">Meesho</option>
                    <option value="Amazon EasyShip">Amazon EasyShip</option>
                    <option value="Flipkart">Flipkart</option>
                    <option value="Delhivery Surface">Delhivery Surface</option>
                    <option value="BlueDart Direct">BlueDart Direct</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase font-bold text-[10px]">Claim Amount (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1950"
                    value={newClaim.amount}
                    onChange={(e) => setNewClaim({ ...newClaim, amount: e.target.value })}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px]">Dispute Category</label>
                <select
                  value={newClaim.reason}
                  onChange={(e) => setNewClaim({ ...newClaim, reason: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Wrong Item in Return (Fake Product)">Wrong Item in Return (Fake Product)</option>
                  <option value="Empty Box Received (Missing Inventory)">Empty Box Received (Missing Inventory)</option>
                  <option value="Damaged in Transit by Courier">Damaged in Transit by Courier</option>
                  <option value="Customer Used & Returned Damaged">Customer Used & Returned Damaged</option>
                  <option value="Courier Lost in Transit (RTO)">Courier Lost in Transit (RTO)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px] flex items-center justify-between">
                  <span>VRM Video Proof Link</span>
                  <span className="text-brand-400 lowercase text-[9px]">auto-sync with VRM vault</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. VRM_RET_9928172 (or leave blank to auto-link)"
                  value={newClaim.vrmRecordingId}
                  onChange={(e) => setNewClaim({ ...newClaim, vrmRecordingId: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px]">Dispute Description / Notes</label>
                <textarea
                  rows={3}
                  placeholder="Explain inspection findings or tamper evidence observed..."
                  value={newClaim.notes}
                  onChange={(e) => setNewClaim({ ...newClaim, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all shadow-lg shadow-indigo-600/20"
                >
                  Submit Dispute Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Claim Detail Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-brand-400">Claim Dossier</span>
                <h3 className="text-lg font-bold text-white">{selectedClaim.id}</h3>
              </div>
              <button onClick={() => setSelectedClaim(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                <div>
                  <span className="text-slate-500 font-semibold block">Channel</span>
                  <span className="font-bold text-white">{selectedClaim.channel}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Claim Value</span>
                  <span className="font-bold text-white">₹{selectedClaim.amount.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">AWB Tracking</span>
                  <span className="font-mono text-indigo-300 font-bold">{selectedClaim.awb}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Status</span>
                  <span className="font-bold text-emerald-400">{selectedClaim.status}</span>
                </div>
              </div>

              <div className="bg-dark-900 p-4 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-brand-400" />
                    VRM Video Proof Attached
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-bold">
                    Verified Tape Stamp
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] font-mono bg-slate-950 px-3 py-2 rounded-xl border border-white/5">
                  ID: {selectedClaim.vrmRecordingId}.mp4
                </p>
                <p className="text-slate-300 italic text-[11px]">
                  "{selectedClaim.notes}"
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedClaim(null)}
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
