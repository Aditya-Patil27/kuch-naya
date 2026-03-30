import { useEffect } from 'react'
import { C, FONTS, cardBorder } from '../tokens'
import ThreeScene from '../components/ThreeScene'
import { VerdictPill, StageBar, StatCard, SectionHeader, StatusDot } from '../components/UI'
import { useJobs } from '../useJobs'

// Live elapsed counter component
function ElapsedCounter({ startSecs }) {
  const [secs, setSecs] = useState(startSecs)
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return (
    <span style={{ fontFamily: FONTS.mono, fontSize: '11px', color: C.teal, animation:'counter-tick 1s infinite' }}>
      {m}m {String(s).padStart(2,'0')}s
    </span>
  )
}

// P99 delta coloring
function DeltaCell({ delta }) {
  const regressed = delta.startsWith('+') && delta !== '+0ms'
  const improved  = delta.startsWith('-')
  const color = regressed ? C.red : improved ? C.green : C.muted
  return (
    <span style={{ fontFamily: FONTS.mono, fontSize: '12px', fontWeight: 700, color }}>
      {delta}
    </span>
  )
}

export default function Dashboard({ setPage }) {
  const { jobs, activeJobs, completedJobs, blockedCount } = useJobs()

  const runs = jobs.slice(0, 10).map((job) => {
    const status = String(job.status || '').toLowerCase()
    const verdict = String(job.verdict || (status === 'failed' ? 'BLOCK' : status === 'completed' ? 'PASS' : 'RUNNING')).toUpperCase()
    const delta = job.p99_delta_pct
    const p99 = typeof delta === 'number' ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%` : '—'

    const created = job.created_at ? new Date(job.created_at).getTime() : Date.now()
    const completed = job.completed_at ? new Date(job.completed_at).getTime() : Date.now()
    const durationSecs = Math.max(0, Math.round((completed - created) / 1000))
    const mins = Math.floor(durationSecs / 60)
    const secs = durationSecs % 60

    const ageSecs = Math.max(0, Math.round((Date.now() - created) / 1000))
    const age = ageSecs < 60 ? `${ageSecs}s ago` : `${Math.floor(ageSecs / 60)}m ago`

    return {
      id: job.id,
      pr: job.pr_number ? `#${job.pr_number}` : '#—',
      title: job.repo || 'pending/repo',
      verdict,
      p99,
      dur: `${mins}m ${String(secs).padStart(2, '0')}s`,
      time: age,
    }
  })

  const counts = {
    tested: completedJobs.length,
    chaos: jobs.filter((j) => typeof j.p99_delta_pct === 'number').length,
    blocked: blockedCount,
    active: activeJobs.length,
  }

  return (
    <div style={{ paddingTop: '56px', background: '#0D1117', minHeight: '100vh' }}>

      {/* Background layers */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(ellipse 80% 50% at -10% -20%, rgba(0,180,216,0.04) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 110% -10%, rgba(248,81,73,0.025) 0%, transparent 60%)
        `,
      }} />
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(0,180,216,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,180,216,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '36px 36px',
      }} />

      <div style={{ position:'relative', zIndex: 1 }}>
        {/* 3D Hero ──────────────────────────────────────────────── */}
        <ThreeScene />

        {/* Stats Row ────────────────────────────────────────────── */}
        <div style={{ padding: '0 28px 28px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'32px' }}>
            <StatCard className="stat-card-1" label="PRs Tested"     value={counts.tested}  sub="This month"         color={C.teal}  />
            <StatCard className="stat-card-2" label="Active Jobs"    value={counts.active}  sub="Running now"        color={C.teal}  spinning={counts.active > 0} />
            <StatCard className="stat-card-3" label="Chaos Events"   value={counts.chaos}   sub="Triggered today"    color={C.amber} />
            <StatCard className="stat-card-4" label="Blocked Merges" value={counts.blocked} sub="Pending review"     color={C.red}   />
          </div>

          {/* Two-column main ──────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:'20px', alignItems:'start' }}>

            {/* PR Analyses Table (left 60%) */}
            <div>
              <SectionHeader title="Recent PR Analyses" action="REFRESH" onAction={() => {}} />
              <div style={{
                ...cardBorder(),
                overflow:'hidden',
              }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0D1117', borderBottom:`1px solid ${C.border}` }}>
                      {['PR','TITLE','VERDICT','P99 Δ','DURATION','TIME'].map(h => (
                        <th key={h} style={{
                          padding: '10px 16px',
                          textAlign: 'left',
                          fontFamily: FONTS.heading,
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: C.muted,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r, i) => (
                      <tr
                        key={r.id || `${r.pr}-${i}`}
                        className="tbl-row"
                        onClick={() => setPage('job-detail')}
                        style={{
                          background: i % 2 === 1 ? 'rgba(0,0,0,0.15)' : 'transparent',
                          borderBottom: `1px solid ${C.border}`,
                          animation: `fadeUp 0.4s ${i * 0.04}s both`,
                        }}
                      >
                        <td style={{ padding:'11px 16px', fontFamily:FONTS.mono, fontSize:'13px', fontWeight:700, color:C.teal, whiteSpace:'nowrap' }}>
                          {r.pr}
                        </td>
                        <td style={{ padding:'11px 16px', fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, maxWidth:'220px' }}>
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                            {r.title}
                          </span>
                        </td>
                        <td style={{ padding:'11px 16px' }}>
                          <VerdictPill verdict={r.verdict} />
                        </td>
                        <td style={{ padding:'11px 16px' }}>
                          <DeltaCell delta={r.p99} />
                        </td>
                        <td style={{ padding:'11px 16px', fontFamily:FONTS.mono, fontSize:'12px', color:C.muted }}>
                          {r.dur}
                        </td>
                        <td style={{ padding:'11px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>
                          {r.time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Job Queue (right) */}
            <div>
              <SectionHeader title="Active Jobs" />
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {activeJobs.map((job, i) => {
                  const stage = Number(job.stage ?? (String(job.status || '').toLowerCase() === 'queued' ? 0 : 2))
                  const progress = Number(job.progress ?? (String(job.status || '').toLowerCase() === 'queued' ? 10 : 55))
                  const created = job.created_at ? new Date(job.created_at).getTime() : Date.now()
                  const elapsed = Math.max(0, Math.round((Date.now() - created) / 1000))

                  return (
                  <div key={job.id} style={{
                    background: '#0D1117',
                    ...cardBorder('active'),
                    padding: '16px',
                    animation: `fadeUp 0.5s ${0.1+i*0.1}s both`,
                  }}>
                    {/* Job header */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                      <div>
                        <span style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.teal, fontWeight:700 }}>
                          {job.id}
                        </span>
                        <div style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted, marginTop:'2px' }}>
                          #{job.pr_number || '—'} · {job.repo || 'pending/repo'}
                        </div>
                      </div>
                      <ElapsedCounter startSecs={elapsed} />
                    </div>

                    {/* Stage bar */}
                    <StageBar activeStage={stage} />
                    <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.teal, marginTop:'6px', letterSpacing:'0.08em' }}>
                      {['QUEUED','PROVISIONING','RUNNING','CHAOS','ANALYZING','REPORTING','DONE'][stage]}
                    </div>

                    {/* Progress bar */}
                    <div style={{
                      marginTop:'10px',
                      height:'4px',
                      borderRadius:'2px',
                      background:'rgba(48,54,61,0.5)',
                      overflow:'hidden',
                    }}>
                      <div className="progress-bar-fill" style={{ width:`${progress}%` }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:'5px' }}>
                      <span style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted }}>Progress</span>
                      <span style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.teal }}>{progress}%</span>
                    </div>
                  </div>
                )})}

                {activeJobs.length === 0 && (
                  <div style={{ textAlign:'center', padding:'32px', color:C.muted, fontFamily:FONTS.mono, fontSize:'12px' }}>
                    No active jobs
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* System Health Footer ─────────────────────────────── */}
          <div style={{
            marginTop: '24px',
            background: C.surface,
            borderRadius: '10px',
            border: `1px solid ${C.border}`,
            padding: '16px 24px',
            display: 'flex',
            gap: '32px',
            alignItems: 'center',
          }}>
            <span style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginRight:'8px' }}>
              SYSTEM
            </span>
            <StatusDot color={C.green}  label="Redis"       status="OPERATIONAL" />
            <StatusDot color={C.green}  label="Worker Pool" status="12/16 ACTIVE" />
            <StatusDot color={C.green}  label="Docker"      status="HEALTHY" />
            <StatusDot color={C.amber}  label="Ollama API"  status="HIGH LOAD" />
            <div style={{ marginLeft:'auto', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>
              Cost/min: <span style={{ color:C.teal }}>$0.47</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
