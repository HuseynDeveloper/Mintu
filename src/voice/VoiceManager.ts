/**
 * Mintu Voice Engine (Milestone 7)
 * Dual-Engine Text-to-Speech (TTS) and Speech-to-Text (STT) Voice Manager.
 *
 * Capabilities:
 * - Animated pet expression synchronization (talk pose on speaking, idle on finish).
 * - Markdown & code fence sanitizer for spoken natural audio.
 * - Configurable speech pitch, rate, and voice profile matching Mintu's cheerful personality.
 * - Web Speech API & MediaRecorder microphone capture for voice commands.
 */

function emitPetAction(state: string) {
  if (typeof window !== "undefined") {
    import("../core/EventBus").then(({ eventBus }) => {
      eventBus.emit("pet:action", { type: "state", payload: state });
    }).catch(() => {});
  }
}

export interface VoiceConfig {
  ttsEnabled: boolean;
  ttsRate: number;    // 0.8 to 1.5
  ttsPitch: number;   // 0.8 to 1.6
  ttsVolume: number;  // 0 to 1
  ttsVoiceName?: string;
  sttLanguage: string;
}

export class VoiceManager {
  private config: VoiceConfig;
  private isSpeaking: boolean = false;
  private isListeningState: boolean = false;
  private activeRecognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): VoiceConfig {
    const ttsEnabled = localStorage.getItem("mintu_tts_enabled") !== "false"; // default true
    const ttsRate = parseFloat(localStorage.getItem("mintu_tts_rate") || "1.05");
    const ttsPitch = parseFloat(localStorage.getItem("mintu_tts_pitch") || "1.15");
    const ttsVolume = parseFloat(localStorage.getItem("mintu_tts_volume") || "1.0");
    const ttsVoiceName = localStorage.getItem("mintu_tts_voice") || "";
    const sttLanguage = localStorage.getItem("mintu_stt_lang") || "az-AZ";

    return {
      ttsEnabled,
      ttsRate,
      ttsPitch,
      ttsVolume,
      ttsVoiceName,
      sttLanguage,
    };
  }

  public saveConfig(newConfig: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem("mintu_tts_enabled", String(this.config.ttsEnabled));
    localStorage.setItem("mintu_tts_rate", String(this.config.ttsRate));
    localStorage.setItem("mintu_tts_pitch", String(this.config.ttsPitch));
    localStorage.setItem("mintu_tts_volume", String(this.config.ttsVolume));
    if (this.config.ttsVoiceName) {
      localStorage.setItem("mintu_tts_voice", this.config.ttsVoiceName);
    }
    localStorage.setItem("mintu_stt_lang", this.config.sttLanguage);
  }

  public getConfig(): VoiceConfig {
    return { ...this.config };
  }

  /**
   * Cleans raw markdown and system syntax so TTS speaks naturally.
   */
  public sanitizeForSpeech(raw: string): string {
    if (!raw) return "";

    return raw
      // Remove code blocks entirely or replace with a short notice
      .replace(/```[\s\S]*?```/g, " [kod bloku] ")
      // Remove inline code
      .replace(/`([^`]+)`/g, "$1")
      // Remove URLs
      .replace(/https?:\/\/\S+/g, " link ")
      // Remove markdown bold/italics
      .replace(/[*_~#]/g, "")
      // Remove xml/html tags
      .replace(/<[^>]+>/g, "")
      // Remove bullet dashes
      .replace(/^\s*[-*+]\s+/gm, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Speak a text string with Mintu's voice and animate pet mouth.
   */
  public speak(
    text: string,
    options?: { onStart?: () => void; onEnd?: () => void; onError?: (err: any) => void }
  ): void {
    if (!this.config.ttsEnabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const cleaned = this.sanitizeForSpeech(text);
    if (!cleaned) return;

    // Cancel ongoing speech before starting new sentence
    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = this.config.ttsRate;
    utterance.pitch = this.config.ttsPitch;
    utterance.volume = this.config.ttsVolume;

    // Pick best suited voice
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      if (this.config.ttsVoiceName) {
        const found = voices.find((v) => v.name === this.config.ttsVoiceName);
        if (found) utterance.voice = found;
      }
      if (!utterance.voice) {
        // Preference: natural cheerful voices or target language
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith("az") ||
            v.lang.startsWith("tr") ||
            v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Zira") ||
            v.name.includes("Jenny")
        );
        if (preferred) utterance.voice = preferred;
      }
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      emitPetAction("talk");
      options?.onStart?.();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      emitPetAction("idle");
      options?.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isSpeaking = false;
      emitPetAction("idle");
      options?.onError?.(e);
    };

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (this.isSpeaking) {
      this.isSpeaking = false;
      emitPetAction("idle");
    }
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  public isListening(): boolean {
    return this.isListeningState;
  }

  /**
   * Start microphone voice recognition.
   */
  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (err: string) => void,
    onStateChange?: (listening: boolean) => void
  ): boolean {
    if (typeof window === "undefined") return false;

    // Stop speaking while listening so Mintu doesn't hear itself
    this.stopSpeaking();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        this.activeRecognition = recognition;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = this.config.sttLanguage || "az-AZ";

        recognition.onstart = () => {
          this.isListeningState = true;
          emitPetAction("curious");
          onStateChange?.(true);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
            onResult(finalTranscript, true);
          } else if (interimTranscript) {
            onResult(interimTranscript, false);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("[VoiceManager] Speech recognition error:", event.error);
          this.isListeningState = false;
          onStateChange?.(false);
          emitPetAction("idle");
          onError(event.error || "Speech recognition error");
        };

        recognition.onend = () => {
          this.isListeningState = false;
          onStateChange?.(false);
          emitPetAction("idle");
        };

        recognition.start();
        return true;
      } catch (e: any) {
        console.warn("[VoiceManager] SpeechRecognition start failed:", e);
      }
    }

    // Fallback: Audio recording via getUserMedia
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          this.audioChunks = [];
          const recorder = new MediaRecorder(stream);
          this.mediaRecorder = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.audioChunks.push(e.data);
          };

          recorder.onstart = () => {
            this.isListeningState = true;
            emitPetAction("curious");
            onStateChange?.(true);
          };

          recorder.onstop = () => {
            this.isListeningState = false;
            onStateChange?.(false);
            emitPetAction("idle");
            stream.getTracks().forEach((track) => track.stop());
          };

          recorder.start();
        })
        .catch((err) => {
          this.isListeningState = false;
          onStateChange?.(false);
          onError("Microphone access denied: " + err.message);
        });
      return true;
    }

    onError("Speech recognition not supported in this environment");
    return false;
  }

  public stopListening(): void {
    if (this.activeRecognition) {
      try {
        this.activeRecognition.stop();
      } catch {}
      this.activeRecognition = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {}
      this.mediaRecorder = null;
    }

    this.isListeningState = false;
    emitPetAction("idle");
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }
}

export const voiceManager = new VoiceManager();
