import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  paneId: string;
}

interface State {
  hasError: boolean;
  message: string;
}

// Catches render-time errors in a single TerminalPane and shows a per-pane
// error placeholder instead of unmounting the whole renderer to a blank
// window. Reuses the existing .pane / .pane__error / .pane--errored styles
// from terminal.css.
export class PaneErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  override componentDidCatch(err: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[pane ${this.props.paneId}] render error`, err, info);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="pane pane--errored">
          <div className="pane__error">
            Pane rendering failed: {this.state.message}. Try closing and reopening it.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
