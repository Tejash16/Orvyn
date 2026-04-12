import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { adminFetch } from '../../lib/api';

const EXPORT_TYPES = [
  { type: 'users', label: 'Users', description: 'All user accounts with profile info, plan, and status' },
  { type: 'usage', label: 'Usage Data', description: 'Current usage stats for all users (files, messages)' },
  { type: 'subscriptions', label: 'Subscriptions', description: 'All subscriptions with status and billing info' },
  { type: 'audit-logs', label: 'Audit Logs', description: 'Full audit trail (last 90 days)' },
  { type: 'organizations', label: 'Organizations', description: 'All organizations with plan and member counts' },
];

export default function ExportPage() {
  const [downloading, setDownloading] = useState(null);

  const handleExport = async (type) => {
    setDownloading(type);
    try {
      const blob = await adminFetch(`/export/${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orvyn-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Export Data</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {EXPORT_TYPES.map(({ type, label, description }) => (
          <div key={type} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{label}</h3>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
            <button
              onClick={() => handleExport(type)}
              disabled={downloading === type}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60 shrink-0"
            >
              {downloading === type ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              CSV
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
