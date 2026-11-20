window.ZS = window.ZS || {};

(function () {
  const R = ZS._Renderer;

  function getZombiePoseMetrics(z, zDef, timeSec) {
    const sc = zDef.scale || 1.0;
    const type = z.type || 'walker';
    const freq = type === 'runner'
      ? 12.5
      : type === 'leaper'
      ? 13.0
      : type === 'brute'
      ? 5.8
      : type === 'shocker'
      ? 6.4
      : zDef.isBoss
      ? 4.8
      : 7.8;
    const stride = z.leapState ? 0 : Math.sin(timeSec * freq + (z.seed || 0));
    const bobAmp = type === 'runner'
      ? 1.8
      : type === 'leaper'
      ? 1.9
      : type === 'brute'
      ? 1.6
      : type === 'spitter'
      ? 1.8
      : 2.1;
    const bob = z.leapState ? 0 : Math.abs(stride) * bobAmp;

    let leapLift = 0;
    let crouch = 0;
    if (z.leapState) {
      if (z.leapState.phase === 'crouch') {
        crouch = -2.0;
      } else if (z.leapState.phase === 'air') {
        const u = Math.max(0, Math.min(1, z.leapState.timer / (z.leapState.airDur || 0.42)));
        leapLift = Math.sin(Math.PI * u) * 26;
      }
    }
    const legZ = 1 + leapLift;
    const bodyBaseZ = Math.max(0.5, 1 + leapLift + crouch + bob);

    const ang = typeof z.facingAngle === 'number' ? z.facingAngle : Math.PI * 0.75;
    const fx = Math.cos(ang);
    const fy = Math.sin(ang);
    const px = -fy;
    const py = fx;

    let headFwd = 0.05 * sc;
    let headZ = bodyBaseZ + 13.0 * sc;
    let headW = 0.31 * sc;
    let headH = 10.6 * sc;
    let topZ = bodyBaseZ + 26.8 * sc;

    if (type === 'runner') {
      headFwd = 0.25 * sc;
      headZ = bodyBaseZ + 11.2 * sc;
      headW = 0.32 * sc;
      headH = 10.8 * sc;
      topZ = bodyBaseZ + 25.4 * sc;
    } else if (type === 'brute') {
      headFwd = 0.06 * sc;
      headZ = bodyBaseZ + 11.8 * sc;
      headW = 0.28 * sc;
      headH = 8.4 * sc;
      topZ = bodyBaseZ + 23.2 * sc;
    } else if (type === 'spitter') {
      headFwd = 0.22 * sc;
      headZ = bodyBaseZ + 8.8 * sc;
      headW = 0.24 * sc;
      headH = 6.0 * sc;
      topZ = bodyBaseZ + 18.2 * sc;
    } else if (type === 'leaper') {
      headFwd = 0.30 * sc;
      headZ = bodyBaseZ + 7.2 * sc;
      headW = 0.22 * sc;
      headH = 5.4 * sc;
      topZ = bodyBaseZ + 16.5 * sc;
    } else if (type === 'shocker') {
      headFwd = 0.03 * sc;
      headZ = bodyBaseZ + 13.6 * sc;
      headW = 0.25 * sc;
      headH = 6.2 * sc;
      topZ = bodyBaseZ + 28.0 * sc;
    } else if (zDef.isBoss) {
      headFwd = 0.05 * sc;
      headZ = bodyBaseZ + 12.2 * sc;
      headW = 0.28 * sc;
      headH = 8.8 * sc;
      topZ = bodyBaseZ + 28.5 * sc;
    }

    return { sc, type, stride, bob, legZ, bodyBaseZ, leapLift, crouch, ang, fx, fy, px, py, headFwd, headZ, headW, headH, topZ };
  }

  const _eyeC = { x: 0, y: 0 };
  const _eyeL = { x: 0, y: 0 };
  const _eyeR = { x: 0, y: 0 };
  const _occTop = { x: 0, y: 0 };
  const _occBot = { x: 0, y: 0 };
  const _zBasePos = { x: 0, y: 0 };

  function getZombieEyePositions(z, zDef, timeSec, zScale, prePose) {
    const Iso = ZS.Iso;
    const m = prePose || getZombiePoseMetrics(z, zDef, timeSec);
    const eyeWorldX = z.x + m.fx * (m.headFwd + m.headW * 0.44);
    const eyeWorldY = z.y + m.fy * (m.headFwd + m.headW * 0.44);
    const eyeWorldZ = m.headZ + m.headH * 0.46;

    const sepWorld = m.headW * 0.24;
    const cPos = Iso.projectTo(eyeWorldX, eyeWorldY, eyeWorldZ, _eyeC);
    const lPos = Iso.projectTo(eyeWorldX - m.px * sepWorld, eyeWorldY - m.py * sepWorld, eyeWorldZ, _eyeL);
    const rPos = Iso.projectTo(eyeWorldX + m.px * sepWorld, eyeWorldY + m.py * sepWorld, eyeWorldZ, _eyeR);

    return {
      cx: cPos.x,
      cy: cPos.y,
      lx: lPos.x,
      ly: lPos.y,
      rx: rPos.x,
      ry: rPos.y,
      sc: m.sc
    };
  }

  function drawZombieEyePinpoints(ctx, eyes, zDef, zScale, P) {
    const eyeSz = Math.max(2.0, 2.3 * eyes.sc * zScale);
    ctx.fillStyle = P.outlineDark || '#1B2430';
    ctx.fillRect(eyes.lx - eyeSz * 0.5 - 0.8, eyes.ly - eyeSz * 0.5 - 0.8, eyeSz + 1.6, eyeSz + 1.6);
    ctx.fillRect(eyes.rx - eyeSz * 0.5 - 0.8, eyes.ry - eyeSz * 0.5 - 0.8, eyeSz + 1.6, eyeSz + 1.6);

    ctx.fillStyle = zDef.eyeColor || P.danger;
    ctx.fillRect(eyes.lx - eyeSz * 0.5, eyes.ly - eyeSz * 0.5, eyeSz, eyeSz);
    ctx.fillRect(eyes.rx - eyeSz * 0.5, eyes.ry - eyeSz * 0.5, eyeSz, eyeSz);
  }

  function isZombieEyesOccluded(state, z, eyes, zScale) {
    const DATA = ZS.DATA;
    const Iso = ZS.Iso;
    const N = DATA.GRID_SIZE;
    const tx = Math.floor(z.x);
    const ty = Math.floor(z.y);
    const offsets = [
      [1, 0],
      [0, 1],
      [1, 1]
    ];
    for (let k = 0; k < offsets.length; k++) {
      const sx = tx + offsets[k][0];
      const sy = ty + offsets[k][1];
      if (sx < 0 || sy < 0 || sx >= N || sy >= N) continue;
      const st = state.structGrid[sy] && state.structGrid[sy][sx];
      if (!st) continue;
      const def = st.id === 'command_hq' ? DATA.HQ_STATS : DATA.ITEMS[st.id];
      if (def && def.passable) continue;
      if (sx + sy + 1.0 <= z.x + z.y + 0.05) continue;

      const hqLv = state.hqLevel || 1;
      const hqOccH = hqLv === 1 ? 18 : hqLv === 2 ? 26 : hqLv === 3 ? 36 : 46;
      const structH = st.id === 'command_hq' ? hqOccH : R.getStructVisualTopZ(st.id, st.level || 1);
      const topPos = Iso.projectTo(sx + 0.5, sy + 0.5, structH, _occTop);
      const botPos = Iso.projectTo(sx + 1, sy + 1, 0, _occBot);
      const halfW = 26 * zScale;
      if (
        eyes.cx >= topPos.x - halfW &&
        eyes.cx <= topPos.x + halfW &&
        eyes.cy >= topPos.y &&
        eyes.cy <= botPos.y
      ) {
        return true;
      }
    }
    return false;
  }

  function drawZombie(ctx, z, timeSec, zScale, state, opts) {
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const zDef = ZS.DATA.ZOMBIES[z.type] || ZS.DATA.ZOMBIES.walker;
    const isGhost = !!(opts && opts.isGhost);
    const m = !isGhost && z._framePose ? z._framePose : getZombiePoseMetrics(z, zDef, timeSec);
    const { sc, type, stride, legZ, bodyBaseZ, fx, fy, px, py } = m;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    const isNightLit = !!(state && state.nightAlpha > 0.35);

    const basePos = Iso.projectTo(z.x, z.y, 1, _zBasePos);

    // Boss Siege Charge trailing afterimages (3 echoes: alpha 0.18 / 0.30 / 0.42)
    if (zDef.isBoss && !isGhost && !isSil && z.chargeState && z.chargeState.phase === 'dash') {
      const cs = z.chargeState;
      const trailFracs = [0.28, 0.52, 0.76];
      const alphas = [0.18, 0.30, 0.42];
      for (let tIdx = 0; tIdx < trailFracs.length; tIdx++) {
        const f = trailFracs[tIdx];
        const ghost = {
          ...z,
          x: cs.startX + (z.x - cs.startX) * f,
          y: cs.startY + (z.y - cs.startY) * f,
          hitFlash: 0,
          _framePose: null,
          _frameEyes: null,
          _frameEyesOccluded: false
        };
        ctx.save();
        ctx.globalAlpha = alphas[tIdx];
        const prevGhostEm = R.emissiveList;
        R.emissiveList = null;
        drawZombie(ctx, ghost, timeSec, zScale, state, { isGhost: true });
        R.emissiveList = prevGhostEm;
        ctx.restore();
      }
    }

    // Boss: dark abyssal ground shadow ring + pulsing danger threat ring + windup lane / glow (hidden in silhouette mode)
    if (zDef.isBoss && !isGhost && !isSil) {
      if (z.chargeState && z.chargeState.phase === 'windup') {
        const cs = z.chargeState;
        const cDx = cs.targetX - z.x;
        const cDy = cs.targetY - z.y;
        const cLen = Math.max(0.01, Math.hypot(cDx, cDy));
        const perpX = (-cDy / cLen) * 0.3;
        const perpY = (cDx / cLen) * 0.3;
        const p1 = Iso.gridToScreen(z.x + perpX, z.y + perpY, 0.6);
        const p2 = Iso.gridToScreen(cs.targetX + perpX, cs.targetY + perpY, 0.6);
        const p3 = Iso.gridToScreen(cs.targetX - perpX, cs.targetY - perpY, 0.6);
        const p4 = Iso.gridToScreen(z.x - perpX, z.y - perpY, 0.6);
        ctx.save();
        ctx.fillStyle = 'rgba(255, 77, 109, 0.14)';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = P.danger;
        ctx.lineWidth = 1.8 * zScale;
        ctx.stroke();
        ctx.setLineDash([]);

        const glowP = Iso.gridToScreen(z.x, z.y, 14);
        ctx.fillStyle = 'rgba(255, 77, 109, 0.32)';
        ctx.beginPath();
        ctx.ellipse(glowP.x, glowP.y, 30 * zScale, 30 * zScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const pulse = 0.94 + 0.09 * Math.sin(timeSec * 5);
      ctx.fillStyle = 'rgba(18, 6, 26, 0.52)';
      ctx.strokeStyle = 'rgba(224, 64, 251, 0.45)';
      ctx.lineWidth = 2.2 * zScale;
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, 18.5 * sc * zScale * pulse, 9.5 * sc * zScale * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = P.dangerFill;
      ctx.strokeStyle = P.danger;
      ctx.lineWidth = 1.9 * zScale;
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, 14.5 * sc * zScale * pulse, 7.4 * sc * zScale * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Leaper landing shadow preview on target tile (grows as leaper approaches landing)
    if (!isGhost && !isSil && z.leapState) {
      const ls = z.leapState;
      const u = ls.phase === 'crouch'
        ? 0.35 + 0.25 * (ls.timer / (ls.crouchDur || 0.12))
        : 0.6 + 0.4 * Math.min(1, ls.timer / (ls.airDur || 0.42));
      const lSh = Iso.gridToScreen(ls.targetX, ls.targetY + 0.05, 0.5);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(lSh.x, lSh.y, 14 * u * zScale, 7 * u * zScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // War Cry frenzy ring (dashed #E040FB r=0.30 around buffed zombie)
    if (!isGhost && !isSil && z.frenzyTimer > 0) {
      R.drawIsoCircle(ctx, z.x, z.y, 0.30 * sc, P.zombieBossCrack || '#E040FB', null, [3, 2], 1.5 * zScale);
    }

    // Crisp ground contact shadow (faint when airborne mid-leap)
    if (!isGhost) {
      const shadowScale = z.leapState && z.leapState.phase === 'air' ? 0.55 : 1.0;
      const shadowRx = (type === 'brute' ? 11.4 : type === 'runner' ? 10.2 : 9.6) * sc * shadowScale * zScale;
      const shadowRy = (type === 'brute' ? 5.8 : 5.0) * sc * shadowScale * zScale;
      ctx.fillStyle = z.leapState && z.leapState.phase === 'air' ? 'rgba(8, 10, 16, 0.25)' : 'rgba(8, 10, 16, 0.52)';
      ctx.beginPath();
      ctx.ellipse(basePos.x, basePos.y, shadowRx, shadowRy, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    Iso.setEntityFlash(z.hitFlash || 0);

    const parts = [];
    const darkStroke = 'rgba(27, 36, 48, 0.42)';
    const legStep = stride * 0.055 * sc;

    if (type === 'runner') {
      const legW = 0.12 * sc;
      R.pushOrientedPart(parts, z.x - fx * (0.10 * sc - legStep) - px * 0.09 * sc, z.y - fy * (0.10 * sc - legStep) - py * 0.09 * sc, legZ, legW, legW, 4.8 * sc, {
        base: '#4a1220'
      });
      R.pushOrientedPart(parts, z.x - fx * (0.10 * sc + legStep) + px * 0.09 * sc, z.y - fy * (0.10 * sc + legStep) + py * 0.09 * sc, legZ, legW, legW, 4.8 * sc, {
        base: '#4a1220'
      });
      R.pushOrientedPart(parts, z.x - fx * 0.09 * sc, z.y - fy * 0.09 * sc, bodyBaseZ + 4.4 * sc, 0.28 * sc, 0.28 * sc, 6.8 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      R.pushOrientedPart(parts, z.x + fx * 0.10 * sc, z.y + fy * 0.10 * sc, bodyBaseZ + 6.4 * sc, 0.30 * sc, 0.30 * sc, 6.8 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      if (zDef.accentColor) {
        R.pushOrientedPart(parts, z.x + fx * 0.09 * sc, z.y + fy * 0.09 * sc, bodyBaseZ + 8.4 * sc, 0.32 * sc, 0.32 * sc, 3.0 * sc, {
          base: zDef.accentColor
        });
      }
      const armW = 0.11 * sc;
      R.pushOrientedPart(parts, z.x - fx * 0.16 * sc - px * 0.18 * sc, z.y - fy * 0.16 * sc - py * 0.18 * sc, bodyBaseZ + 5.8 * sc, armW, armW, 4.8 * sc, {
        base: zDef.skinColor
      });
      R.pushOrientedPart(parts, z.x - fx * 0.16 * sc + px * 0.18 * sc, z.y - fy * 0.16 * sc + py * 0.18 * sc, bodyBaseZ + 5.8 * sc, armW, armW, 4.8 * sc, {
        base: zDef.skinColor
      });
      R.pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    } else if (type === 'brute') {
      const legW = 0.13 * sc;
      R.pushOrientedPart(parts, z.x + fx * legStep - px * 0.10 * sc, z.y + fy * legStep - py * 0.10 * sc, legZ, legW, legW, 4.5 * sc, {
        base: '#240b19'
      });
      R.pushOrientedPart(parts, z.x - fx * legStep + px * 0.10 * sc, z.y - fy * legStep + py * 0.10 * sc, legZ, legW, legW, 4.5 * sc, {
        base: '#240b19'
      });
      R.pushOrientedPart(parts, z.x, z.y, bodyBaseZ + 3.6 * sc, 0.34 * sc, 0.34 * sc, 8.4 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      const armorCol = zDef.armorColor || '#C97A9E';
      R.pushOrientedPart(parts, z.x + fx * 0.15 * sc, z.y + fy * 0.15 * sc, bodyBaseZ + 4.2 * sc, 0.24 * sc, 0.24 * sc, 7.4 * sc, {
        base: armorCol,
        stroke: darkStroke
      });
      for (const side of [-1, 1]) {
        R.pushOrientedPart(parts, z.x + px * side * 0.22 * sc, z.y + py * side * 0.22 * sc, bodyBaseZ + 7.2 * sc, 0.18 * sc, 0.18 * sc, 5.4 * sc, {
          base: armorCol,
          stroke: darkStroke
        });
        R.pushOrientedPart(parts, z.x + fx * 0.07 * sc + px * side * 0.23 * sc, z.y + fy * 0.07 * sc + py * side * 0.23 * sc, bodyBaseZ + 2.8 * sc, 0.14 * sc, 0.14 * sc, 4.8 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      R.pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
      R.pushOrientedPart(parts, z.x + fx * (m.headFwd + 0.01 * sc), z.y + fy * (m.headFwd + 0.01 * sc), m.headZ + m.headH * 0.68, m.headW * 1.06, m.headW * 1.06, 2.2 * sc, {
        base: armorCol,
        stroke: darkStroke
      });
    } else if (type === 'spitter') {
      // SPITTER: Leaning torso + dorsal globular acid sac (#6E8A1E day + 3 #C8F542 spots / #C8F542 emissive night) + low forward head
      const legW = 0.11 * sc;
      R.pushOrientedPart(parts, z.x + fx * legStep - px * 0.08 * sc, z.y + fy * legStep - py * 0.08 * sc, legZ, legW, legW, 3.8 * sc, {
        base: zDef.legColor || '#3A1636'
      });
      R.pushOrientedPart(parts, z.x - fx * legStep + px * 0.08 * sc, z.y - fy * legStep + py * 0.08 * sc, legZ, legW, legW, 3.8 * sc, {
        base: zDef.legColor || '#3A1636'
      });
      R.pushOrientedPart(parts, z.x + fx * 0.06 * sc, z.y + fy * 0.06 * sc, bodyBaseZ + 3.6 * sc, 0.28 * sc, 0.28 * sc, 7.0 * sc, {
        base: zDef.coatColor || '#4F2147',
        stroke: darkStroke
      });
      const sacCol = isNightLit ? (zDef.accentColor || '#C8F542') : (zDef.accentDimColor || '#6E8A1E');
      R.pushOrientedBlob(parts, z.x - fx * 0.15 * sc, z.y - fy * 0.15 * sc, bodyBaseZ + 2.6 * sc, 0.16 * sc, 8.5 * sc, sacCol, {
        emissive: isNightLit,
        acidSpots: !isNightLit,
        spotColor: zDef.accentColor || '#C8F542',
        n: 12,
        slices: 5
      });
      for (const side of [-1, 1]) {
        R.pushOrientedPart(parts, z.x + fx * 0.14 * sc + px * side * 0.15 * sc, z.y + fy * 0.14 * sc + py * side * 0.15 * sc, bodyBaseZ + 4.8 * sc, 0.10 * sc, 0.10 * sc, 4.2 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      R.pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    } else if (type === 'leaper') {
      // LEAPER: Reverse-jointed hind legs + low 2-piece horizontal torso + 3 dorsal bone spines + long reaching arms + claws
      const legCol = zDef.legColor || '#4A1522';
      const boneCol = zDef.accentColor || '#F4EBDD';
      for (const side of [-1, 1]) {
        const sStep = side * legStep;
        R.pushOrientedPart(parts, z.x - fx * (0.13 * sc - sStep * 0.5) + px * side * 0.09 * sc, z.y - fy * (0.13 * sc - sStep * 0.5) + py * side * 0.09 * sc, legZ + 2.4 * sc, 0.10 * sc, 0.10 * sc, 3.8 * sc, {
          base: legCol
        });
        R.pushOrientedPart(parts, z.x - fx * (0.03 * sc - sStep) + px * side * 0.09 * sc, z.y - fy * (0.03 * sc - sStep) + py * side * 0.09 * sc, legZ, 0.09 * sc, 0.09 * sc, 3.0 * sc, {
          base: legCol
        });
        R.pushOrientedPart(parts, z.x + fx * (0.04 * sc + sStep) + px * side * 0.09 * sc, z.y + fy * (0.04 * sc + sStep) + py * side * 0.09 * sc, Math.max(0.4, legZ - 0.3), 0.12 * sc, 0.12 * sc, 1.0 * sc, {
          base: boneCol
        });
      }
      R.pushOrientedPart(parts, z.x - fx * 0.06 * sc, z.y - fy * 0.06 * sc, bodyBaseZ + 5.4 * sc, 0.26 * sc, 0.26 * sc, 4.6 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      R.pushOrientedPart(parts, z.x + fx * 0.12 * sc, z.y + fy * 0.12 * sc, bodyBaseZ + 6.0 * sc, 0.26 * sc, 0.26 * sc, 4.6 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      const spines = [[-0.10, 10.0, 2.4], [0.02, 10.6, 2.6], [0.14, 10.6, 2.2]];
      for (let k = 0; k < spines.length; k++) {
        R.pushOrientedPart(parts, z.x + fx * spines[k][0] * sc, z.y + fy * spines[k][0] * sc, bodyBaseZ + spines[k][1] * sc, 0.06 * sc, 0.06 * sc, spines[k][2] * sc, {
          base: boneCol,
          stroke: darkStroke
        });
      }
      for (const side of [-1, 1]) {
        R.pushOrientedPart(parts, z.x + fx * 0.25 * sc + px * side * 0.16 * sc, z.y + fy * 0.25 * sc + py * side * 0.16 * sc, bodyBaseZ + 5.0 * sc, 0.09 * sc, 0.09 * sc, 4.8 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
        R.pushOrientedPart(parts, z.x + fx * 0.40 * sc + px * side * 0.16 * sc, z.y + fy * 0.40 * sc + py * side * 0.16 * sc, bodyBaseZ + 0.2 * sc, 0.09 * sc, 0.09 * sc, 5.2 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
        R.pushOrientedPart(parts, z.x + fx * 0.48 * sc + px * side * 0.16 * sc, z.y + fy * 0.48 * sc + py * side * 0.16 * sc, Math.max(0.3, legZ - 0.4), 0.11 * sc, 0.11 * sc, 1.2 * sc, {
          base: boneCol
        });
      }
      R.pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    } else if (type === 'shocker') {
      // SHOCKER: Armored torso + dorsal battery pack + 3 vertical EMP rods + glowing #B26BFF coil tips
      const legW = 0.13 * sc;
      R.pushOrientedPart(parts, z.x + fx * legStep - px * 0.10 * sc, z.y + fy * legStep - py * 0.10 * sc, legZ, legW, legW, 4.6 * sc, {
        base: zDef.legColor || '#1E1236'
      });
      R.pushOrientedPart(parts, z.x - fx * legStep + px * 0.10 * sc, z.y - fy * legStep + py * 0.10 * sc, legZ, legW, legW, 4.6 * sc, {
        base: zDef.legColor || '#1E1236'
      });
      R.pushOrientedPart(parts, z.x, z.y, bodyBaseZ + 4.6 * sc, 0.34 * sc, 0.34 * sc, 9.0 * sc, {
        base: zDef.coatColor || '#2E1B4F',
        stroke: darkStroke
      });
      R.pushOrientedPart(parts, z.x - fx * 0.21 * sc, z.y - fy * 0.21 * sc, bodyBaseZ + 6.0 * sc, 0.20 * sc, 0.20 * sc, 7.0 * sc, {
        base: zDef.packColor || '#3B2A5E',
        stroke: darkStroke
      });
      const rods = [[-0.09, 13.0], [0, 15.5], [0.09, 13.0]];
      for (let k = 0; k < rods.length; k++) {
        const oy = rods[k][0] * sc;
        const rh = rods[k][1] * sc;
        const rx = z.x - fx * 0.26 * sc + px * oy;
        const ry = z.y - fy * 0.26 * sc + py * oy;
        R.pushOrientedPart(parts, rx, ry, bodyBaseZ + 8.0 * sc, 0.05 * sc, 0.05 * sc, rh, {
          base: zDef.rodColor || '#6B5A8E',
          stroke: darkStroke
        });
        R.pushOrientedPart(parts, rx, ry, bodyBaseZ + 8.0 * sc + rh, 0.085 * sc, 0.085 * sc, 2.2 * sc, {
          base: zDef.accentColor || '#B26BFF',
          emissive: true
        });
      }
      for (const side of [-1, 1]) {
        R.pushOrientedPart(parts, z.x + fx * 0.04 * sc + px * side * 0.23 * sc, z.y + fy * 0.04 * sc + py * side * 0.23 * sc, bodyBaseZ + 6.0 * sc, 0.14 * sc, 0.14 * sc, 6.0 * sc, {
          base: zDef.coatColor || '#2E1B4F',
          stroke: darkStroke
        });
        R.pushOrientedPart(parts, z.x + fx * 0.08 * sc + px * side * 0.23 * sc, z.y + fy * 0.08 * sc + py * side * 0.23 * sc, bodyBaseZ + 2.4 * sc, 0.13 * sc, 0.13 * sc, 3.6 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      R.pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    } else if (zDef.isBoss) {
      const legW = 0.13 * sc;
      R.pushOrientedPart(parts, z.x + fx * legStep - px * 0.10 * sc, z.y + fy * legStep - py * 0.10 * sc, legZ, legW, legW, 4.8 * sc, {
        base: '#330936'
      });
      R.pushOrientedPart(parts, z.x - fx * legStep + px * 0.10 * sc, z.y - fy * legStep + py * 0.10 * sc, legZ, legW, legW, 4.8 * sc, {
        base: '#330936'
      });
      R.pushOrientedPart(parts, z.x, z.y, bodyBaseZ + 3.8 * sc, 0.33 * sc, 0.33 * sc, 8.6 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      const crackCol = zDef.accentColor || '#E040FB';
      R.pushOrientedPart(parts, z.x + fx * 0.09 * sc, z.y + fy * 0.09 * sc, bodyBaseZ + 5.4 * sc, 0.26 * sc, 0.26 * sc, 4.4 * sc, {
        base: crackCol,
        emissive: true
      });
      R.pushOrientedPart(parts, z.x - fx * 0.12 * sc, z.y - fy * 0.12 * sc, bodyBaseZ + 7.6 * sc, 0.14 * sc, 0.14 * sc, 5.2 * sc, {
        base: crackCol,
        emissive: true
      });
      for (const side of [-1, 1]) {
        R.pushOrientedPart(parts, z.x + px * side * 0.21 * sc, z.y + py * side * 0.21 * sc, bodyBaseZ + 8.0 * sc, 0.16 * sc, 0.16 * sc, 5.0 * sc, {
          base: zDef.coatColor,
          stroke: darkStroke
        });
        R.pushOrientedPart(parts, z.x + fx * 0.14 * sc + px * side * 0.21 * sc, z.y + fy * 0.14 * sc + py * side * 0.21 * sc, bodyBaseZ + 4.2 * sc, 0.14 * sc, 0.14 * sc, 5.0 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      R.pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
      for (const side of [-1, 1]) {
        R.pushOrientedPart(parts, z.x + fx * 0.04 * sc + px * side * 0.16 * sc, z.y + fy * 0.04 * sc + py * side * 0.16 * sc, m.headZ + m.headH * 0.72, 0.10 * sc, 0.10 * sc, 3.8 * sc, {
          base: '#2b0938',
          stroke: darkStroke
        });
        R.pushOrientedPart(parts, z.x + fx * 0.10 * sc + px * side * 0.21 * sc, z.y + fy * 0.10 * sc + py * side * 0.21 * sc, m.headZ + m.headH * 0.72 + 3.0 * sc, 0.085 * sc, 0.085 * sc, 4.4 * sc, {
          base: crackCol,
          emissive: true
        });
      }
    } else {
      const legW = 0.11 * sc;
      R.pushOrientedPart(parts, z.x + fx * legStep - px * 0.075 * sc, z.y + fy * legStep - py * 0.075 * sc, legZ, legW, legW, 4.4 * sc, {
        base: '#431226'
      });
      R.pushOrientedPart(parts, z.x - fx * legStep + px * 0.075 * sc, z.y - fy * legStep + py * 0.075 * sc, legZ, legW, legW, 4.4 * sc, {
        base: '#431226'
      });
      R.pushOrientedPart(parts, z.x, z.y, bodyBaseZ + 4.2 * sc, 0.29 * sc, 0.29 * sc, 9.0 * sc, {
        base: zDef.coatColor,
        stroke: darkStroke
      });
      for (const side of [-1, 1]) {
        R.pushOrientedPart(parts, z.x + fx * 0.16 * sc + px * side * 0.16 * sc, z.y + fy * 0.16 * sc + py * side * 0.16 * sc, bodyBaseZ + 8.6 * sc, 0.115 * sc, 0.115 * sc, 3.4 * sc, {
          base: zDef.coatColor
        });
        R.pushOrientedPart(parts, z.x + fx * 0.30 * sc + px * side * 0.16 * sc, z.y + fy * 0.30 * sc + py * side * 0.16 * sc, bodyBaseZ + 8.8 * sc, 0.115 * sc, 0.115 * sc, 3.2 * sc, {
          base: zDef.skinColor,
          stroke: darkStroke
        });
      }
      R.pushOrientedPart(parts, z.x + fx * m.headFwd, z.y + fy * m.headFwd, m.headZ, m.headW, m.headW, m.headH, {
        base: zDef.skinColor,
        stroke: darkStroke
      });
    }

    R.flushOrientedParts(ctx, parts, zScale);

    // Spitter acid chin droplet (#C8F542)
    if (type === 'spitter' && !isSil && !isGhost) {
      const drip = Iso.gridToScreen(z.x + fx * (m.headFwd + 0.10 * sc), z.y + fy * (m.headFwd + 0.10 * sc), m.headZ - 0.5 * sc);
      R.drawIsoDot(ctx, { x: drip.x, y: drip.y + 3 * zScale }, 1.1, P.mutantAcid || '#C8F542', true, zScale);
    }

    // Boss glowing chest crack lines on screen space for unmistakable mutant fissure detail
    if (zDef.isBoss && !(z.hitFlash > 0)) {
      const c1 = Iso.gridToScreen(z.x + fx * 0.18 * sc - px * 0.06 * sc, z.y + fy * 0.18 * sc - py * 0.06 * sc, bodyBaseZ + 9.8 * sc);
      const c2 = Iso.gridToScreen(z.x + fx * 0.20 * sc + px * 0.02 * sc, z.y + fy * 0.20 * sc + py * 0.02 * sc, bodyBaseZ + 7.2 * sc);
      const c3 = Iso.gridToScreen(z.x + fx * 0.18 * sc - px * 0.04 * sc, z.y + fy * 0.18 * sc - py * 0.04 * sc, bodyBaseZ + 4.8 * sc);
      ctx.strokeStyle = '#FF94FF';
      ctx.lineWidth = Math.max(1.2, 1.6 * zScale);
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.stroke();
    }

    Iso.setEntityFlash(0);

    // Depth-sorted daytime/lit eyes (naturally occluded by foreground 3D structures)
    if (!isGhost) {
      const eyes = z._frameEyes || getZombieEyePositions(z, zDef, timeSec, zScale, m);
      drawZombieEyePinpoints(ctx, eyes, zDef, zScale, P);

      // Slowed EMP cyan tint ring
      if (z.slowTimer > 0) {
        ctx.strokeStyle = P.power;
        ctx.lineWidth = 1.4 * zScale;
        ctx.beginPath();
        ctx.ellipse(basePos.x, basePos.y, 10.2 * sc * zScale, 5.4 * sc * zScale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Gate slow aura ring (#C9D3DE, distinct from EMP cyan #5EF2FF)
      if (z.inGateAura && !isSil) {
        ctx.strokeStyle = P.gateSlowRing || '#C9D3DE';
        ctx.lineWidth = 1.5 * zScale;
        ctx.beginPath();
        ctx.ellipse(basePos.x, basePos.y, 11.4 * sc * zScale, 6.0 * sc * zScale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Lv.3 Razor Pad Vulnerability ring (+15% incoming projectile damage)
      if (z.vulnOnPad && !isSil) {
        ctx.fillStyle = P.dangerFill;
        ctx.strokeStyle = P.danger;
        ctx.lineWidth = 1.4 * zScale;
        ctx.beginPath();
        ctx.ellipse(basePos.x, basePos.y, 11.6 * sc * zScale, 6.0 * sc * zScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function drawProjectiles(ctx, projectiles, zScale, viewW, viewH) {
    if (!projectiles || projectiles.length === 0) return;
    const Iso = ZS.Iso;
    const P = ZS.DATA.PALETTE;
    const isSil = !!window.ZS_SILHOUETTE_MODE;
    const vp = viewW != null ? { w: viewW, h: viewH } : Iso.getViewport();
    const pad = Math.max(60, 80 * zScale);
    for (let i = 0; i < projectiles.length; i++) {
      const p = projectiles[i];
      if (p.kind === 'acid_glob') {
        if (isSil) continue;
        const pStart = Iso.gridToScreen(p.startX, p.startY, 20);
        const pEnd = Iso.gridToScreen(p.targetX, p.targetY, 20);
        if ((pStart.x < -pad && pEnd.x < -pad) || (pStart.x > vp.w + pad && pEnd.x > vp.w + pad) ||
            (pStart.y < -pad && pEnd.y < -pad) || (pStart.y > vp.h + pad && pEnd.y > vp.h + pad)) {
          continue;
        }
        const prog = Math.max(0, Math.min(1, 1 - p.life / (p.maxLife || 0.4)));
        const arcPt = (u) => {
          const gx = p.startX + (p.targetX - p.startX) * u;
          const gy = p.startY + (p.targetY - p.startY) * u;
          const gz = 11 + Math.sin(Math.PI * u) * 18;
          return Iso.gridToScreen(gx, gy, gz);
        };
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = 'rgba(200, 245, 66, 0.45)';
        ctx.lineWidth = 1.4 * zScale;
        ctx.beginPath();
        for (let k = 0; k <= 10; k++) {
          const u = (prog * k) / 10;
          const pt = arcPt(u);
          if (k === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const trailOffsets = [0.16, 0.10, 0.05];
        for (let k = 0; k < trailOffsets.length; k++) {
          const tu = Math.max(0, prog - trailOffsets[k]);
          const tp = arcPt(tu);
          ctx.fillStyle = `rgba(200, 245, 66, ${(0.20 + k * 0.20).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, (2.0 + k * 0.6) * zScale, 0, Math.PI * 2);
          ctx.fill();
        }
        const cur = arcPt(prog);
        ctx.fillStyle = P.mutantAcid || '#C8F542';
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 4.0 * zScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (p.kind === 'acid_mount_ring') {
        if (isSil) continue;
        const c = Iso.gridToScreen(p.x, p.y, p.z || 22);
        if (c.x < -pad || c.x > vp.w + pad || c.y < -pad || c.y > vp.h + pad) continue;
        const alpha = Math.max(0, p.life / (p.maxLife || 0.30));
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = p.color || P.mutantAcid || '#C8F542';
        ctx.lineWidth = 1.6 * zScale;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, (p.radius || 0.18) * 32 * zScale, (p.radius || 0.18) * 16 * zScale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        continue;
      }
      if (p.kind === 'emp_ring') {
        if (isSil) continue;
        const c = Iso.gridToScreen(p.x, p.y, 2);
        const rMax = (p.radius || 2.1) * 38 * zScale;
        if (c.x + rMax < 0 || c.x - rMax > vp.w || c.y + rMax < 0 || c.y - rMax > vp.h) continue;
        const t = Math.max(0, Math.min(1, 1 - p.life / (p.maxLife || 0.35)));
        const r = Math.max(0.15, (p.radius || 2.1) * t);
        const alpha = Math.max(0, p.life / (p.maxLife || 0.35));
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha * 1.1);
        R.drawIsoCircle(ctx, p.x, p.y, r, p.color || P.mutantEmp || '#B26BFF', 'rgba(178, 107, 255, 0.10)', [], 2.0 * zScale);
        if (r > 0.65) {
          R.drawIsoCircle(ctx, p.x, p.y, r * 0.66, 'rgba(178, 107, 255, 0.5)', null, [3, 3], 1.4 * zScale);
        }
        ctx.restore();
        continue;
      }
      if (p.kind === 'warcry_ring') {
        if (isSil) continue;
        const c = Iso.gridToScreen(p.x, p.y, 2);
        const rMax = (p.radius || 3.8) * 38 * zScale;
        if (c.x + rMax < 0 || c.x - rMax > vp.w || c.y + rMax < 0 || c.y - rMax > vp.h) continue;
        const t = Math.max(0, Math.min(1, 1 - p.life / (p.maxLife || 0.50)));
        const r = Math.max(0.25, (p.radius || 3.8) * t);
        const alpha = Math.max(0, p.life / (p.maxLife || 0.50));
        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        R.drawIsoCircle(ctx, p.x, p.y, r, p.color || '#E040FB', 'rgba(224, 64, 251, 0.06)', [], 2.2 * zScale);
        R.drawIsoCircle(ctx, p.x, p.y, r * 0.68, 'rgba(224, 64, 251, 0.55)', null, [], 1.8 * zScale);
        ctx.restore();
        continue;
      }
      if (p.kind === 'bleed_burst') {
        if (isSil) continue;
        const b = Iso.gridToScreen(p.x, p.y, p.z || 3);
        if (b.x < -pad || b.x > vp.w + pad || b.y < -pad || b.y > vp.h + pad) continue;
        const alpha = Math.max(0, p.life / (p.maxLife || 0.32));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = P.danger;
        ctx.lineWidth = 2.0 * zScale;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(a) * 8 * zScale, b.y + Math.sin(a) * 5 * zScale);
          ctx.lineTo(b.x + Math.cos(a) * 16 * zScale, b.y + Math.sin(a) * 9.5 * zScale);
          ctx.stroke();
        }
        ctx.restore();
        continue;
      }
      if (p.kind === 'ring') {
        const c = Iso.gridToScreen(p.x, p.y, 2);
        const rMax = (p.radius || 0.8) * 38 * zScale;
        if (c.x + rMax < 0 || c.x - rMax > vp.w || c.y + rMax < 0 || c.y - rMax > vp.h) continue;
        const alpha = Math.max(0, p.life / (p.maxLife || 0.2));
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        R.drawIsoCircle(ctx, p.x, p.y, p.radius || 0.8, p.color || '#FF9F43', 'rgba(255, 159, 67, 0.22)');
        ctx.restore();
        continue;
      }
      if (p.kind === 'promo_ring') {
        const c = Iso.gridToScreen(p.x, p.y, p.z || 18);
        if (c.x < -pad || c.x > vp.w + pad || c.y < -pad || c.y > vp.h + pad) continue;
        const t = 1 - Math.max(0, p.life / (p.maxLife || 0.8));
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.92;
        ctx.strokeStyle = p.color || '#FFD34D';
        ctx.lineWidth = 2.4 * zScale;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, (10 + t * 24) * zScale, (5.5 + t * 13) * zScale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (p.kind === 'spark') {
        const p1 = Iso.gridToScreen(p.x1, p.y1, p.z || 10);
        const p2 = Iso.gridToScreen(p.x2, p.y2, p.z || 10);
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / (p.maxLife || 0.12));
        ctx.strokeStyle = p.color || '#FF8A3D';
        ctx.lineWidth = 2.4 * zScale;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo((p1.x + p2.x) * 0.5 + 3 * zScale, (p1.y + p2.y) * 0.5 - 4 * zScale);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (p.kind === 'sniper_trail') {
        const p1 = Iso.gridToScreen(p.x1, p.y1, p.z || 24);
        const p2 = Iso.gridToScreen(p.x2, p.y2, p.z || 24);
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / (p.maxLife || 0.15)) * 0.9;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3.2 * zScale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      if (p.kind === 'chain') {
        ctx.strokeStyle = ZS.DATA.PALETTE.power;
        ctx.lineWidth = 2.2 * (p.widthMult || 1.0) * zScale;
        ctx.beginPath();
        for (let k = 0; k < p.points.length; k++) {
          const pt = Iso.gridToScreen(p.points[k].x, p.points[k].y, 14);
          if (k === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x + (Math.random() - 0.5) * 6, pt.y + (Math.random() - 0.5) * 6);
        }
        ctx.stroke();
        continue;
      }

      const cur = Iso.gridToScreen(p.x, p.y, p.z || 12);
      if (cur.x < -pad || cur.x > vp.w + pad || cur.y < -pad || cur.y > vp.h + pad) continue;
      const prev = Iso.gridToScreen(p.x - p.vx * 0.035, p.y - p.vy * 0.035, p.z || 12);
      ctx.strokeStyle = p.color || '#ffe484';
      ctx.lineWidth = (p.width || 2.2) * zScale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
    }
  }

  function drawGroundStains(ctx, stains, zScale, viewW, viewH) {
    if (!stains || stains.length === 0) return;
    const Iso = ZS.Iso;
    const vp = viewW != null ? { w: viewW, h: viewH } : Iso.getViewport();
    const pad = Math.max(40, 56 * zScale);
    ctx.save();
    for (let i = 0; i < stains.length; i++) {
      const stn = stains[i];
      const spChk = Iso.gridToScreen(stn.x, stn.y, 1);
      if (spChk.x < -pad || spChk.x > vp.w + pad || spChk.y < -pad || spChk.y > vp.h + pad) continue;
      if (stn.kind === 'acid_puddle') {
        const fade = Math.min(1, stn.life / Math.min(1.0, stn.maxLife || 2.5));
        const p = Iso.gridToScreen(stn.x, stn.y, 0.65);
        const rx = (stn.radius || 0.32) * 30 * zScale;
        const ry = (stn.radius || 0.32) * 15 * zScale;
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgba(200, 245, 66, 0.55)';
        ctx.strokeStyle = stn.subColor || '#6E8A1E';
        ctx.lineWidth = 1.5 * zScale;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const drops = [[-6, -4], [5, -7], [9, 2], [-9, 3], [1, -10]];
        ctx.fillStyle = stn.color || '#C8F542';
        for (let k = 0; k < drops.length; k++) {
          ctx.beginPath();
          ctx.arc(p.x + drops[k][0] * zScale, p.y + drops[k][1] * zScale, 1.6 * zScale, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }
      if (stn.kind === 'crater_crack') {
        const fade = Math.min(1, stn.life / Math.min(1.6, stn.maxLife || 5.5));
        const p = Iso.gridToScreen(stn.x, stn.y, 0.7);
        ctx.globalAlpha = fade * 0.78;
        ctx.strokeStyle = '#1B2430';
        ctx.lineWidth = 2.0 * zScale;
        const baseA = (stn.seed || 0) * 0.5;
        for (let k = 0; k < 6; k++) {
          const a = baseA + (k / 6) * Math.PI * 2;
          const len = (10 + (k % 2) * 5) * zScale;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len * 0.55);
          ctx.stroke();
        }
        continue;
      }
      const fade = Math.min(1, stn.life / Math.min(2.2, stn.maxLife || 7.5));
      const p = Iso.gridToScreen(stn.x, stn.y, 1.05);
      const rx = stn.radius * 30 * zScale;
      const ry = stn.radius * 15 * zScale;

      ctx.globalAlpha = fade * 0.56;
      ctx.fillStyle = stn.color || '#4E1224';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, (stn.seed || 0) * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Two small irregular satellite splatter droplets
      const a1 = (stn.seed || 1) * 1.9;
      const a2 = a1 + 2.3;
      ctx.globalAlpha = fade * 0.46;
      ctx.fillStyle = stn.subColor || '#7A1A32';
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(a1) * rx * 0.85, p.y + Math.sin(a1) * ry * 0.85, rx * 0.36, ry * 0.36, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + Math.cos(a2) * rx * 0.72, p.y + Math.sin(a2) * ry * 0.72, rx * 0.28, ry * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDyingZombie(ctx, dz, zScale) {
    const Iso = ZS.Iso;
    const t = Math.max(0, Math.min(1, dz.timer / (dz.duration || 0.32)));
    const ease = t * t;
    const sc = dz.scale || 1.0;
    const fallAngle = (dz.facingAngle || 0) + (dz.fallDir || 1) * 1.15;
    const fx = Math.cos(fallAngle);
    const fy = Math.sin(fallAngle);

    const alpha = Math.max(0, 1 - Math.max(0, (t - 0.58) / 0.42));
    ctx.save();
    ctx.globalAlpha = alpha;

    const shadowP = Iso.gridToScreen(dz.x + fx * ease * 0.20 * sc, dz.y + fy * ease * 0.20 * sc, 1);
    ctx.fillStyle = 'rgba(8, 10, 16, 0.38)';
    ctx.beginPath();
    ctx.ellipse(shadowP.x, shadowP.y, (9 + ease * 5) * sc * zScale, (4.8 + ease * 2.2) * sc * zScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brief initial white flash on first 18% of death fall
    Iso.setEntityFlash(t < 0.18 ? 1.0 : 0);

    const torsoX = dz.x + fx * ease * 0.16 * sc;
    const torsoY = dz.y + fy * ease * 0.16 * sc;
    const torsoZ = 1 + (1 - ease) * 4.2 * sc;
    const torsoW = (0.28 + ease * 0.08) * sc;
    const torsoH = Math.max(2.6 * sc, (8.2 - ease * 5.2) * sc);

    const headX = dz.x + fx * (0.06 + ease * 0.36) * sc;
    const headY = dz.y + fy * (0.06 + ease * 0.36) * sc;
    const headZ = 1 + (1 - ease) * 12.2 * sc;
    const headW = 0.28 * sc;
    const headH = Math.max(3.2 * sc, (8.6 - ease * 4.2) * sc);

    const parts = [];
    R.pushOrientedPart(parts, torsoX, torsoY, torsoZ, torsoW, torsoW, torsoH, {
      base: dz.coatColor,
      stroke: 'rgba(27, 36, 48, 0.38)'
    });
    if (dz.accentColor) {
      R.pushOrientedPart(parts, torsoX + fx * 0.05 * sc, torsoY + fy * 0.05 * sc, torsoZ + torsoH * 0.35, torsoW * 0.92, torsoW * 0.92, torsoH * 0.45, {
        base: dz.accentColor,
        emissive: !!dz.isBoss
      });
    }
    R.pushOrientedPart(parts, headX, headY, headZ, headW, headW, headH, {
      base: dz.skinColor,
      stroke: 'rgba(27, 36, 48, 0.38)'
    });
    R.flushOrientedParts(ctx, parts);

    Iso.setEntityFlash(0);
    ctx.restore();
  }

  function drawMuzzleFlashes(ctx, flashes, zScale, viewW, viewH) {
    if (!flashes || flashes.length === 0) return;
    const Iso = ZS.Iso;
    const vp = viewW != null ? { w: viewW, h: viewH } : Iso.getViewport();
    const pad = Math.max(40, 56 * zScale);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < flashes.length; i++) {
      const mf = flashes[i];
      const origin = Iso.gridToScreen(mf.x, mf.y, mf.z);
      if (origin.x < -pad || origin.x > vp.w + pad || origin.y < -pad || origin.y > vp.h + pad) continue;
      const alpha = Math.max(0, Math.min(1, mf.life / (mf.maxLife || 0.055)));
      const sc = (mf.scale || 1.0) * zScale;

      if (mf.kind === 'emp') {
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = mf.color || '#5EF2FF';
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, 9.5 * sc, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, 4.5 * sc, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const tip = Iso.gridToScreen(
        mf.x + Math.cos(mf.angle) * 0.34 * (mf.scale || 1.0),
        mf.y + Math.sin(mf.angle) * 0.34 * (mf.scale || 1.0),
        mf.z
      );
      const dx = tip.x - origin.x;
      const dy = tip.y - origin.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const wing = 4.6 * sc;

      // Outer warm muzzle flame cone
      ctx.globalAlpha = alpha * 0.92;
      ctx.fillStyle = mf.color || '#FFE484';
      ctx.beginPath();
      ctx.moveTo(origin.x + nx * wing, origin.y + ny * wing);
      ctx.lineTo(tip.x, tip.y);
      ctx.lineTo(origin.x - nx * wing, origin.y - ny * wing);
      ctx.closePath();
      ctx.fill();

      // Hot white core spark at barrel tip
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(origin.x + dx * 0.22, origin.y + dy * 0.22, 3.4 * sc, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles(ctx, particles, zScale, viewW, viewH) {
    if (!particles || particles.length === 0) return;
    const Iso = ZS.Iso;
    const vp = viewW != null ? { w: viewW, h: viewH } : Iso.getViewport();
    const pad = Math.max(36, 48 * zScale);
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const sc = Iso.gridToScreen(pt.x, pt.y, pt.z);
      if (sc.x < -pad || sc.x > vp.w + pad || sc.y < -pad || sc.y > vp.h + pad) continue;
      const alpha = Math.max(0, pt.life / (pt.maxLife || 0.5));
      if (pt.kind === 'cube') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha * 1.25);
        const w = pt.w || 0.10;
        Iso.drawVoxelBox(ctx, pt.x - w * 0.5, pt.y - w * 0.5, pt.z, w, w, pt.h || 3.0, {
          base: pt.color || '#94A3B8',
          stroke: 'rgba(27, 36, 48, 0.38)'
        });
        ctx.restore();
        continue;
      }
      ctx.save();
      if (pt.kind === 'dust') {
        const grow = 1 + (1 - alpha) * 0.65;
        ctx.globalAlpha = alpha * 0.52;
        ctx.fillStyle = pt.color || '#DDD2BE';
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, pt.size * grow * zScale, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, pt.size * zScale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  Object.assign(R, {
    getZombiePoseMetrics,
    getZombieEyePositions,
    drawZombieEyePinpoints,
    isZombieEyesOccluded,
    drawZombie,
    drawProjectiles,
    drawGroundStains,
    drawDyingZombie,
    drawMuzzleFlashes,
    drawParticles
  });
})();
