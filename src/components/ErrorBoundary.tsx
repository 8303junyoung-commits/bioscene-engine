import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('BioScene render failure', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="fatal-error" role="alert"><h1>BioScene could not render this scene</h1><p>The stored or imported data was rejected safely. Reload to return to the last valid autosave.</p><code>{this.state.error.message}</code><button onClick={() => window.location.reload()}>Reload editor</button></main>
  }
}
