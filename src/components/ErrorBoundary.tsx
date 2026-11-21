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
      message: error.message || 'Ocurrió un error inesperado.',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('April AI ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-[#08020f] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#10051d] border border-[#8500ff] p-6 space-y-4">
            <h1 className="text-xl font-bold">Algo salió mal en April AI</h1>
            <p className="text-sm text-[#d9aaff] leading-relaxed">
              Ocurrió un problema inesperado al sincronizar tu sesión. Puedes recargar la aplicación para continuar.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] rounded-xl bg-[#8500e8] hover:bg-[#a000ff] text-white text-sm font-medium"
            >
              Recargar April AI
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
