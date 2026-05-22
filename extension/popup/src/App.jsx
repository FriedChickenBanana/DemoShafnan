import React, { useEffect, useState } from 'react';
import Dashboard from './Dashboard.jsx';
import Settings from './Settings.jsx';

const TABS = ['Dashboard', 'Settings'];

export default function App() {
  const [tab, setTab] = useState('Dashboard');
  const [prefs, setPrefs] = useState({
    enabled: true,
    nuclear: false,
    educational: false,
    autoHighlight: true,
  });

  useEffect(() => {
    chrome.storage.local.get('prefs', ({ prefs: saved }) => {
      if (saved) setPrefs(prev => ({ ...prev, ...saved }));
    });
  }, []);

  function savePrefs(newPrefs) {
    setPrefs(newPrefs);
    chrome.storage.local.set({ prefs: newPrefs });
    chrome.runtime.sendMessage({ type: 'PREFS_UPDATED', prefs: newPrefs });
  }

  function handleAnalyseArea() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'START_REGION_DRAW' });
        window.close();
      }
    });
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 6 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>TruthLens</span>
        </div>
        <Toggle
          checked={prefs.enabled}
          onChange={v => savePrefs({ ...prefs, enabled: v })}
          label={prefs.enabled ? 'ON' : 'OFF'}
        />
      </div>

      {/* Analyse Area CTA */}
      <button
        onClick={handleAnalyseArea}
        style={{
          width: '100%', padding: '10px', marginBottom: '16px',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          border: 'none', borderRadius: '8px', color: 'white',
          fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}
      >
        Analyse Selected Area (Rectangle)
      </button>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#1e293b', borderRadius: 8, padding: 4 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '6px', border: 'none', borderRadius: 6, cursor: 'pointer',
            background: tab === t ? '#334155' : 'transparent',
            color: tab === t ? '#f1f5f9' : '#94a3b8', fontWeight: tab === t ? 600 : 400,
            fontSize: 13,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Dashboard' && <Dashboard />}
      {tab === 'Settings' && <Settings prefs={prefs} onSave={savePrefs} />}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer',
          background: checked ? '#3b82f6' : '#334155', transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          transition: 'left 0.2s',
        }} />
      </div>
      <span style={{ fontSize: 12, color: checked ? '#60a5fa' : '#64748b', fontWeight: 600 }}>{label}</span>
    </label>
  );
}
