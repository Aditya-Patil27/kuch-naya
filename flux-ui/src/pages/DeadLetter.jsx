import { useEffect, useState, useMemo } from 'react'
import { C, FONTS, cardBorder } from '../tokens'
import { VerdictPill, GhostBtn, PrimaryBtn } from '../components/UI'
import * as api from '../api'

export default function DeadLetter({ setPage }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryingId, setRetryingId] = useState(null)

  useEffect(() => {
    api.getDeadLetterJobs()
      .then(data => {
        setJobs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const handleRetry = async (jobId) => {
    setRetryingId(jobId)
    try {
      await api.retryJob(jobId)
      setJobs(prev => prev.filter(j => j.job_id !== jobId))
    } catch (err) {
      setError(err.message)
    } finally {
      setRetryingId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily: FONTS.mono, fontSize:'14px', color:C.muted }}>Loading dead letter jobs...</div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh' }}>
      <div style={{ padding:'28px' }}>
        <div style={{ marginBottom:'24px' }}>
          <GhostBtn onClick={() => setPage('dashboard')}>← BACK TO DASHBOARD</GhostBtn>
        </div>

        {error && (
          <div style={{ marginBottom:'16px', padding:'12px 16px', background:'rgba(248,81,73,0.1)', border:`1px solid ${C.red}`, borderRadius:'6px' }}>
            <span style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.red }}>{error}</span>
          </div>
        )}

        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontFamily:FONTS.heading, fontSize:'22px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.text }}>
            DEAD LETTER QUEUE
          </h1>
          <p style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, marginTop:'4px' }}>
            Failed jobs that require manual intervention
          </p>
        </div>

        {jobs.length === 0 ? (
          <div style={{ ...cardBorder(), padding:'40px', textAlign:'center' }}>
            <div style={{ fontFamily:FONTS.mono, fontSize:'14px', color:C.green }}>No dead letter jobs</div>
            <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, marginTop:'8px' }}>
              All jobs completed successfully
            </div>
          </div>
        ) : (
          <div style={{ ...cardBorder(), overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#0D1117', borderBottom:`1px solid ${C.border}` }}>
                  {['JOB ID','REPO','PR','TENANT','REASON','MOVED AT','ACTIONS'].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr key={job.job_id} style={{ background:i%2===1?'rgba(0,0,0,0.15)':'transparent', borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'12px', fontWeight:700, color:C.red }}>{job.job_id}</td>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>{job.repo || '—'}</td>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>#{job.pr_number || '—'}</td>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>{job.tenant_id || 'default'}</td>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:C.red, maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={job.reason}>
                      {job.reason || 'Unknown error'}
                    </td>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>
                      {job.moved_at ? new Date(job.moved_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <button
                        onClick={() => handleRetry(job.job_id)}
                        disabled={retryingId === job.job_id}
                        style={{
                          padding:'6px 12px',
                          background:C.teal,
                          color:'#0D1117',
                          border:'none',
                          borderRadius:'4px',
                          fontFamily:FONTS.mono,
                          fontSize:'11px',
                          fontWeight:700,
                          cursor: retryingId === job.job_id ? 'not-allowed' : 'pointer',
                          opacity: retryingId === job.job_id ? 0.6 : 1,
                        }}
                      >
                        {retryingId === job.job_id ? '...' : 'RETRY'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}