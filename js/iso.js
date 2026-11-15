window.ZS = window.ZS || {};

ZS.Iso = (function () {
  const TILE_W = 68;
  const TILE_H = 34;

  // Top-left fixed directional light factors (art-direction.md §3.1)
  const SHADE_TOP = 1.0;
  const SHADE_LEFT = 0.82;
  const SHADE_RIGHT = 0.66;

  // Emissive (self-lit) faces skip directional shading per issue-03-palette-tokens.md §5
  const EMISSIVE_TOP = 1.0;
  const EMISSIVE_LEFT = 1.0;
  const EMISSIVE_RIGHT = 1.0;

  const colorCache = new Map();

  // Scene-level or entity-level render modifiers (hit flash, day/night tint)
  const renderModifiers = {
    flash: 0,
    tintColor: null,
    tintStrength: 0
  };

  const cam = {
    x: 0,
    y: 17 * 17 + 24,
    zoom: 1.0,
    minZoom: 0.58,
    maxZoom: 1.75
  };

  let viewW = 1280;
  let viewH = 720;

  function getViewport() {
    return { w: viewW, h: viewH };
  }

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

  function parseHexRgb(hex) {
    if (typeof hex !== 'string' || hex[0] !== '#') return null;
    if (hex.length === 4) {
      return {
        r: parseInt(hex[1] + hex[1], 16),
        g: parseInt(hex[2] + hex[2], 16),
        b: parseInt(hex[3] + hex[3], 16)
      };
    }
    if (hex.length >= 7) {
      return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
      };
    }
    return null;
  }

  function toHexByte(v) {
    const clamped = Math.max(0, Math.min(255, Math.round(v)));
    return clamped.toString(16).padStart(2, '0');
  }

  function shadeHex(hex, factor) {
    if (!hex || factor === 1) return hex;
    const key = `${hex}|s|${factor.toFixed(3)}`;
    const hit = colorCache.get(key);
    if (hit) return hit;

    const rgb = parseHexRgb(hex);
    if (!rgb) return hex;
    const out = `#${toHexByte(rgb.r * factor)}${toHexByte(rgb.g * factor)}${toHexByte(rgb.b * factor)}`;
    if (colorCache.size > 4096) colorCache.clear();
    colorCache.set(key, out);
    return out;
  }

  function mixHex(hexA, hexB, t) {
    if (!hexA || !hexB || t <= 0) return hexA;
    if (t >= 1) return hexB;
    const qt = Math.round(t * 50) / 50;
    if (qt <= 0) return hexA;
    if (qt >= 1) return hexB;

    const key = `${hexA}|m|${hexB}|${qt.toFixed(2)}`;
    const hit = colorCache.get(key);
    if (hit) return hit;

    const a = parseHexRgb(hexA);
    const b = parseHexRgb(hexB);
    if (!a || !b) return hexA;
    const out = `#${toHexByte(a.r + (b.r - a.r) * qt)}${toHexByte(a.g + (b.g - a.g) * qt)}${toHexByte(a.b + (b.b - a.b) * qt)}`;
    if (colorCache.size > 4096) colorCache.clear();
    colorCache.set(key, out);
    return out;
  }

  function setSceneTint(tintColor, tintStrength) {
    renderModifiers.tintColor = tintColor || null;
    renderModifiers.tintStrength = tintStrength ? Math.max(0, Math.min(1, tintStrength)) : 0;
  }

  function setEntityFlash(flash) {
    renderModifiers.flash = flash ? Math.max(0, Math.min(1, flash)) : 0;
  }

  function setRenderModifiers(mods) {
    renderModifiers.flash = mods && mods.flash ? Math.max(0, Math.min(1, mods.flash)) : 0;
    renderModifiers.tintColor = (mods && mods.tintColor) || null;
    renderModifiers.tintStrength = mods && mods.tintStrength ? Math.max(0, Math.min(1, mods.tintStrength)) : 0;
  }

  function resetRenderModifiers() {
    renderModifiers.flash = 0;
    renderModifiers.tintColor = null;
    renderModifiers.tintStrength = 0;
  }

  function resolveFaceColor(rawColor, shadeFactor, isEmissive, boxFlash) {
    if (!rawColor) return null;
    let col = shadeFactor === 1 ? rawColor : shadeHex(rawColor, shadeFactor);

    // Apply global day/night ambient tint to matte surfaces only
    if (!isEmissive && renderModifiers.tintColor && renderModifiers.tintStrength > 0) {
      col = mixHex(col, renderModifiers.tintColor, renderModifiers.tintStrength);
    }

    // Apply entity/global hit-flash override (towards pure white)
    const flash = Math.max(renderModifiers.flash, boxFlash || 0);
    if (flash > 0) {
      col = mixHex(col, '#FFFFFF', flash);
    }
    return col;
  }

  // Draws an isometric 3D voxel prism at fractional grid coords.
  // Supports `{ base: '#RRGGBB', emissive, flash, stroke }` with automatic top-left light shading
  // (Top 100%, Left 82%, Right 66%), as well as explicit `{ top, left, right }` overrides.
  function drawVoxelBox(ctx, gx, gy, zBase, wTiles, dTiles, hPx, colors) {
    const zTop = zBase + hPx;
    const bTop = gridToScreen(gx, gy, zTop);
    const rTop = gridToScreen(gx + wTiles, gy, zTop);
    const fTop = gridToScreen(gx + wTiles, gy + dTiles, zTop);
    const lTop = gridToScreen(gx, gy + dTiles, zTop);

    const rBot = gridToScreen(gx + wTiles, gy, zBase);
    const fBot = gridToScreen(gx + wTiles, gy + dTiles, zBase);
    const lBot = gridToScreen(gx, gy + dTiles, zBase);

    const c = colors || {};
    const isEmissive = !!c.emissive;
    const effectiveFlash = Math.max(renderModifiers.flash, c.flash || 0);
    const base = c.base;

    const topCol = base
      ? resolveFaceColor(base, isEmissive ? EMISSIVE_TOP : SHADE_TOP, isEmissive, effectiveFlash)
      : resolveFaceColor(c.top, 1, isEmissive, effectiveFlash);

    const leftCol = base
      ? resolveFaceColor(base, isEmissive ? EMISSIVE_LEFT : SHADE_LEFT, isEmissive, effectiveFlash)
      : resolveFaceColor(c.left, 1, isEmissive, effectiveFlash);

    const rightCol = base
      ? resolveFaceColor(base, isEmissive ? EMISSIVE_RIGHT : SHADE_RIGHT, isEmissive, effectiveFlash)
      : resolveFaceColor(c.right, 1, isEmissive, effectiveFlash);

    // Left face (82% brightness under top-left sun)
    if (hPx > 0 && leftCol) {
      ctx.fillStyle = leftCol;
      ctx.beginPath();
      ctx.moveTo(lTop.x, lTop.y);
      ctx.lineTo(fTop.x, fTop.y);
      ctx.lineTo(fBot.x, fBot.y);
      ctx.lineTo(lBot.x, lBot.y);
      ctx.closePath();
      ctx.fill();
    }

    // Right face (66% brightness under top-left sun)
    if (hPx > 0 && rightCol) {
      ctx.fillStyle = rightCol;
      ctx.beginPath();
      ctx.moveTo(fTop.x, fTop.y);
      ctx.lineTo(rTop.x, rTop.y);
      ctx.lineTo(rBot.x, rBot.y);
      ctx.lineTo(fBot.x, fBot.y);
      ctx.closePath();
      ctx.fill();
    }

    // Top face (100% brightness under top-left sun)
    if (!c.noTop && topCol) {
      ctx.fillStyle = topCol;
      ctx.beginPath();
      ctx.moveTo(bTop.x, bTop.y);
      ctx.lineTo(rTop.x, rTop.y);
      ctx.lineTo(fTop.x, fTop.y);
      ctx.lineTo(lTop.x, lTop.y);
      ctx.closePath();
      ctx.fill();
    }

    if (c.stroke && !c.noTop) {
      ctx.strokeStyle = effectiveFlash > 0.5 ? '#FFFFFF' : c.stroke;
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
    SHADE_TOP,
    SHADE_LEFT,
    SHADE_RIGHT,
    cam,
    getViewport,
    setViewport,
    resetCamera,
    panByScreen,
    zoomAtScreen,
    gridToWorld,
    gridToScreen,
    screenToGrid,
    shadeHex,
    mixHex,
    resolveFaceColor,
    setSceneTint,
    setEntityFlash,
    setRenderModifiers,
    resetRenderModifiers,
    drawVoxelBox,
    drawTilePoly
  };
})();
