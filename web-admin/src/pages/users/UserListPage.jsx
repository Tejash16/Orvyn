import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, ShieldOff, ShieldAlert } from 'lucide-react';
import DataTable from '../../components/DataTable';
import SearchBar from '../../components/SearchBar';
import { adminFetch } from '../../lib/api';

const STATUS_BADGES = {
  active: 'bg-emerald-50 text-emerald-700',
  suspended: 'bg-amber-50 text-amber-700',
  banned: 'bg-red-50 text-red-700',
};

export default function UserListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') || '1');
  const query = searchParams.get('q') || '';
  const statusFilter = searchParams.get('status') || '';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (query) params.set('q', query);
      if (statusFilter) params.set('status', statusFilter);
      const data = await adminFetch(`/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, query, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (val) => {
    setSearchParams((prev) => {
      prev.set('q', val);
      prev.set('page', '1');
      return prev;
    });
  };

  const handlePageChange = (newPage) => {
    setSearchParams((prev) => {
      prev.set('page', String(newPage));
      return prev;
    });
  };

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <span className="font-medium text-slate-900">{row.name}</span>
    )},
    { key: 'email', label: 'Email' },
    { key: 'provider', label: 'Provider', render: (row) => (
      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">
        {row.provider}
      </span>
    )},
    { key: 'userType', label: 'Type', render: (row) => row.userType || 'N/A' },
    { key: 'restrictionStatus', label: 'Status', render: (row) => {
      const status = row.restrictionStatus || 'active';
      return (
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGES[status] || STATUS_BADGES.active}`}>
          {status}
        </span>
      );
    }},
    { key: 'createdAt', label: 'Joined', render: (row) => (
      <span className="text-xs text-slate-500">
        {new Date(row.createdAt).toLocaleDateString()}
      </span>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500">{total} total</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <SearchBar
          value={query}
          onChange={handleSearch}
          placeholder="Search by name or email..."
          className="flex-1 max-w-md"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setSearchParams((prev) => {
              prev.set('status', e.target.value);
              prev.set('page', '1');
              return prev;
            });
          }}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={users}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={handlePageChange}
        onRowClick={(row) => navigate(`/users/${row._id}`)}
        loading={loading}
        emptyMessage="No users found"
      />
    </div>
  );
}
