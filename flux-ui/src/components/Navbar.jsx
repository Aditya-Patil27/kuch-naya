import { C, FONTS } from '../tokens'

const PAGES = [
  { id: 'dashboard',  label: 'Dashboard'  },
  { id: 'jobs',       label: 'Job Queue'  },
  { id: 'settings',   label: 'Settings'   },
  { id: 'pr-preview', label: 'PR Preview' },
]

export default function Navbar({ page, setPage }) {
  return (
    <nav style={{
      position:   'fixed',
      top: 0, left: 0, right: 0,
      height:     '56px',
      zIndex:     1000,
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding:    '0 28px',
      background: 'rgba(13,17,23,0.96)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: `1px solid ${C.border}`,
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', cursor:'pointer' }}
           onClick={() => setPage('dashboard')}>
        {/* Lightning bolt SVG */}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <polygon points="13,1 4,13 11,13 9,21 18,9 11,9" fill="#00B4D8"
            style={{ filter: 'drop-shadow(0 0 6px #00B4D8)' }} />
        </svg>
        <div>
          <span style={{
            fontFamily:    FONTS.heading,
            fontWeight:    700,
            fontSize:      '18px',
            color:         '#E6EDF3',
            letterSpacing: '0.06em',
          }}>FLUX</span>
          <span style={{
            fontFamily:    FONTS.mono,
            fontSize:      '10px',
            color:         C.muted,
            letterSpacing: '0.12em',
            marginLeft:    '10px',
            textTransform: 'uppercase',
          }}>CHAOS REVIEWER</span>
        </div>
      </div>

      {/* Nav Links */}
      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
        {PAGES.map(p => {
          const active = page === p.id
          return (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              className="nav-link"
              style={{
                fontFamily:    FONTS.heading,
                fontWeight:    active ? 600 : 400,
                fontSize:      '13px',
                letterSpacing: '0.05em',
                color:         active ? C.teal : C.muted,
                background:    active ? 'rgba(0,180,216,0.08)' : 'transparent',
                border:        active ? `1px solid rgba(0,180,216,0.3)` : '1px solid transparent',
                borderRadius:  '6px',
                padding:       '6px 14px',
                cursor:        'pointer',
                transition:    'all 0.15s',
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* GitHub Status */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '8px',
        background:   'rgba(63,185,80,0.06)',
        border:       '1px solid rgba(63,185,80,0.25)',
        borderRadius: '20px',
        padding:      '5px 14px',
      }}>
        <div style={{
          width: '7px', height: '7px',
          borderRadius: '50%',
          background: C.green,
          boxShadow: `0 0 8px ${C.green}`,
          animation: 'pulse-glow 2s ease-in-out infinite',
        }} />
        <span style={{
          fontFamily:    FONTS.mono,
          fontSize:      '11px',
          color:         C.green,
          letterSpacing: '0.06em',
        }}>GitHub Connected</span>
      </div>
    </nav>
  )
}
