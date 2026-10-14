import { Component } from 'react';

import { Button } from '../components/ui/Button.jsx';

const STORAGE_KEY = 'syncexc:last-error';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    const report = {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      timestamp: new Date().toISOString(),
    };

    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Uncaught error:', report);
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(report));
    } catch {
      // Session storage may be unavailable; ignore.
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign('/');
  };

  handleCopyReport = async () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Message: ${error?.message ?? 'Unknown error'}`,
      '',
      'Stack:',
      error?.stack ?? '(no stack)',
      '',
      'Component stack:',
      errorInfo?.componentStack ?? '(no component stack)',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard unavailable; ignore.
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;
    const isDev = import.meta.env.DEV;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5 text-destructive"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred while rendering this page.
              </p>
            </div>
          </div>

          {isDev && error ? (
            <div className="mb-6 rounded-md border border-border bg-muted/40 p-4">
              <p className="mb-2 font-mono text-xs font-semibold text-destructive">
                {error.name}: {error.message}
              </p>
              {error.stack ? (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-2xs text-muted-foreground">
                  {error.stack}
                </pre>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button onClick={this.handleReload}>Reload page</Button>
            <Button variant="outline" onClick={this.handleGoHome}>
              Go to home
            </Button>
            <Button variant="ghost" onClick={this.handleCopyReport}>
              Copy error report
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            If this problem persists, please contact support and include the error report.
          </p>
        </div>
      </div>
    );
  }
}