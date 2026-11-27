/**
 * DSH-style borderless 3-segment bottom status bar & click-to-open popovers
 * for Antigravity, automatically following native `:root` Light/Dark CSS tokens.
 */

const BAR_AND_POP_CSS = `
.agy-ctx-ring-bar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  margin-right: 4px;
  flex: 0 0 auto;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  user-select: none;
}
.agy-ctx-ring-bar * {
  box-sizing: border-box;
}
.agy-ctx-ring-bar .acr-seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: var(--secondary-foreground, #3f3f46);
  font-family: inherit;
  font-size: 12px;
  font-weight: 350;
  font-variation-settings: inherit;
  font-optical-sizing: inherit;
  letter-spacing: normal;
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}
.agy-ctx-ring-bar .acr-seg-btn:hover,
.agy-ctx-ring-bar .acr-seg-btn[data-open="true"] {
  background: var(--secondary, rgba(10, 10, 12, 0.06));
  color: var(--foreground, #0a0a0c);
}
.agy-ctx-ring-bar .acr-ico {
  width: 14px;
  height: 14px;
  flex: none;
  display: block;
}
.agy-ctx-ring-bar .acr-bar-track {
  stroke: color-mix(in srgb, var(--foreground, currentColor) 14%, transparent);
}
.agy-ctx-ring-bar .acr-bar-arc {
  transition: stroke-dasharray 0.35s ease, stroke 0.25s ease;
}
.agy-ctx-ring-bar .acr-bar-arc[data-tier="ok"] {
  stroke: var(--muted-foreground, #71717a);
}
.agy-ctx-ring-bar .acr-seg-btn:hover .acr-bar-arc[data-tier="ok"],
.agy-ctx-ring-bar .acr-seg-btn[data-open="true"] .acr-bar-arc[data-tier="ok"] {
  stroke: var(--success, var(--color-green-500, #58983f));
}
.agy-ctx-ring-bar .acr-bar-arc[data-tier="warn"] {
  stroke: var(--color-amber-500, #e59400);
}
.agy-ctx-ring-bar .acr-bar-arc[data-tier="crit"] {
  stroke: var(--error, var(--color-red-500, #de5555));
}
.agy-ctx-ring-bar[data-compact="md"] .acr-seg-btn[data-panel="tokens"] {
  display: none;
}
.agy-ctx-ring-bar[data-compact="sm"] .acr-seg-btn[data-panel="tokens"],
.agy-ctx-ring-bar[data-compact="sm"] .acr-seg-btn[data-panel="session"] {
  display: none;
}

#agy-ctx-ring-pop {
  position: fixed;
  z-index: 2147483000;
  display: none;
  pointer-events: auto;
  box-sizing: border-box;
  width: 296px;
  max-width: calc(100vw - 20px);
  max-height: calc(100vh - 20px);
  overflow-y: auto;
  background: var(--onyx-raised, var(--card, var(--background, #ffffff)));
  border: 1px solid var(--card-border, var(--border, rgba(128, 128, 128, 0.18)));
  border-radius: var(--radius-2xl, 14px);
  padding: 14px 16px;
  color: var(--foreground, #0a0a0c);
  font-family: inherit;
  font-weight: 350;
  font-variation-settings: inherit;
  font-optical-sizing: inherit;
  letter-spacing: normal;
  font-variant-numeric: tabular-nums;
  box-shadow: var(--shadow-lg, 0 10px 24px -4px rgba(0, 0, 0, 0.14)), 0 0 0 0.5px var(--card-border, transparent);
  user-select: none;
}
#agy-ctx-ring-pop.is-visible {
  display: block;
}
#agy-ctx-ring-pop * {
  box-sizing: border-box;
}
#agy-ctx-ring-pop .acr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
#agy-ctx-ring-pop .acr-head-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
#agy-ctx-ring-pop .acr-head-ico {
  width: 15px;
  height: 15px;
  color: var(--foreground, #0a0a0c);
  flex: none;
  display: block;
}
#agy-ctx-ring-pop .acr-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground, #0a0a0c);
  letter-spacing: normal;
  white-space: nowrap;
}
#agy-ctx-ring-pop .acr-head-val {
  font-size: 13px;
  font-weight: 500;
  color: var(--foreground, #0a0a0c);
  white-space: nowrap;
}
#agy-ctx-ring-pop .acr-divider {
  height: 1px;
  background: var(--border, rgba(128, 128, 128, 0.14));
  margin: 10px 0 11px;
}
#agy-ctx-ring-pop .acr-rows {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
#agy-ctx-ring-pop .acr-kv {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
#agy-ctx-ring-pop .acr-k {
  font-size: 12.5px;
  font-weight: 350;
  color: var(--muted-foreground, #71717a);
  white-space: nowrap;
}
#agy-ctx-ring-pop .acr-v {
  font-size: 12.5px;
  font-weight: 400;
  color: var(--foreground, #0a0a0c);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#agy-ctx-ring-pop .acr-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}
#agy-ctx-ring-pop .acr-badge[data-tier="ok"] {
  color: var(--success, var(--color-green-500, #58983f));
  background: color-mix(in srgb, var(--success, #58983f) 14%, transparent);
}
#agy-ctx-ring-pop .acr-badge[data-tier="warn"] {
  color: var(--warning, #b45309);
  background: color-mix(in srgb, var(--color-amber-500, #e59400) 15%, transparent);
}
#agy-ctx-ring-pop .acr-badge[data-tier="crit"] {
  color: var(--error, var(--color-red-500, #de5555));
  background: color-mix(in srgb, var(--error, #de5555) 14%, transparent);
}
#agy-ctx-ring-pop .acr-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
}
#agy-ctx-ring-pop .acr-ring-wrap {
  position: relative;
  width: 74px;
  height: 74px;
  flex: none;
}
#agy-ctx-ring-pop .acr-ring-svg {
  width: 74px;
  height: 74px;
  display: block;
}
#agy-ctx-ring-pop .acr-ring-track {
  stroke: color-mix(in srgb, var(--foreground, currentColor) 12%, transparent);
}
#agy-ctx-ring-pop .acr-ring-arc {
  transition: stroke-dasharray 0.35s ease, stroke 0.25s ease;
}
#agy-ctx-ring-pop .acr-ring-arc[data-tier="ok"] {
  stroke: var(--success, var(--color-green-500, #58983f));
}
#agy-ctx-ring-pop .acr-ring-arc[data-tier="warn"] {
  stroke: var(--color-amber-500, #e59400);
}
#agy-ctx-ring-pop .acr-ring-arc[data-tier="crit"] {
  stroke: var(--error, var(--color-red-500, #de5555));
}
#agy-ctx-ring-pop .acr-ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 2px;
}
#agy-ctx-ring-pop .acr-ring-pct {
  font-size: 14px;
  font-weight: 550;
  color: var(--foreground, #0a0a0c);
  line-height: 1.1;
  letter-spacing: normal;
}
#agy-ctx-ring-pop .acr-ring-sub {
  font-size: 10.5px;
  font-weight: 350;
  color: var(--muted-foreground, #71717a);
  margin-top: 2px;
}
#agy-ctx-ring-pop .acr-stats {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#agy-ctx-ring-pop .acr-stats .acr-v {
  font-weight: 500;
}
#agy-ctx-ring-pop .acr-drawer {
  display: block;
  margin-top: 12px;
  padding: 10px 11px;
  border-radius: var(--radius-lg, 10px);
  background: var(--muted, rgba(128, 128, 128, 0.06));
  border: 1px solid var(--border, rgba(128, 128, 128, 0.1));
}
#agy-ctx-ring-pop .acr-seg-bar {
  display: flex;
  width: 100%;
  height: 6px;
  border-radius: 9999px;
  overflow: hidden;
  background: var(--secondary, rgba(128, 128, 128, 0.12));
  gap: 1px;
  margin-bottom: 9px;
}
#agy-ctx-ring-pop .acr-seg {
  height: 100%;
  min-width: 2px;
  transition: width 0.3s ease;
}
#agy-ctx-ring-pop .acr-bd-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
#agy-ctx-ring-pop .acr-bd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
}
#agy-ctx-ring-pop .acr-bd-left {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 350;
  color: var(--secondary-foreground, var(--muted-foreground, #71717a));
  min-width: 0;
}
#agy-ctx-ring-pop .acr-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
#agy-ctx-ring-pop .acr-bd-right {
  color: var(--foreground, #0a0a0c);
  font-weight: 400;
  white-space: nowrap;
}
#agy-ctx-ring-pop .acr-bd-pct {
  color: var(--muted-foreground, #71717a);
  margin-left: 4px;
  font-weight: 350;
}
#agy-ctx-ring-pop .acr-chip {
  display: inline-flex;
  align-items: center;
  padding: 1.5px 6px;
  border-radius: 9999px;
  font-size: 10.5px;
  font-weight: 400;
  line-height: 1.25;
  color: var(--muted-foreground, #71717a);
  background: var(--muted, rgba(128, 128, 128, 0.08));
  border: 1px solid var(--border, rgba(128, 128, 128, 0.14));
  white-space: nowrap;
}
#agy-ctx-ring-pop .acr-c-system   { background: var(--color-blue-500, #4380b4); }
#agy-ctx-ring-pop .acr-c-injected { background: var(--color-teal-500, #14b8a6); }
#agy-ctx-ring-pop .acr-c-tools    { background: var(--color-orange-500, #e0712f); }
#agy-ctx-ring-pop .acr-c-model    { background: var(--color-violet-500, #bb84cc); }
#agy-ctx-ring-pop .acr-c-user     { background: var(--color-green-500, #63984f); }
`;

export function buildInjectedScript() {
  return `(function () {
  var VERSION = '1.2.10';
  if (window.__agyCtxRing && window.__agyCtxRing.version === VERSION) {
    return { status: 'already_mounted', version: VERSION };
  }
  if (window.__agyCtxRing && typeof window.__agyCtxRing.unmount === 'function') {
    try { window.__agyCtxRing.unmount(); } catch (e) {}
  }
  var legacyNodes = document.querySelectorAll('#agy-ctx-ring-bar, .agy-ctx-ring-bar, #agy-ctx-ring-pill');
  for (var li = 0; li < legacyNodes.length; li++) {
    legacyNodes[li].remove();
  }

  var SVG_GAUGE = '<svg class="acr-ico" viewBox="0 0 16 16" fill="none">' +
    '<path d="M3.1 12.2A6 6 0 1 1 12.9 12.2" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>' +
    '<path d="M8 8.4L10.7 5.5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>' +
    '<circle cx="8" cy="8.6" r="1" fill="currentColor"/>' +
  '</svg>';

  var SVG_DB = '<svg class="acr-ico" viewBox="0 0 16 16" fill="none">' +
    '<ellipse cx="8" cy="4" rx="4.75" ry="1.8" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M3.25 4v3.8c0 .99 2.13 1.8 4.75 1.8s4.75-.81 4.75-1.8V4" stroke="currentColor" stroke-width="1.3"/>' +
    '<path d="M3.25 7.8v3.8c0 .99 2.13 1.8 4.75 1.8s4.75-.81 4.75-1.8V7.8" stroke="currentColor" stroke-width="1.3"/>' +
  '</svg>';

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtTokens(n) {
    var num = Number(n);
    if (!Number.isFinite(num) || num < 0) return '—';
    if (num < 1000) return String(Math.round(num));
    if (num < 1000000) return (num / 1000).toFixed(1) + 'K';
    return (num / 1000000).toFixed(2) + 'M';
  }

  function fmtCompactTok(n) {
    var num = Number(n);
    if (!Number.isFinite(num) || num < 0) return '0';
    if (num < 1000) return String(Math.round(num));
    if (num < 1000000) return (num / 1000).toFixed(1).replace(/\\.0$/, '') + 'K';
    return (num / 1000000).toFixed(1).replace(/\\.0$/, '') + 'M';
  }

  function fmtInt(n) {
    var num = Number(n);
    if (!Number.isFinite(num) || num < 0) return '0';
    return Math.round(num).toLocaleString('en-US');
  }

  function fmtLimit(n) {
    var num = Number(n);
    if (!Number.isFinite(num) || num <= 0) return '—';
    if (num === 1048576 || num === 1000000) return '1M';
    if (num === 512000 || num === 524288) return '512K';
    if (num === 256000 || num === 262144) return '256K';
    if (num < 1000) return String(Math.round(num));
    if (num < 1000000) return Math.round(num / 1000) + 'K';
    return (num / 1000000).toFixed(1).replace(/\\.0$/, '') + 'M';
  }

  function fmtDurationZh(sec) {
    var s = Number(sec);
    if (!Number.isFinite(s) || s <= 0) return '0 秒';
    var total = Math.round(s);
    if (total < 60) return total + ' 秒';
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var rem = total % 60;
    if (h > 0) return h + ' 小时 ' + m + ' 分';
    return rem > 0 ? (m + ' 分 ' + rem + ' 秒') : (m + ' 分');
  }

  function fmtTtftZh(sec) {
    var s = Number(sec);
    if (!Number.isFinite(s) || s <= 0) return '—';
    if (s < 10) return Number(s.toFixed(1)) + ' 秒';
    return Math.round(s) + ' 秒';
  }

  function fmtCache(pct, tokens, coldStart, coldReason) {
    if (coldStart && (!Number.isFinite(tokens) || tokens <= 0)) {
      return coldReason === 'model_switch' ? '切模型冷启动 · 0' : '冷启动 · 0';
    }
    if (!Number.isFinite(pct) || pct < 0) return '—';
    return pct.toFixed(1) + '% · ' + fmtTokens(tokens);
  }

  function renderSessionPop(data) {
    var tps = Number.isFinite(data.decodeTps) && data.decodeTps > 0
      ? Math.round(data.decodeTps) + ' tok/s'
      : '—';
    return '' +
      '<div class="acr-head">' +
        '<div class="acr-head-left">' +
          SVG_GAUGE.replace('class="acr-ico"', 'class="acr-head-ico"') +
          '<span class="acr-title">会话统计</span>' +
        '</div>' +
        '<span class="acr-head-val">' + fmtInt(data.turns) + ' 轮 ' + fmtInt(data.steps) + ' 步</span>' +
      '</div>' +
      '<div class="acr-divider"></div>' +
      '<div class="acr-rows">' +
        '<div class="acr-kv"><span class="acr-k">模型用时</span><span class="acr-v">' + fmtDurationZh(data.modelTimeSec) + '</span></div>' +
        '<div class="acr-kv"><span class="acr-k">工具调用用时</span><span class="acr-v">' + fmtDurationZh(data.toolTimeSec) + '</span></div>' +
        '<div class="acr-kv"><span class="acr-k">首 token 平均 (TTFT)</span><span class="acr-v">' + fmtTtftZh(data.avgTtftSec) + '</span></div>' +
        '<div class="acr-kv"><span class="acr-k">输出速度 (TPS)</span><span class="acr-v">' + tps + '</span></div>' +
      '</div>';
  }

  function renderTokensPop(data) {
    var hitStr = Number.isFinite(data.cumCachePct) ? Math.round(data.cumCachePct) + '%' : '—';
    var hasSub = (data.subagentCount > 0 || data.subagentTotalTokens > 0);
    var subHtml = hasSub
      ? '<div class="acr-divider"></div>' +
        '<div class="acr-rows">' +
          '<div class="acr-kv"><span class="acr-k">主会话</span><span class="acr-v">' + fmtTokens(data.mainTotalTokens) + ' · ' + fmtInt(data.mainRequestCount) + ' 次</span></div>' +
          '<div class="acr-kv"><span class="acr-k">子代理 (' + fmtInt(data.subagentCount) + ')</span><span class="acr-v">' + fmtTokens(data.subagentTotalTokens) + ' · ' + fmtInt(data.subagentRequestCount) + ' 次</span></div>' +
        '</div>'
      : '';
    return '' +
      '<div class="acr-head">' +
        '<div class="acr-head-left">' +
          SVG_DB.replace('class="acr-ico"', 'class="acr-head-ico"') +
          '<span class="acr-title">Token 用量</span>' +
        '</div>' +
        '<span class="acr-head-val">' + fmtInt(data.totalTokens) + ' tok</span>' +
      '</div>' +
      '<div class="acr-divider"></div>' +
      '<div class="acr-rows">' +
        '<div class="acr-kv"><span class="acr-k">缓存命中</span><span class="acr-v">' + hitStr + '</span></div>' +
        '<div class="acr-kv"><span class="acr-k">未缓存输入</span><span class="acr-v">' + fmtInt(data.totalUncachedInput) + ' tok</span></div>' +
        '<div class="acr-kv"><span class="acr-k">缓存读取</span><span class="acr-v">' + fmtInt(data.totalCacheRead) + ' tok</span></div>' +
        '<div class="acr-kv"><span class="acr-k">输出</span><span class="acr-v">' + fmtInt(data.totalOutput) + ' tok</span></div>' +
      '</div>' +
      subHtml;
  }

  function renderContextPop(data) {
    var pct = Number.isFinite(data.usedPct) ? Math.max(0, Math.min(100, data.usedPct)) : 0;
    var tier = data.tier || { id: 'ok', label: '正常' };
    var tierId = tier.id || (pct >= 85 ? 'crit' : pct >= 60 ? 'warn' : 'ok');
    var r = 29;
    var circ = 2 * Math.PI * r;
    var trackLen = circ * 0.75;
    var activeLen = (pct / 100) * trackLen;
    var pctStr = pct <= 0 ? '0%' : pct >= 100 ? '100%' : pct.toFixed(1) + '%';
    var items = Array.isArray(data.breakdown) ? data.breakdown : [];
    var totalTok = Number(data.usedTokens || 0);

    var segsHtml = items.map(function (it) {
      var w = totalTok > 0 ? Math.max(0, (it.tokens / totalTok) * 100) : 0;
      var cls = 'acr-seg acr-c-' + escHtml(it.key || 'system');
      return w > 0.2 ? '<div class="' + cls + '" style="width:' + w.toFixed(2) + '%"></div>' : '';
    }).join('');

    var bdRowsHtml = items.map(function (it) {
      var dotCls = 'acr-dot acr-c-' + escHtml(it.key || 'system');
      return '<div class="acr-bd-row">' +
        '<div class="acr-bd-left">' +
          '<span class="' + dotCls + '"></span>' +
          '<span>' + escHtml(it.label) + '</span>' +
        '</div>' +
        '<div class="acr-bd-right">' +
          fmtTokens(it.tokens) +
          '<span class="acr-bd-pct">(' + (Number.isFinite(it.pct) ? it.pct.toFixed(1) : '0.0') + '%)</span>' +
        '</div>' +
      '</div>';
    }).join('');

    var compChip = data.compacted
      ? '<span class="acr-chip" title="本会话已触发上下文压缩">' + (data.compactedCount > 1 ? ('已压缩 ×' + data.compactedCount) : '已压缩') + '</span>'
      : '';

    return '' +
      '<div class="acr-head">' +
        '<div class="acr-head-left">' +
          '<span class="acr-title">上下文窗口</span>' +
          compChip +
        '</div>' +
        '<span class="acr-badge" data-tier="' + escHtml(tierId) + '">' + escHtml(tier.label || '正常') + '</span>' +
      '</div>' +
      '<div class="acr-main">' +
        '<div class="acr-ring-wrap">' +
          '<svg class="acr-ring-svg" viewBox="0 0 74 74">' +
            '<g transform="rotate(135 37 37)">' +
              '<circle class="acr-ring-track" cx="37" cy="37" r="' + r + '" fill="none" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="' + trackLen.toFixed(2) + ' ' + circ.toFixed(2) + '"/>' +
              (activeLen > 0 ? '<circle class="acr-ring-arc" data-tier="' + escHtml(tierId) + '" cx="37" cy="37" r="' + r + '" fill="none" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="' + activeLen.toFixed(2) + ' ' + circ.toFixed(2) + '"/>' : '') +
            '</g>' +
          '</svg>' +
          '<div class="acr-ring-center">' +
            '<div class="acr-ring-pct">' + pctStr + '</div>' +
            '<div class="acr-ring-sub">已用</div>' +
          '</div>' +
        '</div>' +
        '<div class="acr-stats">' +
          '<div class="acr-kv"><span class="acr-k">已用 Token</span><span class="acr-v">' + fmtTokens(data.usedTokens) + '</span></div>' +
          '<div class="acr-kv"><span class="acr-k">剩余可用</span><span class="acr-v">' + fmtTokens(data.remainingTokens) + '</span></div>' +
          '<div class="acr-kv"><span class="acr-k">窗口上限</span><span class="acr-v">' + fmtLimit(data.limitTokens) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="acr-drawer">' +
        '<div class="acr-seg-bar">' + segsHtml + '</div>' +
        '<div class="acr-bd-list">' + bdRowsHtml + '</div>' +
      '</div>' +
      '<div class="acr-divider"></div>' +
      '<div class="acr-rows">' +
        '<div class="acr-kv"><span class="acr-k">采样模型</span><span class="acr-v" title="' + escHtml(data.model) + '">' + escHtml(data.model || '—') + '</span></div>' +
        '<div class="acr-kv"><span class="acr-k">本次缓存</span><span class="acr-v">' + fmtCache(data.lastCachePct, data.lastCacheTokens, data.lastCacheColdStart, data.lastCacheColdReason) + '</span></div>' +
      '</div>';
  }

  var STYLE_ID = 'agy-ctx-ring-style';
  var BAR_CLASS = 'agy-ctx-ring-bar';
  var POP_ID = 'agy-ctx-ring-pop';
  var CONV_ID_RE = /^[0-9a-f-]{8,}$/i;

  var styleEl = document.getElementById(STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = ${JSON.stringify(BAR_AND_POP_CSS)};

  var popEl = document.getElementById(POP_ID);
  if (!popEl) {
    popEl = document.createElement('div');
    popEl.id = POP_ID;
    document.body.appendChild(popEl);
  }

  var EMPTY_METRICS = {
    conversationId: '',
    usedTokens: 0,
    remainingTokens: 512000,
    limitTokens: 512000,
    usedPct: 0,
    tier: { id: 'ok', label: '正常' },
    model: '—',
    lastTps: null,
    avgTps: null,
    decodeTps: null,
    lastDecodeTps: null,
    avgTtftSec: null,
    modelTimeSec: 0,
    toolTimeSec: 0,
    turns: 0,
    steps: 0,
    toolSteps: 0,
    totalTokens: 0,
    totalUncachedInput: 0,
    totalCacheRead: 0,
    totalOutput: 0,
    mainTotalTokens: 0,
    mainRequestCount: 0,
    subagentCount: 0,
    subagentTotalTokens: 0,
    subagentRequestCount: 0,
    lastCacheTokens: 0,
    lastCachePct: null,
    lastCacheColdStart: false,
    lastCacheColdReason: '',
    cumCacheTokens: 0,
    cumCachePct: null,
    requestCount: 0,
    compacted: false,
    compactedCount: 0,
    breakdown: [
      { key: 'system', label: '系统提示与规则', tokens: 0, pct: 0 },
      { key: 'injected', label: '子智能体与系统消息', tokens: 0, pct: 0 },
      { key: 'tools', label: '工具调用与输出', tokens: 0, pct: 0 },
      { key: 'model', label: '模型思考与回复', tokens: 0, pct: 0 },
      { key: 'user', label: '用户输入', tokens: 0, pct: 0 },
    ],
    updatedAt: 0,
  };

  var metricsCache = Object.create(null);
  metricsCache[''] = EMPTY_METRICS;
  var state = {
    metricsCache: metricsCache,
    panes: new Map(),
    paneByFooter: new WeakMap(),
    activePane: null,
    activePanel: null, // 'session' | 'tokens' | 'context' | null
    observer: null,
    resizeObserver: null,
    mountQueued: false,
    lastNotifiedSig: '',
  };

  function getActiveBtn() {
    return state.activePane && state.activePanel ? state.activePane.btns[state.activePanel] : null;
  }

  function positionPopover() {
    var btn = getActiveBtn();
    if (!btn || !btn.isConnected) return;
    var rect = btn.getBoundingClientRect();
    var popW = popEl.offsetWidth || 296;
    var popH = popEl.offsetHeight || 220;
    var left;
    if (state.activePanel === 'session') {
      left = Math.min(window.innerWidth - popW - 10, Math.max(10, rect.left));
    } else {
      left = Math.min(window.innerWidth - popW - 10, Math.max(10, rect.right - popW));
    }
    var spaceAbove = rect.top - 10;
    var spaceBelow = window.innerHeight - rect.bottom - 10;
    var top;
    if (spaceAbove < popH + 8 && spaceBelow > spaceAbove) {
      top = Math.max(10, Math.min(window.innerHeight - popH - 10, rect.bottom + 8));
    } else {
      top = Math.max(10, rect.top - popH - 8);
    }
    popEl.style.left = left + 'px';
    popEl.style.top = top + 'px';
    popEl.style.bottom = 'auto';
  }

  function renderPopover() {
    var data = (state.activePane && state.activePane.metrics) || EMPTY_METRICS;
    if (state.activePanel === 'session') {
      popEl.innerHTML = renderSessionPop(data);
    } else if (state.activePanel === 'tokens') {
      popEl.innerHTML = renderTokensPop(data);
    } else if (state.activePanel === 'context') {
      popEl.innerHTML = renderContextPop(data);
    }
  }

  function syncPopoverVisibility() {
    var panels = ['session', 'tokens', 'context'];
    state.panes.forEach(function (pane) {
      for (var i = 0; i < panels.length; i++) {
        var k = panels[i];
        var b = pane.btns[k];
        if (!b) continue;
        if (pane === state.activePane && state.activePanel === k) {
          b.setAttribute('data-open', 'true');
        } else {
          b.removeAttribute('data-open');
        }
      }
    });
    var btn = getActiveBtn();
    if (state.activePane && state.activePanel && btn && btn.isConnected) {
      renderPopover();
      popEl.classList.add('is-visible');
      positionPopover();
    } else {
      popEl.classList.remove('is-visible');
    }
  }

  function renderBarForPane(pane) {
    if (!pane || !pane.barEl) return;
    var m = pane.metrics;

    // 1. Session button
    var hasTps = Boolean(m && Number.isFinite(m.decodeTps) && m.decodeTps > 0);
    var sessionText = m
      ? (fmtInt(m.turns) + ' 轮 ' + fmtInt(m.steps) + ' 步' + (hasTps ? (' · ' + Math.round(m.decodeTps) + ' tok/s') : ''))
      : '0 轮 0 步';

    // 2. Tokens button
    var hasHit = Boolean(m && Number.isFinite(m.cumCachePct));
    var tokText = m
      ? (fmtCompactTok(m.totalTokens) + ' tok' + (hasHit ? (' · 缓存命中 ' + Math.round(m.cumCachePct) + '%') : ''))
      : '0 tok';

    // 3. Context circular ring button
    var pct = m && Number.isFinite(m.usedPct) ? Math.max(0, Math.min(100, m.usedPct)) : 0;
    var tierId = (m && m.tier && m.tier.id) || (pct >= 85 ? 'crit' : pct >= 60 ? 'warn' : 'ok');
    var r = 5.2;
    var circ = 2 * Math.PI * r;
    var active = (pct / 100) * circ;
    var pctTxt = m ? (Math.round(pct) + '%') : '0%';

    var renderKey = sessionText + '\\n' + tokText + '\\n' + pctTxt + '\\n' + tierId + '\\n' + (active > 0 ? active.toFixed(2) : '0');
    if (renderKey === pane.lastBarRenderKey) return;
    pane.lastBarRenderKey = renderKey;

    pane.btns.session.innerHTML = SVG_GAUGE + '<span>' + sessionText + '</span>';
    pane.btns.tokens.innerHTML = SVG_DB + '<span>' + tokText + '</span>';
    pane.btns.context.innerHTML =
      '<svg class="acr-ico" viewBox="0 0 16 16">' +
        '<g transform="rotate(-90 8 8)">' +
          '<circle class="acr-bar-track" cx="8" cy="8" r="' + r + '" fill="none" stroke-width="2"/>' +
          (active > 0 ? '<circle class="acr-bar-arc" data-tier="' + escHtml(tierId) + '" cx="8" cy="8" r="' + r + '" fill="none" stroke-width="2" stroke-linecap="round" stroke-dasharray="' + active.toFixed(2) + ' ' + circ.toFixed(2) + '"/>' : '') +
        '</g>' +
      '</svg>' +
      '<span>' + pctTxt + '</span>';
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    try {
      if (typeof el.checkVisibility === 'function') {
        return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      }
    } catch (e) {}
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function isExcludedComposer(el) {
    return Boolean(el.closest('[data-side-panel-composer], [data-testid="side-question-tab-content"], [data-testid="subagent-tab-composer"]'));
  }

  function findMountAnchors() {
    var anchors = [];
    var coveredFooters = new Set();
    var triggers = document.querySelectorAll('[data-testid="permissions-selector-trigger"]');
    for (var i = 0; i < triggers.length; i++) {
      var trg = triggers[i];
      if (!isExcludedComposer(trg) && isVisible(trg)) {
        var ft = trg.closest('.agy-composer-footer');
        if (ft) coveredFooters.add(ft);
        anchors.push({
          keyEl: ft || trg,
          kind: 'before',
          anchor: trg,
          footer: ft,
        });
      }
    }
    var footers = document.querySelectorAll('.agy-composer-footer');
    for (var j = 0; j < footers.length; j++) {
      var f = footers[j];
      if (!coveredFooters.has(f) && !isExcludedComposer(f) && isVisible(f)) {
        var right = f.lastElementChild || f;
        anchors.push({
          keyEl: f,
          kind: 'prepend',
          anchor: right,
          footer: f,
        });
      }
    }
    return anchors;
  }

  function syncResponsiveLayoutForPane(pane) {
    if (!pane || !pane.barEl) return;
    var ft = pane.footerEl || pane.barEl.closest('.agy-composer-footer');
    var w = ft ? ft.getBoundingClientRect().width : window.innerWidth;
    if (!w || w <= 0) return;
    if (w >= 740) {
      pane.barEl.removeAttribute('data-compact');
    } else if (w >= 540) {
      pane.barEl.setAttribute('data-compact', 'md');
    } else {
      pane.barEl.setAttribute('data-compact', 'sm');
    }
  }

  function ensureResizeObserver() {
    if (state.resizeObserver || typeof ResizeObserver !== 'function') return;
    state.resizeObserver = new ResizeObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var pane = state.paneByFooter.get(entries[i].target);
        if (pane) syncResponsiveLayoutForPane(pane);
      }
    });
  }

  function makeSegBtn(pane, panelName, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'acr-seg-btn';
    btn.setAttribute('data-panel', panelName);
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (state.activePane === pane && state.activePanel === panelName) {
        state.activePanel = null;
        state.activePane = null;
      } else {
        state.activePane = pane;
        state.activePanel = panelName;
      }
      syncPopoverVisibility();
    });
    return btn;
  }

  function createPane(target) {
    var pane = {
      keyEl: target.keyEl,
      footerEl: target.footer || null,
      anchorEl: target.anchor,
      kind: target.kind,
      barEl: null,
      btns: {},
      convId: null,
      metrics: EMPTY_METRICS,
      lastBarRenderKey: '',
    };
    var bar = document.createElement('div');
    bar.className = BAR_CLASS;
    pane.btns.session = makeSegBtn(pane, 'session', '会话统计');
    pane.btns.tokens = makeSegBtn(pane, 'tokens', 'Token 用量');
    pane.btns.context = makeSegBtn(pane, 'context', '上下文窗口');
    bar.appendChild(pane.btns.session);
    bar.appendChild(pane.btns.tokens);
    bar.appendChild(pane.btns.context);
    pane.barEl = bar;
    renderBarForPane(pane);
    return pane;
  }

  function extractIdFromFiber(el) {
    if (!el) return '';
    for (var k in el) {
      if (k.startsWith('__reactFiber$') || k.startsWith('__reactProps$')) {
        var node = el[k];
        for (var step = 0; step < 45 && node; step++) {
          var p = node.memoizedProps || node.pendingProps;
          if (p) {
            if (typeof p.conversationId === 'string' && CONV_ID_RE.test(p.conversationId)) {
              return p.conversationId;
            }
            if (typeof p.cascadeId === 'string' && CONV_ID_RE.test(p.cascadeId)) {
              return p.cascadeId;
            }
          }
          node = node.return;
        }
      }
    }
    return '';
  }

  function extractConversationIdForPane(pane, totalPanes) {
    var viewEl = pane.footerEl && pane.footerEl.closest('[data-testid="conversation-view"]');
    var cid = extractIdFromFiber(viewEl);
    if (cid) return cid;
    cid = extractIdFromFiber(pane.anchorEl);
    if (cid) return cid;
    cid = extractIdFromFiber(pane.footerEl);
    if (cid) return cid;
    if (totalPanes === 1) {
      var path = window.location.pathname || '';
      if (path.indexOf('+') === -1 && path.indexOf('%2B') === -1 && path.indexOf('%2b') === -1) {
        var m = path.match(/\\/c\\/([0-9a-f-]{36})(?:$|\\/)/i);
        if (m) return m[1];
      }
    }
    return '';
  }

  function notifyHost(sig) {
    if (typeof window.__agyCtxRingNotify === 'function') {
      try { window.__agyCtxRingNotify(String(sig || '')); } catch (e) {}
    }
  }

  function syncAllPanes(shouldNotify) {
    var anchors = findMountAnchors();
    var activeKeys = new Set();
    for (var i = 0; i < anchors.length; i++) {
      activeKeys.add(anchors[i].keyEl);
    }

    var toRemove = [];
    state.panes.forEach(function (pane, keyEl) {
      if (!activeKeys.has(keyEl) || !keyEl.isConnected) {
        toRemove.push(keyEl);
      }
    });
    for (var r = 0; r < toRemove.length; r++) {
      var staleKey = toRemove[r];
      var stalePane = state.panes.get(staleKey);
      if (stalePane) {
        if (stalePane.footerEl && state.resizeObserver) {
          try { state.resizeObserver.unobserve(stalePane.footerEl); } catch (e) {}
          state.paneByFooter.delete(stalePane.footerEl);
        }
        if (stalePane.barEl) stalePane.barEl.remove();
        if (state.activePane === stalePane) {
          state.activePane = null;
          state.activePanel = null;
          syncPopoverVisibility();
        }
      }
      state.panes.delete(staleKey);
    }

    var convIds = [];
    var seenConv = new Set();
    var totalPanes = anchors.length;

    for (var j = 0; j < anchors.length; j++) {
      var target = anchors[j];
      var pane = state.panes.get(target.keyEl);
      if (!pane) {
        pane = createPane(target);
        state.panes.set(target.keyEl, pane);
      } else {
        if (pane.footerEl !== (target.footer || null)) {
          if (pane.footerEl && state.resizeObserver) {
            try { state.resizeObserver.unobserve(pane.footerEl); } catch (e) {}
            state.paneByFooter.delete(pane.footerEl);
          }
          pane.footerEl = target.footer || null;
        }
        pane.anchorEl = target.anchor;
        pane.kind = target.kind;
      }

      if (target.kind === 'before') {
        if (pane.barEl.nextElementSibling !== target.anchor || pane.barEl.parentNode !== target.anchor.parentNode) {
          target.anchor.insertAdjacentElement('beforebegin', pane.barEl);
        }
      } else if (pane.barEl.parentNode !== target.anchor) {
        target.anchor.insertBefore(pane.barEl, target.anchor.firstChild);
      }

      if (pane.footerEl) {
        ensureResizeObserver();
        if (state.resizeObserver && state.paneByFooter.get(pane.footerEl) !== pane) {
          state.paneByFooter.set(pane.footerEl, pane);
          state.resizeObserver.observe(pane.footerEl);
        }
      }
      syncResponsiveLayoutForPane(pane);

      var cid = extractConversationIdForPane(pane, totalPanes);
      if (cid !== pane.convId) {
        pane.convId = cid;
        pane.metrics = (cid && state.metricsCache[cid]) || EMPTY_METRICS;
        renderBarForPane(pane);
        if (state.activePane === pane && state.activePanel) {
          renderPopover();
          positionPopover();
        }
      }

      if (cid && !seenConv.has(cid)) {
        seenConv.add(cid);
        convIds.push(cid);
      }
    }

    var sig = convIds.join(',');
    if (shouldNotify !== false && sig !== state.lastNotifiedSig) {
      state.lastNotifiedSig = sig;
      notifyHost(sig);
    }
    return convIds;
  }

  function onDocClick(e) {
    if (!state.activePanel) return;
    if (popEl.contains(e.target)) return;
    var insideAnyBar = false;
    state.panes.forEach(function (pane) {
      if (pane.barEl && pane.barEl.contains(e.target)) {
        insideAnyBar = true;
      }
    });
    if (insideAnyBar) return;
    state.activePanel = null;
    state.activePane = null;
    syncPopoverVisibility();
  }
  function onKeyDown(e) {
    if (e.key === 'Escape' && state.activePanel) {
      state.activePanel = null;
      state.activePane = null;
      syncPopoverVisibility();
    }
  }
  function onResize() {
    state.panes.forEach(function (pane) {
      syncResponsiveLayoutForPane(pane);
    });
    if (state.activePanel) positionPopover();
  }
  function onRouteChange() {
    syncAllPanes(true);
  }

  var navApi = window.navigation && typeof window.navigation.addEventListener === 'function'
    ? window.navigation
    : null;
  if (navApi) navApi.addEventListener('currententrychange', onRouteChange);
  window.addEventListener('popstate', onRouteChange);
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onResize);

  var scheduleMicro = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : function (fn) { Promise.resolve().then(fn); };

  state.observer = new MutationObserver(function () {
    if (state.mountQueued) return;
    state.mountQueued = true;
    scheduleMicro(function () {
      state.mountQueued = false;
      syncAllPanes(true);
    });
  });
  state.observer.observe(document.body, { childList: true, subtree: true });
  syncAllPanes(true);

  window.__agyCtxRing = {
    version: VERSION,
    getContext: function () {
      var convIds = syncAllPanes(false);
      return {
        conversationId: convIds[0] || '',
        conversationIds: convIds,
        mounted: state.panes.size > 0,
        mountedCount: state.panes.size,
        cacheSize: Object.keys(state.metricsCache).length,
        hasBinding: typeof window.__agyCtxRingNotify === 'function',
      };
    },
    preload: function (map) {
      if (!map || typeof map !== 'object') return;
      for (var id in map) {
        if (Object.prototype.hasOwnProperty.call(map, id) && map[id]) {
          var prev = state.metricsCache[id];
          if (!prev || (map[id].updatedAt || 0) >= (prev.updatedAt || 0)) {
            state.metricsCache[id] = map[id];
          }
        }
      }
      var activeUpdated = false;
      state.panes.forEach(function (pane) {
        if (pane.convId && state.metricsCache[pane.convId] && (!pane.metrics || pane.metrics === EMPTY_METRICS)) {
          pane.metrics = state.metricsCache[pane.convId];
          renderBarForPane(pane);
          if (pane === state.activePane && state.activePanel) activeUpdated = true;
        }
      });
      if (activeUpdated) {
        renderPopover();
        positionPopover();
      }
    },
    updateMany: function (map) {
      if (!map || typeof map !== 'object') return;
      for (var id in map) {
        if (Object.prototype.hasOwnProperty.call(map, id) && map[id]) {
          state.metricsCache[id] = map[id];
        }
      }
      syncAllPanes(false);
      var activeUpdated = false;
      state.panes.forEach(function (pane) {
        var nextMetrics = pane.convId
          ? (state.metricsCache[pane.convId] || pane.metrics || EMPTY_METRICS)
          : EMPTY_METRICS;
        if (!pane.convId || Object.prototype.hasOwnProperty.call(map, pane.convId) || pane.metrics !== nextMetrics) {
          pane.metrics = nextMetrics;
          renderBarForPane(pane);
          if (pane === state.activePane && state.activePanel) activeUpdated = true;
        }
      });
      if (activeUpdated) {
        renderPopover();
        positionPopover();
      }
    },
    update: function (metrics) {
      var m = metrics || EMPTY_METRICS;
      var cid = m.conversationId || '';
      var map = Object.create(null);
      map[cid] = m;
      window.__agyCtxRing.updateMany(map);
    },
    unmount: function () {
      try { state.observer && state.observer.disconnect(); } catch (e) {}
      try { state.resizeObserver && state.resizeObserver.disconnect(); } catch (e) {}

      if (navApi) navApi.removeEventListener('currententrychange', onRouteChange);
      window.removeEventListener('popstate', onRouteChange);
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onResize);

      state.panes.forEach(function (pane) {
        if (pane.barEl) pane.barEl.remove();
      });
      state.panes.clear();
      var leftover = document.querySelectorAll('#agy-ctx-ring-bar, .agy-ctx-ring-bar, #agy-ctx-ring-pill');
      for (var i = 0; i < leftover.length; i++) {
        leftover[i].remove();
      }
      popEl.remove();
      styleEl.remove();
      delete window.__agyCtxRing;
    }
  };
  return { status: 'mounted', version: VERSION };
})();`;
}
