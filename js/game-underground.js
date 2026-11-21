window.ZS = window.ZS || {};

(function () {
  const G = ZS._Game;
  const { DATA, state } = G;
  const B1_SIZE = DATA.B1_SIZE || 23;
  const ELEV_POS = DATA.B1_ELEVATOR_POS || { x: 11, y: 11 };
  const CARDINALS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  function tileSeed(x, y) {
    let h = ((x * 374761393) ^ (y * 668265263) ^ 0x51a7b3c9) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function getB1ChebyshevDist(tx, ty) {
    return Math.max(Math.abs(tx - ELEV_POS.x), Math.abs(ty - ELEV_POS.y));
  }

  function getB1RockTier(tx, ty) {
    const d = getB1ChebyshevDist(tx, ty);
    if (d <= 4) return 1;
    if (d <= 7) return 2;
    return 3;
  }

  function getB1RockTierName(tier) {
    if (tier === 1) return '내곽 연암';
    if (tier === 2) return '중곽 화강암';
    return '외곽 심층 현무암';
  }

  function getB1DigCost(tx, ty) {
    const tier = getB1RockTier(tx, ty);
    if (tier === 1) return 1;
    if (tier === 2) return 2;
    const drill2 = G.getTechLevel ? G.getTechLevel('b1_drill_2') : 0;
    return drill2 > 0 ? 2 : 3;
  }

  function isB1InnerCoord(tx, ty) {
    return tx >= 1 && ty >= 1 && tx <= B1_SIZE - 2 && ty <= B1_SIZE - 2;
  }

  function isB1CenterCore3x3(tx, ty) {
    return Math.abs(tx - ELEV_POS.x) <= 1 && Math.abs(ty - ELEV_POS.y) <= 1;
  }

  function createDefaultUnderground() {
    const grid = [];
    const b1StructGrid = [];
    for (let y = 0; y < B1_SIZE; y++) {
      const row = [];
      const sRow = [];
      for (let x = 0; x < B1_SIZE; x++) {
        const isBedrock = x === 0 || y === 0 || x === B1_SIZE - 1 || y === B1_SIZE - 1;
        const isElev = x === ELEV_POS.x && y === ELEV_POS.y;
        const isCore3x3 = isB1CenterCore3x3(x, y);
        const isPermCorridor = isCore3x3 && !isElev;
        row.push({
          excavated: isCore3x3,
          bedrock: isBedrock,
          permanentCorridor: isPermCorridor,
          elevator: isElev,
          permanentCore: isElev,
          rockTier: getB1RockTier(x, y),
          roomId: null,
          dirtSeed: +tileSeed(x, y).toFixed(4)
        });
        sRow.push(null);
      }
      grid.push(row);
      b1StructGrid.push(sRow);
    }

    return {
      grid,
      rooms: {},
      nextRoomId: 1,
      doors: {},
      b1StructGrid,
      lockedHighlightRoomId: null,
      lockedHighlightTimer: 0,
      rev: 1
    };
  }

  function ensureUndergroundState() {
    if (
      !state.underground ||
      !Array.isArray(state.underground.grid) ||
      state.underground.grid.length !== B1_SIZE
    ) {
      state.underground = createDefaultUnderground();
    }
    const ug = state.underground;
    if (!ug.rooms || typeof ug.rooms !== 'object') ug.rooms = {};
    if (!ug.doors || typeof ug.doors !== 'object') ug.doors = {};
    if (!Array.isArray(ug.b1StructGrid) || ug.b1StructGrid.length !== B1_SIZE) {
      ug.b1StructGrid = Array.from({ length: B1_SIZE }, () => Array(B1_SIZE).fill(null));
    }
    if (!Number.isFinite(ug.nextRoomId) || ug.nextRoomId < 1) ug.nextRoomId = 1;
    if (!Number.isFinite(ug.rev)) ug.rev = 1;
    if (ug.lockedHighlightTimer == null) ug.lockedHighlightTimer = 0;
    return ug;
  }

  function getB1Cell(tx, ty) {
    const ug = ensureUndergroundState();
    if (tx < 0 || ty < 0 || tx >= B1_SIZE || ty >= B1_SIZE) return null;
    return ug.grid[ty] && ug.grid[ty][tx] ? ug.grid[ty][tx] : null;
  }

  function getB1EdgeKey(x1, y1, x2, y2) {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return `${x1},${y1}|${x2},${y2}`;
    }
    return `${x2},${y2}|${x1},${y1}`;
  }

  function getB1RoomDef(role) {
    const map = DATA.B1_ROOMS || {};
    return map[role] || null;
  }

  function serializeUnderground() {
    const ug = ensureUndergroundState();
    return {
      grid: ug.grid.map((row) =>
        row.map((c) => ({
          excavated: !!c.excavated,
          bedrock: !!c.bedrock,
          permanentCorridor: !!c.permanentCorridor,
          elevator: !!c.elevator,
          permanentCore: !!c.permanentCore,
          rockTier: c.rockTier || 1,
          roomId: c.roomId != null ? c.roomId : null,
          dirtSeed: c.dirtSeed != null ? c.dirtSeed : 0.5
        }))
      ),
      rooms: JSON.parse(JSON.stringify(ug.rooms || {})),
      nextRoomId: ug.nextRoomId || 1,
      doors: JSON.parse(JSON.stringify(ug.doors || {})),
      b1StructGrid: ug.b1StructGrid.map((row) =>
        row.map((s) => (s ? JSON.parse(JSON.stringify(s)) : null))
      )
    };
  }

  function deserializeUnderground(raw) {
    const base = createDefaultUnderground();
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.grid) || raw.grid.length !== B1_SIZE) {
      state.underground = base;
      recomputeUndergroundConnectivity();
      return state.underground;
    }

    for (let y = 0; y < B1_SIZE; y++) {
      const srcRow = Array.isArray(raw.grid[y]) ? raw.grid[y] : null;
      const srcStructRow = Array.isArray(raw.b1StructGrid) && Array.isArray(raw.b1StructGrid[y]) ? raw.b1StructGrid[y] : null;
      if (!srcRow || srcRow.length !== B1_SIZE) {
        state.underground = base;
        recomputeUndergroundConnectivity();
        return state.underground;
      }
      for (let x = 0; x < B1_SIZE; x++) {
        const sc = srcRow[x] || {};
        const defCell = base.grid[y][x];
        if (defCell.bedrock) {
          base.grid[y][x] = defCell;
        } else if (defCell.elevator || defCell.permanentCorridor) {
          base.grid[y][x] = {
            ...defCell,
            excavated: true,
            roomId: null
          };
        } else {
          base.grid[y][x] = {
            excavated: !!sc.excavated,
            bedrock: false,
            permanentCorridor: false,
            elevator: false,
            permanentCore: false,
            rockTier: getB1RockTier(x, y),
            roomId: sc.excavated && sc.roomId != null ? Number(sc.roomId) : null,
            dirtSeed: Number.isFinite(sc.dirtSeed) ? sc.dirtSeed : defCell.dirtSeed
          };
        }
        if (srcStructRow && srcStructRow[x] && !defCell.bedrock && !defCell.elevator) {
          base.b1StructGrid[y][x] = { ...srcStructRow[x] };
        }
      }
    }

    let maxRoomId = 0;
    if (raw.rooms && typeof raw.rooms === 'object') {
      const keys = Object.keys(raw.rooms);
      for (let i = 0; i < keys.length; i++) {
        const r = raw.rooms[keys[i]];
        if (!r || !getB1RoomDef(r.role)) continue;
        const rid = Math.floor(Number(r.id != null ? r.id : keys[i]));
        if (!Number.isFinite(rid) || rid < 1) continue;
        base.rooms[rid] = {
          id: rid,
          role: r.role,
          tiles: [],
          connected: false
        };
        if (rid > maxRoomId) maxRoomId = rid;
      }
    }

    // Ensure every grid cell's roomId points to an existing room
    for (let y = 1; y < B1_SIZE - 1; y++) {
      for (let x = 1; x < B1_SIZE - 1; x++) {
        const c = base.grid[y][x];
        if (c.roomId != null && !base.rooms[c.roomId]) {
          c.roomId = null;
        }
        if (c.roomId != null && c.roomId > maxRoomId) maxRoomId = c.roomId;
      }
    }

    base.nextRoomId = Math.max(maxRoomId + 1, Math.floor(Number(raw.nextRoomId) || 1));

    if (raw.doors && typeof raw.doors === 'object') {
      const dKeys = Object.keys(raw.doors);
      for (let i = 0; i < dKeys.length; i++) {
        const d = raw.doors[dKeys[i]];
        if (!d || !Array.isArray(d.a) || !Array.isArray(d.b)) continue;
        const x1 = Math.floor(Number(d.a[0]));
        const y1 = Math.floor(Number(d.a[1]));
        const x2 = Math.floor(Number(d.b[0]));
        const y2 = Math.floor(Number(d.b[1]));
        if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) continue;
        const k = getB1EdgeKey(x1, y1, x2, y2);
        base.doors[k] = x1 < x2 || (x1 === x2 && y1 < y2)
          ? { a: [x1, y1], b: [x2, y2] }
          : { a: [x2, y2], b: [x1, y1] };
      }
    }

    state.underground = base;
    reconcileB1Rooms();
    pruneInvalidB1Doors();
    recomputeUndergroundConnectivity();
    base.rev += 1;
    return base;
  }

  // ================= LAYER SWITCHING (DAYTIME ONLY) =================
  function clearTransientLayerVfx() {
    state.particles = [];
    state.floatingTexts = [];
  }

  function enterUnderground() {
    if (!state.undergroundUnlocked) {
      if (ZS.Audio && ZS.Audio.playError) ZS.Audio.playError();
      G.banner('지하 쉘터 미개방', '지휘 본부 Lv.2(Wave 20+) 증축 시 지하 B1 승강기가 개방됩니다.', 'warn');
      return false;
    }
    if (state.phase !== 'day') {
      if (ZS.Audio && ZS.Audio.playError) ZS.Audio.playError();
      G.banner('지하 진입 불가', '야간 방어 중에는 지상으로만 지휘할 수 있습니다.', 'warn');
      return false;
    }
    if (state.activeLayer === 'underground') return true;

    ensureUndergroundState();
    recomputeUndergroundConnectivity();

    if (ZS.Iso && ZS.Iso.saveLayerCamera) {
      ZS.Iso.saveLayerCamera('surface');
    }
    state.activeLayer = 'underground';
    clearTransientLayerVfx();
    G.pendingVeteranDemolish = null;

    if (ZS.Iso && ZS.Iso.restoreLayerCamera) {
      ZS.Iso.restoreLayerCamera('underground');
    }
    if (ZS._UI && ZS._UI.onLayerChanged) {
      ZS._UI.onLayerChanged('underground');
    }
    if (ZS.Audio && ZS.Audio.playDoor) ZS.Audio.playDoor();
    G.notifyUi();
    return true;
  }

  function exitUnderground() {
    if (state.activeLayer === 'surface') return true;

    if (ZS.Iso && ZS.Iso.saveLayerCamera) {
      ZS.Iso.saveLayerCamera('underground');
    }
    state.activeLayer = 'surface';
    clearTransientLayerVfx();

    if (ZS.Iso && ZS.Iso.restoreLayerCamera) {
      ZS.Iso.restoreLayerCamera('surface');
    }
    if (ZS._UI && ZS._UI.onLayerChanged) {
      ZS._UI.onLayerChanged('surface');
    }
    if (ZS.Audio && ZS.Audio.playDoor) ZS.Audio.playDoor();
    G.notifyUi();
    return true;
  }

  function toggleActiveLayer() {
    if (state.activeLayer === 'underground') {
      return exitUnderground();
    }
    return enterUnderground();
  }

  // ================= RADIAL EXCAVATION & SALVAGE =================
  function hasExcavatedNeighbor(ug, tx, ty) {
    for (let i = 0; i < 4; i++) {
      const nx = tx + CARDINALS[i][0];
      const ny = ty + CARDINALS[i][1];
      if (nx < 0 || ny < 0 || nx >= B1_SIZE || ny >= B1_SIZE) continue;
      const nc = ug.grid[ny] && ug.grid[ny][nx];
      if (nc && nc.excavated) return true;
    }
    return false;
  }

  function canDigTile(tx, ty) {
    if (!state.undergroundUnlocked) {
      return { ok: false, cost: 0, tier: 1, reason: '지하 B1이 아직 개방되지 않았습니다.' };
    }
    if (state.phase !== 'day') {
      return { ok: false, cost: 0, tier: 1, reason: '야간 전투 중에는 지하 굴착을 진행할 수 없습니다.' };
    }
    if (state.activeLayer !== 'underground') {
      return { ok: false, cost: 0, tier: 1, reason: '지하 B1 레이어에서만 굴착할 수 있습니다.' };
    }
    const ug = ensureUndergroundState();
    if (tx < 0 || ty < 0 || tx >= B1_SIZE || ty >= B1_SIZE) {
      return { ok: false, cost: 0, tier: 3, reason: '지하 구역 범위를 벗어났습니다.' };
    }
    const cell = ug.grid[ty][tx];
    if (!cell) return { ok: false, cost: 0, tier: 3, reason: '잘못된 타일입니다.' };
    if (cell.bedrock) {
      return { ok: false, cost: 0, tier: 3, reason: '기반암(외곽 테두리)은 굴착할 수 없습니다.' };
    }
    const tier = getB1RockTier(tx, ty);
    const cost = getB1DigCost(tx, ty);
    if (cell.excavated) {
      return { ok: false, cost, tier, alreadyExcavated: true, reason: '이미 굴착된 공간입니다.' };
    }
    if (!hasExcavatedNeighbor(ug, tx, ty)) {
      return { ok: false, cost, tier, notAdjacent: true, reason: '열린 공간과 상하좌우로 인접한 암반만 굴착할 수 있습니다.' };
    }
    if ((state.digAp || 0) < cost) {
      return {
        ok: false,
        cost,
        tier,
        shortAp: true,
        reason: `굴착 AP 부족 (필요 ${cost} AP · 보유 ${Math.floor(state.digAp || 0)} AP)`
      };
    }
    return { ok: true, cost, tier, tierName: getB1RockTierName(tier) };
  }

  function rollB1Salvage(tier) {
    const drill1 = G.getTechLevel ? G.getTechLevel('b1_drill_1') : 0;
    const rewardMult = drill1 > 0 ? 1.25 : 1.0;
    const roll = Math.random();

    if (tier === 1) {
      if (roll >= 0.18) return null;
      const isScrap = Math.random() < 0.55;
      const baseAmt = isScrap ? (6 + Math.floor(Math.random() * 7)) : (4 + Math.floor(Math.random() * 5));
      const amt = Math.max(1, Math.round(baseAmt * rewardMult));
      return isScrap ? { kind: 'scrap', amount: amt } : { kind: 'coin', amount: amt };
    }

    if (tier === 2) {
      if (roll >= 0.28) return null;
      const typeRoll = Math.random();
      if (typeRoll < 0.42) {
        const amt = Math.max(1, Math.round((12 + Math.floor(Math.random() * 11)) * rewardMult));
        return { kind: 'scrap', amount: amt };
      }
      if (typeRoll < 0.76) {
        const amt = Math.max(1, Math.round((8 + Math.floor(Math.random() * 8)) * rewardMult));
        return { kind: 'coin', amount: amt };
      }
      const amt = Math.max(1, Math.round(2 * rewardMult));
      return { kind: 'rp', amount: amt };
    }

    // Tier 3 (d >= 8)
    if (roll >= 0.42) return null;
    const typeRoll = Math.random();
    if (typeRoll < 0.38) {
      const amt = Math.max(1, Math.round((22 + Math.floor(Math.random() * 17)) * rewardMult));
      return { kind: 'scrap', amount: amt };
    }
    if (typeRoll < 0.72) {
      const amt = Math.max(1, Math.round((16 + Math.floor(Math.random() * 13)) * rewardMult));
      return { kind: 'coin', amount: amt };
    }
    const amt = Math.max(1, Math.round((4 + Math.floor(Math.random() * 3)) * rewardMult));
    return { kind: 'rp', amount: amt };
  }

  function digTileAt(tx, ty, opts) {
    const silent = !!(opts && opts.silent);
    const check = canDigTile(tx, ty);
    if (!check.ok) {
      if (!silent) {
        if (ZS.Audio && ZS.Audio.playError) ZS.Audio.playError();
        G.banner('굴착 불가', check.reason, 'warn');
      }
      return false;
    }

    const ug = ensureUndergroundState();
    const cell = ug.grid[ty][tx];
    state.digAp = Math.max(0, (state.digAp || 0) - check.cost);
    cell.excavated = true;
    cell.roomId = null;
    ug.rev += 1;

    const salvage = rollB1Salvage(check.tier);
    if (salvage) {
      if (salvage.kind === 'scrap') {
        state.scrap = (state.scrap || 0) + salvage.amount;
        if (G.addFloatingText) {
          G.addFloatingText(tx + 0.5, ty + 0.5, 22, `+${salvage.amount} 고철`, DATA.PALETTE.resScrap, 13, DATA.PALETTE.outlineDark);
        }
      } else if (salvage.kind === 'coin') {
        state.coin = (state.coin || 0) + salvage.amount;
        if (G.addFloatingText) {
          G.addFloatingText(tx + 0.5, ty + 0.5, 22, `+${salvage.amount} 코인`, DATA.PALETTE.coin, 13, DATA.PALETTE.outlineDark);
        }
      } else if (salvage.kind === 'rp') {
        state.rp = (state.rp || 0) + salvage.amount;
        if (G.addFloatingText) {
          G.addFloatingText(tx + 0.5, ty + 0.5, 22, `+${salvage.amount} RP`, '#C084FC', 13, DATA.PALETTE.outlineDark);
        }
      }
    }

    if (G.addFloatingText) {
      G.addFloatingText(tx + 0.5, ty + 0.5, salvage ? 11 : 16, `-${check.cost} AP`, '#F59E0B', 12, DATA.PALETTE.outlineDark);
    }

    // Rock crumble cubes & dust puffs (no cyan!)
    const rockColors = check.tier === 1
      ? ['#73685B', '#5C4B3B', '#8C7E6D']
      : check.tier === 2
      ? ['#58616C', '#454D56', '#727D8A']
      : ['#3B434F', '#292F38', '#8E6A42'];
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 1.9;
      const life = 0.40 + Math.random() * 0.24;
      const pt = {
        kind: 'cube',
        x: tx + 0.5 + (Math.random() - 0.5) * 0.35,
        y: ty + 0.5 + (Math.random() - 0.5) * 0.35,
        z: 4 + Math.random() * 6,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        vz: 18 + Math.random() * 24,
        w: 0.08 + Math.random() * 0.05,
        h: 2.4 + Math.random() * 2.2,
        color: rockColors[i % rockColors.length],
        bounced: false,
        life,
        maxLife: life
      };
      if (G.pushParticle) G.pushParticle(pt);
      else state.particles.push(pt);
    }
    if (G.spawnBuildDustPuffs) {
      G.spawnBuildDustPuffs(tx + 0.5, ty + 0.5, 5);
    }

    if (ZS.Audio && ZS.Audio.playDig) ZS.Audio.playDig();
    else if (ZS.Audio && ZS.Audio.playBuild) ZS.Audio.playBuild();

    if (salvage) {
      const resLabel = salvage.kind === 'scrap' ? `고철 +${salvage.amount}` : salvage.kind === 'coin' ? `코인 +${salvage.amount}` : `연구 샘플 +${salvage.amount} RP`;
      G.banner(`매장물 발견 (${getB1RockTierName(check.tier)})`, `암반 굴착 중 ${resLabel} 회수!`, 'good');
    }

    G.saveGame();
    G.notifyUi();
    return true;
  }

  // ================= DRAG ROOM ZONING, LOCKING & RECONCILIATION =================
  function getB1RoomGadgetTiles(roomId) {
    const ug = ensureUndergroundState();
    const out = [];
    if (roomId == null) return out;
    for (let y = 1; y < B1_SIZE - 1; y++) {
      for (let x = 1; x < B1_SIZE - 1; x++) {
        const c = ug.grid[y][x];
        if (c && c.roomId === roomId && ug.b1StructGrid[y] && ug.b1StructGrid[y][x]) {
          out.push([x, y]);
        }
      }
    }
    return out;
  }

  function roomHasGadgets(roomId) {
    if (roomId == null) return false;
    const ug = ensureUndergroundState();
    const room = ug.rooms[roomId];
    if (room && Array.isArray(room.tiles) && room.tiles.length > 0) {
      for (let i = 0; i < room.tiles.length; i++) {
        const [x, y] = room.tiles[i];
        if (ug.b1StructGrid[y] && ug.b1StructGrid[y][x]) return true;
      }
      return false;
    }
    return getB1RoomGadgetTiles(roomId).length > 0;
  }

  function triggerB1LockHighlight(roomId) {
    const ug = ensureUndergroundState();
    ug.lockedHighlightRoomId = roomId;
    ug.lockedHighlightTimer = 2.0;
    if (ZS.Audio && ZS.Audio.playError) ZS.Audio.playError();
    G.banner('구역 수정 잠금', '구역 내부의 시설·가젯을 모두 제거한 뒤 수정하세요.', 'warn');
    G.notifyUi();
  }

  function reconcileB1Rooms() {
    const ug = ensureUndergroundState();
    const tilesByRoom = new Map();

    for (let y = 1; y < B1_SIZE - 1; y++) {
      for (let x = 1; x < B1_SIZE - 1; x++) {
        const c = ug.grid[y][x];
        if (!c || !c.excavated || c.permanentCorridor || c.elevator || c.bedrock) {
          if (c) c.roomId = null;
          continue;
        }
        if (c.roomId != null) {
          if (!ug.rooms[c.roomId]) {
            c.roomId = null;
            continue;
          }
          let arr = tilesByRoom.get(c.roomId);
          if (!arr) {
            arr = [];
            tilesByRoom.set(c.roomId, arr);
          }
          arr.push([x, y]);
        }
      }
    }

    // Delete empty rooms
    const existingIds = Object.keys(ug.rooms);
    for (let i = 0; i < existingIds.length; i++) {
      const rid = Number(existingIds[i]);
      if (!tilesByRoom.has(rid)) {
        delete ug.rooms[rid];
      }
    }

    // Split any disconnected room components into separate room IDs
    const visited = new Uint8Array(B1_SIZE * B1_SIZE);
    const orderedRids = Array.from(tilesByRoom.keys()).sort((a, b) => a - b);
    for (let ri = 0; ri < orderedRids.length; ri++) {
      const rid = orderedRids[ri];
      const room = ug.rooms[rid];
      const tiles = tilesByRoom.get(rid);
      if (!room || !tiles || tiles.length === 0) continue;

      const tileSet = new Set();
      for (let i = 0; i < tiles.length; i++) {
        tileSet.add(tiles[i][1] * B1_SIZE + tiles[i][0]);
      }

      const components = [];
      for (let i = 0; i < tiles.length; i++) {
        const sx = tiles[i][0];
        const sy = tiles[i][1];
        const sIdx = sy * B1_SIZE + sx;
        if (visited[sIdx]) continue;

        const comp = [];
        const q = [[sx, sy]];
        visited[sIdx] = 1;
        let head = 0;
        while (head < q.length) {
          const [cx, cy] = q[head++];
          comp.push([cx, cy]);
          for (let k = 0; k < 4; k++) {
            const nx = cx + CARDINALS[k][0];
            const ny = cy + CARDINALS[k][1];
            if (nx < 1 || ny < 1 || nx >= B1_SIZE - 1 || ny >= B1_SIZE - 1) continue;
            const nIdx = ny * B1_SIZE + nx;
            if (visited[nIdx] || !tileSet.has(nIdx)) continue;
            visited[nIdx] = 1;
            q.push([nx, ny]);
          }
        }
        components.push(comp);
      }

      room.tiles = components[0];
      for (let ci = 1; ci < components.length; ci++) {
        const newId = ug.nextRoomId++;
        const comp = components[ci];
        ug.rooms[newId] = {
          id: newId,
          role: room.role,
          tiles: comp,
          connected: false
        };
        for (let ti = 0; ti < comp.length; ti++) {
          ug.grid[comp[ti][1]][comp[ti][0]].roomId = newId;
        }
      }
    }
  }

  function isValidB1DoorEdge(x1, y1, x2, y2) {
    if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) {
      return { ok: false, reason: '인접한 두 타일 경계에만 방폭문을 설치할 수 있습니다.' };
    }
    const c1 = getB1Cell(x1, y1);
    const c2 = getB1Cell(x2, y2);
    if (!c1 || !c2 || c1.bedrock || c2.bedrock || !c1.excavated || !c2.excavated) {
      return { ok: false, reason: '굴착된 두 열린 타일 사이의 콘크리트 격벽에만 방폭문을 설치할 수 있습니다.' };
    }
    if (c1.elevator || c2.elevator) {
      return { ok: false, reason: '승강기 코어 직결 경계에는 방폭문을 설치할 수 없습니다.' };
    }
    if (c1.roomId === c2.roomId) {
      return { ok: false, reason: '구역과 복도 또는 서로 다른 구역 사이의 콘크리트 격벽을 클릭하세요.' };
    }
    const key = getB1EdgeKey(x1, y1, x2, y2);
    const ordered = x1 < x2 || (x1 === x2 && y1 < y2)
      ? { a: [x1, y1], b: [x2, y2] }
      : { a: [x2, y2], b: [x1, y1] };
    return { ok: true, key, a: ordered.a, b: ordered.b };
  }

  function pruneInvalidB1Doors() {
    const ug = ensureUndergroundState();
    const keys = Object.keys(ug.doors);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const d = ug.doors[k];
      if (!d || !Array.isArray(d.a) || !Array.isArray(d.b)) {
        delete ug.doors[k];
        continue;
      }
      const check = isValidB1DoorEdge(d.a[0], d.a[1], d.b[0], d.b[1]);
      if (!check.ok) {
        delete ug.doors[k];
      }
    }
  }

  function recomputeUndergroundConnectivity() {
    const ug = ensureUndergroundState();
    const rKeys = Object.keys(ug.rooms);
    for (let i = 0; i < rKeys.length; i++) {
      if (ug.rooms[rKeys[i]]) ug.rooms[rKeys[i]].connected = false;
    }

    const visited = new Uint8Array(B1_SIZE * B1_SIZE);
    const queue = [];

    // Seed BFS from all 8 permanent corridor tiles surrounding (11, 11)
    for (let y = ELEV_POS.y - 1; y <= ELEV_POS.y + 1; y++) {
      for (let x = ELEV_POS.x - 1; x <= ELEV_POS.x + 1; x++) {
        const c = ug.grid[y] && ug.grid[y][x];
        if (c && c.excavated && c.permanentCorridor && !c.elevator) {
          visited[y * B1_SIZE + x] = 1;
          queue.push([x, y]);
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      const curCell = ug.grid[cy][cx];
      const curRoomId = curCell.roomId != null ? curCell.roomId : null;

      for (let k = 0; k < 4; k++) {
        const nx = cx + CARDINALS[k][0];
        const ny = cy + CARDINALS[k][1];
        if (nx < 1 || ny < 1 || nx >= B1_SIZE - 1 || ny >= B1_SIZE - 1) continue;
        const nIdx = ny * B1_SIZE + nx;
        if (visited[nIdx]) continue;
        const nCell = ug.grid[ny][nx];
        if (!nCell || !nCell.excavated || nCell.bedrock || nCell.elevator) continue;

        const nextRoomId = nCell.roomId != null ? nCell.roomId : null;
        let canCross = false;
        if (curRoomId === nextRoomId) {
          canCross = true;
        } else {
          const edgeKey = getB1EdgeKey(cx, cy, nx, ny);
          if (ug.doors[edgeKey]) canCross = true;
        }
        if (!canCross) continue;

        visited[nIdx] = 1;
        queue.push([nx, ny]);
        if (nextRoomId != null && ug.rooms[nextRoomId]) {
          ug.rooms[nextRoomId].connected = true;
        }
      }
    }

    let connectedRooms = 0;
    const totalRooms = rKeys.length;
    for (let i = 0; i < totalRooms; i++) {
      if (ug.rooms[rKeys[i]] && ug.rooms[rKeys[i]].connected) connectedRooms += 1;
    }
    return { connectedRooms, totalRooms };
  }

  function isUndergroundTileConnected(tx, ty) {
    const ug = ensureUndergroundState();
    const cell = getB1Cell(tx, ty);
    if (!cell || !cell.excavated) return false;
    if (cell.permanentCorridor || cell.elevator) return true;
    if (cell.roomId == null) return false;
    const r = ug.rooms[cell.roomId];
    return !!(r && r.connected);
  }

  function getRectBounds(x0, y0, x1, y1) {
    return {
      minX: Math.max(1, Math.min(B1_SIZE - 2, Math.floor(Math.min(x0, x1)))),
      maxX: Math.max(1, Math.min(B1_SIZE - 2, Math.floor(Math.max(x0, x1)))),
      minY: Math.max(1, Math.min(B1_SIZE - 2, Math.floor(Math.min(y0, y1)))),
      maxY: Math.max(1, Math.min(B1_SIZE - 2, Math.floor(Math.max(y0, y1))))
    };
  }

  function canZoneB1Rect(x0, y0, x1, y1, role) {
    if (state.phase !== 'day' || !state.undergroundUnlocked || state.activeLayer !== 'underground') {
      return { ok: false, validTiles: [], blockedTiles: [], reason: '주간 지하 B1 레이어에서만 구역을 지정할 수 있습니다.' };
    }
    if (!getB1RoomDef(role)) {
      return { ok: false, validTiles: [], blockedTiles: [], reason: '알 수 없는 방 역할입니다.' };
    }
    const ug = ensureUndergroundState();
    const { minX, maxX, minY, maxY } = getRectBounds(x0, y0, x1, y1);
    const validTiles = [];
    const blockedTiles = [];
    const touchedRoomIds = new Set();

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const c = ug.grid[y][x];
        if (!c || !c.excavated || c.bedrock || c.permanentCorridor || c.elevator) {
          blockedTiles.push([x, y]);
          continue;
        }
        validTiles.push([x, y]);
        if (c.roomId != null) touchedRoomIds.add(c.roomId);
      }
    }

    if (validTiles.length === 0) {
      return {
        ok: false,
        validTiles,
        blockedTiles,
        reason: '굴착된 빈 공간(중앙 승강기 홀 복도 제외) 위에서만 구역을 지정할 수 있습니다.'
      };
    }

    // Include same-role adjacent rooms as merge targets
    for (let i = 0; i < validTiles.length; i++) {
      const [vx, vy] = validTiles[i];
      for (let k = 0; k < 4; k++) {
        const nx = vx + CARDINALS[k][0];
        const ny = vy + CARDINALS[k][1];
        if (nx < 1 || ny < 1 || nx >= B1_SIZE - 1 || ny >= B1_SIZE - 1) continue;
        const nc = ug.grid[ny][nx];
        if (nc && nc.roomId != null) {
          const nRoom = ug.rooms[nc.roomId];
          if (nRoom && nRoom.role === role) {
            touchedRoomIds.add(nc.roomId);
          }
        }
      }
    }

    for (const rid of touchedRoomIds) {
      if (roomHasGadgets(rid)) {
        return {
          ok: false,
          validTiles,
          blockedTiles,
          lockedRoomId: rid,
          reason: '구역 내부의 시설·가젯을 모두 제거한 뒤 수정하세요.'
        };
      }
    }

    return { ok: true, validTiles, blockedTiles, touchedRoomIds };
  }

  function zoneB1Rect(x0, y0, x1, y1, role) {
    const check = canZoneB1Rect(x0, y0, x1, y1, role);
    if (!check.ok) {
      if (check.lockedRoomId != null) {
        triggerB1LockHighlight(check.lockedRoomId);
      } else {
        if (ZS.Audio && ZS.Audio.playError) ZS.Audio.playError();
        G.banner('구역 지정 불가', check.reason, 'warn');
      }
      return false;
    }

    const ug = ensureUndergroundState();
    const sameRoleIds = [];
    for (const rid of check.touchedRoomIds) {
      const r = ug.rooms[rid];
      if (r && r.role === role) sameRoleIds.push(rid);
    }

    let changed = false;
    const targetRoomId = sameRoleIds.length > 0 ? Math.min(...sameRoleIds) : ug.nextRoomId++;
    if (!ug.rooms[targetRoomId]) {
      ug.rooms[targetRoomId] = {
        id: targetRoomId,
        role,
        tiles: [],
        connected: false
      };
      changed = true;
    }

    if (sameRoleIds.length > 1) {
      const mergeSet = new Set(sameRoleIds);
      for (let y = 1; y < B1_SIZE - 1; y++) {
        for (let x = 1; x < B1_SIZE - 1; x++) {
          const c = ug.grid[y][x];
          if (c && c.roomId != null && mergeSet.has(c.roomId) && c.roomId !== targetRoomId) {
            c.roomId = targetRoomId;
            changed = true;
          }
        }
      }
    }

    for (let i = 0; i < check.validTiles.length; i++) {
      const [vx, vy] = check.validTiles[i];
      if (ug.grid[vy][vx].roomId !== targetRoomId) {
        ug.grid[vy][vx].roomId = targetRoomId;
        changed = true;
      }
    }

    if (!changed) return true;

    reconcileB1Rooms();
    pruneInvalidB1Doors();
    recomputeUndergroundConnectivity();
    ug.rev += 1;

    if (ZS.Audio && ZS.Audio.playBuild) ZS.Audio.playBuild();
    G.saveGame();
    G.notifyUi();
    return true;
  }

  function zoneB1Tile(tx, ty, role) {
    return zoneB1Rect(tx, ty, tx, ty, role);
  }

  function canUnzoneB1Rect(x0, y0, x1, y1) {
    if (state.phase !== 'day' || !state.undergroundUnlocked || state.activeLayer !== 'underground') {
      return { ok: false, validTiles: [], reason: '주간 지하 B1 레이어에서만 구역을 해제할 수 있습니다.' };
    }
    const ug = ensureUndergroundState();
    const { minX, maxX, minY, maxY } = getRectBounds(x0, y0, x1, y1);
    const validTiles = [];
    const touchedRoomIds = new Set();

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const c = ug.grid[y][x];
        if (!c || !c.excavated || c.roomId == null) continue;
        validTiles.push([x, y]);
        touchedRoomIds.add(c.roomId);
      }
    }

    if (validTiles.length === 0) {
      return { ok: false, validTiles, reason: '해제할 구역 타일이 없습니다.' };
    }

    for (const rid of touchedRoomIds) {
      if (roomHasGadgets(rid)) {
        return {
          ok: false,
          validTiles,
          lockedRoomId: rid,
          reason: '구역 내부의 시설·가젯을 모두 제거한 뒤 수정하세요.'
        };
      }
    }

    return { ok: true, validTiles, touchedRoomIds };
  }

  function unzoneB1Rect(x0, y0, x1, y1) {
    const check = canUnzoneB1Rect(x0, y0, x1, y1);
    if (!check.ok) {
      if (check.lockedRoomId != null) {
        triggerB1LockHighlight(check.lockedRoomId);
      } else {
        if (ZS.Audio && ZS.Audio.playError) ZS.Audio.playError();
      }
      return false;
    }

    const ug = ensureUndergroundState();
    for (let i = 0; i < check.validTiles.length; i++) {
      const [vx, vy] = check.validTiles[i];
      ug.grid[vy][vx].roomId = null;
    }

    reconcileB1Rooms();
    pruneInvalidB1Doors();
    recomputeUndergroundConnectivity();
    ug.rev += 1;

    if (ZS.Audio && ZS.Audio.playRemove) ZS.Audio.playRemove();
    G.saveGame();
    G.notifyUi();
    return true;
  }

  function unzoneB1Tile(tx, ty) {
    return unzoneB1Rect(tx, ty, tx, ty);
  }

  // ================= BLAST DOORS =================
  function findNearestB1DoorEdge(sx, sy, gx, gy) {
    if (!state.undergroundUnlocked || state.activeLayer !== 'underground') return null;
    const ug = ensureUndergroundState();
    const Iso = ZS.Iso;
    const wallMidZ = (DATA.B1_WALL_Z || 10) * 0.45;
    const tx = Math.floor(gx);
    const ty = Math.floor(gy);
    const candidates = new Map();

    for (let cy = Math.max(1, ty - 1); cy <= Math.min(B1_SIZE - 2, ty + 1); cy++) {
      for (let cx = Math.max(1, tx - 1); cx <= Math.min(B1_SIZE - 2, tx + 1); cx++) {
        const dirs = [
          [1, 0],
          [0, 1]
        ];
        for (let d = 0; d < dirs.length; d++) {
          const nx = cx + dirs[d][0];
          const ny = cy + dirs[d][1];
          if (nx < 1 || ny < 1 || nx >= B1_SIZE - 1 || ny >= B1_SIZE - 1) continue;
          const v = isValidB1DoorEdge(cx, cy, nx, ny);
          if (!v.ok || candidates.has(v.key)) continue;
          candidates.set(v.key, v);
        }
      }
    }

    if (candidates.size === 0) return null;

    let best = null;
    let bestScore = Infinity;
    const zScale = Iso ? Iso.cam.zoom : 1;
    const maxPxDist = 36 * zScale;

    for (const v of candidates.values()) {
      const mx = (v.a[0] + v.b[0] + 1) * 0.5;
      const my = (v.a[1] + v.b[1] + 1) * 0.5;
      let score;
      if (Iso && sx != null && sy != null) {
        const sp = Iso.gridToScreen(mx, my, wallMidZ);
        const pxDist = Math.hypot(sp.x - sx, sp.y - sy);
        const touchesHoveredTile =
          (v.a[0] === tx && v.a[1] === ty) || (v.b[0] === tx && v.b[1] === ty);
        if (pxDist > maxPxDist && !touchesHoveredTile) continue;
        score = pxDist;
      } else {
        score = Math.hypot(mx - gx, my - gy);
      }
      if (score < bestScore) {
        bestScore = score;
        best = {
          key: v.key,
          a: v.a,
          b: v.b,
          hasDoor: !!ug.doors[v.key]
        };
      }
    }

    return best;
  }

  function toggleB1Door(x1, y1, x2, y2) {
    if (state.phase !== 'day' || !state.undergroundUnlocked || state.activeLayer !== 'underground') {
      if (ZS.Audio && ZS.Audio.playError) ZS.Audio.playError();
      return false;
    }
    const check = isValidB1DoorEdge(x1, y1, x2, y2);
    if (!check.ok) {
      if (ZS.Audio && ZS.Audio.playError) ZS.Audio.playError();
      G.banner('방폭문 설치 불가', check.reason, 'warn');
      return false;
    }
    const ug = ensureUndergroundState();
    const hadDoor = !!ug.doors[check.key];
    if (hadDoor) {
      delete ug.doors[check.key];
    } else {
      ug.doors[check.key] = { a: check.a, b: check.b };
    }
    recomputeUndergroundConnectivity();
    ug.rev += 1;

    if (ZS.Audio && ZS.Audio.playDoor) ZS.Audio.playDoor();
    else if (ZS.Audio && ZS.Audio.playBuild) ZS.Audio.playBuild();

    G.saveGame();
    G.notifyUi();
    return true;
  }

  function getB1Summary() {
    const ug = ensureUndergroundState();
    let excavatedCount = 0;
    let gadgetCount = 0;
    for (let y = 1; y < B1_SIZE - 1; y++) {
      for (let x = 1; x < B1_SIZE - 1; x++) {
        const c = ug.grid[y][x];
        if (c && c.excavated && !c.elevator && !c.permanentCorridor) excavatedCount += 1;
        if (ug.b1StructGrid[y] && ug.b1StructGrid[y][x]) gadgetCount += 1;
      }
    }
    const rKeys = Object.keys(ug.rooms);
    let connectedRooms = 0;
    for (let i = 0; i < rKeys.length; i++) {
      if (ug.rooms[rKeys[i]] && ug.rooms[rKeys[i]].connected) connectedRooms += 1;
    }
    return {
      excavatedCount,
      roomCount: rKeys.length,
      connectedRooms,
      doorCount: Object.keys(ug.doors).length,
      gadgetCount
    };
  }

  function updateUnderground(rawDt) {
    const ug = state.underground;
    if (!ug) return;
    if (ug.lockedHighlightTimer > 0) {
      ug.lockedHighlightTimer = Math.max(0, ug.lockedHighlightTimer - rawDt);
      if (ug.lockedHighlightTimer <= 0) {
        ug.lockedHighlightRoomId = null;
      }
    }
  }

  function debugAddDigAp(amount) {
    if (!G.isDebugAllowed || !G.isDebugAllowed()) return false;
    const add = Number(amount) || 20;
    state.undergroundUnlocked = true;
    ensureUndergroundState();
    state.digApCap = Math.max(state.digApCap || 24, (state.digAp || 0) + add);
    state.digAp = (state.digAp || 0) + add;
    if (ZS.Audio && ZS.Audio.playTrade) ZS.Audio.playTrade();
    G.banner(`[DEBUG] +${add} 굴착 AP 지급`, `지하 B1 개방 · 보유 굴착력 ${state.digAp}/${state.digApCap} AP`, 'good');
    G.saveGame();
    G.notifyUi();
    return true;
  }

  Object.assign(G, {
    getB1ChebyshevDist,
    getB1RockTier,
    getB1RockTierName,
    getB1DigCost,
    isB1InnerCoord,
    createDefaultUnderground,
    ensureUndergroundState,
    getB1Cell,
    getB1EdgeKey,
    getB1RoomDef,
    serializeUnderground,
    deserializeUnderground,
    enterUnderground,
    exitUnderground,
    toggleActiveLayer,
    canDigTile,
    digTileAt,
    getB1RoomGadgetTiles,
    roomHasGadgets,
    triggerB1LockHighlight,
    reconcileB1Rooms,
    isValidB1DoorEdge,
    pruneInvalidB1Doors,
    recomputeUndergroundConnectivity,
    isUndergroundTileConnected,
    canZoneB1Rect,
    zoneB1Rect,
    zoneB1Tile,
    canUnzoneB1Rect,
    unzoneB1Rect,
    unzoneB1Tile,
    findNearestB1DoorEdge,
    toggleB1Door,
    getB1Summary,
    updateUnderground,
    debugAddDigAp
  });

  if (ZS.Game) {
    Object.assign(ZS.Game, {
      getB1ChebyshevDist,
      getB1RockTier,
      getB1RockTierName,
      getB1DigCost,
      createDefaultUnderground,
      ensureUndergroundState,
      getB1Cell,
      getB1EdgeKey,
      getB1RoomDef,
      enterUnderground,
      exitUnderground,
      toggleActiveLayer,
      canDigTile,
      digTileAt,
      getB1RoomGadgetTiles,
      roomHasGadgets,
      isValidB1DoorEdge,
      recomputeUndergroundConnectivity,
      isUndergroundTileConnected,
      canZoneB1Rect,
      zoneB1Rect,
      zoneB1Tile,
      canUnzoneB1Rect,
      unzoneB1Rect,
      unzoneB1Tile,
      findNearestB1DoorEdge,
      toggleB1Door,
      getB1Summary,
      debugAddDigAp
    });
  }
})();
