import { useState, useEffect } from 'react'
import { GLOBAL_CSS } from './tokens'
import { ErrorBoundary } from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import JobDetail from './pages/JobDetail'
import JobsQueue from './pages/JobsQueue'
import Settings from './pages/Settings'
import PRPreview from './pages/PRPreview'
import DeadLetter from './pages/DeadLetter'
import Runners from './pages/Runners'
import Tenants from './pages/Tenants'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [selectedJobId, setSelectedJobId] = useState(null)

  // Inject global CSS once
  useEffect(() => {
    const tag = document.createElement('style')
    tag.id = 'flux-global-styles'
    tag.textContent = GLOBAL_CSS
    document.head.appendChild(tag)
    return () => { document.getElementById('flux-global-styles')?.remove() }
  }, [])

  // Navigate helper — wraps setPage for passing to children
  const navigate = (target, jobId = null) => {
    setSelectedJobId(jobId)
    setPage(target)
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':  return <Dashboard setPage={navigate} />
      case 'job-detail': return <JobDetail  setPage={navigate} jobId={selectedJobId} />
      case 'jobs':       return <JobsQueue  setPage={navigate} />
      case 'settings':   return <Settings />
      case 'pr-preview': return <PRPreview />
      case 'dead-letter': return <DeadLetter setPage={navigate} />
      case 'runners':    return <Runners setPage={navigate} />
      case 'tenants':   return <Tenants setPage={navigate} />
      default:           return <Dashboard setPage={navigate} />
    }
  }

  return (
    <ErrorBoundary>
      <Navbar page={page} setPage={setPage} />
      <main key={page} style={{ transition: 'opacity 0.2s ease' }}>
        {renderPage()}
      </main>
    </ErrorBoundary>
  )
}
