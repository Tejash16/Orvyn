import { useEffect, useState } from 'react';
import { Users, CreditCard, Building2, FileText, MessageSquare, Tag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatsCard from '../components/StatsCard';
import { adminFetch } from '../lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/dashboard/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <p className="text-slate-500">Failed to load dashboard data.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Total Users" value={stats.totalUsers} icon={Users} color="blue" />
        <StatsCard title="Active Subscriptions" value={stats.activeSubscriptions} icon={CreditCard} color="emerald" />
        <StatsCard title="Organizations" value={stats.totalOrganizations} icon={Building2} color="purple" />
        <StatsCard
          title="Files This Period"
          value={stats.totalFilesThisPeriod}
          icon={FileText}
          color="amber"
        />
        <StatsCard
          title="Messages Today"
          value={stats.totalMessagesToday}
          icon={MessageSquare}
          color="blue"
        />
        <StatsCard
          title="Active Promos"
          value={stats.activePromoCodes ?? 0}
          icon={Tag}
          color="purple"
        />
      </div>

      {/* Subscriptions breakdown */}
      {stats.subscriptionsByPlan && stats.subscriptionsByPlan.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Subscriptions by Plan</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.subscriptionsByPlan}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent signups */}
      {stats.recentSignups && stats.recentSignups.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Signups</h2>
          <div className="space-y-3">
            {stats.recentSignups.map((user) => (
              <div key={user._id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
