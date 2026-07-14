import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { adminFetch } from '../../lib/api';

export default function OrgDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [maxSeats, setMaxSeats] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminFetch(`/organizations/${id}`)
      .then((data) => { setOrg(data); setMaxSeats(data.maxSeats || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const updateSeats = async () => {
    setSaving(true);
    try {
      await adminFetch(`/organizations/${id}/seats`, {
        method: 'PUT',
        body: JSON.stringify({ maxSeats }),
      });
      setOrg((prev) => ({ ...prev, maxSeats }));
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!org) return <p className="text-slate-500">Organization not found.</p>;

  return (
    <div>
      <button onClick={() => navigate('/organizations')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h1 className="text-xl font-bold text-slate-900 mb-1">{org.name}</h1>
        <p className="text-sm text-slate-500 font-mono mb-4">{org.slug}</p>
        <div className="flex gap-4 text-sm">
          <span>Plan: <strong className="capitalize">{org.plan}</strong></span>
          <span>Billing: <strong>{org.subscriptionStatus || 'None'}</strong></span>
          <span>Created: <strong>{new Date(org.createdAt).toLocaleDateString()}</strong></span>
        </div>
      </div>

      {/* Seats */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Seat Management</h2>
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-700">Max Seats:</label>
          <input
            type="number"
            value={maxSeats}
            onChange={(e) => setMaxSeats(parseInt(e.target.value) || 0)}
            className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            onClick={updateSeats}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {/* Members */}
      {org.members && org.members.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Members ({org.members.length})</h2>
          <div className="space-y-2">
            {org.members.map((m) => (
              <div key={m._id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.userName || m.userId}</p>
                  <p className="text-xs text-slate-500">{m.userEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md capitalize">{m.role}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>{m.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
