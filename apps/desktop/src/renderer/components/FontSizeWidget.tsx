import { useWorkspaceStore } from '@renderer/state/workspaceStore';

export function FontSizeWidget(): JSX.Element {
  const fontSizePx = useWorkspaceStore((s) => s.fontSizePx);
  const bumpFontSize = useWorkspaceStore((s) => s.bumpFontSize);
  const resetFontSize = useWorkspaceStore((s) => s.resetFontSize);

  return (
    <div className="tab-bar__font-zoom" role="group" aria-label="Terminal font size">
      <button
        type="button"
        className="tab-bar__font-zoom-btn"
        title="Decrease font size (Ctrl+-)"
        onClick={() => bumpFontSize(-1)}
      >
        A−
      </button>
      <button
        type="button"
        className="tab-bar__font-zoom-value"
        title="Reset font size (Ctrl+0)"
        onClick={() => resetFontSize()}
      >
        {fontSizePx}
      </button>
      <button
        type="button"
        className="tab-bar__font-zoom-btn"
        title="Increase font size (Ctrl+=)"
        onClick={() => bumpFontSize(1)}
      >
        A+
      </button>
    </div>
  );
}
