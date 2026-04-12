import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Database } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { adminFetch } from '../../lib/api';

export default function BrowserPage() {
  const { collection } = useParams();
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedDoc, setExpandedDoc] = useState(null);

  useEffect(() => {
    adminFetch('/database/collections')
      .then((data) => setCollections(data.collections || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!collection) { setLoading(false); return; }
    setLoading(true);
    adminFetch(`/database/${collection}?page=${page}&limit=20`)
      .then((data) => {
        setDocs(data.documents || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [collection, page]);

  if (!collection) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Database Browser</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {collections.map((col) => (
            <button
              key={col}
              onClick={() => navigate(`/database/${col}`)}
              className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition-all"
            >
              <Database className="w-5 h-5 text-emerald-600 mb-2" />
              <p className="text-sm font-medium text-slate-900">{col}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const columns = [
    { key: '_id', label: 'ID', width: '220px', render: (row) => (
      <span className="text-xs font-mono text-slate-500 truncate block max-w-[200px]">{row._id}</span>
    )},
    { key: 'preview', label: 'Preview', render: (row) => {
      const preview = Object.entries(row)
        .filter(([k]) => !['_id', '__v', 'createdAt', 'updatedAt'].includes(k))
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}`)
        .join(' | ');
      return <span className="text-xs text-slate-600 truncate block max-w-[500px]">{preview}</span>;
    }},
    { key: 'createdAt', label: 'Created', render: (row) => (
      row.createdAt ? <span className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</span> : 'N/A'
    )},
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/database')} className="text-sm text-slate-500 hover:text-slate-700">Collections</button>
        <span className="text-slate-300">/</span>
        <h1 className="text-2xl font-bold text-slate-900">{collection}</h1>
        <span className="text-sm text-slate-500">({total} documents)</span>
      </div>

      <DataTable
        columns={columns}
        data={docs}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        onRowClick={(row) => setExpandedDoc(expandedDoc === row._id ? null : row._id)}
        loading={loading}
        emptyMessage="No documents in this collection"
      />

      {/* Expanded document viewer */}
      {expandedDoc && (
        <div className="mt-4 bg-slate-900 rounded-xl p-4 overflow-x-auto">
          <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">
            {JSON.stringify(docs.find((d) => d._id === expandedDoc), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
