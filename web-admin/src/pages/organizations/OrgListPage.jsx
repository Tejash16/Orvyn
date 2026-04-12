import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import SearchBar from '../../components/SearchBar';
import { adminFetch } from '../../lib/api';

export default function OrgListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orgs, setOrgs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') || '1');
  const query = searchParams.get('q') || '';

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (query) params.set('q', query);
      const data = await adminFetch(`/organizations?${params}`);
      setOrgs(data.organizations || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const columns = [
    { key: 'name', label: 'Name', render: (row) => <span className="font-medium text-slate-900">{row.name}</span> },
    { key: 'slug', label: 'Slug', render: (row) => <span className="text-xs font-mono text-slate-500">{row.slug}</span> },
    { key: 'plan', label: 'Plan', render: (row) => (
      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-medium capitalize">{row.plan}</span>
    )},
    { key: 'memberCount', label: 'Members', render: (row) => `${row.memberCount || 0} / ${row.maxSeats}` },
    { key: 'subscriptionStatus', label: 'Billing', render: (row) => row.subscriptionStatus || 'None' },
    { key: 'createdAt', label: 'Created', render: (row) => (
      <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</span>
    )},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Organizations</h1>

      <SearchBar
        value={query}
        onChange={(val) => setSearchParams((prev) => { prev.set('q', val); prev.set('page', '1'); return prev; })}
        placeholder="Search organizations..."
        className="max-w-md mb-4"
      />

      <DataTable
        columns={columns}
        data={orgs}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => setSearchParams((prev) => { prev.set('page', String(p)); return prev; })}
        onRowClick={(row) => navigate(`/organizations/${row._id}`)}
        loading={loading}
      />
    </div>
  );
}
