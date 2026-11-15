window.ZS = window.ZS || {};

ZS.Audio = (function () {
  let ctx = null;
  let muted = false;
  let lastShotTime = 0;

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freq, endFreq, duration, type, gainVal) {
    const c = ensure();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    g.gain.setValueAtTime(gainVal || 0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function noise(duration, gainVal, filterFreq) {
    const c = ensure();
    if (!c) return;
    const now = c.currentTime;
    const sampleCount = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, sampleCount, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / sampleCount, 1.6);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq || 1100;

    const g = c.createGain();
    g.gain.setValueAtTime(gainVal || 0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start(now);
  }

  return {
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    playBuild() {
      tone(320, 540, 0.09, 'triangle', 0.09);
      setTimeout(() => tone(620, 780, 0.07, 'sine', 0.06), 45);
    },
    playUpgrade() {
      tone(380, 620, 0.10, 'triangle', 0.09);
      setTimeout(() => tone(620, 920, 0.11, 'sine', 0.08), 55);
      setTimeout(() => tone(880, 1240, 0.14, 'triangle', 0.08), 115);
    },
    playRemove() {
      tone(300, 140, 0.12, 'sawtooth', 0.07);
    },
    playError() {
      tone(170, 120, 0.16, 'sawtooth', 0.08);
    },
    playTrade() {
      tone(520, 880, 0.1, 'sine', 0.08);
      setTimeout(() => tone(780, 1120, 0.13, 'triangle', 0.08), 70);
    },
    playShoot(projType) {
      const c = ensure();
      if (!c) return;
      const now = performance.now();
      if (now - lastShotTime < 38) return; // prevent audio overload when many turrets fire
      lastShotTime = now;

      if (projType === 'vulcan') {
        noise(0.045, 0.055, 1600);
        tone(220, 95, 0.04, 'sawtooth', 0.04);
      } else if (projType === 'sniper') {
        noise(0.14, 0.12, 950);
        tone(420, 80, 0.13, 'sawtooth', 0.09);
      } else if (projType === 'shotgun') {
        noise(0.11, 0.10, 750);
        tone(190, 65, 0.09, 'square', 0.06);
      } else if (projType === 'missile' || projType === 'hq_aegis') {
        noise(0.16, 0.08, 600);
        tone(280, 130, 0.15, 'triangle', 0.06);
      } else if (projType === 'emp') {
        tone(960, 260, 0.12, 'sawtooth', 0.06);
      } else {
        noise(0.06, 0.065, 1350);
        tone(280, 110, 0.05, 'triangle', 0.045);
      }
    },
    playExplosion() {
      noise(0.28, 0.15, 380);
      tone(130, 38, 0.26, 'sine', 0.12);
    },
    playBlackout() {
      tone(440, 160, 0.35, 'sawtooth', 0.11);
      setTimeout(() => tone(310, 110, 0.4, 'sawtooth', 0.10), 180);
    },
    playWaveStart() {
      tone(220, 330, 0.22, 'sawtooth', 0.08);
      setTimeout(() => tone(330, 440, 0.28, 'triangle', 0.09), 140);
    },
    playWaveClear() {
      [440, 554, 659, 880].forEach((f, idx) => {
        setTimeout(() => tone(f, f * 1.03, 0.18, 'triangle', 0.08), idx * 85);
      });
    }
  };
})();
