import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { adminFetch } from '../../lib/api';

export default function HealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/system/health');
      setHealth(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = (bytes / 1024 / 1024).toFixed(1);
    return `${mb} MB`;
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">System Health</h1>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!health ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Services */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Services</h2>
            <div className="space-y-3">
              {[
                { name: 'Express Server', status: true },
                { name: 'MongoDB', status: health.mongodb?.connected },
              ].map((svc) => (
                <div key={svc.name} className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-700">{svc.name}</span>
                  {svc.status ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                      <CheckCircle className="w-4 h-4" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                      <XCircle className="w-4 h-4" /> Disconnected
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Memory */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Memory Usage</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">RSS</span>
                <span className="font-medium text-slate-900">{formatBytes(health.memory?.rss)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Heap Used</span>
                <span className="font-medium text-slate-900">{formatBytes(health.memory?.heapUsed)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Heap Total</span>
                <span className="font-medium text-slate-900">{formatBytes(health.memory?.heapTotal)}</span>
              </div>
            </div>
          </div>

          {/* Uptime */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Server Info</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Uptime</span>
                <span className="font-medium text-slate-900">{formatUptime(health.uptime)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Node.js</span>
                <span className="font-medium text-slate-900">{health.nodeVersion || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Environment</span>
                <span className="font-medium text-slate-900">{health.environment || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* DB Stats */}
          {health.mongodb?.dbStats && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Database Stats</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Collections</span>
                  <span className="font-medium text-slate-900">{health.mongodb.dbStats.collections}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Documents</span>
                  <span className="font-medium text-slate-900">{health.mongodb.dbStats.objects?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Storage Size</span>
                  <span className="font-medium text-slate-900">{formatBytes(health.mongodb.dbStats.storageSize)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
