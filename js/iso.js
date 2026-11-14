window.ZS = window.ZS || {};

ZS.Iso = (function () {
  const TILE_W = 68;
  const TILE_H = 34;

  const cam = {
    x: 0,
    y: 17 * 17 + 24,
    zoom: 1.0,
    minZoom: 0.58,
    maxZoom: 1.75
  };

  let viewW = 1280;
  let viewH = 720;

  function setViewport(w, h) {
    viewW = w;
    viewH = h;
  }

  function resetCamera() {
    const center = ZS.DATA.HQ_POS.x + 0.5;
    cam.x = 0;
    cam.y = (center + center) * (TILE_H / 2) + 24;
    cam.zoom = Math.min(1.12, Math.max(0.78, Math.min(viewW / 1280, viewH / 760)));
  }

  function panByScreen(dxScreen, dyScreen) {
    cam.x -= dxScreen / cam.zoom;
    cam.y -= dyScreen / cam.zoom;
    clampCamera();
  }

  function zoomAtScreen(factor, sx, sy) {
    const before = screenToWorld(sx, sy);
    cam.zoom = Math.max(cam.minZoom, Math.min(cam.maxZoom, cam.zoom * factor));
    const after = screenToWorld(sx, sy);
    cam.x += before.wx - after.wx;
    cam.y += before.wy - after.wy;
    clampCamera();
  }

  function clampCamera() {
    const maxCoord = ZS.DATA.GRID_SIZE * TILE_W * 0.55;
    cam.x = Math.max(-maxCoord, Math.min(maxCoord, cam.x));
    cam.y = Math.max(-80, Math.min(ZS.DATA.GRID_SIZE * TILE_H + 120, cam.y));
  }

  function gridToWorld(gx, gy) {
    return {
      wx: (gx - gy) * (TILE_W * 0.5),
      wy: (gx + gy) * (TILE_H * 0.5)
    };
  }

  function gridToScreen(gx, gy, zPx) {
    const wx = (gx - gy) * (TILE_W * 0.5);
    const wy = (gx + gy) * (TILE_H * 0.5) - (zPx || 0);
    return {
      x: (wx - cam.x) * cam.zoom + viewW * 0.5,
      y: (wy - cam.y) * cam.zoom + viewH * 0.5
    };
  }

  function screenToWorld(sx, sy) {
    return {
      wx: (sx - viewW * 0.5) / cam.zoom + cam.x,
      wy: (sy - viewH * 0.5) / cam.zoom + cam.y
    };
  }

  function screenToGrid(sx, sy) {
    const { wx, wy } = screenToWorld(sx, sy);
    const halfW = TILE_W * 0.5;
    const halfH = TILE_H * 0.5;
    const gx = (wx / halfW + wy / halfH) * 0.5;
    const gy = (wy / halfH - wx / halfW) * 0.5;
    return {
      gx,
      gy,
      tx: Math.floor(gx),
      ty: Math.floor(gy)
    };
  }

  // Draws an isometric 3D voxel prism at fractional grid coords
  function drawVoxelBox(ctx, gx, gy, zBase, wTiles, dTiles, hPx, colors) {
    const zTop = zBase + hPx;
    const bTop = gridToScreen(gx, gy, zTop);
    const rTop = gridToScreen(gx + wTiles, gy, zTop);
    const fTop = gridToScreen(gx + wTiles, gy + dTiles, zTop);
    const lTop = gridToScreen(gx, gy + dTiles, zTop);

    const rBot = gridToScreen(gx + wTiles, gy, zBase);
    const fBot = gridToScreen(gx + wTiles, gy + dTiles, zBase);
    const lBot = gridToScreen(gx, gy + dTiles, zBase);

    // Left face
    if (hPx > 0 && colors.left) {
      ctx.fillStyle = colors.left;
      ctx.beginPath();
      ctx.moveTo(lTop.x, lTop.y);
      ctx.lineTo(fTop.x, fTop.y);
      ctx.lineTo(fBot.x, fBot.y);
      ctx.lineTo(lBot.x, lBot.y);
      ctx.closePath();
      ctx.fill();
    }

    // Right face
    if (hPx > 0 && colors.right) {
      ctx.fillStyle = colors.right;
      ctx.beginPath();
      ctx.moveTo(fTop.x, fTop.y);
      ctx.lineTo(rTop.x, rTop.y);
      ctx.lineTo(rBot.x, rBot.y);
      ctx.lineTo(fBot.x, fBot.y);
      ctx.closePath();
      ctx.fill();
    }

    // Top face
    if (colors.top) {
      ctx.fillStyle = colors.top;
      ctx.beginPath();
      ctx.moveTo(bTop.x, bTop.y);
      ctx.lineTo(rTop.x, rTop.y);
      ctx.lineTo(fTop.x, fTop.y);
      ctx.lineTo(lTop.x, lTop.y);
      ctx.closePath();
      ctx.fill();
    }

    if (colors.stroke) {
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = Math.max(0.75, 1 * cam.zoom);
      ctx.beginPath();
      ctx.moveTo(bTop.x, bTop.y);
      ctx.lineTo(rTop.x, rTop.y);
      ctx.lineTo(fTop.x, fTop.y);
      ctx.lineTo(lTop.x, lTop.y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  function drawTilePoly(ctx, tx, ty, zPx, fillStyle, strokeStyle, lineWidth) {
    const p0 = gridToScreen(tx, ty, zPx || 0);
    const p1 = gridToScreen(tx + 1, ty, zPx || 0);
    const p2 = gridToScreen(tx + 1, ty + 1, zPx || 0);
    const p3 = gridToScreen(tx, ty + 1, zPx || 0);

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth || 1;
      ctx.stroke();
    }
  }

  return {
    TILE_W,
    TILE_H,
    cam,
    setViewport,
    resetCamera,
    panByScreen,
    zoomAtScreen,
    gridToWorld,
    gridToScreen,
    screenToGrid,
    drawVoxelBox,
    drawTilePoly
  };
})();
