import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import { adminFetch } from '../../lib/api';

const STATUS_COLORS = {
  active: 'bg-emerald-50 text-emerald-700',
  trialing: 'bg-blue-50 text-blue-700',
  past_due: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-slate-100 text-slate-500',
  expired: 'bg-red-50 text-red-700',
};

export default function SubListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subs, setSubs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') || '1');
  const statusFilter = searchParams.get('status') || '';
  const planFilter = searchParams.get('plan') || '';

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set('status', statusFilter);
      if (planFilter) params.set('plan', planFilter);
      const data = await adminFetch(`/subscriptions?${params}`);
      setSubs(data.subscriptions || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, planFilter]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const columns = [
    { key: 'userName', label: 'User', render: (row) => (
      <div>
        <p className="font-medium text-slate-900">{row.userName || 'N/A'}</p>
        <p className="text-xs text-slate-500">{row.userEmail}</p>
      </div>
    )},
    { key: 'plan', label: 'Plan', render: (row) => (
      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-medium capitalize">{row.plan}</span>
    )},
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[row.status] || 'bg-slate-100 text-slate-500'}`}>
        {row.status}
      </span>
    )},
    { key: 'currentPeriodEnd', label: 'Period End', render: (row) => (
      row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString() : 'N/A'
    )},
    { key: 'createdAt', label: 'Created', render: (row) => (
      <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</span>
    )},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Subscriptions</h1>

      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setSearchParams((prev) => { prev.set('status', e.target.value); prev.set('page', '1'); return prev; })}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past Due</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setSearchParams((prev) => { prev.set('plan', e.target.value); prev.set('page', '1'); return prev; })}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={subs}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => setSearchParams((prev) => { prev.set('page', String(p)); return prev; })}
        loading={loading}
      />
    </div>
  );
}
