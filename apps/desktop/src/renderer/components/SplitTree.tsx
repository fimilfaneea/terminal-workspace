import { Fragment, useEffect, useRef } from 'react';
import {
  Group,
  Panel,
  Separator,
  useGroupRef,
  type Layout,
} from 'react-resizable-panels';
import { TerminalPane } from './TerminalPane';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';
import type { PaneNode, SplitPaneNode, Tab } from '@renderer/state/types';

interface Props {
  tab: Tab;
  isVisible: boolean;
}

export function SplitTree({ tab, isVisible }: Props): JSX.Element {
  return (
    <div className="split-root">
      {renderNode(tab.rootPane, tab.id, isVisible, tab.activePaneId)}
    </div>
  );
}

function renderNode(
  node: PaneNode,
  tabId: string,
  isVisible: boolean,
  activePaneId: string,
): JSX.Element {
  if (node.type === 'leaf') {
    return (
      <div
        key={node.id}
        className="split-leaf"
        onMouseDownCapture={() => {
          useWorkspaceStore.getState().setActivePane(tabId, node.id);
        }}
      >
        <TerminalPane
          sessionId={node.sessionId}
          paneId={node.id}
          isFocused={node.id === activePaneId}
          isVisible={isVisible}
        />
      </div>
    );
  }
  return (
    <SplitGroup
      key={node.id}
      node={node}
      tabId={tabId}
      isVisible={isVisible}
      activePaneId={activePaneId}
    />
  );
}

interface SplitGroupProps {
  node: SplitPaneNode;
  tabId: string;
  isVisible: boolean;
  activePaneId: string;
}

function SplitGroup({
  node,
  tabId,
  isVisible,
  activePaneId,
}: SplitGroupProps): JSX.Element {
  const groupRef = useGroupRef();
  const programmaticRef = useRef(false);
  const n = node.children.length;
  const panelId = (i: number): string => `${node.id}:${i}`;

  // When `userResized` is false, force every panel back to 1/n after each
  // child-count change. The library only honors `defaultSize` on a panel's
  // first mount, so a fresh equal layout has to be pushed imperatively.
  // `programmaticRef` flags this push so the resulting onLayoutChanged event
  // is not mistaken for a user drag.
  useEffect(() => {
    if (node.userResized) return;
    const handle = groupRef.current;
    if (!handle) return;
    const layout: Layout = {};
    const equal = 100 / n;
    for (let i = 0; i < n; i++) layout[panelId(i)] = equal;
    programmaticRef.current = true;
    try {
      handle.setLayout(layout);
    } finally {
      programmaticRef.current = false;
    }
    // panelId uses node.id, captured for the duration of this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, node.userResized, node.id]);

  return (
    <Group
      id={node.id}
      groupRef={groupRef}
      orientation={node.direction}
      className="split-group"
      onLayoutChanged={(layout: Layout) => {
        if (programmaticRef.current) return;
        const ratios = node.children.map((_, i) => {
          const v = layout[panelId(i)];
          return typeof v === 'number' ? v / 100 : 1 / n;
        });
        useWorkspaceStore.getState().setSplitRatios(tabId, node.id, ratios);
      }}
    >
      {node.children.map((child, i) => {
        const size = node.userResized
          ? (node.ratios[i] ?? 1 / n) * 100
          : 100 / n;
        return (
          <Fragment key={panelId(i)}>
            {i > 0 && <Separator className="split-separator" />}
            <Panel id={panelId(i)} defaultSize={size} minSize={5}>
              {renderNode(child, tabId, isVisible, activePaneId)}
            </Panel>
          </Fragment>
        );
      })}
    </Group>
  );
}
