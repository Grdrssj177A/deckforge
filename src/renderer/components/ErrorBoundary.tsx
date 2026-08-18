import { Component, ReactNode } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string; // Identificador para logs
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Captura errores de rendering/lifecycle en sus hijos.
 * Muestra un fallback en vez de crashear toda la app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    log.error(`[${this.props.name || 'unknown'}] ${error.message}`, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="error-boundary-fallback">
          <span className="error-boundary-icon">⚠️</span>
          <span className="error-boundary-text">Error</span>
        </div>
      );
    }
    return this.props.children;
  }
}
