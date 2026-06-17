import { useRef, useState } from 'react';
import {
  selectTabTitle,
  useWorkspaceStore,
} from '@renderer/state/workspaceStore';
import type { Tab } from '@renderer/state/types';
import { usePersistedCwdPresets } from '@renderer/hooks/usePersistedCwdPresets';
import { Menu, type MenuEntry } from './Menu';
import { ManagePresetsDialog } from './ManagePresetsDialog';
import { RenamableTitle, type RenamableTitleHandle } from './RenamableTitle';
import { SavedCommandsButton } from './SavedCommandsButton';
import { FontSizeWidget } from './FontSizeWidget';

const DRAG_MIME = 'application/x-tab-index';

function basenameOf(path: string): string {
  const cleaned = path.replace(/[\\/]+$/u, '');
  const idx = Math.max(cleaned.lastIndexOf('\\'), cleaned.lastIndexOf('/'));
  return idx === -1 ? cleaned : cleaned.slice(idx + 1) || cleaned;
}

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
  const renameTab = useWorkspaceStore((s) => s.renameTab);
  const splitFocusedPane = useWorkspaceStore((s) => s.splitFocusedPane);
  const equalizePanes = useWorkspaceStore((s) => s.equalizePanes);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canEqualize =
    activeTab !== undefined && activeTab.rootPane.type !== 'leaf';

  const dragFromRef = useRef<number | null>(null);
  const [dropState, setDropState] = useState<DropState | null>(null);

  const userPresets = usePersistedCwdPresets();
  const lastCwd = useWorkspaceStore((s) => s.lastCwd);
  const setLastCwd = useWorkspaceStore((s) => s.setLastCwd);
  const effectiveCwd: string | null =
    lastCwd ?? userPresets.presets[0]?.path ?? null;
  const [splitInMenu, setSplitInMenu] = useState<{
    direction: 'horizontal' | 'vertical';
    position: { x: number; y: number };
  } | null>(null);
  const [newTabMenu, setNewTabMenu] = useState<{ x: number; y: number } | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{
    tabId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [showManageDialog, setShowManageDialog] = useState(false);

  const newTabBtnRef = useRef<HTMLButtonElement | null>(null);

  const closeTabById = (tabId: string): void => {
    void (async () => {
      const result = await closeTab(tabId);
      if (result.wouldCloseWindow) {
        await window.shell.requestWindowClose();
      }
    })();
  };

  const closeOtherTabs = (keepTabId: string): void => {
    const others = tabs.filter((t) => t.id !== keepTabId).map((t) => t.id);
    void (async () => {
      for (const id of others) {
        const result = await closeTab(id);
        if (result.wouldCloseWindow) {
          await window.shell.requestWindowClose();
          return;
        }
      }
    })();
  };

  const openNewWindow = (): void => {
    void window.shell.openWindow();
  };

  const moveTabToNewWindow = (tabId: string): void => {
    void (async () => {
      const payload = useWorkspaceStore.getState().buildSerializedTab(tabId);
      if (!payload) return; // only one tab — nothing to detach
      await window.shell.openWindowWithTab(payload);
      useWorkspaceStore.getState().removeTabLocally(tabId);
    })();
  };

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

  const openNewTabMenu = (): void => {
    const btn = newTabBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setNewTabMenu({ x: rect.left, y: rect.bottom });
  };

  const newTabAt = (cwd: string | undefined): void => {
    if (cwd && cwd.length > 0) setLastCwd(cwd);
    void newTab(cwd);
  };

  const newTabMenuEntries: MenuEntry[] = [
    ...userPresets.presets.map<MenuEntry>((p) => ({
      kind: 'item',
      label: p.label,
      onActivate: () => newTabAt(p.path),
    })),
    ...(userPresets.presets.length > 0
      ? ([{ kind: 'separator' }] satisfies MenuEntry[])
      : []),
    {
      kind: 'item',
      label: 'Choose folder…',
      onActivate: () => {
        void (async () => {
          const path = await window.shell.pickFolder();
          if (path) newTabAt(path);
        })();
      },
    },
    {
      kind: 'item',
      label: 'Manage presets…',
      onActivate: () => setShowManageDialog(true),
    },
    { kind: 'separator' },
    {
      kind: 'item',
      label: 'New window',
      shortcut: 'Ctrl+Shift+N',
      onActivate: openNewWindow,
    },
  ];

  const splitAt = (
    direction: 'horizontal' | 'vertical',
    cwd: string,
  ): void => {
    if (cwd && cwd.length > 0) setLastCwd(cwd);
    void splitFocusedPane(direction, cwd);
  };

  const splitInMenuEntries = (
    direction: 'horizontal' | 'vertical',
  ): MenuEntry[] => {
    const entries: MenuEntry[] = [];
    for (const p of userPresets.presets) {
      entries.push({
        kind: 'item',
        label: p.label,
        onActivate: () => splitAt(direction, p.path),
      });
    }
    if (userPresets.presets.length > 0) {
      entries.push({ kind: 'separator' });
    }
    entries.push({
      kind: 'item',
      label: 'Choose folder…',
      onActivate: () => {
        void (async () => {
          const path = await window.shell.pickFolder();
          if (path) splitAt(direction, path);
        })();
      },
    });
    return entries;
  };

  const tabContextMenuEntries = (
    tab: Tab,
    contextPosition: { x: number; y: number },
  ): MenuEntry[] => {
    const isActive = tab.id === activeTabId;
    return [
      {
        kind: 'item',
        label: 'Rename tab',
        onActivate: () => {
          setActiveTab(tab.id);
          // Defer to allow the row to mount with active state
          requestAnimationFrame(() => {
            tabRenameHandles.current.get(tab.id)?.startEditing();
          });
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'New window',
        shortcut: 'Ctrl+Shift+N',
        onActivate: openNewWindow,
      },
      {
        kind: 'item',
        label: 'Move tab to new window',
        disabled: tabs.length <= 1,
        onActivate: () => moveTabToNewWindow(tab.id),
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Split right',
        shortcut: 'Ctrl+Shift+E',
        disabled: !isActive,
        onActivate: () => {
          void splitFocusedPane('horizontal');
        },
      },
      {
        kind: 'item',
        label: 'Split right in…',
        disabled: !isActive,
        onActivate: () => {
          setSplitInMenu({ direction: 'horizontal', position: contextPosition });
        },
      },
      {
        kind: 'item',
        label: 'Split down',
        shortcut: 'Ctrl+Shift+O',
        disabled: !isActive,
        onActivate: () => {
          void splitFocusedPane('vertical');
        },
      },
      {
        kind: 'item',
        label: 'Split down in…',
        disabled: !isActive,
        onActivate: () => {
          setSplitInMenu({ direction: 'vertical', position: contextPosition });
        },
      },
      { kind: 'separator' },
      {
        kind: 'item',
        label: 'Close tab',
        shortcut: 'Ctrl+W',
        onActivate: () => closeTabById(tab.id),
      },
      {
        kind: 'item',
        label: 'Close other tabs',
        disabled: tabs.length <= 1,
        onActivate: () => closeOtherTabs(tab.id),
      },
    ];
  };

  // Per-tab rename handles so the context menu can trigger inline edit.
  const tabRenameHandles = useRef<Map<string, RenamableTitleHandle>>(new Map());

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
            onClose={() => closeTabById(tab.id)}
            onRename={(name) => renameTab(tab.id, name)}
            onContextMenu={(e) => {
              e.preventDefault();
              setTabContextMenu({
                tabId: tab.id,
                position: { x: e.clientX, y: e.clientY },
              });
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
            registerRenameHandle={(handle) => {
              if (handle) tabRenameHandles.current.set(tab.id, handle);
              else tabRenameHandles.current.delete(tab.id);
            }}
          />
        ))}
      </div>
      <div className="tab-bar__new-group">
        <button
          ref={newTabBtnRef}
          className="tab-bar__new"
          type="button"
          title={
            effectiveCwd
              ? `New tab in ${effectiveCwd} (Ctrl+T)`
              : 'New tab (Ctrl+T)'
          }
          onClick={() => newTabAt(effectiveCwd ?? undefined)}
          onContextMenu={(e) => {
            e.preventDefault();
            openNewTabMenu();
          }}
        >
          +
        </button>
        <button
          className="tab-bar__new-arrow"
          type="button"
          title="New tab in…"
          onClick={openNewTabMenu}
        >
          ▾
        </button>
        {effectiveCwd && (
          <span
            className="tab-bar__new-cwd"
            title={effectiveCwd}
            onClick={openNewTabMenu}
          >
            {basenameOf(effectiveCwd)}
          </span>
        )}
        <button
          type="button"
          className={`tab-bar__equalize${canEqualize ? ' tab-bar__equalize--active' : ''}`}
          title="Equalize pane sizes (Ctrl+Shift+0)"
          aria-label="Equalize pane sizes"
          disabled={!canEqualize}
          onClick={() => activeTab && equalizePanes(activeTab.id)}
        >
          <span className="tab-bar__equalize-icon" aria-hidden="true">⫴</span>
        </button>
        <SavedCommandsButton />
        <FontSizeWidget />
      </div>
      {newTabMenu && (
        <Menu
          entries={newTabMenuEntries}
          position={newTabMenu}
          onClose={() => setNewTabMenu(null)}
          width={240}
        />
      )}
      {tabContextMenu && (() => {
        const tab = tabs.find((t) => t.id === tabContextMenu.tabId);
        if (!tab) return null;
        return (
          <Menu
            entries={tabContextMenuEntries(tab, tabContextMenu.position)}
            position={tabContextMenu.position}
            onClose={() => setTabContextMenu(null)}
            width={220}
          />
        );
      })()}
      {splitInMenu && (
        <Menu
          entries={splitInMenuEntries(splitInMenu.direction)}
          position={splitInMenu.position}
          onClose={() => setSplitInMenu(null)}
          width={240}
        />
      )}
      {showManageDialog && (
        <ManagePresetsDialog
          presets={userPresets.presets}
          onAdd={userPresets.addPreset}
          onRemove={userPresets.removePreset}
          onRename={userPresets.renamePreset}
          onPickFolder={() => window.shell.pickFolder()}
          onClose={() => setShowManageDialog(false)}
        />
      )}
    </div>
  );
}

interface TabItemProps {
  tab: Tab;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  dropIndicator: 'before' | 'after' | null;
  registerRenameHandle: (handle: RenamableTitleHandle | null) => void;
}

function TabItem({
  tab,
  index,
  isActive,
  onSelect,
  onClose,
  onRename,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragEnd,
  dropIndicator,
  registerRenameHandle,
}: TabItemProps): JSX.Element {
  const title = useWorkspaceStore((s) => selectTabTitle(s, tab.id));
  const fallback = `Terminal ${index + 1}`;
  const renameRef = useRef<RenamableTitleHandle | null>(null);

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
      onContextMenu={onContextMenu}
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
        ref={(handle) => {
          renameRef.current = handle;
          registerRenameHandle(handle);
        }}
        title={title || fallback}
        className="tab__title"
        inputClassName="tab__rename-input"
        onRename={onRename}
      />
      <button
        className="tab__close"
        type="button"
        title="Close tab (Ctrl+W)"
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
