window.ZS = window.ZS || {};

ZS.Pathfinding = (function () {
  const DIRS = [
    { dx: 1, dy: 0, w: 1.0 },
    { dx: -1, dy: 0, w: 1.0 },
    { dx: 0, dy: 1, w: 1.0 },
    { dx: 0, dy: -1, w: 1.0 },
    { dx: 1, dy: 1, w: 1.42 },
    { dx: 1, dy: -1, w: 1.42 },
    { dx: -1, dy: 1, w: 1.42 },
    { dx: -1, dy: -1, w: 1.42 }
  ];

  function isBlocking(structGrid, x, y) {
    const s = structGrid[y] && structGrid[y][x];
    if (!s) return false;
    if (s.id === 'command_hq') return false;
    const def = ZS.DATA.ITEMS[s.id];
    return !(def && def.passable);
  }

  function tilePenalty(structGrid, x, y) {
    const s = structGrid[y] && structGrid[y][x];
    if (!s || s.id === 'command_hq') return 0;
    const def = ZS.DATA.ITEMS[s.id];
    if (def && def.passable) return 0.15;
    return 11.5 + (s.hp || 100) / 34;
  }

  function computeFlowField(gridSize, hqPos, structGrid) {
    const INF = 1e9;
    const cost = Array.from({ length: gridSize }, () => Array(gridSize).fill(INF));
    const next = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
    const visited = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

    cost[hqPos.y][hqPos.x] = 0;

    // Simple O(N^2) Dijkstra on 22x22 (484 nodes) — ultra fast & zero GC churn
    const total = gridSize * gridSize;
    for (let iter = 0; iter < total; iter++) {
      let bestCost = INF;
      let cx = -1;
      let cy = -1;

      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (!visited[y][x] && cost[y][x] < bestCost) {
            bestCost = cost[y][x];
            cx = x;
            cy = y;
          }
        }
      }

      if (cx === -1) break;
      visited[cy][cx] = true;

      for (let d = 0; d < DIRS.length; d++) {
        const dir = DIRS[d];
        const nx = cx - dir.dx; // neighbor stepping TOWARD (cx, cy) via (+dir.dx, +dir.dy)
        const ny = cy - dir.dy;
        if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
        if (visited[ny][nx]) continue;

        // Prevent diagonal corner cutting around solid structures
        if (dir.dx !== 0 && dir.dy !== 0) {
          if (isBlocking(structGrid, nx + dir.dx, ny) || isBlocking(structGrid, nx, ny + dir.dy)) {
            continue;
          }
        }

        const stepCost = dir.w + tilePenalty(structGrid, cx, cy);
        const cand = bestCost + stepCost;
        if (cand < cost[ny][nx]) {
          cost[ny][nx] = cand;
          next[ny][nx] = { dx: dir.dx, dy: dir.dy };
        }
      }
    }

    return { cost, next };
  }

  return {
    computeFlowField,
    isBlocking
  };
})();
