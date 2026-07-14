import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { adminFetch } from '../../lib/api';

export default function PromoCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    applicablePlans: ['pro'],
    maxRedemptions: '',
    validUntil: '',
  });

  const update = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body = {
        ...form,
        discountValue: parseFloat(form.discountValue),
        maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions) : null,
        validUntil: form.validUntil || null,
      };
      await adminFetch('/promo-codes', { method: 'POST', body: JSON.stringify(body) });
      navigate('/promo-codes');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate('/promo-codes')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Promo Codes
      </button>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Create Promo Code</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
          <input
            value={form.code}
            onChange={(e) => update('code', e.target.value.toUpperCase())}
            required
            placeholder="e.g., WELCOME50"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Optional description"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount Type</label>
            <select
              value={form.discountType}
              onChange={(e) => update('discountType', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount (paise)</option>
              <option value="trial_extension">Trial Extension (days)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
            <input
              type="number"
              value={form.discountValue}
              onChange={(e) => update('discountValue', e.target.value)}
              required
              placeholder={form.discountType === 'percentage' ? '0-100' : 'Amount'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Applicable Plans</label>
          <div className="flex gap-3">
            {['pro', 'enterprise'].map((plan) => (
              <label key={plan} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.applicablePlans.includes(plan)}
                  onChange={(e) => {
                    const plans = e.target.checked
                      ? [...form.applicablePlans, plan]
                      : form.applicablePlans.filter((p) => p !== plan);
                    update('applicablePlans', plans);
                  }}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Redemptions</label>
            <input
              type="number"
              value={form.maxRedemptions}
              onChange={(e) => update('maxRedemptions', e.target.value)}
              placeholder="Leave empty for unlimited"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expires On</label>
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => update('validUntil', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Promo Code
        </button>
      </form>
    </div>
  );
}
