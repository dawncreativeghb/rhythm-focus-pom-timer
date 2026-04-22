import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional fallback UI. Defaults to rendering nothing so the rest of the app keeps working. */
  fallback?: ReactNode;
  /** Optional label used in console logs to identify which boundary tripped. */
  label?: string;
  /** Optional callback invoked when an error is caught. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

/**
 * Minimal error boundary. Catches render/runtime errors in its subtree
 * and renders `fallback` (or nothing) so the rest of the app keeps working.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info);
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
