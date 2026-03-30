import { useState, useEffect } from 'react'
import { GLOBAL_CSS } from './tokens'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import JobDetail from './pages/JobDetail'
import JobsQueue from './pages/JobsQueue'
import Settings from './pages/Settings'
import PRPreview from './pages/PRPreview'

export default function App() {
  const [page, setPage] = useState('dashboard')

  // Inject global CSS once
  useEffect(() => {
    const tag = document.createElement('style')
    tag.id = 'flux-global-styles'
    tag.textContent = GLOBAL_CSS
    document.head.appendChild(tag)
    return () => { document.getElementById('flux-global-styles')?.remove() }
  }, [])

  // Navigate helper — wraps setPage for passing to children
  const navigate = (target) => setPage(target)

  const renderPage = () => {
    switch (page) {
      case 'dashboard':  return <Dashboard setPage={navigate} />
      case 'job-detail': return <JobDetail  setPage={navigate} />
      case 'jobs':       return <JobsQueue  setPage={navigate} />
      case 'settings':   return <Settings />
      case 'pr-preview': return <PRPreview />
      default:           return <Dashboard setPage={navigate} />
    }
  }

  return (
    <>
      <Navbar page={page} setPage={setPage} />
      <main key={page} style={{ transition: 'opacity 0.2s ease' }}>
        {renderPage()}
      </main>
    </>
  )
}
