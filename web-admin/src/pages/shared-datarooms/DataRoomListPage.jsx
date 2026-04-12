import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import SearchBar from '../../components/SearchBar';
import { adminFetch } from '../../lib/api';

export default function DataRoomListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') || '1');
  const query = searchParams.get('q') || '';

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (query) params.set('q', query);
      const data = await adminFetch(`/shared-datarooms?${params}`);
      setRooms(data.sharedDataRooms || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const columns = [
    { key: 'sourceDataroomName', label: 'Name', render: (row) => (
      <span className="font-medium text-slate-900">{row.sourceDataroomName}</span>
    )},
    { key: 'ownerName', label: 'Owner', render: (row) => (
      <div>
        <p className="text-sm text-slate-700">{row.ownerName}</p>
        <p className="text-xs text-slate-500">{row.ownerEmail}</p>
      </div>
    )},
    { key: 'fileCount', label: 'Files' },
    { key: 'folderCount', label: 'Folders' },
    { key: 'accessCount', label: 'Shared With' },
    { key: 'snapshotVersion', label: 'Version' },
    { key: 'createdAt', label: 'Created', render: (row) => (
      <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</span>
    )},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Shared DataRooms</h1>

      <SearchBar
        value={query}
        onChange={(val) => setSearchParams((prev) => { prev.set('q', val); prev.set('page', '1'); return prev; })}
        placeholder="Search by name or owner..."
        className="max-w-md mb-4"
      />

      <DataTable
        columns={columns}
        data={rooms}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => setSearchParams((prev) => { prev.set('page', String(p)); return prev; })}
        loading={loading}
      />
    </div>
  );
}
