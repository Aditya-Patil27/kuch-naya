import { useEffect, useState } from 'react'
import { C, FONTS, cardBorder } from '../tokens'
import { GhostBtn, ConfirmationDialog, RefreshButton } from '../components/UI'
import * as api from '../api'

export default function Runners({ setPage }) {
  const [runners, setRunners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, runnerId: null, runnerName: '' })
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    api.getRunners()
      .then(data => {
        setRunners(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const getStatusColor = (runner) => {
    if (!runner.last_seen_at) return C.muted
    const lastSeen = new Date(runner.last_seen_at)
    const now = new Date()
    const diffMs = now - lastSeen
    const diffMins = diffMs / 1000 / 60
    if (diffMins > 5) return C.red
    if (diffMins > 1) return C.amber
    return C.green
  }

  const getStatusLabel = (runner) => {
    if (!runner.last_seen_at) return 'NEVER SEEN'
    const lastSeen = new Date(runner.last_seen_at)
    const now = new Date()
    const diffMs = now - lastSeen
    const diffMins = Math.floor(diffMs / 1000 / 60)
    if (diffMins > 5) return 'OFFLINE'
    if (diffMins > 1) return 'IDLE'
    return 'ACTIVE'
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.deleteRunner(deleteDialog.runnerId)
      setRunners(prev => prev.filter(r => r.id !== deleteDialog.runnerId))
setDeleteDialog({ open: false, runnerId: null, runnerName: '' })
    } finally {
      setDeleting(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await api.getRunners()
      setRunners(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily: FONTS.mono, fontSize:'14px', color:C.muted }}>Loading runners...</div>
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
            RUNNER MANAGEMENT
          </h1>
          <p style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, marginTop:'4px' }}>
            Registered runners and their status
          </p>
        </div>

        <div style={{ marginBottom:'16px' }}>
          <RefreshButton onClick={handleRefresh} loading={refreshing} />
        </div>

        {runners.length === 0 ? (
          <div style={{ ...cardBorder(), padding:'40px', textAlign:'center' }}>
            <div style={{ fontFamily:FONTS.mono, fontSize:'14px', color:C.muted }}>No runners registered</div>
            <div style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, marginTop:'8px' }}>
              Runners will appear here when they check in via heartbeat
            </div>
          </div>
        ) : (
          <div style={{ ...cardBorder(), overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#0D1117', borderBottom:`1px solid ${C.border}` }}>
                  {['RUNNER ID','NAME','TENANT','STATUS','CAPABILITIES','LAST SEEN','CREATED','ACTIONS'].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runners.map((runner, i) => {
                  const statusColor = getStatusColor(runner)
                  const statusLabel = getStatusLabel(runner)
                  return (
                    <tr key={runner.id} style={{ background:i%2===1?'rgba(0,0,0,0.15)':'transparent', borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'12px', fontWeight:700, color:C.teal }}>{runner.id}</td>
                      <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>{runner.name}</td>
                      <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>{runner.tenant_id || 'default'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{
                          background:`${statusColor}20`,
                          color:statusColor,
                          border:`1px solid ${statusColor}`,
                          borderRadius:'4px',
                          padding:'3px 8px',
                          fontFamily:FONTS.mono,
                          fontSize:'10px',
                          fontWeight:700,
                        }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>
                        {runner.capabilities ? Object.keys(runner.capabilities).join(', ') : 'none'}
                      </td>
                      <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>
                        {runner.last_seen_at ? new Date(runner.last_seen_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>
                        {runner.created_at ? new Date(runner.created_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <button
                          onClick={() => setDeleteDialog({ open: true, runnerId: runner.id, runnerName: runner.name })}
                          style={{
                            padding:'4px 10px',
                            background:'transparent',
                            border:`1px solid ${C.red}`,
                            borderRadius:'4px',
                            color:C.red,
                            fontFamily:FONTS.mono,
                            fontSize:'10px',
                            cursor:'pointer',
                          }}
                        >
                          DELETE
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={deleteDialog.open}
        title="Delete Runner"
        message={`Are you sure you want to delete runner "${deleteDialog.runnerName}"?`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, runnerId: null, runnerName: '' })}
        danger
      />
    </div>
  )
}