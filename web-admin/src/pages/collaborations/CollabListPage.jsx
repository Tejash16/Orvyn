import { useEffect, useState } from 'react';
import DataTable from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import { adminFetch } from '../../lib/api';

export default function CollabListPage() {
  const [collabs, setCollabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [breakId, setBreakId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCollabs = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/collaborations');
      setCollabs(data.collaborations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCollabs(); }, []);

  const handleBreak = async () => {
    setActionLoading(true);
    try {
      await adminFetch(`/collaborations/${breakId}`, { method: 'DELETE' });
      await fetchCollabs();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
      setBreakId(null);
    }
  };

  const columns = [
    { key: 'userAName', label: 'User A', render: (row) => (
      <div>
        <p className="text-sm font-medium text-slate-900">{row.userAName || 'Unknown'}</p>
        <p className="text-xs text-slate-500">{row.userAEmail}</p>
      </div>
    )},
    { key: 'userBName', label: 'User B', render: (row) => (
      <div>
        <p className="text-sm font-medium text-slate-900">{row.userBName || 'Unknown'}</p>
        <p className="text-xs text-slate-500">{row.userBEmail}</p>
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
        row.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' :
        row.status === 'pending' ? 'bg-amber-50 text-amber-700' :
        'bg-slate-100 text-slate-500'
      }`}>{row.status}</span>
    )},
    { key: 'createdAt', label: 'Created', render: (row) => (
      <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</span>
    )},
    { key: 'actions', label: '', render: (row) => (
      <button
        onClick={(e) => { e.stopPropagation(); setBreakId(row._id); }}
        className="text-xs text-red-600 hover:text-red-700 font-medium"
      >
        Break
      </button>
    )},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Collaborations</h1>
      <DataTable columns={columns} data={collabs} loading={loading} emptyMessage="No collaborations found" />
      <ConfirmDialog
        open={!!breakId}
        title="Break Collaboration"
        message="This will end the collaboration between these two users. They will no longer be able to share DataRooms with each other."
        confirmLabel="Break Collaboration"
        variant="danger"
        onConfirm={handleBreak}
        onCancel={() => setBreakId(null)}
        loading={actionLoading}
      />
    </div>
  );
}
