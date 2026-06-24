/** Plinko route generation — destination-first, adjacent-lane only. */

export const NUM_ROWS = 12;
export const NUM_SLOTS = 13;
export const PEG_SPACING = 0.074;

const BOARD = {
  TOP: 0.06,
  PEG_BOTTOM: 0.73,
  SLOT_Y: 0.88,
  SPAWN_X: 0.5,
  SPAWN_Y: 0.035,
};

export interface PlinkoRouteNode {
  row: number;
  col: number;
  x: number;
  y: number;
}

export function slotToX(slot: number): number {
  const m = 0.032;
  return m + (slot / (NUM_SLOTS - 1)) * (1 - 2 * m);
}

function rowY(row: number): number {
  return BOARD.TOP + ((row + 0.5) / NUM_ROWS) * (BOARD.PEG_BOTTOM - BOARD.TOP);
}

/** Channel X for lane `col` at peg row — last row aligns with slot positions. */
export function channelX(row: number, col: number): number {
  if (row >= NUM_ROWS - 1) return slotToX(col);
  return 0.5 + (col - (row + 1) / 2) * PEG_SPACING;
}

/** Fisher-Yates shuffle — exactly `targetSlot` right moves in NUM_ROWS rows. */
export function generatePath(targetSlot: number): ('L' | 'R')[] {
  const rights = Math.max(0, Math.min(NUM_ROWS, targetSlot));
  const moves: ('L' | 'R')[] = [
    ...Array(rights).fill('R' as const),
    ...Array(NUM_ROWS - rights).fill('L' as const),
  ];
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  return moves;
}

/** Build complete peg route from L/R path — route is fixed before animation. */
export function buildRouteFromPath(path: ('L' | 'R')[], targetSlot: number): PlinkoRouteNode[] {
  let col = 0;
  const nodes: PlinkoRouteNode[] = [
    { row: -1, col: 0, x: BOARD.SPAWN_X, y: BOARD.SPAWN_Y },
  ];

  for (let row = 0; row < path.length; row++) {
    if (path[row] === 'R') col++;
    const x = row >= NUM_ROWS - 1 ? slotToX(col) : channelX(row, col);
    nodes.push({
      row,
      col,
      x,
      y: rowY(row) + 0.018,
    });
  }

  const finalX = slotToX(targetSlot);
  nodes[nodes.length - 1].x = finalX;
  nodes[nodes.length - 1].col = targetSlot;

  nodes.push({ row: NUM_ROWS, col: targetSlot, x: finalX, y: 0.758 });
  nodes.push({ row: NUM_ROWS + 1, col: targetSlot, x: finalX, y: 0.808 });
  nodes.push({ row: NUM_ROWS + 2, col: targetSlot, x: finalX, y: 0.858 });
  nodes.push({ row: NUM_ROWS + 3, col: targetSlot, x: finalX, y: BOARD.SLOT_Y });
  nodes.push({ row: NUM_ROWS + 4, col: targetSlot, x: finalX, y: BOARD.SLOT_Y + 0.006 });

  return nodes;
}

export function validateRoute(route: PlinkoRouteNode[], targetSlot: number): boolean {
  if (route.length < 3) return false;
  if (Math.abs(route[0].x - BOARD.SPAWN_X) > 0.0001) return false;
  if (Math.abs(route[0].y - BOARD.SPAWN_Y) > 0.0001) return false;

  const pegNodes = route.filter(n => n.row >= 0 && n.row < NUM_ROWS);
  if (pegNodes.length !== NUM_ROWS) return false;

  let prevCol = -1;
  for (const node of pegNodes) {
    if (prevCol >= 0) {
      const delta = node.col - prevCol;
      if (delta < 0 || delta > 1) return false;
    }
    prevCol = node.col;
  }

  if (prevCol !== targetSlot) return false;

  const finalX = slotToX(targetSlot);
  const lastPeg = pegNodes[pegNodes.length - 1];
  if (Math.abs(lastPeg.x - finalX) > 0.0001) return false;

  const dropNodes = route.filter(n => n.row >= NUM_ROWS);
  for (const node of dropNodes) {
    if (node.col !== targetSlot) return false;
    if (Math.abs(node.x - finalX) > 0.0001) return false;
  }

  return true;
}

/** Generate path + route with validation — regenerates on failure. */
export function generateValidatedDrop(targetSlot: number): {
  path: ('L' | 'R')[];
  route: PlinkoRouteNode[];
} {
  for (let attempt = 0; attempt < 64; attempt++) {
    const path = generatePath(targetSlot);
    const route = buildRouteFromPath(path, targetSlot);
    if (validateRoute(route, targetSlot)) {
      return { path, route };
    }
  }
  const path = generatePath(targetSlot);
  const route = buildRouteFromPath(path, targetSlot);
  return { path, route };
}
