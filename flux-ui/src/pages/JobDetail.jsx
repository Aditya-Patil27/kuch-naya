import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { C, FONTS, MOCK_METRICS, cardBorder } from '../tokens'
import { VerdictPill, StageBar, GhostBtn } from '../components/UI'

const STAGES_FULL = ['QUEUED','PROVISIONING','RUNNING','CHAOS','ANALYZING','REPORTING','DONE']

const PIPELINE_STEPS = [
  { name: 'Queue Accepted',       ts: '14:22:01' },
  { name: 'vCluster Provisioned', ts: '14:22:47' },
  { name: 'Load Test Started',    ts: '14:23:05' },
  { name: 'Chaos Injected',       ts: '14:26:18' },
  { name: 'OTel Analysis',        ts: '14:27:34' },
  { name: 'LLM Report Generated', ts: '14:28:51' },
  { name: 'VERDICT: BLOCK',       ts: '14:29:15', verdict: true },
]

// Mock timeline data
const CHART_DATA = [
  { t:'0s',   base:42,  pr:44  },
  { t:'30s',  base:45,  pr:52  },
  { t:'60s',  base:43,  pr:79  },
  { t:'90s',  base:44,  pr:112 },
  { t:'120s', base:42,  pr:189 }, // chaos injection
  { t:'150s', base:45,  pr:242 },
  { t:'180s', base:43,  pr:218 },
  { t:'210s', base:44,  pr:195 },
  { t:'225s', base:43,  pr:178 },
]

const CHAOS_SCENARIOS = [
  { name: 'Latency Injection', detail: '+200ms jitter via Toxiproxy',   executed: true },
  { name: 'Pod Termination',   detail: '1x pod killed at 60s mark',       executed: true },
  { name: 'Packet Loss',       detail: '8% packet drop on egress',        executed: true },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: C.surface, border:`1px solid ${C.border}`,
      borderRadius:'8px', padding:'10px 14px',
      fontFamily: FONTS.mono, fontSize:'12px',
    }}>
      <div style={{ color:C.muted, marginBottom:'6px' }}>t = {label}</div>
      <div style={{ color:C.green }}>Baseline: {payload[0]?.value}ms</div>
      <div style={{ color:C.red   }}>PR#406:   {payload[1]?.value}ms</div>
    </div>
  )
}

export default function JobDetail({ setPage }) {
  return (
    <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh' }}>
      {/* Fixed background */}
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        background:'radial-gradient(ellipse 80% 50% at -10% -20%, rgba(0,180,216,0.03) 0%, transparent 60%)',
      }} />

      <div style={{ position:'relative', zIndex:1, padding:'28px' }}>
        {/* Header bar ─────────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'28px' }}>
          <GhostBtn onClick={() => setPage('dashboard')}>
            ← BACK TO DASHBOARD
          </GhostBtn>

          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, marginBottom:'3px' }}>
              PR #406 · ui/dashboard
            </div>
            <div style={{ fontFamily:FONTS.heading, fontSize:'14px', color:C.text }}>
              refactor: lazy-load comment thread widgets
            </div>
          </div>

          <VerdictPill verdict="BLOCK" large />
        </div>

        {/* Two-column ──────────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'20px' }}>

          {/* LEFT COLUMN */}
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

            {/* AI Findings Card */}
            <div style={{
              ...cardBorder('block'),
              padding:'0',
              overflow:'hidden',
              animation:'fadeUp 0.5s 0.05s both',
            }}>
              <div style={{ borderLeft:`3px solid ${C.teal}`, padding:'20px 24px' }}>
                {/* Finding header */}
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
                  <span style={{
                    background:'rgba(248,81,73,0.13)', color:C.red,
                    border:`1px solid rgba(248,81,73,0.45)`, borderRadius:'4px',
                    fontFamily:FONTS.mono, fontWeight:700, fontSize:'10px',
                    letterSpacing:'0.1em', padding:'3px 8px',
                  }}>CRITICAL</span>
                  <span style={{ fontFamily:FONTS.heading, fontWeight:700, fontSize:'14px', color:C.text }}>
                    P50 Latency Regression — Lazy Loading Blocks Thread
                  </span>
                </div>

                <div style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted, marginBottom:'16px' }}>
                  ui/dashboard/src/components/CommentThread.jsx
                </div>

                {/* Metric delta grid */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                  {[
                    { label:'P50 Baseline', val:'42ms',  color:C.green },
                    { label:'P50 PR',       val:'189ms', color:C.red },
                    { label:'P99 Baseline', val:'94ms',  color:C.green },
                    { label:'P99 PR',       val:'242ms', color:C.red },
                  ].map(m => (
                    <div key={m.label} style={{
                      background:`rgba(248,81,73,0.05)`,
                      border:`1px solid rgba(248,81,73,0.18)`,
                      borderRadius:'6px', padding:'10px 14px',
                    }}>
                      <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>{m.label}</div>
                      <div style={{ fontFamily:FONTS.mono, fontSize:'18px', fontWeight:700, color:m.color }}>{m.val}</div>
                    </div>
                  ))}
                </div>

                <p style={{ fontFamily:FONTS.heading, fontSize:'13px', color:C.muted, lineHeight:1.7, marginBottom:'16px' }}>
                  The lazy-loading implementation introduces a synchronous DOM reflow cascade during
                  the Intersection Observer callback. Under concurrent load (500 VUs), this creates a
                  thread-blocking pattern in the main event loop, causing P50 latency to spike 347%
                  above the established baseline. The regression is deterministic and reproducible
                  across 3 chaos replays.
                </p>

                {/* Code block */}
                <div style={{
                  background:'#080C10', border:`1px solid ${C.border}`,
                  borderRadius:'8px', padding:'14px 16px', marginBottom:'16px',
                  fontFamily:FONTS.mono, fontSize:'11px', lineHeight:1.7,
                  overflow:'auto',
                }}>
                  <div><span style={{color:'#8B949E'}}>// ❌ Problematic pattern</span></div>
                  <div><span style={{color:'#569CD6'}}>const</span><span style={{color:'#E6EDF3'}}> observer</span><span style={{color:'#8B949E'}}> = </span><span style={{color:'#569CD6'}}>new</span><span style={{color:'#E6EDF3'}}> IntersectionObserver</span><span style={{color:'#8B949E'}}>(</span><span style={{color:'#569CD6'}}>{'(e) =>'}</span><span style={{color:'#8B949E'}}>{'{'}</span></div>
                  <div><span style={{color:'#E6EDF3'}}>  {'  '}thread</span><span style={{color:'#8B949E'}}>.</span><span style={{color:'#00B4D8'}}>forceLayout</span><span style={{color:'#8B949E'}}>()</span></div>
                  <div><span style={{color:'#E6EDF3'}}>  {'  '}dom</span><span style={{color:'#8B949E'}}>.</span><span style={{color:'#00B4D8'}}>reflow</span><span style={{color:'#8B949E'}}>(</span><span style={{color:'#CE9178'}}>"sync"</span><span style={{color:'#8B949E'}}>)</span></div>
                  <div><span style={{color:'#8B949E'}}>{'}'}</span><span style={{color:'#8B949E'}}>)</span></div>
                </div>

                {/* Confidence */}
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <span style={{
                    background:'rgba(0,180,216,0.1)', color:C.teal,
                    border:`1px solid rgba(0,180,216,0.35)`, borderRadius:'4px',
                    fontFamily:FONTS.mono, fontSize:'11px', fontWeight:700,
                    letterSpacing:'0.06em', padding:'4px 12px',
                  }}>HIGH CONFIDENCE</span>
                </div>
              </div>
            </div>

            {/* Load Test Timeline Chart */}
            <div style={{
              ...cardBorder(),
              padding:'20px 24px',
              animation:'fadeUp 0.5s 0.12s both',
            }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'16px' }}>
                P50 LATENCY TIMELINE (ms)
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={CHART_DATA} margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis dataKey="t" stroke={C.muted} tick={{ fontFamily:FONTS.mono, fontSize:10, fill:C.muted }} />
                  <YAxis stroke={C.muted} tick={{ fontFamily:FONTS.mono, fontSize:10, fill:C.muted }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x="120s" stroke={C.amber} strokeDasharray="6 4"
                    label={{ value:'Chaos ↓', fill:C.amber, fontFamily:FONTS.mono, fontSize:10 }} />
                  <Line type="monotone" dataKey="base" stroke={C.green} strokeWidth={2} dot={false} name="Baseline" />
                  <Line type="monotone" dataKey="pr"   stroke={C.red}   strokeWidth={2} dot={false} name="PR Branch" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chaos Scenarios */}
            <div style={{
              ...cardBorder(),
              padding:'20px 24px',
              animation:'fadeUp 0.5s 0.18s both',
            }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'16px' }}>
                CHAOS SCENARIOS EXECUTED
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
                {CHAOS_SCENARIOS.map(cs => (
                  <div key={cs.name} style={{
                    background:'rgba(0,0,0,0.3)',
                    border:`1px solid ${C.border}`,
                    borderRadius:'8px', padding:'14px',
                  }}>
                    <div style={{ fontFamily:FONTS.heading, fontSize:'12px', fontWeight:700, color:C.text, marginBottom:'6px' }}>
                      {cs.name}
                    </div>
                    <div style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted, marginBottom:'10px' }}>
                      {cs.detail}
                    </div>
                    <span style={{
                      background:'rgba(63,185,80,0.1)', color:C.green,
                      border:`1px solid rgba(63,185,80,0.35)`, borderRadius:'4px',
                      fontFamily:FONTS.mono, fontSize:'10px', fontWeight:700,
                      letterSpacing:'0.08em', padding:'2px 8px',
                    }}>EXECUTED</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

            {/* Metrics Table */}
            <div style={{
              ...cardBorder('block'),
              padding:'20px',
              animation:'fadeUp 0.5s 0.08s both',
            }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'14px' }}>
                PERFORMANCE METRICS
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Metric','Baseline','PR','Δ'].map(h => (
                      <th key={h} style={{ fontFamily:FONTS.heading, fontSize:'9px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, padding:'0 0 8px 0', textAlign:'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_METRICS.map((m, i) => (
                    <tr key={m.name} style={{ borderTop:`1px solid ${C.border}` }}>
                      <td style={{ padding:'8px 0', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>{m.name}</td>
                      <td style={{ padding:'8px 0', fontFamily:FONTS.mono, fontSize:'11px', color:C.green }}>{m.baseline}</td>
                      <td style={{ padding:'8px 0', fontFamily:FONTS.mono, fontSize:'11px', color:m.regressed?C.red:C.text }}>{m.pr}</td>
                      <td style={{ padding:'8px 0', fontFamily:FONTS.mono, fontSize:'11px', fontWeight:700, color:m.regressed?C.red:C.muted }}>{m.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pipeline Stepper */}
            <div style={{
              ...cardBorder(),
              padding:'20px',
              animation:'fadeUp 0.5s 0.14s both',
            }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'16px' }}>
                PIPELINE EXECUTION
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
                {PIPELINE_STEPS.map((step, i) => (
                  <div key={step.name}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        {/* Checkmark circle */}
                        <div style={{
                          width:'18px', height:'18px',
                          borderRadius:'50%',
                          background: step.verdict ? 'rgba(248,81,73,0.2)' : 'rgba(63,185,80,0.15)',
                          border: step.verdict ? `1px solid ${C.red}` : `1px solid ${C.green}`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          flexShrink:0,
                        }}>
                          <span style={{ fontSize:'10px', color: step.verdict ? C.red : C.green }}>
                            {step.verdict ? '✕' : '✓'}
                          </span>
                        </div>
                        <span style={{ fontFamily:FONTS.mono, fontSize:'12px', color:step.verdict?C.red:C.text }}>
                          {step.name}
                        </span>
                      </div>
                      <span style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted }}>
                        {step.ts}
                      </span>
                    </div>
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div style={{ marginLeft:'9px', height:'12px', width:'1px', background:`rgba(63,185,80,0.2)` }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{
                borderTop:`1px solid ${C.border}`,
                paddingTop:'12px', marginTop:'8px',
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <span style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>
                  TOTAL
                </span>
                <span style={{ fontFamily:FONTS.mono, fontSize:'16px', fontWeight:700, color:C.teal }}>
                  7m 14s
                </span>
              </div>
            </div>

            {/* Stage Bar */}
            <div style={{ ...cardBorder(), padding:'16px' }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'10px' }}>
                STAGE PROGRESS
              </div>
              <StageBar activeStage={6} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px' }}>
                {STAGES_FULL.map((s, i) => (
                  <span key={s} style={{ fontFamily:FONTS.mono, fontSize:'8px', color:i===6?C.teal:C.muted, letterSpacing:'0.05em', textTransform:'uppercase' }}>
                    {s.slice(0,3)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
