import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { adminFetch } from '../../lib/api';

export default function BroadcastPage() {
  const [form, setForm] = useState({ type: 'system', message: '', targetUserIds: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const body = {
        type: form.type,
        message: form.message,
        targetUserIds: form.targetUserIds
          ? form.targetUserIds.split(',').map((id) => id.trim()).filter(Boolean)
          : null,
      };
      const data = await adminFetch('/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResult({ success: true, message: `Notification sent to ${data.recipientCount || 'all'} users.` });
      setForm({ type: 'system', message: '', targetUserIds: '' });
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Broadcast Notification</h1>

      {result && (
        <div className={`rounded-lg px-4 py-3 mb-4 text-sm ${
          result.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {result.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notification Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="system">System Announcement</option>
            <option value="maintenance">Maintenance Notice</option>
            <option value="feature">New Feature</option>
            <option value="warning">Warning</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
          <textarea
            value={form.message}
            onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
            required
            rows={4}
            placeholder="Write your notification message..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Target Users (optional)</label>
          <input
            value={form.targetUserIds}
            onChange={(e) => setForm((prev) => ({ ...prev, targetUserIds: e.target.value }))}
            placeholder="Comma-separated user IDs, or leave empty for all users"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <p className="text-xs text-slate-400 mt-1">Leave empty to broadcast to all users.</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Notification
        </button>
      </form>
    </div>
  );
}
