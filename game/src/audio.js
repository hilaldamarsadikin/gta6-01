// TELUK EMAS — sound, all procedural: no audio files anywhere, just
// oscillators and filtered noise through WebAudio. The engine hum follows
// the car's speed, the horn is a square blip, a gunshot is a noise burst,
// the police siren wails between two tones, and a quiet pad loop plays over
// the city. Nothing starts until the player presses a key or clicks, the
// way browsers demand, and M mutes everything at once.
//
// selfTest() exercises every one-shot path (horn, gunshot, punch, crash,
// pickup, skid) against a muted master and returns false if any of them
// throws — headless runs cannot hear the game, but they can prove the
// graph builds without an error.

import { AUDIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let started = false;
  let volume = AUDIO.master;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = AUDIO.master;
      master.connect(ctx.destination);
      startEngine();
      startMusic();
    } catch {
      ctx = null;
      master = null;
    }
  }

  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 28;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();
  }

  // One oscillator whose frequency slides between two tones, the classic
  // two-tone wail. It is built lazily, the first time a siren is wanted.
  function startSiren() {
    if (!ctx || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  // A slow, warm pad: two detuned triangles on a I–vi–IV–V loop in C
  // major, one chord every four seconds, very quiet, sitting under the
  // action instead of on top of it.
  function startMusic() {
    const chords = [
      [130.81, 164.81, 196.0],
      [110.0, 130.81, 164.81],
      [87.31, 130.81, 174.61],
      [98.0, 146.83, 196.0],
    ];
    let step = 0;
    function playChord() {
      if (!ctx) return;
      if (!muted) {
        const freqs = chords[step % chords.length];
        step += 1;
        for (const f of freqs) {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = f;
          osc.detune.value = (Math.random() - 0.5) * 8;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, ctx.currentTime);
          g.gain.linearRampToValueAtTime(AUDIO.music, ctx.currentTime + 1.2);
          g.gain.linearRampToValueAtTime(0, ctx.currentTime + 4.2);
          osc.connect(g);
          g.connect(master);
          osc.start();
          osc.stop(ctx.currentTime + 4.4);
        }
      }
      musicTimer = setTimeout(playChord, 4000);
    }
    playChord();
  }

  // A decaying burst of white noise through a lowpass filter: the raw
  // material for gunshots, punches, crashes and skids.
  function noiseBurst(duration, filterFreq, gainValue) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gainValue;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  function blip(freq, type, seconds, gainValue, slideTo) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.setValueAtTime(slideTo, ctx.currentTime + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainValue, ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime + seconds);
    osc.connect(g);
    g.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + seconds + 0.05);
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : volume;
    },
    isMuted() {
      return muted;
    },
    // Set the master volume (0..1, clamped): the mute toggle goes through
    // here too, so 0 always means silence and 1 never clips the graph.
    // While muted the gain stays at 0 whatever volume is asked for — the
    // stored volume is only applied again when the player unmutes.
    setVolume(value) {
      const v = Math.max(0, Math.min(1, value));
      volume = v;
      if (master) master.gain.value = muted ? 0 : v;
      return v;
    },
    // The volume setVolume() last stored, 0 while muted: the HUD and the
    // pause screen read this instead of guessing from the gain node.
    getVolume() {
      return muted ? 0 : volume;
    },
    // speed01 is 0..1, driving says whether Raka is in a car at all.
    setEngine(speed01, driving) {
      if (!ctx || !engineGain || !engineOsc || !engineOsc2) return;
      const target = driving ? AUDIO.engineBase + speed01 * AUDIO.engineTop : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, ctx.currentTime, 0.1);
      engineOsc2.frequency.setTargetAtTime(28 + speed01 * 55, ctx.currentTime, 0.1);
    },
    horn() {
      blip(370, 'square', 0.35, 0.16);
    },
    gunshot() {
      noiseBurst(0.16, 1800, 0.5);
    },
    punch() {
      noiseBurst(0.09, 500, 0.35);
    },
    crash() {
      noiseBurst(0.3, 300, 0.6);
    },
    skid() {
      noiseBurst(0.4, 900, 0.22);
    },
    pickup() {
      blip(660, 'sine', 0.25, 0.18, 990);
    },
    setSiren(on, elapsed) {
      if (!ctx) return;
      startSiren();
      if (!sirenOsc || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? AUDIO.siren : 0, ctx.currentTime, 0.2);
      if (on) {
        const tone = Math.sin(elapsed * 3.2) > 0 ? 720 : 960;
        sirenOsc.frequency.setTargetAtTime(tone, ctx.currentTime, 0.05);
      }
    },
    // Pause and resume the whole graph: the pause screen suspends the
    // context so the engine and the pad stop while the game waits.
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    // Stop the music loop for good: the shot stager and the game-over
    // screen use this so a finished session leaves no timer behind. It
    // only clears the scheduler — the pad's already-playing chord fades
    // out on its own, so there is no audible cut.
    stopMusic() {
      if (musicTimer) {
        clearTimeout(musicTimer);
        musicTimer = null;
      }
    },
    // Run every sound path once, muted, and report whether any threw.
    selfTest() {
      try {
        ensure();
        if (!ctx) return { ok: false, reason: 'no AudioContext' };
        const wasMuted = muted;
        muted = true;
        if (master) master.gain.value = 0;
        this.horn();
        this.gunshot();
        this.punch();
        this.crash();
        this.skid();
        this.pickup();
        this.setEngine(0.6, true);
        this.setEngine(0, false);
        this.setSiren(true, 1.23);
        this.setSiren(false, 1.23);
        muted = wasMuted;
        if (master) master.gain.value = wasMuted ? 0 : volume;
        return { ok: true, reason: '' };
      } catch (err) {
        return { ok: false, reason: String(err && err.message ? err.message : err) };
      }
    },
    get started() {
      return started;
    },
  };
}
