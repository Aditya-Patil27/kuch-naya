import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { C, FONTS, cardBorder } from '../tokens'
import { VerdictPill, StageBar } from '../components/UI'
import { useJobs } from '../useJobs'

const FILTERS = ['ALL','ACTIVE','COMPLETED','FAILED','BLOCKED']
const PAGE_SIZE = 10

const DAILY_VOLUME = [
  { day:'Mon', count:23 },
  { day:'Tue', count:18 },
  { day:'Wed', count:31 },
  { day:'Thu', count:27 },
  { day:'Fri', count:42 },
  { day:'Sat', count:14 },
  { day:'Sun', count:8  },
]

function ElapsedCounter({ startSecs }) {
  const [secs, setSecs] = useState(startSecs)
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return (
    <span style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.teal }}>
      {m}m {String(s).padStart(2,'0')}s
    </span>
  )
}

export default function JobsQueue({ setPage }) {
  const { jobs } = useJobs()
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const allJobs = useMemo(() => (
    jobs.map((job) => {
      const status = String(job.status || '').toLowerCase()

      let verdict = 'RUNNING'
      if (status === 'failed') verdict = 'FAILED'
      if (status === 'completed') verdict = String(job.verdict || 'PASS').toUpperCase()

      const created = job.created_at ? new Date(job.created_at).getTime() : nowMs
      const completed = job.completed_at ? new Date(job.completed_at).getTime() : nowMs
      const durationSecs = Math.max(0, Math.round((completed - created) / 1000))
      const mins = Math.floor(durationSecs / 60)
      const secs = durationSecs % 60

      const ageSecs = Math.max(0, Math.round((nowMs - created) / 1000))
      const time = ageSecs < 60 ? `${ageSecs}s ago` : `${Math.floor(ageSecs / 60)}m ago`

      return {
        id: job.id,
        pr: job.pr_number ? `#${job.pr_number}` : '#—',
        repo: job.repo || 'pending/repo',
        verdict,
        p99: typeof job.p99_delta_pct === 'number' ? `${job.p99_delta_pct >= 0 ? '+' : ''}${job.p99_delta_pct.toFixed(1)}%` : '—',
        dur: `${mins}m ${String(secs).padStart(2, '0')}s`,
        time,
        stage: Number(job.stage ?? (status === 'queued' ? 0 : status === 'running' ? 2 : 6)),
        progress: Number(job.progress ?? (status === 'queued' ? 10 : status === 'running' ? 60 : 100)),
        elapsed: Math.max(0, Math.round((nowMs - created) / 1000)),
      }
    })
  ), [jobs, nowMs])

  const filtered = useMemo(() => allJobs.filter(j => {
    if (filter === 'ACTIVE' && j.verdict !== 'RUNNING') return false
    if (filter === 'BLOCKED' && j.verdict !== 'BLOCK') return false
    if (filter === 'FAILED'  && j.verdict !== 'FAILED')  return false
    if (filter === 'COMPLETED' && ['RUNNING'].includes(j.verdict)) return false
    if (search && !j.id.toLowerCase().includes(search.toLowerCase()) &&
        !j.pr.toLowerCase().includes(search.toLowerCase()) &&
        !j.repo.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [allJobs, filter, search])

  const activeJobs = useMemo(() => allJobs.filter(j => j.verdict === 'RUNNING'), [allJobs])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = currentPage > totalPages ? totalPages : currentPage
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pagedJobs = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  const completedJobs = allJobs.filter((j) => j.verdict !== 'RUNNING')
  const passCount = completedJobs.filter((j) => j.verdict === 'PASS').length
  const blockedCount = completedJobs.filter((j) => j.verdict === 'BLOCK').length
  const avgDurationSecs = completedJobs.length
    ? Math.round(completedJobs.reduce((sum, j) => {
      const [m, s] = String(j.dur || '0m 00s').replace('m', '').replace('s', '').split(' ')
      return sum + (Number(m) * 60 + Number(s))
    }, 0) / completedJobs.length)
    : 0
  const avgDurationLabel = `${Math.floor(avgDurationSecs / 60)}m ${String(avgDurationSecs % 60).padStart(2, '0')}s`
  const passRate = completedJobs.length ? `${((passCount / completedJobs.length) * 100).toFixed(1)}%` : '0.0%'

  return (
    <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh' }}>
      <div style={{ padding:'28px' }}>

        {/* Page header */}
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontFamily:FONTS.heading, fontSize:'22px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.text }}>
            JOB QUEUE
          </h1>
          <p style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, marginTop:'4px' }}>
            All chaos review jobs · Real-time status
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:'24px', alignItems:'start' }}>

          {/* LEFT — main content */}
          <div>
            {/* Filter bar */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px', flexWrap:'wrap' }}>
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f)
                    setCurrentPage(1)
                  }}
                  style={{
                    fontFamily:    FONTS.heading,
                    fontSize:      '12px',
                    fontWeight:    600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding:       '6px 16px',
                    borderRadius:  '6px',
                    cursor:        'pointer',
                    border:        filter===f ? `1px solid rgba(0,180,216,0.5)` : `1px solid ${C.border}`,
                    background:    filter===f ? 'rgba(0,180,216,0.1)' : 'transparent',
                    color:         filter===f ? C.teal : C.muted,
                    transition:    'all 0.15s',
                  }}
                >
                  {f}
                </button>
              ))}
              <div style={{ marginLeft:'auto', position:'relative' }}>
                <input
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder="Search job ID, PR, repo…"
                  style={{
                    background:   C.surface,
                    border:       `1px solid ${C.border}`,
                    borderRadius: '6px',
                    padding:      '6px 14px',
                    fontFamily:   FONTS.mono,
                    fontSize:     '12px',
                    color:        C.text,
                    width:        '240px',
                    transition:   'box-shadow 0.2s',
                  }}
                />
              </div>
            </div>

            {/* Active jobs horizontal scroll */}
            {activeJobs.length > 0 && (
              <div style={{ marginBottom:'24px' }}>
                <div style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'12px' }}>
                  ACTIVE NOW — {activeJobs.length} JOB{activeJobs.length>1?'S':''}
                </div>
                <div style={{ display:'flex', gap:'14px', overflowX:'auto', paddingBottom:'8px' }}>
                  {activeJobs.map(job => (
                    <div key={job.id} style={{
                      ...cardBorder('active'),
                      padding:'16px', minWidth:'260px', maxWidth:'280px',
                      background:'#0D1117',
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
                        <div>
                          <div style={{ fontFamily:FONTS.mono, fontSize:'12px', fontWeight:700, color:C.teal }}>{job.id}</div>
                          <div style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>{job.pr} · {job.repo}</div>
                        </div>
                        {job.elapsed && <ElapsedCounter startSecs={job.elapsed} />}
                      </div>
                      <StageBar activeStage={job.stage || 0} />
                      <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.teal, marginTop:'5px' }}>
                        {['QUEUED','PROVISIONING','RUNNING','CHAOS','ANALYZING','REPORTING','DONE'][job.stage||0]}
                      </div>
                      {job.progress && (
                        <div style={{ marginTop:'8px', height:'3px', borderRadius:'2px', background:'rgba(48,54,61,0.5)', overflow:'hidden' }}>
                          <div className="progress-bar-fill" style={{ width:`${job.progress}%` }} />
                        </div>
                      )}
                      <div style={{ marginTop:'10px' }}>
                        <button className="btn-ghost-flux" style={{ padding:'4px 10px', width:'100%', textAlign:'center' }}>
                          CANCEL
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History table */}
            <div style={{ ...cardBorder(), overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#0D1117', borderBottom:`1px solid ${C.border}` }}>
                    {['JOB ID','PR','REPO','VERDICT','P99 Δ','DURATION','TIME','ACTIONS'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontFamily:FONTS.heading, fontSize:'9px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedJobs.map((job, i) => (
                    <tr key={job.id} className="tbl-row"
                      style={{ background:i%2===1?'rgba(0,0,0,0.15)':'transparent', borderBottom:`1px solid ${C.border}`, animation:`fadeUp 0.35s ${i*0.04}s both` }}
                      onClick={() => setPage('job-detail')}>
                      <td style={{ padding:'10px 14px', fontFamily:FONTS.mono, fontSize:'12px', fontWeight:700, color:C.teal }}>{job.id}</td>
                      <td style={{ padding:'10px 14px', fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>{job.pr}</td>
                      <td style={{ padding:'10px 14px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>{job.repo}</td>
                      <td style={{ padding:'10px 14px' }}><VerdictPill verdict={job.verdict} /></td>
                      <td style={{ padding:'10px 14px', fontFamily:FONTS.mono, fontSize:'12px', fontWeight:700, color:job.verdict==='BLOCK'||job.verdict==='FAILED'?C.red:job.verdict==='PASS'?C.green:C.muted }}>{job.p99}</td>
                      <td style={{ padding:'10px 14px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>{job.dur}</td>
                      <td style={{ padding:'10px 14px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>{job.time}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', gap:'6px' }} onClick={e=>e.stopPropagation()}>
                          <button style={{ background:'none',border:'none',cursor:'pointer',fontSize:'14px',opacity:0.7 }} title="View Detail">🔍</button>
                          <button style={{ background:'none',border:'none',cursor:'pointer',fontSize:'14px',opacity:0.7 }} title="GitHub">🐙</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display:'flex', justifyContent:'center', gap:'6px', marginTop:'16px' }}>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).slice(0, 10).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)} style={{
                  width:'32px', height:'32px',
                  borderRadius:'6px',
                  border: safePage===p ? `1px solid ${C.teal}` : `1px solid ${C.border}`,
                  background: safePage===p ? 'rgba(0,180,216,0.1)' : 'transparent',
                  color: safePage===p ? C.teal : C.muted,
                  fontFamily: FONTS.mono,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>{p}</button>
              ))}
            </div>
          </div>

          {/* RIGHT — stats sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            {/* Quick stats */}
            <div style={{ ...cardBorder(), padding:'20px' }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'14px' }}>
                QUICK STATS
              </div>
              {[
                { label:'Total Jobs',    value:String(allJobs.length), color:C.teal },
                { label:'Pass Rate',     value:passRate, color:C.green },
                { label:'Avg Duration',  value:avgDurationLabel, color:C.text },
                { label:'Blocked Jobs',  value:String(blockedCount), color:C.red },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>{s.label}</span>
                  <span style={{ fontFamily:FONTS.mono, fontSize:'14px', fontWeight:700, color:s.color }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Top regression */}
            <div style={{ ...cardBorder('block'), padding:'16px' }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'10px' }}>
                WORST REGRESSION
              </div>
              <div style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.teal, marginBottom:'4px' }}>PR #406</div>
              <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted, marginBottom:'8px' }}>ui/dashboard</div>
              <div style={{ fontFamily:FONTS.mono, fontSize:'24px', fontWeight:700, color:C.red }}>+347%</div>
              <div style={{ fontFamily:FONTS.mono, fontSize:'10px', color:C.muted }}>P50 regression</div>
            </div>

            {/* Daily volume bar chart */}
            <div style={{ ...cardBorder(), padding:'16px' }}>
              <div style={{ fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted, marginBottom:'14px' }}>
                DAILY VOLUME
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={DAILY_VOLUME} margin={{ top:2, right:2, bottom:2, left:-30 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" stroke={C.muted} tick={{ fontFamily:FONTS.mono, fontSize:10, fill:C.muted }} />
                  <YAxis stroke={C.muted} tick={{ fontFamily:FONTS.mono, fontSize:10, fill:C.muted }} />
                  <Bar dataKey="count" fill={C.teal} fillOpacity={0.7} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
