/**
 * Mintu Sound Synthesis Engine (Web Audio API)
 * Procedural, zero-dependency audio synthesizer for:
 * - Soothing Pomodoro and Timer chimes
 * - Cute pet companion chirps (happy, level-up, click)
 * - Procedural ambient noise (rain, white noise) for focus sessions
 * - RAM purge sparkle
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private isAmbientPlaying: boolean = false;
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

  /**
   * Soothing bell chime for Pomodoro / Timer completion
   */
  public playChime(): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      // Two-tone gentle harmonic bell: D5 (587Hz) then A5 (880Hz)
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

  /**
   * Cute companion chirps for pet interactions
   */
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
      } else if (type === "happy") {
        // Multi-frequency ascending chirp
        const notes = [659.25, 783.99, 987.77]; // E5, G5, B5
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
        // Glorious fanfare: C5, E5, G5, C6
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

  /**
   * RAM purge optimization sparkle sound
   */
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

  /**
   * Procedural ambient focus sounds (Rain / White Noise)
   */
  public startAmbientSound(mode: "rain" | "white-noise" = "rain", volume: number = 0.15): void {
    if (this.isMuted) return;
    this.stopAmbientSound();

    try {
      const ctx = this.getAudioContext();
      const bufferSize = ctx.sampleRate * 2; // 2-second looped noise buffer
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Generate brown/pink noise
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (mode === "rain") {
          // Brownish noise: gentle integration for rain roar
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 3.5;
        } else {
          // Pink-ish noise
          lastOut = (lastOut + 0.08 * white) / 1.08;
          data[i] = lastOut * 2.0;
        }
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // Lowpass filter for smooth organic warmth
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(mode === "rain" ? 850 : 1200, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.min(0.3, Math.max(0.01, volume)), ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();

      this.ambientSource = noise;
      this.ambientGain = gain;
      this.isAmbientPlaying = true;
    } catch {}
  }

  public setAmbientVolume(vol: number): void {
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(Math.min(0.4, Math.max(0, vol)), this.ctx.currentTime);
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
    this.ambientGain = null;
    this.isAmbientPlaying = false;
  }

  public getIsAmbientPlaying(): boolean {
    return this.isAmbientPlaying;
  }
}

export const soundEngine = new SoundEngine();
