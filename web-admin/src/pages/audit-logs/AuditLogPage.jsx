import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import SearchBar from '../../components/SearchBar';
import { adminFetch } from '../../lib/api';

export default function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') || '1');
  const action = searchParams.get('action') || '';
  const query = searchParams.get('q') || '';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (action) params.set('action', action);
      if (query) params.set('q', query);
      const data = await adminFetch(`/audit-logs?${params}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, action, query]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const columns = [
    { key: 'createdAt', label: 'Time', width: '160px', render: (row) => (
      <span className="text-xs text-slate-500 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</span>
    )},
    { key: 'userName', label: 'User', render: (row) => (
      <div>
        <p className="text-sm font-medium text-slate-900">{row.userName}</p>
        <p className="text-xs text-slate-500">{row.userEmail}</p>
      </div>
    )},
    { key: 'action', label: 'Action', render: (row) => (
      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-mono">{row.action}</span>
    )},
    { key: 'resourceType', label: 'Resource', render: (row) => (
      <div>
        <p className="text-sm text-slate-700">{row.resourceType}</p>
        {row.resourceName && <p className="text-xs text-slate-500">{row.resourceName}</p>}
      </div>
    )},
    { key: 'ipAddress', label: 'IP', render: (row) => (
      <span className="text-xs font-mono text-slate-500">{row.ipAddress || 'N/A'}</span>
    )},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Audit Logs</h1>

      <div className="flex items-center gap-3 mb-4">
        <SearchBar
          value={query}
          onChange={(val) => setSearchParams((prev) => { prev.set('q', val); prev.set('page', '1'); return prev; })}
          placeholder="Search by user..."
          className="flex-1 max-w-sm"
        />
        <select
          value={action}
          onChange={(e) => setSearchParams((prev) => { prev.set('action', e.target.value); prev.set('page', '1'); return prev; })}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="">All Actions</option>
          <option value="dataroom.shared">DataRoom Shared</option>
          <option value="dataroom.created">DataRoom Created</option>
          <option value="org.member_invited">Member Invited</option>
          <option value="org.member_joined">Member Joined</option>
          <option value="org.member_removed">Member Removed</option>
          <option value="billing.subscription_created">Subscription Created</option>
          <option value="billing.payment_success">Payment Success</option>
          <option value="billing.payment_failed">Payment Failed</option>
          <option value="admin.user_suspended">User Suspended</option>
          <option value="admin.user_banned">User Banned</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => setSearchParams((prev) => { prev.set('page', String(p)); return prev; })}
        loading={loading}
      />
    </div>
  );
}
