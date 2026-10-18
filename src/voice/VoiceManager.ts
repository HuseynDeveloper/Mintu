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
  private onResultCb: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onErrorCb: ((err: string) => void) | null = null;
  private onStateChangeCb: ((listening: boolean, statusText?: string) => void) | null = null;
  private mediaStream: any = null;

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
   * Transcribe recorded audio blob using available cloud AI providers (Groq Whisper, OpenAI Whisper, Gemini Multimodal).
   */
  public async transcribeAudio(audioBlob: Blob): Promise<string> {
    const { cloudProviderManager } = await import("../ai/adapters/CloudProviderManager");
    const activeProvider = cloudProviderManager.getActiveProviderId();
    const lang = (this.config.sttLanguage || "az-AZ").split("-")[0]; // "az", "en", "tr", "ru", etc.

    // 1. Try Groq Whisper (Blazing fast ~250ms, highly accurate for Azerbaijani)
    const groqKey = await cloudProviderManager.getApiKey("groq");
    if (groqKey) {
      try {
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        formData.append("model", "whisper-large-v3-turbo");
        formData.append("language", lang);
        formData.append("response_format", "json");

        const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
          },
          body: formData,
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data && data.text && data.text.trim()) {
            return data.text.trim();
          }
        }
      } catch (e) {
        console.warn("[VoiceManager] Groq Whisper failed:", e);
      }
    }

    // 2. Try OpenAI Whisper
    const openAiKey = await cloudProviderManager.getApiKey("openai");
    if (openAiKey) {
      try {
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        formData.append("model", "whisper-1");
        formData.append("language", lang);

        const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
          },
          body: formData,
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data && data.text && data.text.trim()) {
            return data.text.trim();
          }
        }
      } catch (e) {
        console.warn("[VoiceManager] OpenAI Whisper failed:", e);
      }
    }

    // 3. Try Gemini multimodal audio transcription
    const geminiKey = await cloudProviderManager.getApiKey("gemini");
    if (geminiKey) {
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result as string;
            const b64 = res.substring(res.indexOf(",") + 1);
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        const mime = audioBlob.type || "audio/webm";
        const promptText = `Please transcribe the exact spoken speech from this audio recording verbatim in the original language (${this.config.sttLanguage}). Output strictly and only the transcription text, with no markdown, quotes, notes, or explanations.`;

        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { inlineData: { mimeType: mime, data: base64Data } },
                    { text: promptText },
                  ],
                },
              ],
            }),
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            return text.trim();
          }
        }
      } catch (e) {
        console.warn("[VoiceManager] Gemini Audio transcription failed:", e);
      }
    }

    // 4. Try Custom OpenAI-compatible endpoint
    if (activeProvider === "custom") {
      const customKey = (await cloudProviderManager.getApiKey("custom")) || "";
      const baseUrl = cloudProviderManager.getBaseUrl("custom");
      try {
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        formData.append("model", "whisper-1");
        formData.append("language", lang);

        const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/audio/transcriptions`, {
          method: "POST",
          headers: {
            ...(customKey ? { Authorization: `Bearer ${customKey}` } : {}),
          },
          body: formData,
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data && data.text && data.text.trim()) {
            return data.text.trim();
          }
        }
      } catch (e) {}
    }

    throw new Error(
      "Səsi mətnə çevirmək üçün Parametrlərdən Gemini, OpenAI və ya Groq API açarı təyin edin."
    );
  }

  /**
   * Start microphone voice recognition or audio recording.
   */
  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (err: string) => void,
    onStateChange?: (listening: boolean, statusText?: string) => void
  ): boolean {
    if (typeof window === "undefined") return false;

    // Stop speaking while listening so Mintu doesn't hear itself
    this.stopSpeaking();

    this.onResultCb = onResult;
    this.onErrorCb = onError;
    this.onStateChangeCb = onStateChange || null;

    // Direct MediaRecorder approach: rock-solid in Windows WebView2
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          this.mediaStream = stream;
          this.audioChunks = [];

          let mimeType = "audio/webm";
          if (typeof MediaRecorder.isTypeSupported === "function") {
            if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
              mimeType = "audio/webm;codecs=opus";
            } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
              mimeType = "audio/ogg;codecs=opus";
            }
          }

          const recorder = new MediaRecorder(stream, { mimeType });
          this.mediaRecorder = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              this.audioChunks.push(e.data);
            }
          };

          recorder.onstart = () => {
            this.isListeningState = true;
            emitPetAction("curious");
            this.onStateChangeCb?.(true, "listening");
          };

          recorder.onstop = async () => {
            this.isListeningState = false;
            this.onStateChangeCb?.(false, "transcribing");
            emitPetAction("idle");

            // Stop all mic tracks
            stream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;

            if (this.audioChunks.length === 0) {
              this.onStateChangeCb?.(false, "idle");
              return;
            }

            const recordedBlob = new Blob(this.audioChunks, { type: mimeType });
            this.audioChunks = [];

            try {
              const text = await this.transcribeAudio(recordedBlob);
              if (text && text.trim()) {
                this.onResultCb?.(text.trim(), true);
              } else {
                this.onErrorCb?.("Heç bir səs aşkar edilmədi.");
              }
            } catch (err: any) {
              this.onErrorCb?.(err?.message || "Transkripsiya xətası");
            } finally {
              this.onStateChangeCb?.(false, "idle");
            }
          };

          recorder.start(250); // Collect chunk every 250ms
        })
        .catch((err) => {
          this.isListeningState = false;
          this.onStateChangeCb?.(false, "idle");
          this.onErrorCb?.("Mikrofona giriş rədd edildi: " + err.message);
        });

      return true;
    }

    onError("Bu mühitdə mikrofon dəstəklənmir.");
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

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t: any) => t.stop());
      } catch {}
      this.mediaStream = null;
    }

    this.isListeningState = false;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }
}

export const voiceManager = new VoiceManager();
