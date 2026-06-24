import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Catches uncaught render/runtime errors anywhere below it and shows a readable
 * fallback instead of unmounting the whole app (which renders as a blank screen).
 * This is a resilience guard, not a fix for any specific bug — it makes failures
 * visible (message on screen + in the console) and recoverable.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the component stack for debugging.
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid min-h-screen place-items-center p-8">
        <div className="rb-card w-full max-w-lg p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-missed">Something went wrong</h1>
          <p className="mt-2 text-sm text-text-mute">
            The page hit an unexpected error and stopped rendering. The details below are also in the
            browser console.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-[10px] bg-surface2 p-3 text-left text-xs text-text-mute">
            {error.message}
          </pre>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-[12px] border border-line px-4 py-2 text-sm text-text hover:border-text-mute"
            >
              Try again
            </button>
            <button
              onClick={() => location.reload()}
              className="rounded-[12px] bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:brightness-105"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
