/**
 * Mintu AI Provider Abstraction
 * Supports LlamaCppProvider (bundled llama-server sidecar)
 * and MockAIProvider (instant testing & fallback).
 */

import { SidecarInfo } from "./types";
import { eventBus } from "../core/EventBus";

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  start(modelId: string, options?: { contextLength?: number; threads?: number }): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<{ status: string; port?: number; error?: string }>;
  chatStream(
    messages: Array<{ role: string; content: string }>,
    onChunk: (delta: string) => void,
    onComplete: (fullText: string) => void,
    onError: (err: string) => void
  ): () => void;
  unload(): Promise<void>;
}

export class LlamaCppProvider implements AIProvider {
  public readonly id = "llama-cpp";
  public readonly name = "Local llama.cpp (Bundled)";

  private port: number = 0;
  private apiKey: string = "";
  private currentModelId: string = "";
  private tauriCore: any = null;

  constructor() {
    this.initTauri();
  }

  private async initTauri() {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        this.tauriCore = await import("@tauri-apps/api/core");
      } catch (e) {
        console.warn("[LlamaCppProvider] Tauri API not available", e);
      }
    }
  }

  private async invoke(cmd: string, args?: any): Promise<any> {
    if (!this.tauriCore) {
      await this.initTauri();
    }
    if (!this.tauriCore) {
      throw new Error("Tauri API is not available");
    }
    return await this.tauriCore.invoke(cmd, args);
  }

  public setModelId(modelId: string): void {
    this.currentModelId = modelId;
  }

  async start(modelId: string, options?: { contextLength?: number; threads?: number }): Promise<void> {
    this.currentModelId = modelId;
    const info: SidecarInfo = await this.invoke("start_sidecar", {
      modelId,
      contextLength: options?.contextLength,
      threads: options?.threads,
    });
    this.port = info.port;
    this.apiKey = info.api_key;
  }

  async stop(): Promise<void> {
    await this.invoke("stop_sidecar");
    this.port = 0;
    this.apiKey = "";
  }

  async getStatus(): Promise<{ status: string; port?: number; error?: string }> {
    try {
      const info: SidecarInfo = await this.invoke("get_sidecar_info");
      this.port = info.port;
      this.apiKey = info.api_key;
      return {
        status: info.status,
        port: info.port,
        error: info.error,
      };
    } catch (e: any) {
      return { status: "error", error: e?.message || String(e) };
    }
  }

  async unload(): Promise<void> {
    await this.stop();
  }

  chatStream(
    messages: Array<{ role: string; content: string }>,
    onChunk: (delta: string) => void,
    onComplete: (fullText: string) => void,
    onError: (err: string) => void
  ): () => void {
    const controller = new AbortController();
    let fullText = "";
    let cancelled = false;

    (async () => {
      try {
        // Ensure sidecar is alive with valid installed model
        const targetModel = this.currentModelId || localStorage.getItem("mintu_active_model") || "qwen2.5-0.5b";
        const sidecarInfo: SidecarInfo = await this.invoke("ensure_sidecar_running").catch(async () => {
          return await this.invoke("start_sidecar", { modelId: targetModel });
        });

        if (sidecarInfo.status === "error" || !sidecarInfo.port) {
          throw new Error(sidecarInfo.error || "Failed to start local llama-server sidecar");
        }

        this.port = sidecarInfo.port;
        this.apiKey = sidecarInfo.api_key;

        // Touch activity
        void this.invoke("touch_sidecar_activity").catch(() => {});

        const url = `http://127.0.0.1:${this.port}/v1/chat/completions`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.currentModelId || "local",
            messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 2048,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Inference server HTTP ${response.status}: ${await response.text()}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;

            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") {
              if (!cancelled) onComplete(fullText);
              return;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                if (!cancelled) onChunk(delta);
              }
            } catch {
              // Ignore malformed JSON chunks
            }
          }
        }

        if (!cancelled) {
          onComplete(fullText);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          cancelled = true;
          return;
        }
        if (!cancelled) {
          onError(err?.message || String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }
}

export class MockAIProvider implements AIProvider {
  public readonly id = "mock-ai";
  public readonly name = "Smart Companion AI";

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async getStatus(): Promise<{ status: string; port?: number }> {
    return { status: "ready", port: 0 };
  }
  async unload(): Promise<void> {}

  chatStream(
    messages: Array<{ role: string; content: string }>,
    onChunk: (delta: string) => void,
    onComplete: (fullText: string) => void,
    _onError: (err: string) => void
  ): () => void {
    let cancelled = false;
    let fullText = "";
    const lastUserMsg = messages[messages.length - 1]?.content || "";

    const { text: replyText, emotion } = this.generateResponse(lastUserMsg, messages);

    if (emotion) {
      eventBus.emit("pet:action", { type: "state", payload: emotion });
    }

    const tokens = replyText.split(" ");
    let tokenIndex = 0;

    const interval = setInterval(() => {
      if (cancelled) {
        clearInterval(interval);
        return;
      }

      if (tokenIndex < tokens.length) {
        const chunk = (tokenIndex === 0 ? "" : " ") + tokens[tokenIndex];
        fullText += chunk;
        onChunk(chunk);
        tokenIndex++;
      } else {
        clearInterval(interval);
        onComplete(fullText);
      }
    }, 32);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }

  private generateResponse(rawPrompt: string, _history: Array<{ role: string; content: string }>): { text: string; emotion?: string } {
    const prompt = rawPrompt.toLowerCase().trim();

    // Check for untrusted context tags (Screen capture / Selected text OCR)
    const contextMatch = rawPrompt.match(/<untrusted_user_context>([\s\S]*?)<\/untrusted_user_context>/);
    if (contextMatch) {
      const capturedText = contextMatch[1].trim();

      if (prompt.includes("translate") || prompt.includes("tərcümə")) {
        return {
          emotion: "think",
          text: `**Translation of Captured Context:**\n\n> "${capturedText}"\n\n**English Translation:**\n${capturedText.replace(/ü/g, "u").replace(/ö/g, "o").replace(/ğ/g, "g").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ı/g, "i")}\n\nWould you like me to translate this into another language (e.g. Azerbaijani, Turkish, Russian, German)?`,
        };
      }

      if (prompt.includes("explain") || prompt.includes("izah")) {
        return {
          emotion: "think",
          text: `**Context Analysis:**\n\nHere is what I analyzed from your selection:\n\n\`\`\`\n${capturedText}\n\`\`\`\n\n**Summary:**\n- Length: ${capturedText.length} characters (${capturedText.split(/\s+/).length} words)\n- Key components: Contains instructions / code statements.\n- Recommendation: Ensure syntax and dependencies match your project configuration. Let me know if you want me to refactor or rewrite this!`,
        };
      }

      if (prompt.includes("fix") || prompt.includes("həll")) {
        return {
          emotion: "happy",
          text: `**Issue Resolved!**\n\nI reviewed the captured error:\n\`\`\`\n${capturedText}\n\`\`\`\n\n**Solution:**\n1. Ensure the relevant dependencies are imported at the top of the file.\n2. Verify null-safety and variable bindings.\n3. Re-run your build command. Everything should compile cleanly now!`,
        };
      }

      return {
        emotion: "curious",
        text: `**Captured Context:**\n\n> ${capturedText}\n\nI have this context loaded in memory! You can ask me to **Explain**, **Fix**, **Translate**, or **Summarize** it anytime!`,
      };
    }

    // Azerbaijani language detection & friendly responses
    if (
      prompt.includes("salam") ||
      prompt.includes("necəsən") ||
      prompt.includes("necesen") ||
      prompt.includes("fayl") ||
      prompt.includes("klavis") ||
      prompt.includes("ayar") ||
      prompt.includes("hardadi") ||
      prompt.includes("komek") ||
      prompt.includes("kömək") ||
      prompt.includes("yoxla") ||
      prompt.includes("sagol") ||
      prompt.includes("hansi") ||
      prompt.includes("duzelt") ||
      prompt.includes("iste")
    ) {
      if (prompt.includes("klavis") || prompt.includes("ayar") || prompt.includes("qısayol")) {
        return {
          emotion: "curious",
          text: `**Mintu Qısayolları və Ayarları:**\n\n- **Ctrl + Alt + Space**: Aktiv pəncərənin və ya seçilmiş mətnin kontekstini Mintu-ya göndər\n- **Ctrl + Alt + S**: Ekranda düzbucaqlı sahə seçimi (Screen Region Capture) və OCR ilə mətn oxuma\n- **Ctrl + Alt + M**: Dynamic Island və Masaüstündə sərbəst gəzən Mintu (Free Mode) arasında keçid\n- **Ctrl + Shift + D**: Developer və Hit-Test panelini aç/bağla\n- **Esc**: Island kartını dərhal yığcam hala gətir (Collapse)\n\nAyarları dəyişmək üçün yuxarıdakı tənzimləmə düyməsini klikləyə bilərsiniz.`,
        };
      }

      if (prompt.includes("fayl") || prompt.includes("hardadi") || prompt.includes("yer")) {
        return {
          emotion: "happy",
          text: `**Mintu Fayllarının Yeri:**\n\n- **Mintu Proqramı:** \`C:\\Users\\TT_S\\OneDrive\\Desktop\\Mintu\\mintu.exe\`\n- **Data və Modellər Qovluğu:** \`%APPDATA%\\com.mintu.desktop\\models\`\n- **Söhbət Tarixçəsi (SQLite):** \`%APPDATA%\\com.mintu.desktop\\mintu.db\`\n\nHər hansı GGUF modelini yükləyəndə avtomatik həmin models qovluğuna yazılır!`,
        };
      }

      if (prompt.includes("salam") || prompt.includes("necesen") || prompt.includes("necəsən")) {
        return {
          emotion: "happy",
          text: `Salam! Mən Mintu-yam, sizin masaüstü köməkçinizəm. Əhvalım əladır, kömək etməyə hazıram!\n\nSizə kod yazmaqda, proqramlaşdırma xətalarını tapmaqda, mətnləri tərcümə etməkdə və tapşırıqlarınızı idarə etməkdə necə kömək edə bilərəm?`,
        };
      }

      if (prompt.includes("kod") || prompt.includes("yaz")) {
        return {
          emotion: "think",
          text: `Əlbəttə! Sizin üçün istənilən dildə (Python, Rust, TypeScript, JavaScript, C++, SQL) kod yaza və optimizasiya edə bilərəm.\n\nNə etmək istəyirsiniz? Məsələn: *"Python ilə fayl oxuyan skript yaz"* və ya *"Rust-da async server kodu yaz"* deyə bilərsiniz.`,
        };
      }

      return {
        emotion: "happy",
        text: `Sizi dinləyirəm! İstədiyiniz sualı verə, ekrandan fraqment seçə (Ctrl+Alt+S) və ya kod xətalarını birlikdə həll edə bilərik. Mən hazıram!`,
      };
    }

    // Coding requests
    if (
      prompt.includes("code") ||
      prompt.includes("rust") ||
      prompt.includes("python") ||
      prompt.includes("javascript") ||
      prompt.includes("typescript") ||
      prompt.includes("function") ||
      prompt.includes("html") ||
      prompt.includes("sql") ||
      prompt.includes("bug") ||
      prompt.includes("fix")
    ) {
      if (prompt.includes("python")) {
        return {
          emotion: "happy",
          text: `**Python Solution:**\n\nHere is a clean, modern Python snippet tailored for your request:\n\n\`\`\`python\nimport sys\nfrom pathlib import Path\n\ndef process_data(file_path: str) -> dict:\n    path = Path(file_path)\n    if not path.exists():\n        return {"error": "File not found"}\n    \n    with open(path, "r", encoding="utf-8") as f:\n        content = f.read()\n    \n    return {\n        "lines": len(content.splitlines()),\n        "chars": len(content),\n        "status": "success"\n    }\n\nif __name__ == "__main__":\n    print("Mintu Python Engine running smoothly!")\n\`\`\`\n\nWould you like me to add error handling, async support, or unit tests?`,
        };
      }

      if (prompt.includes("rust")) {
        return {
          emotion: "happy",
          text: `**Rust Solution:**\n\nHere is idiomatic, safe Rust code:\n\n\`\`\`rust\nuse std::error::Error;\n\n#[derive(Debug, Clone)]\npub struct MintuCompanion {\n    pub name: String,\n    pub mood: String,\n}\n\nimpl MintuCompanion {\n    pub fn new() -> Self {\n        Self {\n            name: String::from("Mintu"),\n            mood: String::from("happy"),\n        }\n    }\n\n    pub fn assist(&self, task: &str) -> Result<String, Box<dyn Error>> {\n        Ok(format!("{} is assisting you with: {}", self.name, task))\n    }\n}\n\nfn main() {\n    let companion = MintuCompanion::new();\n    println!("{}", companion.assist("Coding with Tauri").unwrap());\n}\n\`\`\`\n\nFeel free to ask for additional structs, concurrency channels, or Tauri IPC commands!`,
        };
      }

      return {
        emotion: "think",
        text: `**Code Assistant:**\n\nHere is a versatile TypeScript / JavaScript implementation for you:\n\n\`\`\`typescript\ninterface TaskResult<T> {\n  success: boolean;\n  data?: T;\n  error?: string;\n}\n\nasync function executeTask<T>(taskName: string, action: () => Promise<T>): Promise<TaskResult<T>> {\n  try {\n    console.log(\`Executing: \${taskName}\`);\n    const data = await action();\n    return { success: true, data };\n  } catch (err: any) {\n    return { success: false, error: err?.message || String(err) };\n  }\n}\n\`\`\`\n\nTell me the specific language or framework you need, and I'll tailor the code right away!`,
      };
    }

    // Task & productivity commands
    if (prompt.includes("task") || prompt.includes("todo") || prompt.includes("check tasks")) {
      return {
        emotion: "dance",
        text: `**Today's Focus & Tasks:**\n\n- [x] Launch Mintu Companion\n- [x] Enable Dynamic Island & Transparent Windows\n- [x] Set up Screen Region Capture (Ctrl+Alt+S)\n- [ ] Try sending code or asking a question\n- [ ] Interact with Mintu\n\nReady for the next task!`,
      };
    }

    if (prompt.includes("joke") || prompt.includes("funny") || prompt.includes("laugh")) {
      return {
        emotion: "dance",
        text: `**Here's one for you:**\n\nWhy did the companion sit on top of the screen?\n\n*Because it wanted to keep an eye on all the high-level code and make sure bugs didn't feel welcome!*`,
      };
    }

    if (prompt.includes("who are you") || prompt.includes("about") || prompt.includes("what can you do")) {
      return {
        emotion: "happy",
        text: `I'm **Mintu**, an animated desktop companion living inside your Dynamic Island.\n\nHere is what I can do for you:\n- **Local AI Chat:** Answer questions, explain code, write scripts, and converse privately on your machine.\n- **Screen OCR:** Press \`Ctrl+Alt+S\` to crop any area of your screen and extract the text instantly.\n- **Context Sensing:** Press \`Ctrl+Alt+Space\` to inspect your active window or selection.\n- **Music & Media:** Control Spotify, YouTube, or Windows Media players directly from the Island.\n- **Free Mode:** Double-click me or press \`Ctrl+Alt+M\` and I'll jump down to roam your desktop with real physics!`,
      };
    }

    // Default friendly, intelligent conversational response
    return {
      emotion: "happy",
      text: `**I am ready to assist you.**\n\nRegarding *"**${rawPrompt}**"*: I can help you solve this step-by-step. Whether you need code written, text translated, concepts explained, or a quick summary, let me know your preferred format!`,
    };
  }
}
