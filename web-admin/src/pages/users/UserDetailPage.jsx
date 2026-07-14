import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Ban, ShieldOff, Trash2, RotateCcw, Save, Loader2 } from 'lucide-react';
import ConfirmDialog from '../../components/ConfirmDialog';
import { adminFetch } from '../../lib/api';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [dialog, setDialog] = useState(null); // { type, title, message }
  const [limits, setLimits] = useState({});
  const [limitsSaving, setLimitsSaving] = useState(false);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const data = await adminFetch(`/users/${id}`);
      setUser(data);
      if (data.limits) {
        setLimits({
          monthlyFileLimit: data.limits.monthlyFileLimit,
          dailyMessageLimit: data.limits.dailyMessageLimit,
          dataroomLimit: data.limits.dataroomLimit,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, [id]);

  const performAction = async (action, body = {}) => {
    setActionLoading(true);
    try {
      if (action === 'delete') {
        await adminFetch(`/users/${id}`, { method: 'DELETE' });
        navigate('/users');
        return;
      }
      await adminFetch(`/users/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await fetchUser();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
      setDialog(null);
    }
  };

  const saveLimits = async () => {
    setLimitsSaving(true);
    try {
      await adminFetch(`/users/${id}/limits`, {
        method: 'PUT',
        body: JSON.stringify(limits),
      });
      await fetchUser();
    } catch (err) {
      alert(err.message);
    } finally {
      setLimitsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <p className="text-slate-500">User not found.</p>;

  const status = user.restrictionStatus || 'active';

  return (
    <div>
      <button onClick={() => navigate('/users')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </button>

      {/* User header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {user.profilePicture ? (
              <img src={user.profilePicture} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
                {user.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900">{user.name}</h1>
              <p className="text-sm text-slate-500">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{user.provider}</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{user.userType || 'No type'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                  status === 'suspended' ? 'bg-amber-50 text-amber-700' :
                  'bg-red-50 text-red-700'
                }`}>{status}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {status === 'active' && (
              <button
                onClick={() => setDialog({
                  type: 'suspend', title: 'Suspend User',
                  message: `Are you sure you want to suspend ${user.name}? They will not be able to access Orvyn until unsuspended.`,
                })}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
              >
                <ShieldOff className="w-4 h-4" /> Suspend
              </button>
            )}
            {status === 'suspended' && (
              <button
                onClick={() => performAction('unsuspend')}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Unsuspend
              </button>
            )}
            {status !== 'banned' && (
              <button
                onClick={() => setDialog({
                  type: 'ban', title: 'Ban User',
                  message: `Are you sure you want to permanently ban ${user.name}? This action is severe and the user will lose all access.`,
                })}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <Ban className="w-4 h-4" /> Ban
              </button>
            )}
            <button
              onClick={() => performAction('reset-password')}
              disabled={actionLoading}
              className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Reset Password
            </button>
            <button
              onClick={() => setDialog({
                type: 'delete', title: 'Delete User',
                message: `This will permanently delete ${user.name}'s account and all their data. This action cannot be undone.`,
              })}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Usage */}
        {user.usage && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Usage</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Files this period</span>
                <span className="font-medium text-slate-900">{user.usage.filesUploadedThisPeriod}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Messages today</span>
                <span className="font-medium text-slate-900">{user.usage.messagesToday}</span>
              </div>
            </div>
          </div>
        )}

        {/* Limits */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Limits</h2>
            {user.limits?.isCustomOverride && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Custom Override</span>
            )}
          </div>
          <div className="space-y-3">
            {[
              { key: 'monthlyFileLimit', label: 'Monthly file limit' },
              { key: 'dailyMessageLimit', label: 'Daily message limit' },
              { key: 'dataroomLimit', label: 'DataRoom limit' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{label}</span>
                <input
                  type="number"
                  value={limits[key] ?? ''}
                  onChange={(e) => setLimits((prev) => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-2 py-1 text-sm text-right border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            ))}
            <p className="text-xs text-slate-400">Use -1 for unlimited</p>
            <button
              onClick={saveLimits}
              disabled={limitsSaving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60 mt-2"
            >
              {limitsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Limits
            </button>
          </div>
        </div>
      </div>

      {/* Organization memberships */}
      {user.organizations && user.organizations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Organizations</h2>
          <div className="space-y-2">
            {user.organizations.map((org) => (
              <div key={org._id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{org.organizationName || org.organizationId}</p>
                  <p className="text-xs text-slate-500">Role: {org.role}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  org.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>{org.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent audit logs */}
      {user.recentAuditLogs && user.recentAuditLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-2">
            {user.recentAuditLogs.map((log) => (
              <div key={log._id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm text-slate-700">{log.action}</p>
                  {log.resourceName && <p className="text-xs text-slate-500">{log.resourceName}</p>}
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.type === 'delete' ? 'Delete Permanently' : dialog?.type === 'ban' ? 'Ban User' : 'Suspend User'}
        variant="danger"
        onConfirm={() => performAction(dialog.type, { reason: 'Admin action' })}
        onCancel={() => setDialog(null)}
        loading={actionLoading}
      />
    </div>
  );
}
