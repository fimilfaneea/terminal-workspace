import { Group, Panel, Separator, type Layout } from 'react-resizable-panels';
import { TerminalPane } from './TerminalPane';
import { useWorkspaceStore } from '@renderer/state/workspaceStore';
import type { PaneNode, Tab } from '@renderer/state/types';

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
  const aId = `${node.id}:a`;
  const bId = `${node.id}:b`;
  return (
    <Group
      key={node.id}
      id={node.id}
      orientation={node.direction}
      className="split-group"
      onLayoutChanged={(layout: Layout) => {
        const a = layout[aId];
        if (typeof a !== 'number') return;
        useWorkspaceStore.getState().setSplitRatio(tabId, node.id, a / 100);
      }}
    >
      <Panel id={aId} defaultSize={node.ratio * 100} minSize={5}>
        {renderNode(node.children[0], tabId, isVisible, activePaneId)}
      </Panel>
      <Separator className="split-separator" />
      <Panel id={bId} defaultSize={(1 - node.ratio) * 100} minSize={5}>
        {renderNode(node.children[1], tabId, isVisible, activePaneId)}
      </Panel>
    </Group>
  );
}
