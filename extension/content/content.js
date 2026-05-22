// TruthLens Content Script — injected on every page
// Dependencies are inline or via chrome.runtime.getURL
(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────
  const VERDICT_COLORS = {
    FALSE: '#ef4444',
    MISLEADING: '#f97316',
    UNVERIFIED: '#eab308',
    TRUE: '#22c55e',
    UNKNOWN: '#94a3b8',
  };

  // ── Verdict floating card ────────────────────────────────────────────────
  function showVerdictCard({ text, result, status, error }) {
    removeExistingCard();
    const card = document.createElement('div');
    card.id = 'truthlens-verdict-card';
    card.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
      width: 360px; max-height: 480px; overflow-y: auto;
      background: #1e293b; color: #f1f5f9; border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5); padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px; line-height: 1.5; border: 1px solid #334155;
      animation: tlSlideIn 0.2s ease-out;
    `;

    if (status === 'loading') {
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="tl-spinner"></div>
          <span style="color:#94a3b8">Fact-checking…</span>
        </div>
        <div style="margin-top:8px;color:#64748b;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">"${text?.slice(0, 80)}…"</div>
      `;
    } else if (status === 'error') {
      card.innerHTML = `<div style="color:#ef4444">Error: ${error}</div>`;
    } else if (status === 'done' && result) {
      const color = VERDICT_COLORS[result.verdict] || VERDICT_COLORS.UNKNOWN;
      const confidencePct = Math.round((result.confidence || 0) * 100);
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-weight:700;font-size:16px;color:${color}">${result.verdict}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:#94a3b8">${confidencePct}% confidence</span>
            <button id="tl-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;">×</button>
          </div>
        </div>
        <div style="margin-bottom:10px;color:#cbd5e1;font-size:13px;">${result.summary || ''}</div>
        ${result.whyBot ? `
          <div style="background:#0f172a;border-radius:8px;padding:10px;margin-bottom:10px;">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Why TruthLens flagged this</div>
            <div style="color:#94a3b8;font-size:12px;">${result.whyBot}</div>
          </div>
        ` : ''}
        ${result.sources?.length ? `
          <div style="border-top:1px solid #334155;padding-top:10px;">
            <div style="font-size:11px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Sources</div>
            ${result.sources.slice(0, 3).map(s => `
              <a href="${s.url}" target="_blank" rel="noopener noreferrer"
                style="display:block;color:#60a5fa;font-size:12px;margin-bottom:4px;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                title="${s.url}">${s.title || s.url}</a>
            `).join('')}
          </div>
        ` : ''}
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="tl-vote" data-vote="agree" style="flex:1;background:#1e3a5f;border:1px solid #3b82f6;color:#93c5fd;border-radius:6px;padding:6px;cursor:pointer;font-size:12px;">👍 Agree</button>
          <button class="tl-vote" data-vote="disagree" style="flex:1;background:#3b1e1e;border:1px solid #ef4444;color:#fca5a5;border-radius:6px;padding:6px;cursor:pointer;font-size:12px;">👎 Disagree</button>
          <button class="tl-vote" data-vote="report" style="flex:1;background:#2d2a1e;border:1px solid #eab308;color:#fde68a;border-radius:6px;padding:6px;cursor:pointer;font-size:12px;">⚠️ Report</button>
        </div>
      `;
    }

    document.body.appendChild(card);

    const closeBtn = card.querySelector('#tl-close');
    if (closeBtn) closeBtn.addEventListener('click', removeExistingCard);

    card.querySelectorAll('.tl-vote').forEach(btn => {
      btn.addEventListener('click', () => {
        const vote = btn.dataset.vote;
        if (result?.claimId) {
          chrome.runtime.sendMessage({ type: 'SUBMIT_VOTE', claimId: result.claimId, vote });
        }
        btn.style.opacity = '0.5';
        btn.disabled = true;
      });
    });
  }

  function removeExistingCard() {
    document.getElementById('truthlens-verdict-card')?.remove();
  }

  // ── Region drawer (F3 — Rectangle Box) ──────────────────────────────────
  let isDrawing = false;
  let drawOverlay = null;
  let selectionBox = null;
  let startX, startY;

  function startRegionDraw() {
    if (drawOverlay) return;
    drawOverlay = document.createElement('div');
    drawOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483646;
      cursor: crosshair; background: rgba(0,0,0,0.15);
    `;
    drawOverlay.innerHTML = `
      <div style="position:fixed;top:16px;left:50%;transform:translateX(-50%);
        background:#1e293b;color:#f1f5f9;padding:8px 16px;border-radius:8px;
        font-family:-apple-system,sans-serif;font-size:13px;pointer-events:none;
        box-shadow:0 4px 20px rgba(0,0,0,0.4);">
        Draw a rectangle over the area to analyse — press Esc to cancel
      </div>
    `;

    selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
      position: fixed; border: 2px solid #3b82f6; background: rgba(59,130,246,0.1);
      pointer-events: none; z-index: 2147483647; display: none;
    `;
    document.body.appendChild(drawOverlay);
    document.body.appendChild(selectionBox);

    drawOverlay.addEventListener('mousedown', onDrawStart);
    document.addEventListener('mousemove', onDrawMove);
    document.addEventListener('mouseup', onDrawEnd);
    document.addEventListener('keydown', onDrawCancel);
  }

  function onDrawStart(e) {
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';
  }

  function onDrawMove(e) {
    if (!isDrawing) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selectionBox.style.left = x + 'px';
    selectionBox.style.top = y + 'px';
    selectionBox.style.width = w + 'px';
    selectionBox.style.height = h + 'px';
  }

  async function onDrawEnd(e) {
    if (!isDrawing) return;
    isDrawing = false;
    cleanupDrawOverlay();

    const dpr = window.devicePixelRatio || 1;
    const x = Math.min(e.clientX, startX) * dpr;
    const y = Math.min(e.clientY, startY) * dpr;
    const w = Math.abs(e.clientX - startX) * dpr;
    const h = Math.abs(e.clientY - startY) * dpr;

    if (w < 20 || h < 20) return; // too small

    showVerdictCard({ status: 'loading', text: 'Analysing selected area…' });

    // Ask SW to capture the visible tab
    chrome.runtime.sendMessage({ type: 'CAPTURE_AND_CROP' }, ({ dataUrl }) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
        const cropped = canvas.toDataURL('image/png');
        // Send to SW for backend call
        chrome.runtime.sendMessage({ type: 'FACTCHECK_IMAGE', imageBase64: cropped }, (res) => {
          if (res?.ok) showVerdictCard({ status: 'done', result: res.result });
          else showVerdictCard({ status: 'error', error: res?.error || 'Unknown error' });
        });
      };
      img.src = dataUrl;
    });
  }

  function onDrawCancel(e) {
    if (e.key === 'Escape') cleanupDrawOverlay();
  }

  function cleanupDrawOverlay() {
    isDrawing = false;
    drawOverlay?.remove();
    selectionBox?.remove();
    drawOverlay = null;
    selectionBox = null;
    document.removeEventListener('mousemove', onDrawMove);
    document.removeEventListener('mouseup', onDrawEnd);
    document.removeEventListener('keydown', onDrawCancel);
  }

  // ── Message listener ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SHOW_VERDICT' || msg.type === 'FACTCHECK_RESULT') {
      showVerdictCard(msg);
    }
    if (msg.type === 'START_REGION_DRAW') {
      startRegionDraw();
    }
  });

  // ── CSS animation injection ───────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes tlSlideIn {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .tl-spinner {
      width: 16px; height: 16px; border: 2px solid #334155;
      border-top-color: #3b82f6; border-radius: 50%;
      animation: tlSpin 0.6s linear infinite;
    }
    @keyframes tlSpin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
})();
