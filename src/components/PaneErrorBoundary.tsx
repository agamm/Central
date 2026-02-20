import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaneErrorBoundaryProps {
  readonly paneName: string;
  readonly children: ReactNode;
}

interface PaneErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: string | null;
}

/**
 * Error boundary for major UI panes (sidebar, chat, files/terminal).
 * This is the ONE exception to the "no classes" rule — React requires
 * class components for componentDidCatch error boundaries.
 */
class PaneErrorBoundary extends Component<
  PaneErrorBoundaryProps,
  PaneErrorBoundaryState
> {
  constructor(props: PaneErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PaneErrorBoundaryState {
    return { hasError: true, error: error.message };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <PaneErrorFallback
          paneName={this.props.paneName}
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

interface PaneErrorFallbackProps {
  readonly paneName: string;
  readonly error: string | null;
  readonly onReset: () => void;
}

function PaneErrorFallback({
  paneName,
  error,
  onReset,
}: PaneErrorFallbackProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-950/50">
        <AlertTriangle className="h-5 w-5 text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {paneName} encountered an error
        </p>
        {error && (
          <p className="mt-1 max-w-[280px] truncate text-xs text-muted-foreground">
            {error}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="mt-1 gap-1.5 text-xs"
      >
        <RotateCcw className="h-3 w-3" />
        Retry
      </Button>
    </div>
  );
}

export { PaneErrorBoundary };
