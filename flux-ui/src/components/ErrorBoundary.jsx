import { Component } from 'react'
import { C, FONTS } from '../tokens'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '40px',
          background: '#0D1117',
          color: C.text,
        }}>
          <div style={{
            fontFamily: FONTS.heading,
            fontSize: '24px',
            fontWeight: 700,
            color: C.red,
            marginBottom: '16px',
          }}>
            Something went wrong
          </div>
          <div style={{
            fontFamily: FONTS.mono,
            fontSize: '13px',
            color: C.muted,
            marginBottom: '24px',
            maxWidth: '500px',
            textAlign: 'center',
          }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
            <pre style={{
              fontFamily: FONTS.mono,
              fontSize: '11px',
              color: C.muted,
              background: '#161B22',
              padding: '16px',
              borderRadius: '8px',
              maxWidth: '800px',
              overflow: 'auto',
              marginBottom: '24px',
            }}>
              {this.state.error.stack}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            style={{
              padding: '12px 24px',
              background: C.teal,
              color: '#0D1117',
              border: 'none',
              borderRadius: '6px',
              fontFamily: FONTS.mono,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary