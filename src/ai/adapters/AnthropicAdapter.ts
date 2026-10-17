/**
 * Mintu Anthropic Claude Cloud Adapter
 */

import { AIProvider } from "../AIProvider";

export class AnthropicAdapter implements AIProvider {
  public readonly id = "cloud-anthropic";
  public readonly name = "Anthropic Claude";
  private baseUrl = "https://api.anthropic.com/v1";
  private model: string = "claude-3-5-sonnet-20241022";
  private tauriCore: any = null;

  constructor(defaultModel?: string) {
    if (defaultModel) this.model = defaultModel;
    this.initTauri();
  }

  private async initTauri() {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        this.tauriCore = await import("@tauri-apps/api/core");
      } catch (e) {
        console.warn("[AnthropicAdapter] Tauri API not available", e);
      }
    }
  }

  public setModel(model: string) {
    this.model = model;
  }

  public getModel(): string {
    return this.model;
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async unload(): Promise<void> {}

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
      return await this.tauriCore.invoke("get_api_key", { provider: "anthropic" });
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
        const apiKey = await this.getApiKey();
        if (!apiKey) {
          onError("No API key found in Windows Credential Manager for Anthropic Claude. Please configure your key in Settings.");
          return;
        }

        // Separate system messages
        let systemPrompt = "";
        const userAndAssistantMessages: Array<{ role: string; content: string }> = [];

        for (const m of messages) {
          if (m.role === "system") {
            systemPrompt += (systemPrompt ? "\n\n" : "") + m.content;
          } else {
            userAndAssistantMessages.push({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            });
          }
        }

        const endpoint = `${this.baseUrl}/messages`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: this.model,
            system: systemPrompt || undefined,
            messages: userAndAssistantMessages,
            max_tokens: 4096,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          let parsedError = errText;
          try {
            const errObj = JSON.parse(errText);
            parsedError = errObj.error?.message || errText;
          } catch {}
          onError(`Anthropic API error (${res.status}): ${parsedError}`);
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
            if (!trimmed.startsWith("data: ")) continue;

            const dataStr = trimmed.substring(6).trim();
            if (dataStr === "[DONE]") {
              onComplete(fullText);
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.type === "content_block_delta" && data.delta?.text) {
                fullText += data.delta.text;
                onChunk(data.delta.text);
              } else if (data.type === "message_stop") {
                onComplete(fullText);
                return;
              }
            } catch {}
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
