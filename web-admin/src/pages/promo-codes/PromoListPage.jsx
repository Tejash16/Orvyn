import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import DataTable from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import { adminFetch } from '../../lib/api';

export default function PromoListPage() {
  const navigate = useNavigate();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deactivateId, setDeactivateId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/promo-codes');
      setCodes(data.promoCodes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleDeactivate = async () => {
    setActionLoading(true);
    try {
      await adminFetch(`/promo-codes/${deactivateId}/deactivate`, { method: 'POST' });
      await fetchCodes();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
      setDeactivateId(null);
    }
  };

  const columns = [
    { key: 'code', label: 'Code', render: (row) => (
      <span className="font-mono font-bold text-emerald-700">{row.code}</span>
    )},
    { key: 'discountType', label: 'Type', render: (row) => (
      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{row.discountType}</span>
    )},
    { key: 'discountValue', label: 'Value', render: (row) => {
      if (row.discountType === 'percentage') return `${row.discountValue}%`;
      if (row.discountType === 'trial_extension') return `${row.discountValue} days`;
      return `${(row.discountValue / 100).toFixed(2)}`;
    }},
    { key: 'currentRedemptions', label: 'Redemptions', render: (row) => (
      `${row.currentRedemptions}${row.maxRedemptions ? ` / ${row.maxRedemptions}` : ''}`
    )},
    { key: 'isActive', label: 'Status', render: (row) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
        row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
      }`}>
        {row.isActive ? 'Active' : 'Inactive'}
      </span>
    )},
    { key: 'actions', label: '', render: (row) => row.isActive ? (
      <button
        onClick={(e) => { e.stopPropagation(); setDeactivateId(row._id); }}
        className="text-xs text-red-600 hover:text-red-700 font-medium"
      >
        Deactivate
      </button>
    ) : null },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Promo Codes</h1>
        <button
          onClick={() => navigate('/promo-codes/create')}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Code
        </button>
      </div>

      <DataTable columns={columns} data={codes} loading={loading} emptyMessage="No promo codes yet" />

      <ConfirmDialog
        open={!!deactivateId}
        title="Deactivate Promo Code"
        message="This code will no longer be usable. Existing redemptions are not affected."
        confirmLabel="Deactivate"
        variant="warning"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateId(null)}
        loading={actionLoading}
      />
    </div>
  );
}
