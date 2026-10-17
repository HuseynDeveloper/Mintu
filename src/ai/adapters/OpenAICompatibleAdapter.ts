/**
 * Mintu AI Cloud Adapter
 * Supports Google Gemini (both Native REST stream & OpenAI compatibility),
 * OpenAI, DeepSeek, Qwen, Kimi, and Custom base URLs (Ollama, Groq, OpenRouter).
 */

import { AIProvider } from "../AIProvider";

export class OpenAICompatibleAdapter implements AIProvider {
  public readonly id: string;
  public readonly name: string;
  private baseUrl: string;
  private model: string;
  private providerId: string;
  private tauriCore: any = null;

  constructor(providerId: string, name: string, baseUrl: string, defaultModel: string) {
    this.providerId = providerId;
    this.id = `cloud-${providerId}`;
    this.name = name;
    this.baseUrl = baseUrl.trim().replace(/\/+$/, "");
    this.model = defaultModel;
    this.initTauri();
  }

  private async initTauri() {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        this.tauriCore = await import("@tauri-apps/api/core");
      } catch (e) {
        console.warn("[OpenAICompatibleAdapter] Tauri API not available", e);
      }
    }
  }

  public setModel(model: string) {
    this.model = model.trim();
  }

  public getModel(): string {
    return this.model;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.trim().replace(/\/+$/, "");
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  async start(): Promise<void> {
    // Cloud provider is ready on demand
  }

  async stop(): Promise<void> {
    // No-op for cloud
  }

  async unload(): Promise<void> {
    // No-op for cloud
  }

  async getStatus(): Promise<{ status: string; error?: string }> {
    try {
      const hasKey = await this.hasApiKey();
      return { status: hasKey ? "ready" : "needs_key" };
    } catch (e: any) {
      return { status: "error", error: e?.message || String(e) };
    }
  }

  private async getApiKey(): Promise<string | null> {
    if (!this.tauriCore) await this.initTauri();
    if (this.tauriCore) {
      return await this.tauriCore.invoke("get_api_key", { provider: this.providerId });
    }
    return null;
  }

  public async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return !!key && key.trim().length > 0;
  }

  chatStream(
    messages: Array<{ role: string; content: string }>,
    onChunk: (delta: string) => void,
    onComplete: (fullText: string) => void,
    onError: (err: string) => void
  ): () => void {
    const controller = new AbortController();

    (async () => {
      try {
        const apiKey = (await this.getApiKey())?.trim();
        if (!apiKey) {
          onError(`No API key found in Windows Credential Manager for ${this.name}. Please enter your key in Settings.`);
          return;
        }

        const isGemini =
          this.providerId === "gemini" ||
          this.baseUrl.includes("generativelanguage.googleapis.com") ||
          apiKey.startsWith("AIza");

        const isExplicitOpenAiEndpoint =
          this.baseUrl.includes("/openai") || this.baseUrl.endsWith("/chat/completions");

        let endpoint = "";
        let headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        let bodyPayload: any = null;

        if (isGemini && !isExplicitOpenAiEndpoint) {
          // Native Google Gemini Stream API (Most reliable for Gemini API keys)
          const cleanModel = (this.model || "gemini-2.5-flash").replace(/^models\//, "");
          endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
          headers["x-goog-api-key"] = apiKey;

          // Extract system prompt if present
          let systemPrompt = "";
          const userContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

          for (const m of messages) {
            if (m.role === "system") {
              systemPrompt = systemPrompt ? `${systemPrompt}\n\n${m.content}` : m.content;
            } else {
              userContents.push({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              });
            }
          }

          bodyPayload = {
            contents: userContents,
            generationConfig: {
              temperature: 0.7,
            },
          };

          if (systemPrompt) {
            bodyPayload.systemInstruction = {
              parts: [{ text: systemPrompt }],
            };
          }
        } else {
          // Standard OpenAI-compatible API (OpenAI, DeepSeek, Qwen, Ollama, Groq, Custom proxy)
          endpoint = this.baseUrl;
          if (!endpoint.endsWith("/chat/completions")) {
            endpoint = `${endpoint}/chat/completions`;
          }

          headers["Authorization"] = `Bearer ${apiKey}`;
          if (apiKey.startsWith("AIza")) {
            headers["x-goog-api-key"] = apiKey;
          }

          bodyPayload = {
            model: this.model,
            messages,
            stream: true,
            temperature: 0.7,
          };
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          let parsedError = errText;
          try {
            const errObj = JSON.parse(errText);
            parsedError =
              errObj.error?.message ||
              errObj.message ||
              (Array.isArray(errObj) && errObj[0]?.error?.message) ||
              errText;
          } catch {}

          if (res.status === 403) {
            onError(
              `${this.name} Error (403 Forbidden): ${parsedError || "API key permission denied or location unsupported."}`
            );
          } else if (res.status === 404) {
            onError(
              `${this.name} Error (404 Not Found): ${parsedError || `Model "${this.model}" or endpoint URL not found.`}`
            );
          } else {
            onError(`${this.name} API error (${res.status}): ${parsedError}`);
          }
          return;
        }

        if (!res.body) {
          onError("Response body is empty");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;

            if (trimmed === "data: [DONE]") {
              onComplete(fullText);
              return;
            }

            if (trimmed.startsWith("data: ")) {
              try {
                const data = JSON.parse(trimmed.substring(6));

                // 1. OpenAI delta format
                let delta = data.choices?.[0]?.delta?.content;

                // 2. Google Gemini candidate format
                if (!delta && data.candidates?.[0]?.content?.parts) {
                  delta = data.candidates[0].content.parts.map((p: any) => p.text || "").join("");
                }

                if (typeof delta === "string" && delta.length > 0) {
                  fullText += delta;
                  onChunk(delta);
                }
              } catch {}
            }
          }
        }

        onComplete(fullText);
      } catch (err: any) {
        if (err.name === "AbortError") {
          return;
        }
        onError(err?.message || String(err));
      }
    })();

    return () => {
      controller.abort();
    };
  }
}
