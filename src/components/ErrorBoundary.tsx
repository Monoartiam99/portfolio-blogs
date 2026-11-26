import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string };
        if (parsed?.error) {
          friendlyMessage = `Database ${parsed.operationType || 'operation'} error: ${parsed.error}`;
        }
      } catch {
        // Use raw message if not JSON
      }

      return (
        <div className="min-h-screen bg-[#FAFAFA] text-[#09090B] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-zinc-200 p-8">
            <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">
              Application Recovery
            </p>
            <h1 className="font-serif text-2xl font-semibold text-zinc-950 mb-3">
              Unable to complete this view
            </h1>
            <p className="text-sm text-zinc-600 leading-relaxed mb-6 break-words">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.hash = '#/';
                window.location.reload();
              }}
              className="px-4 py-2 text-sm font-medium bg-[#1E3A8A] text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer"
            >
              Reload Journal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
