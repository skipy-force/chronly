import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] caught:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-surface p-6 text-on-surface">
          <p className="text-lg font-semibold text-error">Something broke</p>
          <p className="max-w-md text-center text-sm text-on-surface-variant">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-pill bg-primary px-4 py-1.5 text-sm text-surface"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
