import { newPaneId } from './ids';
import type {
  LeafPaneNode,
  PaneNode,
  SplitDirection,
  SplitPaneNode,
} from '@renderer/state/types';

const MIN_RATIO = 0.05;

function equalRatios(n: number): number[] {
  return Array<number>(n).fill(1 / n);
}

function clampAndNormalize(ratios: number[]): number[] {
  if (ratios.length === 0) return ratios;
  const clamped = ratios.map((r) => (Number.isFinite(r) ? Math.max(MIN_RATIO, r) : MIN_RATIO));
  const sum = clamped.reduce((a, b) => a + b, 0);
  if (sum === 0) return equalRatios(clamped.length);
  return clamped.map((r) => r / sum);
}

export function createLeaf(sessionId: string): LeafPaneNode {
  return { type: 'leaf', id: newPaneId(), sessionId };
}

export function findLeaf(root: PaneNode, paneId: string): LeafPaneNode | null {
  if (root.type === 'leaf') return root.id === paneId ? root : null;
  for (const child of root.children) {
    const found = findLeaf(child, paneId);
    if (found) return found;
  }
  return null;
}

export function findParentSplit(
  root: PaneNode,
  paneId: string,
): { parent: SplitPaneNode; index: number } | null {
  if (root.type === 'leaf') return null;
  const idx = root.children.findIndex((c) => c.id === paneId);
  if (idx !== -1) return { parent: root, index: idx };
  for (const child of root.children) {
    const found = findParentSplit(child, paneId);
    if (found) return found;
  }
  return null;
}

/**
 * Replaces the leaf identified by `paneId` with the result of inserting
 * `newPane` next to it in `direction`. Same-direction parents flatten (the new
 * pane joins as a sibling and ratios reset to equal); otherwise the leaf is
 * wrapped in a fresh 2-child split.
 */
export function splitLeaf(
  root: PaneNode,
  paneId: string,
  direction: SplitDirection,
  newPane: LeafPaneNode,
): PaneNode {
  // Case: leaf is the root.
  if (root.type === 'leaf') {
    if (root.id !== paneId) return root;
    return {
      type: 'split',
      id: newPaneId(),
      direction,
      children: [root, newPane],
      ratios: equalRatios(2),
      userResized: false,
    };
  }
  // Same-direction parent that directly contains the leaf: flatten.
  if (root.direction === direction) {
    const idx = root.children.findIndex((c) => c.id === paneId);
    if (idx !== -1) {
      const nextChildren = [...root.children];
      nextChildren.splice(idx + 1, 0, newPane);
      const nextRatios = root.userResized
        ? splitRatioInPlace(root.ratios, idx)
        : equalRatios(nextChildren.length);
      return {
        ...root,
        children: nextChildren,
        ratios: nextRatios,
      };
    }
  } else {
    // Different-direction parent: if the leaf is a direct child, replace it
    // in place with a fresh perpendicular split.
    const idx = root.children.findIndex((c) => c.id === paneId);
    if (idx !== -1) {
      const child = root.children[idx];
      if (child && child.type === 'leaf') {
        const wrapper: SplitPaneNode = {
          type: 'split',
          id: newPaneId(),
          direction,
          children: [child, newPane],
          ratios: equalRatios(2),
          userResized: false,
        };
        const nextChildren = [...root.children];
        nextChildren[idx] = wrapper;
        return { ...root, children: nextChildren };
      }
    }
  }
  // Recurse into children.
  let changed = false;
  const nextChildren = root.children.map((c) => {
    const next = splitLeaf(c, paneId, direction, newPane);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...root, children: nextChildren } : root;
}

/**
 * When a user-resized group gets a new sibling, halve the ratio at `idx`
 * and give the new entry the other half so the visual size of unaffected
 * panes is preserved.
 */
function splitRatioInPlace(ratios: number[], idx: number): number[] {
  const out = [...ratios];
  const original = out[idx] ?? 1 / (ratios.length + 1);
  const half = original / 2;
  out[idx] = half;
  out.splice(idx + 1, 0, half);
  return clampAndNormalize(out);
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
  // Direct removal of a child leaf.
  const directIdx = root.children.findIndex((c) => c.id === paneId);
  if (directIdx !== -1) {
    const removed = root.children[directIdx];
    if (removed && removed.type === 'leaf') {
      const remaining = root.children.filter((_, i) => i !== directIdx);
      const removedRatio = root.ratios[directIdx] ?? 0;
      if (remaining.length === 1) {
        const sole = remaining[0];
        return { newRoot: sole ?? null, orphanedSessionIds: [removed.sessionId] };
      }
      const remainingRatios = root.ratios.filter((_, i) => i !== directIdx);
      const nextRatios = root.userResized
        ? clampAndNormalize(remainingRatios.map((r) => r + removedRatio / remaining.length))
        : equalRatios(remaining.length);
      return {
        newRoot: { ...root, children: remaining, ratios: nextRatios },
        orphanedSessionIds: [removed.sessionId],
      };
    }
  }
  // Recurse.
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    if (!child) continue;
    const result = removeLeaf(child, paneId);
    if (result.orphanedSessionIds.length === 0) continue;
    let nextChildren: PaneNode[];
    if (result.newRoot === null) {
      nextChildren = root.children.filter((_, j) => j !== i);
    } else {
      nextChildren = root.children.map((c, j) => (j === i ? result.newRoot! : c));
    }
    if (nextChildren.length === 0) {
      return { newRoot: null, orphanedSessionIds: result.orphanedSessionIds };
    }
    if (nextChildren.length === 1) {
      const sole = nextChildren[0];
      return {
        newRoot: sole ?? null,
        orphanedSessionIds: result.orphanedSessionIds,
      };
    }
    let nextRatios: number[];
    if (result.newRoot === null) {
      const removedRatio = root.ratios[i] ?? 0;
      const remainingRatios = root.ratios.filter((_, j) => j !== i);
      nextRatios = root.userResized
        ? clampAndNormalize(remainingRatios.map((r) => r + removedRatio / nextChildren.length))
        : equalRatios(nextChildren.length);
    } else {
      nextRatios = root.ratios;
    }
    return {
      newRoot: { ...root, children: nextChildren, ratios: nextRatios },
      orphanedSessionIds: result.orphanedSessionIds,
    };
  }
  return { newRoot: root, orphanedSessionIds: [] };
}

export function collectLeafIds(root: PaneNode): string[] {
  if (root.type === 'leaf') return [root.id];
  const out: string[] = [];
  for (const child of root.children) out.push(...collectLeafIds(child));
  return out;
}

export function collectSessionIds(root: PaneNode): string[] {
  if (root.type === 'leaf') return [root.sessionId];
  const out: string[] = [];
  for (const child of root.children) out.push(...collectSessionIds(child));
  return out;
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

// Reset every split node in the tree to equal ratios and clear `userResized`.
// SplitTree.tsx's effect at line 84 imperatively pushes `setLayout(equal)` to
// react-resizable-panels whenever `userResized` flips to false, so clearing
// the flag is what actually moves the panels.
export function equalizeAllSplits(root: PaneNode): PaneNode {
  if (root.type === 'leaf') return root;
  const n = root.children.length;
  return {
    ...root,
    children: root.children.map((c) => equalizeAllSplits(c)),
    ratios: equalRatios(n),
    userResized: false,
  };
}

export function updateSplitRatios(
  root: PaneNode,
  splitNodeId: string,
  ratios: number[],
): PaneNode {
  if (root.type === 'leaf') return root;
  if (root.id === splitNodeId) {
    if (ratios.length !== root.children.length) return root;
    const next = clampAndNormalize(ratios);
    if (
      next.length === root.ratios.length &&
      next.every((r, i) => Math.abs(r - (root.ratios[i] ?? 0)) < 1e-6) &&
      root.userResized
    ) {
      return root;
    }
    return { ...root, ratios: next, userResized: true };
  }
  let changed = false;
  const nextChildren = root.children.map((c) => {
    const n = updateSplitRatios(c, splitNodeId, ratios);
    if (n !== c) changed = true;
    return n;
  });
  return changed ? { ...root, children: nextChildren } : root;
}
