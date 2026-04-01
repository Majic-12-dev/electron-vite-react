import type { ReactNode } from 'react'
import { Component } from 'react'
import { Button } from '@/components/ui/Button'

type ErrorBoundaryProps = {
  children: ReactNode
  fallback?: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error) {
    console.error('Tool crashed:', error)
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    const { hasError, message } = this.state
    if (hasError) {
      return (
        <div className='flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-panel/70 p-8 text-center'>
          <div className='text-lg font-semibold text-text'>Something went wrong in this tool.</div>
          <p className='max-w-md text-sm text-muted'>
            {message || 'Please reload the tool. Your app shell is still running safely.'}
          </p>
          <Button onClick={this.handleReset} variant='secondary'>
            Reload Tool
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
