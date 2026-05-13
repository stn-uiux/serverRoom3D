import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GltfErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[GLTF] Load error:", error.message, errorInfo.componentStack?.slice(0, 200));
  }

  render() {
    if (this.state.hasError) {
      // Render a simple placeholder mesh — no Html here to avoid context issues
      return (
        <mesh>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial color="#ef4444" wireframe />
        </mesh>
      );
    }

    return this.props.children;
  }
}
