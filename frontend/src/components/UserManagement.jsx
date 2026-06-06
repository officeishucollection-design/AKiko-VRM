import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, ShieldAlert, Loader2, Check, CheckSquare, Square } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('operator');
  const [allowOrder, setAllowOrder] = useState(true);
  const [allowReturn, setAllowReturn] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/auth/users`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !password || !fullName.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (role === 'operator' && !allowOrder && !allowReturn) {
      setError('An Operator must be assigned to at least one station (Order Scan, Returns, or Both).');
      return;
    }

    setSubmitting(true);

    const allowedStations = [];
    if (allowOrder) allowedStations.push('order');
    if (allowReturn) allowedStations.push('return');

    const payload = {
      username: username.trim(),
      password,
      fullName: fullName.trim(),
      role,
      allowedStations: role === 'operator' ? allowedStations : ['order', 'return']
    };

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccess(`User "${data.user.username}" created successfully!`);
      // Reset form
      setUsername('');
      setPassword('');
      setFullName('');
      setRole('operator');
      setAllowOrder(true);
      setAllowReturn(true);

      // Refresh list
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user) => {
    if (user._id === currentUser._id) {
      alert('You cannot delete your own admin account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete user "${user.fullName}" (${user.username})?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/users/${user._id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setSuccess(`User "${user.username}" deleted successfully.`);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">Admin</span>;
      case 'operator':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">Operator</span>;
      case 'auditor':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">Auditor</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-500/10 text-slate-400">{role}</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Users className="w-7 h-7 text-brand-500" />
          User Management
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Manage system users, assign roles, and delegate specific station permissions for Operators.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-2xl flex items-start gap-3 animate-pulse-slow">
          <ShieldAlert className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div className="text-sm font-semibold">{error}</div>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 rounded-2xl flex items-start gap-3">
          <Check className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm font-semibold">{success}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* User Creation Form */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
          <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <UserPlus className="w-4 h-4 text-brand-500" /> Create New User
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block ml-1">
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-colors placeholder:text-slate-600 text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block ml-1">
                Username
              </label>
              <input
                type="text"
                placeholder="lowercase letters"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-colors placeholder:text-slate-600 lowercase text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block ml-1">
                Password
              </label>
              <input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-colors placeholder:text-slate-600 text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block ml-1">
                Access Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-colors text-slate-100"
              >
                <option value="operator">Operator (Picker/Packer)</option>
                <option value="auditor">Auditor (Read-Only)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            {/* Operator Granular Station Checkboxes */}
            {role === 'operator' && (
              <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                  Assign Stations
                </span>
                
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setAllowOrder(!allowOrder)}
                    className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white transition-colors text-left"
                  >
                    {allowOrder ? (
                      <CheckSquare className="w-4 h-4 text-brand-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    Order Scan Station
                  </button>

                  <button
                    type="button"
                    onClick={() => setAllowReturn(!allowReturn)}
                    className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white transition-colors text-left"
                  >
                    {allowReturn ? (
                      <CheckSquare className="w-4 h-4 text-brand-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    Returns Station
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 bg-brand-600 hover:bg-brand-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create User Account
                </>
              )}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
          <h3 className="text-md font-bold text-white border-b border-white/5 pb-3">
            System Users Directory
          </h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              <p className="text-xs">Loading directory...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-xs">
              No users registered in the system.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">
                    <th className="pb-3 pl-2">Name</th>
                    <th className="pb-3">Username</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Access Details</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-slate-800/10 transition-colors">
                      <td className="py-3 pl-2 font-bold text-white">{user.fullName}</td>
                      <td className="py-3 text-slate-400 lowercase">{user.username}</td>
                      <td className="py-3">{getRoleBadge(user.role)}</td>
                      <td className="py-3 text-slate-300">
                        {user.role === 'admin' && (
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">All Systems Open</span>
                        )}
                        {user.role === 'auditor' && (
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Read Only Records & Dash</span>
                        )}
                        {user.role === 'operator' && (
                          <div className="flex flex-wrap gap-1">
                            {user.allowedStations.includes('order') && (
                              <span className="bg-indigo-500/10 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-500/20">
                                Order Scan
                              </span>
                            )}
                            {user.allowedStations.includes('return') && (
                              <span className="bg-purple-500/10 text-purple-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-purple-500/20">
                                Returns
                              </span>
                            )}
                            {user.allowedStations.length === 0 && (
                              <span className="bg-red-500/10 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/20">
                                No Stations Assigned
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right pr-2">
                        {user._id !== currentUser._id ? (
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/35 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-semibold px-2">Current Admin</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default UserManagement;
