import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console (and could send to error reporting service)
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="card" style={{ maxWidth: 600, margin: '2rem auto', textAlign: 'center' }}>
          <h2 className="h2" style={{ color: 'var(--error, #d32f2f)' }}>Oops! Something went wrong</h2>
          <p className="muted">We're sorry, but something unexpected happened. Please try refreshing the page.</p>
          <button
            className="btn"
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem' }}
          >
            Refresh Page
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '2rem', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Error Details (Development)</summary>
              <pre style={{
                background: '#f5f5f5',
                padding: '1rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                overflow: 'auto',
                marginTop: '0.5rem'
              }}>
                {this.state.error ? this.state.error.toString() : 'Unknown error'}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary