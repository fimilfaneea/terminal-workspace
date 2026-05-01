import { newPaneId } from './ids';
import type {
  LeafPaneNode,
  PaneNode,
  SplitDirection,
  SplitPaneNode,
} from '@renderer/state/types';

const DEFAULT_RATIO = 0.5;

export function createLeaf(sessionId: string): LeafPaneNode {
  return { type: 'leaf', id: newPaneId(), sessionId };
}

export function findLeaf(root: PaneNode, paneId: string): LeafPaneNode | null {
  if (root.type === 'leaf') return root.id === paneId ? root : null;
  return findLeaf(root.children[0], paneId) ?? findLeaf(root.children[1], paneId);
}

export function findParentSplit(
  root: PaneNode,
  paneId: string,
): { parent: SplitPaneNode; index: 0 | 1 } | null {
  if (root.type === 'leaf') return null;
  if (root.children[0].id === paneId) return { parent: root, index: 0 };
  if (root.children[1].id === paneId) return { parent: root, index: 1 };
  return (
    findParentSplit(root.children[0], paneId) ??
    findParentSplit(root.children[1], paneId)
  );
}

/**
 * Replaces the leaf identified by `paneId` with a split node whose first
 * child is the original leaf and whose second child is `newPane`. Pure: caller
 * mints `newPane` (typically via `createLeaf`) so this helper has no randomness.
 */
export function splitLeaf(
  root: PaneNode,
  paneId: string,
  direction: SplitDirection,
  newPane: LeafPaneNode,
): PaneNode {
  if (root.type === 'leaf') {
    if (root.id !== paneId) return root;
    return {
      type: 'split',
      id: newPaneId(),
      direction,
      ratio: DEFAULT_RATIO,
      children: [root, newPane],
    };
  }
  const [a, b] = root.children;
  const left = splitLeaf(a, paneId, direction, newPane);
  if (left !== a) return { ...root, children: [left, b] };
  const right = splitLeaf(b, paneId, direction, newPane);
  if (right !== b) return { ...root, children: [a, right] };
  return root;
}

export function removeLeaf(
  root: PaneNode,
  paneId: string,
): { newRoot: PaneNode | null; orphanedSessionIds: string[] } {
  if (root.type === 'leaf') {
    if (root.id === paneId) {
      return { newRoot: null, orphanedSessionIds: [root.sessionId] };
    }
    return { newRoot: root, orphanedSessionIds: [] };
  }
  const [a, b] = root.children;
  const left = removeLeaf(a, paneId);
  if (left.orphanedSessionIds.length > 0) {
    return {
      newRoot: left.newRoot === null ? b : { ...root, children: [left.newRoot, b] },
      orphanedSessionIds: left.orphanedSessionIds,
    };
  }
  const right = removeLeaf(b, paneId);
  if (right.orphanedSessionIds.length > 0) {
    return {
      newRoot: right.newRoot === null ? a : { ...root, children: [a, right.newRoot] },
      orphanedSessionIds: right.orphanedSessionIds,
    };
  }
  return { newRoot: root, orphanedSessionIds: [] };
}

export function collectLeafIds(root: PaneNode): string[] {
  if (root.type === 'leaf') return [root.id];
  return [...collectLeafIds(root.children[0]), ...collectLeafIds(root.children[1])];
}

export function collectSessionIds(root: PaneNode): string[] {
  if (root.type === 'leaf') return [root.sessionId];
  return [
    ...collectSessionIds(root.children[0]),
    ...collectSessionIds(root.children[1]),
  ];
}

export function focusNext(root: PaneNode, currentPaneId: string): string {
  const leaves = collectLeafIds(root);
  if (leaves.length === 0) return currentPaneId;
  const idx = leaves.indexOf(currentPaneId);
  if (idx === -1) return leaves[0] ?? currentPaneId;
  return leaves[(idx + 1) % leaves.length] ?? currentPaneId;
}

export function focusPrev(root: PaneNode, currentPaneId: string): string {
  const leaves = collectLeafIds(root);
  if (leaves.length === 0) return currentPaneId;
  const idx = leaves.indexOf(currentPaneId);
  if (idx === -1) return leaves[0] ?? currentPaneId;
  return leaves[(idx - 1 + leaves.length) % leaves.length] ?? currentPaneId;
}

const MIN_RATIO = 0.05;
const MAX_RATIO = 0.95;

export function updateSplitRatio(
  root: PaneNode,
  splitNodeId: string,
  ratio: number,
): PaneNode {
  if (root.type === 'leaf') return root;
  const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
  if (root.id === splitNodeId) {
    if (root.ratio === clamped) return root;
    return { ...root, ratio: clamped };
  }
  const [a, b] = root.children;
  const left = updateSplitRatio(a, splitNodeId, ratio);
  if (left !== a) return { ...root, children: [left, b] };
  const right = updateSplitRatio(b, splitNodeId, ratio);
  if (right !== b) return { ...root, children: [a, right] };
  return root;
}
