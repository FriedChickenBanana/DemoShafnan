import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Load from local storage (privacy: stats are local only)
    chrome.storage.local.get('weeklyStats', ({ weeklyStats }) => {
      setStats(weeklyStats || { claimsSeen: 0, claimsFlagged: 0, topCategory: 'None', streak: 0 });
    });
  }, []);

  if (!stats) return <div style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>Loading stats…</div>;

  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        This Week's Info Diet
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard label="Claims Seen" value={stats.claimsSeen} color="#3b82f6" />
        <StatCard label="Flagged" value={stats.claimsFlagged} color="#ef4444" />
        <StatCard label="Top Category" value={stats.topCategory} color="#f97316" small />
        <StatCard label="Streak 🔥" value={`${stats.streak} days`} color="#8b5cf6" small />
      </div>
      {stats.claimsFlagged > 0 && (
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 12, fontSize: 13, color: '#94a3b8' }}>
          You questioned <strong style={{ color: '#f1f5f9' }}>{stats.claimsFlagged} claims</strong> this week.
          Keep thinking critically!
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, small }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: '12px 10px' }}>
      <div style={{ fontSize: small ? 15 : 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}
