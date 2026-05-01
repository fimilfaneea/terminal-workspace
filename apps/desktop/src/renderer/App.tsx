import { usePersistedFontSize } from './hooks/usePersistedFontSize';

export function App(): JSX.Element {
  const [fontSize] = usePersistedFontSize();
  return (
    <div className="app-shell" style={{ fontSize }}>
      Terminal Workspace — fontSize {fontSize}px
    </div>
  );
}
