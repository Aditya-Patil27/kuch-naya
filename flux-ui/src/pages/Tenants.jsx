import { useEffect, useState } from 'react'
import { C, FONTS, cardBorder } from '../tokens'
import { GhostBtn, PrimaryBtn, ConfirmationDialog, RefreshButton } from '../components/UI'
import * as api from '../api'

export default function Tenants({ setPage }) {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGithubOrg, setNewGithubOrg] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, tenantId: null, tenantName: '' })
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    api.getTenants()
      .then(data => {
        setTenants(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    
    setCreating(true)
    try {
      const created = await api.createTenant({ name: newName, githubOrg: newGithubOrg || null })
      setTenants(prev => [...prev, created])
      setNewName('')
      setNewGithubOrg('')
      setShowCreate(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.deleteTenant(deleteDialog.tenantId)
      setTenants(prev => prev.filter(t => t.id !== deleteDialog.tenantId))
setDeleteDialog({ open: false, tenantId: null, tenantName: '' })
    } finally {
      setDeleting(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await api.getTenants()
      setTenants(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }
  }

  if (loading) {
    return (
      <div style={{ paddingTop:'56px', background:'#0D1117', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily: FONTS.mono, fontSize:'14px', color:C.muted }}>Loading tenants...</div>
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

        <div style={{ marginBottom:'24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h1 style={{ fontFamily:FONTS.heading, fontSize:'22px', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:C.text }}>
              TENANT MANAGEMENT
            </h1>
            <p style={{ fontFamily:FONTS.mono, fontSize:'12px', color:C.muted, marginTop:'4px' }}>
              Manage multi-tenant organizations
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
            <PrimaryBtn onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? 'CANCEL' : '+ NEW TENANT'}
            </PrimaryBtn>
          </div>
        </div>

        {showCreate && (
          <div style={{ ...cardBorder(), padding:'24px', marginBottom:'24px' }}>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom:'16px' }}>
                <div style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted, marginBottom:'6px' }}>TENANT NAME *</div>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g., Acme Corp"
                  style={{
                    width:'100%',
                    padding:'10px 14px',
                    background:C.surface,
                    border:`1px solid ${C.border}`,
                    borderRadius:'6px',
                    fontFamily:FONTS.mono,
                    fontSize:'13px',
                    color:C.text,
                  }}
                />
              </div>
              <div style={{ marginBottom:'16px' }}>
                <div style={{ fontFamily:FONTS.mono, fontSize:'11px', color:C.muted, marginBottom:'6px' }}>GITHUB ORGANIZATION (OPTIONAL)</div>
                <input
                  type="text"
                  value={newGithubOrg}
                  onChange={e => setNewGithubOrg(e.target.value)}
                  placeholder="e.g., acme-corp"
                  style={{
                    width:'100%',
                    padding:'10px 14px',
                    background:C.surface,
                    border:`1px solid ${C.border}`,
                    borderRadius:'6px',
                    fontFamily:FONTS.mono,
                    fontSize:'13px',
                    color:C.text,
                  }}
                />
              </div>
              <PrimaryBtn type="submit" disabled={creating || !newName.trim()}>
                {creating ? 'CREATING...' : 'CREATE TENANT'}
              </PrimaryBtn>
            </form>
          </div>
        )}

        {tenants.length === 0 ? (
          <div style={{ ...cardBorder(), padding:'40px', textAlign:'center' }}>
            <div style={{ fontFamily:FONTS.mono, fontSize:'14px', color:C.muted }}>No tenants found</div>
          </div>
        ) : (
          <div style={{ ...cardBorder(), overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#0D1117', borderBottom:`1px solid ${C.border}` }}>
                  {['TENANT ID','NAME','GITHUB ORG','CREATED AT','ACTIONS'].map(h => (
                    <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontFamily:FONTS.heading, fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:C.muted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant, i) => (
                  <tr key={tenant.id} style={{ background:i%2===1?'rgba(0,0,0,0.15)':'transparent', borderBottom:`1px solid ${C.border}` }}>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'12px', fontWeight:700, color:C.teal }}>{tenant.id}</td>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'12px', color:C.text }}>{tenant.name}</td>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:tenant.github_org ? C.text : C.muted }}>
                      {tenant.github_org || '—'}
                    </td>
                    <td style={{ padding:'12px 16px', fontFamily:FONTS.mono, fontSize:'11px', color:C.muted }}>
                      {tenant.created_at ? new Date(tenant.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      {tenant.id !== 'default' && (
                        <button
                          onClick={() => setDeleteDialog({ open: true, tenantId: tenant.id, tenantName: tenant.name })}
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
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={deleteDialog.open}
        title="Delete Tenant"
        message={`Are you sure you want to delete "${deleteDialog.tenantName}"? This will also delete all associated runners and jobs.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, tenantId: null, tenantName: '' })}
        danger
      />
    </div>
  )
}