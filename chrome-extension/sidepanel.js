/**
 * Mintu Living Companion — Chrome Extension Side Panel Logic
 * Fully clean, emoji-free professional UI
 */

// Default configuration
const DEFAULT_CONFIG = {
  provider: "gemini",
  apiKey: "",
  model: "gemini-2.5-flash",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
};

const PROVIDER_PRESETS = {
  gemini: {
    model: "gemini-2.5-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  openai: {
    model: "gpt-4o",
    baseUrl: "https://api.openai.com/v1",
  },
  deepseek: {
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
  },
  custom: {
    model: "llama3",
    baseUrl: "http://localhost:11434/v1",
  },
};

// State
let conversationHistory = [];
let isGenerating = false;
let abortController = null;

// DOM Elements
const messagesContainer = document.getElementById("messages-container");
const userInput = document.getElementById("user-input");
const btnSend = document.getElementById("btn-send");
const petAvatar = document.getElementById("header-pet");
const petStatusText = document.getElementById("pet-status-text");
const btnToggleFloat = document.getElementById("btn-toggle-float");
const btnOpenSettings = document.getElementById("btn-open-settings");
const btnCloseSettings = document.getElementById("btn-close-settings");
const settingsPanel = document.getElementById("settings-panel");
const btnSaveSettings = document.getElementById("btn-save-settings");

const settingProvider = document.getElementById("setting-provider");
const settingApiKey = document.getElementById("setting-api-key");
const settingModel = document.getElementById("setting-model");
const settingBaseUrl = document.getElementById("setting-base-url");

// Chips
const chipSummarize = document.getElementById("chip-summarize");
const chipKeypoints = document.getElementById("chip-keypoints");
const chipTranslate = document.getElementById("chip-translate");
const chipClear = document.getElementById("chip-clear");

// Initialize on Load
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  setupEventListeners();
  setupRuntimeMessageListener();
});

// Load Settings from chrome.storage.local
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["mintu_settings"], (result) => {
      const cfg = Object.assign({}, DEFAULT_CONFIG, result.mintu_settings || {});
      settingProvider.value = cfg.provider || "gemini";
      settingApiKey.value = cfg.apiKey || "";
      settingModel.value = cfg.model || DEFAULT_CONFIG.model;
      settingBaseUrl.value = cfg.baseUrl || DEFAULT_CONFIG.baseUrl;
      resolve(cfg);
    });
  });
}

// Save Settings to chrome.storage.local
async function saveSettings() {
  const cfg = {
    provider: settingProvider.value,
    apiKey: settingApiKey.value.trim(),
    model: settingModel.value.trim() || DEFAULT_CONFIG.model,
    baseUrl: settingBaseUrl.value.trim() || DEFAULT_CONFIG.baseUrl,
  };

  return new Promise((resolve) => {
    chrome.storage.local.set({ mintu_settings: cfg }, () => {
      settingsPanel.classList.remove("active");
      showStatus("Parametrlər yadda saxlanıldı", 2500);
      resolve();
    });
  });
}

function showStatus(text, duration = 3000) {
  const original = "Status: Hazırdır";
  petStatusText.textContent = text;
  if (duration > 0) {
    setTimeout(() => {
      petStatusText.textContent = original;
    }, duration);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Provider selector change
  settingProvider.addEventListener("change", () => {
    const preset = PROVIDER_PRESETS[settingProvider.value];
    if (preset) {
      settingModel.value = preset.model;
      settingBaseUrl.value = preset.baseUrl;
    }
  });

  // Settings modal
  btnOpenSettings.addEventListener("click", () => {
    settingsPanel.classList.add("active");
  });

  btnCloseSettings.addEventListener("click", () => {
    settingsPanel.classList.remove("active");
  });

  btnSaveSettings.addEventListener("click", async () => {
    await saveSettings();
  });

  // Send message
  btnSend.addEventListener("click", handleUserSend);
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUserSend();
    }
  });

  // Interaction without emojis
  petAvatar.addEventListener("click", () => {
    petAvatar.style.transform = "scale(1.15)";
    showStatus("Aktiv", 1800);
    setTimeout(() => {
      petAvatar.style.transform = "";
    }, 200);
  });

  // Quick Action Chips
  chipSummarize.addEventListener("click", () => {
    handlePageAction("summarize");
  });

  chipKeypoints.addEventListener("click", () => {
    handlePageAction("keypoints");
  });

  chipTranslate.addEventListener("click", () => {
    handlePageAction("translate");
  });

  chipClear.addEventListener("click", () => {
    conversationHistory = [];
    messagesContainer.innerHTML = `
      <div class="message-row assistant">
        <div class="message-sender-tag">Mintu</div>
        <div class="bubble">
          Söhbət təmizləndi. Mintu hazırdır. Sualınızı daxil edə bilərsiniz.
        </div>
      </div>
    `;
    showStatus("Söhbət təmizləndi", 1500);
  });

  // Toggle Float Companion in Active Tab
  btnToggleFloat.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "toggle-mintu-float" }, (res) => {
          if (chrome.runtime.lastError) {
            appendMessage("assistant", "Bu səhifədə köməkçi açıla bilmədi (brauzerin daxili səhifələrində icazə verilmir). Adi veb saytda yoxlayın.");
          } else {
            showStatus("Köməkçi dəyişdirildi", 2000);
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  });
}

// Runtime messages from background context menu or content script
function setupRuntimeMessageListener() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "mintu:context-action") {
      if (msg.action === "explain" && msg.text) {
        handleDirectPrompt(`Aşağıdakı mətni izah et və mahiyyətini aydın şəkildə bildir:\n\n"${msg.text}"`);
      } else if (msg.action === "summarize-page") {
        handlePageAction("summarize");
      }
    }
  });
}

// Extract content from current active tab
async function getActivePageDetails() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return null;

    if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("chrome-extension://"))) {
      return { title: tab.title || "Browser System Tab", url: tab.url, text: "", selection: "" };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = window.getSelection() ? window.getSelection().toString().trim() : "";
        const bodyClone = document.body.cloneNode(true);
        const scripts = bodyClone.querySelectorAll("script, style, noscript, nav, footer, svg");
        scripts.forEach((el) => el.remove());
        const cleanedText = bodyClone.innerText.replace(/\s+/g, " ").trim();
        return {
          title: document.title,
          url: window.location.href,
          selection: sel,
          text: cleanedText.slice(0, 14000),
        };
      },
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
  } catch (err) {
    console.warn("[Mintu] Failed to extract page details:", err);
  }
  return null;
}

// Handle chip actions
async function handlePageAction(actionType) {
  showStatus("Səhifə oxunur...", 0);
  const page = await getActivePageDetails();

  if (!page || (!page.text && !page.selection)) {
    showStatus("Status: Hazırdır");
    appendMessage("assistant", "Bu səhifənin mətnini oxumaq mümkün olmadı. Adi veb səhifəsində yoxlayın və ya mətni birbaşa bura kopyalayın.");
    return;
  }

  let prompt = "";
  if (actionType === "summarize") {
    prompt = `Aşağıdakı veb səhifəni xülasələndir ("${page.title}"):\n\nURL: ${page.url}\n\nMəzmun:\n${page.text}\n\nZəhmət olmasa əsas məzmunu aydın və səliqəli bəndlərlə xülasə et. Cavabda emoji istifadə etmə.`;
  } else if (actionType === "keypoints") {
    prompt = `"${page.title}" səhifəsindən ən vacib 5 əsas fikri çıxar:\n\nMəzmun:\n${page.text}\n\nCavabda emoji istifadə etmə.`;
  } else if (actionType === "translate") {
    const textToTranslate = page.selection || page.text.slice(0, 3000);
    if (!page.selection) {
      prompt = `Aşağıdakı səhifə məzmununu Azərbaycan dilinə dəqiq və axıcı şəkildə tərcümə et (emoji istifadə etmə):\n\n${textToTranslate}`;
    } else {
      prompt = `Aşağıdakı seçilmiş mətni Azərbaycan dilinə tərcümə et (emoji istifadə etmə):\n\n"${page.selection}"`;
    }
  }

  handleDirectPrompt(prompt);
}

// User input send handler
async function handleUserSend() {
  const text = userInput.value.trim();
  if (!text || isGenerating) return;

  userInput.value = "";
  await handleDirectPrompt(text);
}

// Process and send prompt to AI
async function handleDirectPrompt(userPrompt) {
  if (isGenerating) return;

  const settings = await loadSettings();

  if (!settings.apiKey && settings.provider !== "custom") {
    appendMessage("user", userPrompt);
    appendMessage(
      "assistant",
      `API Açarı tapılmadı.\n\nMintu-nun cavab verə bilməsi üçün yuxarı sağdakı Parametrlər bölməsindən ${settings.provider.toUpperCase()} API Key daxil edin və yadda saxlayın.`
    );
    settingsPanel.classList.add("active");
    return;
  }

  appendMessage("user", userPrompt);
  conversationHistory.push({ role: "user", content: userPrompt });

  if (conversationHistory.length > 10) {
    conversationHistory = conversationHistory.slice(-10);
  }

  isGenerating = true;
  btnSend.disabled = true;
  showStatus("Düşünür...", 0);

  const responseBubble = appendMessage("assistant", "", true);

  try {
    abortController = new AbortController();
    await streamCompletion(settings, conversationHistory, responseBubble);
  } catch (err) {
    if (err.name === "AbortError") {
      responseBubble.innerHTML += "<br><em>[Cavab dayandırıldı]</em>";
    } else {
      console.error("[Mintu] API error:", err);
      responseBubble.innerHTML = `
        <div style="background:rgba(239, 68, 68, 0.12);border:1px solid rgba(239, 68, 68, 0.35);padding:10px;border-radius:8px;color:#fca5a5;">
          <strong>Xəta baş verdi:</strong><br>
          ${escapeHtml(err.message || String(err))}
        </div>
        <div style="margin-top:8px;font-size:11px;color:#9ca3af;">
          Parametrlər bölməsindən API açarınızın və model adının düzgünlüyünü yoxlayın.
        </div>
      `;
    }
  } finally {
    isGenerating = false;
    btnSend.disabled = false;
    showStatus("Status: Hazırdır");
  }
}

// Universal Streaming Completion without Emojis
async function streamCompletion(settings, messages, targetBubble) {
  const apiKey = (settings.apiKey || "").trim();
  const rawBaseUrl = (settings.baseUrl || "").trim().replace(/\/+$/, "");
  const modelName = (settings.model || "gemini-2.5-flash").trim();

  const isGemini =
    settings.provider === "gemini" ||
    rawBaseUrl.includes("generativelanguage.googleapis.com") ||
    apiKey.startsWith("AIza");

  const isExplicitOpenAi =
    rawBaseUrl.includes("/openai") || rawBaseUrl.endsWith("/chat/completions");

  let endpoint = "";
  const headers = {
    "Content-Type": "application/json",
  };
  let bodyPayload = null;

  // Professional emoji-free system prompt
  const systemPromptText =
    "You are Mintu, an intelligent, professional living companion AI inside Google Chrome. " +
    "You assist the user by answering questions, summarizing webpages, translating text, and coding. " +
    "Do NOT use any emojis in your responses. Keep responses completely emoji-free, well-structured, clear, and professional using markdown. " +
    "If the user writes in Azerbaijani, answer in Azerbaijani without emojis.";

  if (isGemini && !isExplicitOpenAi) {
    const cleanModel = modelName.replace(/^models\//, "");
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${apiKey}`;
    headers["x-goog-api-key"] = apiKey;

    const userContents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    bodyPayload = {
      contents: userContents,
      generationConfig: {
        temperature: 0.7,
      },
      systemInstruction: {
        parts: [{ text: systemPromptText }],
      },
    };
  } else {
    endpoint = rawBaseUrl;
    if (!endpoint.endsWith("/chat/completions")) {
      endpoint = `${endpoint}/chat/completions`;
    }

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      if (apiKey.startsWith("AIza")) {
        headers["x-goog-api-key"] = apiKey;
      }
    }

    bodyPayload = {
      model: modelName,
      messages: [{ role: "system", content: systemPromptText }, ...messages],
      stream: true,
      temperature: 0.7,
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(bodyPayload),
    signal: abortController.signal,
  });

  if (!response.ok) {
    let errBody = "";
    try {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        errBody = json.error?.message || json.message || (Array.isArray(json) && json[0]?.error?.message) || text;
      } catch {
        errBody = text;
      }
    } catch (e) {}

    if (response.status === 403) {
      throw new Error(`HTTP 403 Giriş qadağandır (Forbidden): ${errBody || "API açarının icazələrini və ya ölkə/VPN statusunu yoxlayın."}`);
    } else if (response.status === 404) {
      throw new Error(`HTTP 404 Tapılmadı (Not Found): ${errBody || `"${modelName}" modeli və ya endpoint URL tapılmadı.`}`);
    } else {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${errBody}`);
    }
  }

  showStatus("Yazır...", 0);

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let accumulatedText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":") || trimmed === "data: [DONE]") continue;

      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);

          // 1. OpenAI delta format
          let delta = parsed.choices?.[0]?.delta?.content;

          // 2. Gemini native candidates format
          if (!delta && parsed.candidates?.[0]?.content?.parts) {
            delta = parsed.candidates[0].content.parts.map((p) => p.text || "").join("");
          }

          if (typeof delta === "string" && delta.length > 0) {
            accumulatedText += delta;
            targetBubble.innerHTML = formatMarkdown(accumulatedText);
            scrollToBottom();
          }
        } catch (e) {
          // ignore partial json
        }
      }
    }
  }

  if (accumulatedText) {
    conversationHistory.push({ role: "assistant", content: accumulatedText });
  }
}

// Append message helper without emojis
function appendMessage(role, text, isLive = false) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const senderTag = document.createElement("div");
  senderTag.className = "message-sender-tag";
  senderTag.textContent = role === "assistant" ? "Mintu" : "Sən";
  row.appendChild(senderTag);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (isLive) {
    bubble.innerHTML = '<span class="typing-indicator">Mintu düşünür və yazır...</span>';
  } else {
    bubble.innerHTML = formatMarkdown(text);
  }

  row.appendChild(bubble);
  messagesContainer.appendChild(row);
  scrollToBottom();
  return bubble;
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Safe Markdown Parser
function formatMarkdown(text) {
  if (!text) return "";
  let escaped = escapeHtml(text);

  // Code blocks: ```lang\ncode\n```
  escaped = escaped.replace(/```([\s\S]*?)```/g, (match, p1) => {
    return `<pre><code>${p1}</code></pre>`;
  });

  // Inline code: `code`
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold: **text**
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *text*
  escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Line breaks
  escaped = escaped.replace(/\n/g, "<br>");

  return escaped;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
