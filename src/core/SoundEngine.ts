/**
 * Mintu Sound Synthesis Engine (Web Audio API)
 * Procedural, zero-dependency audio synthesizer for:
 * 1. Soothing Pomodoro and Timer chimes
 * 2. Cute pet companion chirps (happy, level-up, click, purr)
 * 3. Procedural ambient focus mixer (rain, fireplace, brown-noise, white-noise)
 * 4. RAM purge sparkle
 */

export type AmbientSoundMode = "off" | "rain" | "fireplace" | "brown-noise" | "white-noise";

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientCrackleSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private isAmbientPlaying: boolean = false;
  private currentAmbientMode: AmbientSoundMode = "off";
  private currentAmbientVolume: number = 0.18;
  private isMuted: boolean = false;

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted && this.isAmbientPlaying) {
      this.stopAmbientSound();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public playChime(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const freqs = [587.33, 880.0];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.18);
        gain.gain.setValueAtTime(0, now + idx * 0.18);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.18 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.18 + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.18);
        osc.stop(now + idx * 0.18 + 1.3);
      });
    } catch {}
  }

  public playCuteChirp(type: "happy" | "level-up" | "click" | "purr" = "click"): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      if (type === "click") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "purr") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.14);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === "happy") {
        const notes = [659.25, 783.99, 987.77];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + i * 0.07);
          gain.gain.setValueAtTime(0.12, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.16);
        });
      } else if (type === "level-up") {
        const fanfare = [523.25, 659.25, 783.99, 1046.5];
        fanfare.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = i === 3 ? "triangle" : "sine";
          osc.frequency.setValueAtTime(freq, now + i * 0.09);
          gain.gain.setValueAtTime(0.15, now + i * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + (i === 3 ? 0.6 : 0.2));
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.09);
          osc.stop(now + i * 0.09 + (i === 3 ? 0.65 : 0.25));
        });
      }
    } catch {}
  }

  public playPurgeSound(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch {}
  }

  public startAmbientSound(mode: AmbientSoundMode = "rain", volume?: number): void {
    if (mode === "off") {
      this.stopAmbientSound();
      return;
    }
    if (this.isMuted) return;
    this.stopAmbientSound();

    const targetVol = typeof volume === "number" ? volume : this.currentAmbientVolume;
    this.currentAmbientVolume = Math.min(0.4, Math.max(0.01, targetVol));

    try {
      const ctx = this.getAudioContext();
      const durationSec = 3;
      const bufferSize = ctx.sampleRate * durationSec;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (mode === "rain") {
          lastOut = (lastOut + 0.03 * white) / 1.03;
          const drop = Math.random() < 0.0008 ? (Math.random() - 0.5) * 0.35 : 0;
          data[i] = lastOut * 3.1 + drop;
        } else if (mode === "fireplace") {
          lastOut = (lastOut + 0.015 * white) / 1.015;
          data[i] = lastOut * 3.6;
        } else if (mode === "brown-noise") {
          lastOut = (lastOut + 0.018 * white) / 1.018;
          data[i] = lastOut * 4.0;
        } else {
          lastOut = (lastOut + 0.09 * white) / 1.09;
          data[i] = lastOut * 1.9;
        }
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      const cutoff =
        mode === "rain"
          ? 920
          : mode === "fireplace"
            ? 300
            : mode === "brown-noise"
              ? 420
              : 1550;
      filter.frequency.setValueAtTime(cutoff, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(this.currentAmbientVolume, ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      // Extra organic wood-crackle layer for fireplace mode
      if (mode === "fireplace") {
        const crackleBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const cData = crackleBuf.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          if (Math.random() < 0.00035) {
            const amp = 0.25 + Math.random() * 0.55;
            const len = Math.min(28, bufferSize - i);
            for (let k = 0; k < len; k++) {
              cData[i + k] = (Math.random() * 2 - 1) * amp * (1 - k / len);
            }
          }
        }
        const crackle = ctx.createBufferSource();
        crackle.buffer = crackleBuf;
        crackle.loop = true;

        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(2100, ctx.currentTime);
        bp.Q.setValueAtTime(1.4, ctx.currentTime);

        crackle.connect(bp);
        bp.connect(gain);
        crackle.start();
        this.ambientCrackleSource = crackle;
      }

      this.ambientSource = noise;
      this.ambientGain = gain;
      this.isAmbientPlaying = true;
      this.currentAmbientMode = mode;
    } catch {}
  }

  public setAmbientVolume(vol: number): void {
    const clamped = Math.min(0.4, Math.max(0.01, vol));
    this.currentAmbientVolume = clamped;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  public stopAmbientSound(): void {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      } catch {}
      this.ambientSource = null;
    }
    if (this.ambientCrackleSource) {
      try {
        this.ambientCrackleSource.stop();
        this.ambientCrackleSource.disconnect();
      } catch {}
      this.ambientCrackleSource = null;
    }
    this.ambientGain = null;
    this.isAmbientPlaying = false;
    this.currentAmbientMode = "off";
  }

  public getIsAmbientPlaying(): boolean {
    return this.isAmbientPlaying;
  }

  public getAmbientMode(): AmbientSoundMode {
    return this.currentAmbientMode;
  }

  public getAmbientVolume(): number {
    return this.currentAmbientVolume;
  }
}

export const soundEngine = new SoundEngine();
