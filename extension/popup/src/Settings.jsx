import React from 'react';

export default function Settings({ prefs, onSave }) {
  function toggle(key) {
    onSave({ ...prefs, [key]: !prefs[key] });
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Settings
      </div>
      {[
        { key: 'autoHighlight', label: 'Auto-highlight suspicious claims', desc: 'Scans page text automatically' },
        { key: 'nuclear', label: 'Nuclear Mode', desc: 'Blurs content with <20% credibility' },
        { key: 'educational', label: 'Educational Mode', desc: 'Shows media literacy tips inline' },
      ].map(({ key, label, desc }) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid #1e293b' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{desc}</div>
          </div>
          <div
            onClick={() => toggle(key)}
            style={{
              width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer', flexShrink: 0, marginLeft: 12,
              background: prefs[key] ? '#3b82f6' : '#334155', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: prefs[key] ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
