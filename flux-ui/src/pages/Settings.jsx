import { useState } from 'react'
import { C, FONTS, cardBorder } from '../tokens'
import { Toggle, PrimaryBtn, GhostBtn } from '../components/UI'

const RAMP_PROFILES = [
  {
    id: 'staircase', label: 'STAIRCASE',
    path: 'M0,36 L0,28 L7,28 L7,20 L14,20 L14,12 L21,12 L21,4 L28,4',
  },
  {
    id: 'linear', label: 'LINEAR',
    path: 'M0,36 L28,4',
  },
  {
    id: 'spike', label: 'SPIKE',
    path: 'M0,36 L8,4 L16,4 L17,36',
  },
  {
    id: 'soak', label: 'SOAK',
    path: 'M0,36 L5,4 L22,4 L28,36',
  },
]

const NAV_ITEMS = [
  'Load Testing',
  'Chaos Scenarios',
  'AI Analyzer',
  'GitHub Integration',
  'Notifications',
  'Access Control',
]

const CHAOS_TOGGLES = [
  { id:'latency', label:'Latency Injection',  detail:'Inject variable latency via Toxiproxy',     default:true  },
  { id:'pod',     label:'Pod Termination',    detail:'Random pod kill at configurable intervals',  default:true  },
  { id:'packet',  label:'Packet Loss',        detail:'Simulate network degradation via iptables',  default:false },
]

export default function Settings() {
  const [activeNav,  setActiveNav]  = useState('Load Testing')
  const [rampProfile, setRampProfile] = useState('staircase')
  const [chaos, setChaos] = useState({ latency:true, pod:true, packet:false })
  const [vus, setVus] = useState({ baseline:50, peak:500, soak:200 })
  const [confidence, setConfidence] = useState('MEDIUM')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh', display:'flex' }}>
      {/* Left sidebar nav */}
      <div style={{
        width:'220px', flexShrink:0,
        background:C.surface,
        borderRight:`1px solid ${C.border}`,
        paddingTop:'24px',
        position:'sticky', top:'56px', height:'calc(100vh - 56px)',
        overflow:'auto',
      }}>
        <div style={{ fontFamily:FONTS.heading, fontSize:'9px', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.muted, padding:'0 20px 12px' }}>
          Configuration
        </div>
        {NAV_ITEMS.map(item => {
          const active = item === activeNav
          return (
            <button key={item} onClick={() => setActiveNav(item)} style={{
              width:'100%', textAlign:'left',
              padding:'10px 20px',
              fontFamily:FONTS.heading, fontSize:'13px', fontWeight:active?600:400,
              color: active ? C.teal : C.muted,
              background: active ? 'rgba(0,180,216,0.06)' : 'transparent',
              borderLeft: active ? `3px solid ${C.teal}` : '3px solid transparent',
              border:'none',
              cursor:'pointer',
              borderRight:'none',
              transition:'all 0.15s',
            }}>
              {item}
            </button>
          )
        })}
      </div>

      {/* Main content */}
      <div style={{ flex:1, padding:'32px 36px', overflow:'auto' }}>
        <div style={{ maxWidth:'720px' }}>

          {activeNav === 'Load Testing' && (
            <div style={{ animation:'fadeUp 0.4s both' }}>
              <h2 style={{ fontFamily:FONTS.heading, fontSize:'18px', fontWeight:700, letterSpacing:'0.06em', color:C.text, marginBottom:'6px' }}>
                Load Testing
              </h2>
              <p style={{ fontFamily:FONTS.heading, fontSize:'13px', color:C.muted, lineHeight:1.7, marginBottom:'28px' }}>
                Configure virtual user counts, ramp profiles, and test parameters for chaos injection.
              </p>

              {/* VU Count stepper section */}
              <div style={{ ...cardBorder(), padding:'24px', marginBottom:'20px' }}>
                <div style={{ fontFamily:FONTS.heading, fontSize:'12px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'18px' }}>
                  VIRTUAL USER COUNTS
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px' }}>
                  {[
                    { key:'baseline', label:'Baseline VUs' },
                    { key:'peak',     label:'Peak VUs'     },
                    { key:'soak',     label:'Soak VUs'     },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:600, color:C.muted, marginBottom:'8px' }}>
                        {label}
                      </div>
                      <div style={{ display:'flex', border:`1px solid ${C.border}`, borderRadius:'6px', overflow:'hidden' }}>
                        <button
                          onClick={() => setVus(v => ({ ...v, [key]: Math.max(1, v[key]-10) }))}
                          style={{ width:'36px', background:C.surfaceDeep, border:'none', color:C.text, fontSize:'16px', cursor:'pointer', flexShrink:0, transition:'background 0.15s' }}
                        >−</button>
                        <div style={{ flex:1, textAlign:'center', padding:'8px', fontFamily:FONTS.mono, fontSize:'14px', fontWeight:700, color:C.teal, background:C.surface }}>
                          {vus[key]}
                        </div>
                        <button
                          onClick={() => setVus(v => ({ ...v, [key]: v[key]+10 }))}
                          style={{ width:'36px', background:C.surfaceDeep, border:'none', color:C.text, fontSize:'16px', cursor:'pointer', flexShrink:0, transition:'background 0.15s' }}
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ramp Profile selector */}
              <div style={{ ...cardBorder(), padding:'24px', marginBottom:'20px' }}>
                <div style={{ fontFamily:FONTS.heading, fontSize:'12px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'16px' }}>
                  RAMP PROFILE
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
                  {RAMP_PROFILES.map(p => {
                    const selected = rampProfile === p.id
                    return (
                      <div
                        key={p.id}
                        onClick={() => setRampProfile(p.id)}
                        style={{
                          background: selected ? 'rgba(0,180,216,0.06)' : '#0D1117',
                          border: selected ? `1px solid rgba(0,180,216,0.5)` : `1px solid ${C.border}`,
                          borderRadius:'8px',
                          padding:'14px 10px',
                          cursor:'pointer',
                          textAlign:'center',
                          boxShadow: selected ? '0 0 20px rgba(0,180,216,0.18)' : 'none',
                          transition:'all 0.2s',
                        }}
                      >
                        {/* Mini sparkline SVG */}
                        <svg width="80" height="36" viewBox="0 0 28 36" style={{ display:'block', margin:'0 auto 10px' }}>
                          <path d={p.path}
                            stroke={selected ? C.teal : C.muted}
                            strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div style={{ fontFamily:FONTS.mono, fontSize:'10px', fontWeight:700, letterSpacing:'0.08em', color:selected?C.teal:C.muted }}>
                          {p.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeNav === 'Chaos Scenarios' && (
            <div style={{ animation:'fadeUp 0.4s both' }}>
              <h2 style={{ fontFamily:FONTS.heading, fontSize:'18px', fontWeight:700, letterSpacing:'0.06em', color:C.text, marginBottom:'6px' }}>
                Chaos Scenarios
              </h2>
              <p style={{ fontFamily:FONTS.heading, fontSize:'13px', color:C.muted, lineHeight:1.7, marginBottom:'28px' }}>
                Enable or disable individual fault injection strategies applied during chaos testing.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {CHAOS_TOGGLES.map(ct => {
                  const on = chaos[ct.id]
                  return (
                    <div key={ct.id} style={{
                      background: on ? 'rgba(0,180,216,0.04)' : 'transparent',
                      border: on ? `1px solid rgba(0,180,216,0.25)` : `1px solid ${C.border}`,
                      borderRadius:'10px',
                      padding:'18px 22px',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      opacity: on ? 1 : 0.45,
                      transition:'all 0.25s',
                    }}>
                      <div>
                        <div style={{ fontFamily:FONTS.heading, fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'4px' }}>
                          {ct.label}
                        </div>
                        <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted }}>
                          {ct.detail}
                        </div>
                      </div>
                      <Toggle on={on} onChange={v => setChaos(c => ({ ...c, [ct.id]: v }))} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeNav === 'AI Analyzer' && (
            <div style={{ animation:'fadeUp 0.4s both' }}>
              <h2 style={{ fontFamily:FONTS.heading, fontSize:'18px', fontWeight:700, letterSpacing:'0.06em', color:C.text, marginBottom:'6px' }}>
                AI Analyzer
              </h2>
              <p style={{ fontFamily:FONTS.heading, fontSize:'13px', color:C.muted, lineHeight:1.7, marginBottom:'28px' }}>
                Configure the LLM model, thresholds, and output behavior for AI-generated chaos reports.
              </p>
              <div style={{ ...cardBorder(), padding:'24px' }}>
                {/* 2×2 grid of selects */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
                  {[
                    { label:'Model',        opts:['llama3.2','codellama','mistral'] },
                    { label:'Temperature',  opts:['0.1','0.3','0.5','0.7'] },
                    { label:'Max Tokens',   opts:['2048','4096','8192'] },
                    { label:'Report Style', opts:['Terse','Detailed','Executive'] },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'8px' }}>{s.label}</div>
                      <select style={{
                        width:'100%', padding:'8px 12px',
                        background:C.surface, border:`1px solid ${C.border}`, borderRadius:'6px',
                        fontFamily:FONTS.mono, fontSize:'13px', color:C.text,
                        cursor:'pointer',
                      }}>
                        {s.opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Confidence pills */}
                <div>
                  <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:C.muted, marginBottom:'10px' }}>
                    CONFIDENCE THRESHOLD
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {['LOW','MEDIUM','HIGH'].map(c => {
                      const sel = confidence === c
                      return (
                        <button key={c} onClick={() => setConfidence(c)} style={{
                          flex:1, padding:'8px 0',
                          border: sel ? `1px solid rgba(0,180,216,0.5)` : `1px solid ${C.border}`,
                          borderRadius:'6px',
                          background: sel ? 'rgba(0,180,216,0.1)' : 'transparent',
                          color: sel ? C.teal : C.muted,
                          fontFamily:FONTS.mono, fontSize:'12px', fontWeight:700,
                          cursor:'pointer', transition:'all 0.15s',
                        }}>{c}</button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!['Load Testing','Chaos Scenarios','AI Analyzer'].includes(activeNav) && (
            <div style={{ animation:'fadeUp 0.4s both' }}>
              <h2 style={{ fontFamily:FONTS.heading, fontSize:'18px', fontWeight:700, letterSpacing:'0.06em', color:C.text, marginBottom:'6px' }}>
                {activeNav}
              </h2>
              <div style={{ ...cardBorder(), padding:'40px', textAlign:'center' }}>
                <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted }}>
                  Configuration for <strong style={{ color:C.teal }}>{activeNav}</strong> coming soon.
                </div>
              </div>
            </div>
          )}

          {/* Bottom action buttons */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'28px' }}>
            <PrimaryBtn onClick={handleSave} style={{ flex:1, marginRight:'12px', padding:'12px 0', textAlign:'center' }}>
              {saved ? '✓ SAVED' : 'SAVE CHANGES'}
            </PrimaryBtn>
            <GhostBtn>RESET TO DEFAULTS</GhostBtn>
          </div>
        </div>
      </div>
    </div>
  )
}
