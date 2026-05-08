import { useEffect, useState, useMemo, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { C, FONTS, cardBorder } from '../tokens'
import { VerdictPill, StageBar, GhostBtn } from '../components/UI'
import * as api from '../api'

const STAGES_FULL = ['QUEUED','DIFF','BASELINE','TOXIPROXY','CHAOS','ANALYZE','REPORT']

const STAGES_SHORT = ['QUEUED','DIFF','BASE','TOXI','CHAOS','ANALYZE','REPORT']

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
      <div style={{ color:C.red   }}>PR:   {payload[1]?.value}ms</div>
    </div>
  )
}

export default function JobDetail({ setPage, jobId }) {
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retrying, setRetrying] = useState(false)
  const [retrySuccess, setRetrySuccess] = useState(false)
  const [nowMs] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    
    if (!jobId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    api.getJob(jobId)
      .then(data => {
        if (!cancelled) {
          setJob(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [jobId])

  const timeoutRef = useRef(null)

  const handleRetry = async () => {
    if (!jobId) return
    setRetrying(true)
    setError(null)
    try {
      await api.retryJob(jobId)
      setRetrySuccess(true)
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(async () => {
        setRetrySuccess(false)
        try {
          const updatedJob = await api.getJob(jobId)
          setJob(updatedJob)
        } catch {
          // Ignore refresh errors
        }
      }, 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const chartData = useMemo(() => {
    if (!job) return []
    const baseline = Number(job.p99_baseline) || 50
    const pr = Number(job.p99_pr) || baseline
    const points = []
    for (let i = 0; i <= 7; i++) {
      const t = `${i * 30}s`
      const baseVal = baseline + Math.sin(i * 0.5) * 5
      const prVal = pr * (0.3 + 0.7 * Math.min(1, i / 4))
      points.push({ t, base: Math.round(baseVal), pr: Math.round(prVal) })
    }
    return points
  }, [job])

  const durationSecs = useMemo(() => {
    if (!job?.created_at || !job?.completed_at) return 0
    const created = new Date(job.created_at).getTime()
    const completed = new Date(job.completed_at).getTime()
    return Math.max(0, Math.round((completed - created) / 1000))
  }, [job])

  const status = String(job?.status || '').toLowerCase()
  const verdict = job?.verdict || (status === 'failed' ? 'BLOCK' : status === 'completed' ? 'PASS' : 'RUNNING')
  const stage = Number(job?.stage ?? (status === 'queued' ? 0 : status === 'running' ? 2 : 6))
  const progress = Number(job?.progress ?? (status === 'queued' ? 10 : status === 'running' ? 60 : 100))

  if (loading) {
    return (
      <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily: FONTS.mono, fontSize:'14px', color:C.muted }}>Loading job details...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh', padding:'28px' }}>
        <GhostBtn onClick={() => setPage('dashboard')}>← BACK TO DASHBOARD</GhostBtn>
        <div style={{ marginTop:'24px', padding:'20px', background:'rgba(248,81,73,0.1)', border:`1px solid ${C.red}`, borderRadius:'8px' }}>
          <div style={{ fontFamily: FONTS.mono, fontSize:'14px', color:C.red }}>Error loading job: {error}</div>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh', padding:'28px' }}>
        <GhostBtn onClick={() => setPage('dashboard')}>← BACK TO DASHBOARD</GhostBtn>
        <div style={{ marginTop:'24px', padding:'20px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px' }}>
          <div style={{ fontFamily: FONTS.mono, fontSize:'14px', color:C.muted }}>No job selected. Click a job from the dashboard.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh' }}>
      <div style={{
        position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
        background:'radial-gradient(ellipse 80% 50% at -10% -20%, rgba(0,180,216,0.03) 0%, transparent 60%)',
      }} />

      <div style={{ position:'relative', zIndex:1, padding:'28px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'28px' }}>
          <GhostBtn onClick={() => setPage('dashboard')}>
            ← BACK TO DASHBOARD
          </GhostBtn>

          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, marginBottom:'3px' }}>
              PR #{job.pr_number || '—'} · {job.repo || 'pending/repo'}
            </div>
            <div style={{ fontFamily:FONTS.heading, fontSize:'14px', color:C.text }}>
              Job ID: {job.id}
            </div>
          </div>

          <VerdictPill verdict={verdict} large />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:'20px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div style={{
              ...cardBorder(),
              padding:'20px 24px',
              animation:'fadeUp 0.5s 0.05s both',
            }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'16px' }}>
                JOB DETAILS
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                <div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>Job ID</div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.teal }}>{job.id}</div>
                </div>
                <div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>Repository</div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>{job.repo || '—'}</div>
                </div>
                <div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>PR Number</div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>#{job.pr_number || '—'}</div>
                </div>
                <div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>Status</div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.teal, textTransform:'uppercase' }}>{job.status || 'unknown'}</div>
                </div>
                <div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>Created</div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>
                    {job.created_at ? new Date(job.created_at).toLocaleString() : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>Completed</div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>
                    {job.completed_at ? new Date(job.completed_at).toLocaleString() : job.status === 'completed' ? '—' : 'In Progress'}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>Run Mode</div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>{job.run_mode || 'single'}</div>
                </div>
                <div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>Shards</div>
                  <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>{job.shard_count || 1}</div>
                </div>
              </div>
            </div>

            {job.findings && (
              <div style={{
                ...cardBorder(verdict === 'BLOCK' ? 'block' : verdict === 'PASS' ? 'pass' : 'default'),
                padding:'20px 24px',
                animation:'fadeUp 0.5s 0.08s both',
              }}>
                <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'16px' }}>
                  AI ANALYSIS
                </div>
                {job.findings.summary && (
                  <div style={{ fontFamily:FONTS.heading, fontSize:'13px', color:C.text, marginBottom:'12px', lineHeight:1.6 }}>
                    {job.findings.summary}
                  </div>
                )}
                {job.findings.mechanism && (
                  <div style={{ marginBottom:'12px' }}>
                    <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px', letterSpacing:'0.08em', textTransform:'uppercase' }}>Mechanism</div>
                    <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>{job.findings.mechanism}</div>
                  </div>
                )}
                {job.findings.suggestedFix && (
                  <div style={{ marginBottom:'12px' }}>
                    <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px', letterSpacing:'0.08em', textTransform:'uppercase' }}>Suggested Fix</div>
                    <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.text, background:'#080C10', padding:'12px', borderRadius:'6px' }}>
                      <code>{job.findings.suggestedFix}</code>
                    </div>
                  </div>
                )}
                {job.findings.confidence && (
                  <div style={{ display:'flex', justifyContent:'flex-end' }}>
                    <span style={{
                      background:'rgba(0,180,216,0.1)', color:C.teal,
                      border:`1px solid rgba(0,180,216,0.35)`, borderRadius:'4px',
                      fontFamily:FONTS.mono, fontSize:'11px', fontWeight:700,
                      letterSpacing:'0.06em', padding:'4px 12px',
                    }}>CONFIDENCE: {job.findings.confidence}</span>
                  </div>
                )}
                {job.findings.provider && (
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'8px' }}>
                    <span style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted }}>
                      Provider: {job.findings.provider}
                    </span>
                  </div>
                )}
              </div>
            )}

            {job.p99_baseline && job.p99_pr && (
              <div style={{
                ...cardBorder(),
                padding:'20px 24px',
                animation:'fadeUp 0.5s 0.12s both',
              }}>
                <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'16px' }}>
                  P99 LATENCY TIMELINE
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                    <XAxis dataKey="t" stroke={C.muted} tick={{ fontFamily:FONTS.mono, fontSize:10, fill:C.muted }} />
                    <YAxis stroke={C.muted} tick={{ fontFamily:FONTS.mono, fontSize:10, fill:C.muted }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="base" stroke={C.green} strokeWidth={2} dot={false} name="Baseline" />
                    <Line type="monotone" dataKey="pr"   stroke={C.red}   strokeWidth={2} dot={false} name="PR Branch" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div style={{
              ...cardBorder(),
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
                  <tr style={{ borderTop:`1px solid ${C.border}` }}>
                    <td style={{ padding:'8px 0', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>P99 Latency</td>
                    <td style={{ padding:'8px 0', fontFamily:FONTS.mono, fontSize:'11px', color:C.green }}>{job.p99_baseline ? `${Number(job.p99_baseline).toFixed(2)}ms` : '—'}</td>
                    <td style={{ padding:'8px 0', fontFamily:FONTS.mono, fontSize:'11px', color:C.text }}>{job.p99_pr ? `${Number(job.p99_pr).toFixed(2)}ms` : '—'}</td>
                    <td style={{ padding:'8px 0', fontFamily:FONTS.mono, fontSize:'11px', fontWeight:700, color:job.p99_delta_pct > 0 ? C.red : C.green }}>
                      {job.p99_delta_pct ? `${job.p99_delta_pct >= 0 ? '+' : ''}${Number(job.p99_delta_pct).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{
              ...cardBorder(),
              padding:'20px',
              animation:'fadeUp 0.5s 0.14s both',
            }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'11px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'16px' }}>
                EXECUTION STATUS
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>Status</span>
                  <span style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.teal, textTransform:'uppercase' }}>{job.status || 'unknown'}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>Verdict</span>
                  <span style={{ fontFamily:FONTS.mono, fontSize:'11px', color:verdict === 'PASS' ? C.green : verdict === 'BLOCK' ? C.red : C.amber, textTransform:'uppercase' }}>{verdict}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>Attempts</span>
                  <span style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.text }}>{job.attempt_count || 0}</span>
                </div>
                {job.last_error && (
                  <div style={{ padding:'8px 0' }}>
                    <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'4px' }}>Last Error</div>
                    <div style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.red }}>{job.last_error}</div>
                  </div>
                )}
                {(job.status === 'failed' || job.status === 'dead-letter') && (
                  <div style={{ marginTop:'16px' }}>
                    <button
                      onClick={handleRetry}
                      disabled={retrying}
                      style={{
                        width:'100%',
                        padding:'10px 16px',
                        background: retrySuccess ? C.green : C.teal,
                        color: '#0D1117',
                        border:'none',
                        borderRadius:'6px',
                        fontFamily:FONTS.mono,
                        fontSize:'12px',
                        fontWeight:700,
                        cursor: retrying ? 'not-allowed' : 'pointer',
                        opacity: retrying ? 0.6 : 1,
                        transition:'all 0.2s',
                      }}
                    >
                      {retrySuccess ? '✓ RETRY QUEUED' : retrying ? 'QUEUING...' : 'RETRY JOB'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ ...cardBorder(), padding:'16px' }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'10px' }}>
                STAGE PROGRESS
              </div>
              <StageBar activeStage={stage} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px' }}>
                {STAGES_FULL.map((s, i) => (
                  <span key={s} style={{ fontFamily:FONTS.mono, fontSize:'8px', color:i===stage?C.teal:C.muted, letterSpacing:'0.05em', textTransform:'uppercase' }}>
                    {s.slice(0,3)}
                  </span>
                ))}
              </div>
            </div>

            {durationSecs > 0 && (
              <div style={{
                borderTop:`1px solid ${C.border}`,
                paddingTop:'12px', marginTop:'8px',
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <span style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>
                  TOTAL DURATION
                </span>
                <span style={{ fontFamily:FONTS.mono, fontSize:'16px', fontWeight:700, color:C.teal }}>
                  {Math.floor(durationSecs / 60)}m {durationSecs % 60}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}