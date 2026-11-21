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

  function getTileElev(terrainGrid, x, y) {
    const t = terrainGrid && terrainGrid[y] && terrainGrid[y][x];
    if (!t) return 0;
    if (t.kind === 'plateau') return t.elev != null ? t.elev : ((ZS.DATA && ZS.DATA.PLATEAU_ELEV_Z) || 10);
    if (t.kind === 'ramp') return t.elev != null ? t.elev : ((ZS.DATA && ZS.DATA.RAMP_ELEV_Z) || 5);
    return 0;
  }

  function isFlatWalkableTerrain(t) {
    return !t || (t.kind !== 'rock' && t.kind !== 'plateau' && t.kind !== 'ramp');
  }

  function canTraverseTerrainStep(terrainGrid, fx, fy, tx, ty) {
    if (!terrainGrid) return true;
    const dx = tx - fx;
    const dy = ty - fy;
    if (dx === 0 && dy === 0) return true;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;

    const fromT = terrainGrid[fy] && terrainGrid[fy][fx];
    const toT = terrainGrid[ty] && terrainGrid[ty][tx];
    if ((fromT && fromT.kind === 'rock') || (toT && toT.kind === 'rock')) return false;

    const isDiag = dx !== 0 && dy !== 0;

    if (toT && toT.kind === 'ramp') {
      if (isDiag) return false;
      const rd = toT.rampDir;
      if (!rd) return false;
      if (dx === rd.dx && dy === rd.dy) return isFlatWalkableTerrain(fromT);
      if (dx === -rd.dx && dy === -rd.dy) return !!(fromT && fromT.kind === 'plateau');
      return false;
    }

    if (fromT && fromT.kind === 'ramp') {
      if (isDiag) return false;
      const rd = fromT.rampDir;
      if (!rd) return false;
      if (dx === rd.dx && dy === rd.dy) return !!(toT && toT.kind === 'plateau');
      if (dx === -rd.dx && dy === -rd.dy) return isFlatWalkableTerrain(toT);
      return false;
    }

    const eFrom = fromT && fromT.kind === 'plateau' ? 10 : 0;
    const eTo = toT && toT.kind === 'plateau' ? 10 : 0;
    if (eFrom !== eTo) return false;

    if (isDiag) {
      const n1 = terrainGrid[fy] && terrainGrid[fy][tx];
      const n2 = terrainGrid[ty] && terrainGrid[ty][fx];
      if ((n1 && (n1.kind === 'rock' || n1.kind === 'ramp')) || (n2 && (n2.kind === 'rock' || n2.kind === 'ramp'))) {
        return false;
      }
      const e1 = n1 && n1.kind === 'plateau' ? 10 : 0;
      const e2 = n2 && n2.kind === 'plateau' ? 10 : 0;
      if (e1 !== eFrom || e2 !== eFrom) return false;
    }

    return true;
  }

  function isBlocking(structGrid, x, y, terrainGrid) {
    const tGrid = terrainGrid !== undefined ? terrainGrid : (ZS.Game && ZS.Game.state && ZS.Game.state.terrainGrid);
    const t = tGrid && tGrid[y] && tGrid[y][x];
    if (t && t.kind === 'rock') return true;
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
    if (def && def.subType === 'gate') return 2.0;
    return 44.0 + (s.hp || 100) / 25;
  }

  function computeFlowField(gridSize, hqPos, structGrid, terrainGrid) {
    const tGrid = terrainGrid !== undefined ? terrainGrid : (ZS.Game && ZS.Game.state && ZS.Game.state.terrainGrid);
    const INF = 1e9;
    const cost = Array.from({ length: gridSize }, () => Array(gridSize).fill(INF));
    const next = Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
    const visited = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

    cost[hqPos.y][hqPos.x] = 0;

    // Simple O(N^2) Dijkstra on 26x26 (676 nodes) — ultra fast & zero GC churn
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

        if (!canTraverseTerrainStep(tGrid, nx, ny, cx, cy)) continue;

        // Prevent diagonal corner cutting around solid structures and terrain obstacles
        if (dir.dx !== 0 && dir.dy !== 0) {
          if (isBlocking(structGrid, nx + dir.dx, ny, tGrid) || isBlocking(structGrid, nx, ny + dir.dy, tGrid)) {
            continue;
          }
        }

        let rampWeight = 0;
        const toTile = tGrid && tGrid[cy] && tGrid[cy][cx];
        if (toTile && toTile.kind === 'ramp' && toTile.rampDir) {
          if (dir.dx === toTile.rampDir.dx && dir.dy === toTile.rampDir.dy) {
            rampWeight = 0.35;
          } else if (dir.dx === -toTile.rampDir.dx && dir.dy === -toTile.rampDir.dy) {
            rampWeight = -0.15;
          }
        }

        const stepCost = dir.w + rampWeight + tilePenalty(structGrid, cx, cy);
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
    isBlocking,
    canTraverseTerrainStep,
    getTileElev
  };
})();
