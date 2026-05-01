import { useRef, useState } from 'react';
import {
  selectTabTitle,
  useWorkspaceStore,
} from '@renderer/state/workspaceStore';
import { findLeaf } from '@renderer/lib/splitTree';
import type { Tab } from '@renderer/state/types';
import { RenamableTitle } from './RenamableTitle';

const DRAG_MIME = 'application/x-tab-index';

interface DropState {
  index: number;
  side: 'before' | 'after';
}

export function TabBar(): JSX.Element {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const reorderTabs = useWorkspaceStore((s) => s.reorderTabs);
  const newTab = useWorkspaceStore((s) => s.newTab);

  const dragFromRef = useRef<number | null>(null);
  const [dropState, setDropState] = useState<DropState | null>(null);

  const handleDragOver = (e: React.DragEvent, index: number): void => {
    if (dragFromRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
    setDropState({ index, side });
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    const from = dragFromRef.current;
    const target = dropState;
    dragFromRef.current = null;
    setDropState(null);
    if (from === null || target === null) return;
    let to = target.side === 'before' ? target.index : target.index + 1;
    if (to > from) to -= 1;
    if (to === from) return;
    if (to < 0 || to >= tabs.length) return;
    reorderTabs(from, to);
  };

  return (
    <div className="tab-bar" onDragLeave={() => setDropState(null)}>
      <div className="tab-bar__strip" onDrop={handleDrop}>
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            index={index}
            isActive={tab.id === activeTabId}
            onSelect={() => setActiveTab(tab.id)}
            onClose={() => {
              void (async () => {
                const result = await closeTab(tab.id);
                if (result.wouldCloseWindow) {
                  await window.shell.requestWindowClose();
                }
              })();
            }}
            onDragStart={(e) => {
              dragFromRef.current = index;
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData(DRAG_MIME, String(index));
            }}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={() => {
              dragFromRef.current = null;
              setDropState(null);
            }}
            dropIndicator={
              dropState && dropState.index === index ? dropState.side : null
            }
          />
        ))}
      </div>
      <button
        className="tab-bar__new"
        type="button"
        title="New tab (Ctrl+Shift+T)"
        onClick={() => {
          void newTab();
        }}
      >
        +
      </button>
    </div>
  );
}

interface TabItemProps {
  tab: Tab;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  dropIndicator: 'before' | 'after' | null;
}

function TabItem({
  tab,
  index,
  isActive,
  onSelect,
  onClose,
  onDragStart,
  onDragOver,
  onDragEnd,
  dropIndicator,
}: TabItemProps): JSX.Element {
  const title = useWorkspaceStore((s) => selectTabTitle(s, tab.id));
  const renameSession = useWorkspaceStore((s) => s.renameSession);
  const fallback = `Terminal ${index + 1}`;
  const className = [
    'tab',
    isActive ? 'tab--active' : '',
    tab.hasError ? 'tab--error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onMouseDown={(e) => {
        if (e.button === 0) onSelect();
      }}
    >
      {dropIndicator === 'before' && <span className="tab__drop tab__drop--before" />}
      {tab.hasUnreadActivity && !isActive && (
        <span className="tab__dot tab__dot--unread" />
      )}
      {tab.hasError && <span className="tab__dot tab__dot--error" />}
      <RenamableTitle
        title={title || fallback}
        className="tab__title"
        inputClassName="tab__rename-input"
        onRename={(next) => {
          const focused = findLeaf(tab.rootPane, tab.activePaneId);
          if (!focused) return;
          void renameSession(focused.sessionId, next);
        }}
      />
      <button
        className="tab__close"
        type="button"
        title="Close tab (Ctrl+Shift+W)"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
      {dropIndicator === 'after' && <span className="tab__drop tab__drop--after" />}
    </div>
  );
}
