// FLUX Design System — Color Tokens & Typography
export const C = {
  // Backgrounds
  bg:          '#0D1117',
  surface:     '#161B22',
  surfaceDeep: '#1C2128',
  border:      '#30363D',
  // Accents
  teal:        '#00B4D8',
  tealDim:     '#007A96',
  green:       '#3FB950',
  amber:       '#D29922',
  red:         '#F85149',
  // Text
  text:        '#E6EDF3',
  muted:       '#8B949E',
}

export const FONTS = {
  heading: "'Chakra Petch', sans-serif",
  mono:    "'JetBrains Mono', 'Courier New', monospace",
}

// Verdict pill styles
export const VERDICT = {
  PASS:    { bg: 'rgba(63,185,80,0.13)',   color: '#3FB950', border: 'rgba(63,185,80,0.45)',   shadow: 'rgba(63,185,80,0.15)' },
  WARN:    { bg: 'rgba(210,153,34,0.13)',  color: '#D29922', border: 'rgba(210,153,34,0.45)',  shadow: 'rgba(210,153,34,0.15)' },
  BLOCK:   { bg: 'rgba(248,81,73,0.13)',   color: '#F85149', border: 'rgba(248,81,73,0.45)',   shadow: 'rgba(248,81,73,0.15)' },
  FAILED:  { bg: 'rgba(248,81,73,0.13)',   color: '#F85149', border: 'rgba(248,81,73,0.45)',   shadow: 'rgba(248,81,73,0.15)' },
  RUNNING: { bg: 'rgba(0,180,216,0.13)',   color: '#00B4D8', border: 'rgba(0,180,216,0.45)',   shadow: 'rgba(0,180,216,0.15)' },
}

// Global CSS injected once via useEffect in App
export const GLOBAL_CSS = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 6px currentColor; }
  50%       { box-shadow: 0 0 18px currentColor, 0 0 32px currentColor; }
}
@keyframes data-flow {
  from { stroke-dashoffset: 36; }
  to   { stroke-dashoffset: 0; }
}
@keyframes blink-chaos {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0.3; }
}
@keyframes counter-tick {
  from { opacity: 0.6; }
  to   { opacity: 1; }
}

.flux-hero-text {
  animation: fadeUp 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards;
}
.flux-hero-sub {
  animation: fadeUp 0.8s 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
}

.stat-card-1 { animation: fadeUp 0.55s 0.00s both; }
.stat-card-2 { animation: fadeUp 0.55s 0.08s both; }
.stat-card-3 { animation: fadeUp 0.55s 0.16s both; }
.stat-card-4 { animation: fadeUp 0.55s 0.24s both; }

.card-hover {
  transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
              box-shadow 0.25s ease,
              border-color 0.25s ease;
}
.card-hover:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,180,216,0.2) !important;
}

.nav-link {
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.nav-link:hover {
  color: #00B4D8 !important;
  background: rgba(0,180,216,0.06) !important;
}

.tbl-row {
  transition: background 0.15s;
  cursor: pointer;
}
.tbl-row:hover { background: #1C2128 !important; }

.btn-primary-flux {
  background: #00B4D8;
  color: #0D1117;
  font-family: 'Chakra Petch', sans-serif;
  font-weight: 700;
  font-size: 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s;
}
.btn-primary-flux:hover {
  box-shadow: 0 0 20px rgba(0,180,216,0.4);
  transform: translateY(-1px);
}

.btn-ghost-flux {
  background: transparent;
  border: 1px solid #30363D;
  color: #8B949E;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.btn-ghost-flux:hover {
  border-color: #00B4D8;
  color: #00B4D8;
}

.progress-bar-fill {
  box-shadow: 0 0 10px rgba(0,180,216,0.6);
  transition: width 0.4s ease-out;
  background: linear-gradient(90deg, #007A96, #00B4D8);
  height: 100%;
  border-radius: 2px;
}

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(0,180,216,0.2);
  border-top: 2px solid #00B4D8;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  display: inline-block;
  vertical-align: middle;
  margin-right: 6px;
  flex-shrink: 0;
}

input, select {
  font-family: 'Chakra Petch', sans-serif;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(0,180,216,0.3) !important;
}
`

// Card gradient border CSS object
export const cardBorder = (type = 'default') => {
  const accent =
    type === 'block'   ? 'rgba(248,81,73,0.45)'  :
    type === 'pass'    ? 'rgba(63,185,80,0.35)'   :
    type === 'active'  ? 'rgba(0,180,216,0.60)'   :
    'rgba(0,180,216,0.35)'

  const accent2 =
    type === 'block'   ? 'rgba(248,81,73,0.12)'   :
    'rgba(48,54,61,0.8)'

  return {
    background: `linear-gradient(#161B22, #161B22) padding-box,
                 linear-gradient(135deg, ${accent}, rgba(48,54,61,0.8), ${accent2}) border-box`,
    border: '1px solid transparent',
    borderRadius: '10px',
  }
}

export const statCardBg = {
  background: 'linear-gradient(145deg, #1C2128 0%, #161B22 60%, #0D1117 100%)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(0,180,216,0.08) inset',
}

export const STAGES = ['QUEUED','PROVISIONING','RUNNING','CHAOS','ANALYZING','REPORTING','DONE']
