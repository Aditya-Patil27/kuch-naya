import { C, VERDICT, FONTS } from '../tokens'

// ─── Verdict Pill ────────────────────────────────────────────────────
export function VerdictPill({ verdict, large = false }) {
  const v = VERDICT[verdict] || VERDICT.PASS
  return (
    <span style={{
      background:   v.bg,
      color:        v.color,
      border:       `1px solid ${v.border}`,
      borderRadius: large ? '6px' : '4px',
      fontFamily:   FONTS.mono,
      fontWeight:   700,
      fontSize:     large ? '14px' : '11px',
      letterSpacing:'0.08em',
      padding:      large ? '6px 18px' : '3px 10px',
      boxShadow:    `0 0 8px ${v.shadow}`,
      whiteSpace:   'nowrap',
      display:      'inline-flex',
      alignItems:   'center',
      gap:          '5px',
    }}>
      <span style={{ fontSize: large ? '9px' : '7px' }}>●</span>
      {verdict}
    </span>
  )
}

// ─── Stage Progress Bar ───────────────────────────────────────────────
const STAGES = ['QUEUED','PROV','RUNNING','CHAOS','ANALYZE','REPORT','DONE']

export function StageBar({ activeStage = 0 }) {
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {STAGES.map((s, i) => {
        const past   = i < activeStage
        const active = i === activeStage
        const future = i > activeStage
        return (
          <div key={s} style={{ flex: 1 }}>
            <div style={{
              height:       '3px',
              borderRadius: '2px',
              background:   past   ? `rgba(0,180,216,0.55)` :
                            active ? C.teal :
                            'rgba(48,54,61,0.25)',
              boxShadow:    active ? `0 0 10px ${C.teal}` : 'none',
              transition:   'background 0.3s',
            }} />
          </div>
        )
      })}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color, className, spinning }) {
  return (
    <div className={`card-hover ${className}`} style={{
      background: 'linear-gradient(145deg, #1C2128 0%, #161B22 60%, #0D1117 100%)',
      boxShadow:  '0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(0,180,216,0.08) inset',
      backgroundClip: 'padding-box',
      border:     `1px solid ${C.border}`,
      borderRadius: '10px',
      padding:    '20px 24px',
      position:   'relative',
      overflow:   'hidden',
    }}>
      {/* Accent gradient top edge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: `linear-gradient(90deg, transparent, ${color || C.teal}55, transparent)`,
      }} />
      <p style={{
        fontFamily:    FONTS.heading,
        fontSize:      '10px',
        fontWeight:    600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color:         C.muted,
        marginBottom:  '10px',
      }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {spinning && <div className="spinner" />}
        <p style={{
          fontFamily: FONTS.mono,
          fontSize:   '32px',
          fontWeight: 700,
          color:      color || C.teal,
          lineHeight: 1,
        }}>{value}</p>
      </div>
      {sub && (
        <p style={{
          fontFamily: FONTS.mono,
          fontSize:   '11px',
          color:      C.muted,
          marginTop:  '6px',
        }}>{sub}</p>
      )}
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────
export function SectionHeader({ title, action, onAction }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
      <h2 style={{
        fontFamily:    FONTS.heading,
        fontSize:      '13px',
        fontWeight:    700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color:         C.text,
      }}>{title}</h2>
      {action && (
        <button onClick={onAction} className="btn-ghost-flux" style={{ padding:'4px 12px' }}>
          {action}
        </button>
      )}
    </div>
  )
}

// ─── Toggle Switch ─────────────────────────────────────────────────────
export function Toggle({ on, onChange }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        width: '40px', height: '22px',
        borderRadius: '11px',
        background: on ? C.teal : C.border,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: '16px', height: '16px',
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: '3px',
        left: on ? '21px' : '3px',
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </div>
  )
}

// ─── Service Status Dot ────────────────────────────────────────────────
export function StatusDot({ color, label, status }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
      <div style={{
        width: '7px', height: '7px',
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}`,
        animation: 'pulse-glow 2s ease-in-out infinite',
      }} />
      <span style={{ fontFamily: FONTS.mono, fontSize: '11px', color: C.muted }}>
        {label}
      </span>
      <span style={{ fontFamily: FONTS.mono, fontSize: '11px', color }}>
        {status}
      </span>
    </div>
  )
}

// ─── Ghost Button ──────────────────────────────────────────────────────
export function GhostBtn({ children, onClick, style }) {
  return (
    <button className="btn-ghost-flux" onClick={onClick} style={{ padding:'7px 16px', ...style }}>
      {children}
    </button>
  )
}

// ─── Primary Button ────────────────────────────────────────────────────
export function PrimaryBtn({ children, onClick, style }) {
  return (
    <button className="btn-primary-flux" onClick={onClick} style={{ padding:'10px 24px', ...style }}>
      {children}
    </button>
  )
}
