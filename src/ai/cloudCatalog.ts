/**
 * Mintu Cloud AI Providers Catalog
 */

export interface CloudProviderConfig {
  id: string;
  name: string;
  badge: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  docUrl: string;
  keyPrefix: string;
}

export const CLOUD_PROVIDERS: Record<string, CloudProviderConfig> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    badge: "Cloud",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.0-flash-thinking-exp", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash", "gemini-1.5-pro"],
    docUrl: "https://aistudio.google.com/app/apikey",
    keyPrefix: "AIza",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    badge: "Cloud",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-7-sonnet",
    models: ["claude-3-7-sonnet", "claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-haiku-20240307"],
    docUrl: "https://console.anthropic.com/settings/keys",
    keyPrefix: "sk-ant",
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    badge: "Cloud",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini", "gpt-4.5-preview"],
    docUrl: "https://platform.openai.com/api-keys",
    keyPrefix: "sk-",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    badge: "Cloud",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    docUrl: "https://platform.deepseek.com/api_keys",
    keyPrefix: "sk-",
  },
  qwen: {
    id: "qwen",
    name: "Qwen (DashScope)",
    badge: "Cloud",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-max",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
    docUrl: "https://dashscope.console.aliyun.com/apiKey",
    keyPrefix: "sk-",
  },
  kimi: {
    id: "kimi",
    name: "Moonshot Kimi",
    badge: "Cloud",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k"],
    docUrl: "https://platform.moonshot.cn/console/api-keys",
    keyPrefix: "sk-",
  },
  groq: {
    id: "groq",
    name: "Groq (Ultra-Fast Whisper & LLMs)",
    badge: "Cloud",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b", "qwen-2.5-coder-32b", "llama-3.1-8b-instant", "whisper-large-v3-turbo"],
    docUrl: "https://console.groq.com/keys",
    keyPrefix: "gsk_",
  },
  custom: {
    id: "custom",
    name: "Custom (OpenAI-Compatible / Proxy / Ollama)",
    badge: "Custom",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gemini-2.0-flash", "deepseek-chat", "deepseek-reasoner"],
    docUrl: "",
    keyPrefix: "",
  },
};
