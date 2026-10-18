/**
 * Dynamic Island Content Slots
 * Handles:
 * - Collapsed: Peeking sleepy Mintu + glowing green status dot
 * - Idle: Awake Mintu + live clock
 * - Notification: Title, text, optional actions (Image D)
 * - Expanded AI Chat (Image B):
 *   - Onboarding view (hardware inspection, model recommendation, chunked download, progress, pause/resume)
 *   - Chat view (Image B greeting & suggestion chips, message history, streaming markdown, code copy, stop, regenerate)
 *   - Settings view (model switcher, delete model, context length, system prompt, export)
 * - Timer Demo & Music Demo
 */

import { chatManager } from "../ai/ChatManager";
import { modelManager } from "../ai/ModelManager";
import { memoryManager } from "../ai/MemoryManager";
import { moodManager } from "../ai/MoodManager";
import { MarkdownRenderer } from "../ai/MarkdownRenderer";
import { DownloadProgress } from "../ai/types";
import { eventBus } from "../core/EventBus";
import { appBridge } from "../core/AppBridge";
import { activityManager } from "../core/ActivityManager";
import { CONTEXT_TEMPLATES } from "../ai/contextTemplates";
import { toolExecutor } from "../ai/tools/ToolExecutor";
import { cloudProviderManager } from "../ai/adapters/CloudProviderManager";
import { CLOUD_PROVIDERS } from "../ai/cloudCatalog";
import { PendingToolApproval } from "../ai/tools/Tool";
import { NotificationRow } from "../ui/NotificationRow";
import { timerModule } from "../modules/timer/TimerModule";
import { timerEngine } from "../modules/timer/TimerEngine";
import { statusModule } from "../modules/status/StatusModule";
import { moduleRegistry } from "../modules/ModuleRegistry";
import { voiceManager } from "../voice/VoiceManager";
import { xpManager } from "../gamification/XPManager";
import { smartClipboard } from "../clipboard/SmartClipboard";
import { updateChecker } from "../updater/UpdateChecker";

export interface NotificationPayload {
  icon?: string;
  appIcon?: string;
  appName?: string;
  title: string;
  text: string;
  target?: string;
  actions?: Array<{ id: string; label: string; primary?: boolean }>;
}

export class IslandContentRenderer {
  public readonly container: HTMLElement;

  // Slots
  private slotCollapsed!: HTMLElement;
  private slotIdle!: HTMLElement;
  private slotNotification!: HTMLElement;
  private slotExpanded!: HTMLElement;
  private slotTimer!: HTMLElement;
  private slotMusic!: HTMLElement;
  private slotConsent!: HTMLElement;
  private slotContext!: HTMLElement;
  private slotBlocked!: HTMLElement;
  private slotAnswerReady!: HTMLElement;
  private slotReading!: HTMLElement;
  private slotTranslate!: HTMLElement;
  private slotToolApproval!: HTMLElement;
  private slotCloudConsent!: HTMLElement;

  private currentNotification: NotificationPayload | null = null;
  private isTranslatingFlow: boolean = false;
  private currentDetectedLang: string = "English";
  private currentTranslationSourceText: string = "";

  private clockEl!: HTMLElement;
  private clockInterval: number | null = null;
  private waveformAnimId: number | null = null;

  // Attached context chips
  private attachedChipsEl!: HTMLElement;
  private attachedChips: Array<{ id: string; type: "code" | "image"; label: string; data: string; appName?: string }> = [];
  private activeContextData: { text?: string; imgB64?: string; appName?: string } | null = null;
  private isMusicPlaying: boolean = false;
  private currentDownloadingModelId: string = "";

  // Expanded sub-views
  private expandedSubView: "chat" | "onboarding" | "settings" = "chat";
  private chatMessagesEl!: HTMLElement;
  private chatInputEl!: HTMLInputElement;
  private sendBtnEl!: HTMLButtonElement;
  private stopBtnEl!: HTMLButtonElement;
  private chipsRowEl!: HTMLElement;
  private greetingRowEl!: HTMLElement;

  // Milestone 5: Chat drawer, undo, and message editing
  private undoDeleteTimer: number | null = null;
  private pendingDeleteChatId: string | null = null;
  private editingMessageId: string | null = null;
  private currentSlotName: string = "idle";

  // Callback to request island size update
  public onRequestResize?: (width: number, height: number) => void;
  public onRequestCollapse?: () => void;

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "island-content-container";
    this.initSlots();
    this.initModules();
    this.startClock();
    this.initAIIntegration();
  }

  private initModules(): void {
    moduleRegistry.init({
      eventBus,
      activityManager,
      requestExpand: () => {
        this.switchSubView("chat");
        eventBus.emit("island:request-state", "expanded");
      },
      requestCollapse: () => {
        if (this.onRequestCollapse) this.onRequestCollapse();
      },
      isMintuInside: () => !document.body.classList.contains("mintu-outside"),
    });

    moduleRegistry.register(timerModule);
    moduleRegistry.register(statusModule);

    timerEngine.subscribe(() => {
      if (this.currentSlotName === "timer") {
        timerModule.renderCompact(this.slotTimer, {
          mintuInside: !document.body.classList.contains("mintu-outside"),
        });
      }
    });
  }

  private initSlots(): void {
    this.container.innerHTML = `
      <!-- SLOT 1: COLLAPSED -->
      <div class="island-slot slot-collapsed active">
        <div class="slot-left-pet-anchor"></div>
        <div class="collapsed-status-wrap">
          <div class="collapsed-status-dot" id="collapsed-status-dot"></div>
          <div class="collapsed-progress-ring" id="collapsed-progress-ring" style="display: none;">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.18)" stroke-width="2.5" fill="none" />
              <circle id="collapsed-ring-bar" cx="12" cy="12" r="9" stroke="#10B981" stroke-width="2.5" fill="none"
                stroke-dasharray="56.54" stroke-dashoffset="56.54" stroke-linecap="round" transform="rotate(-90 12 12)" />
            </svg>
          </div>
        </div>
      </div>

      <!-- SLOT 2: IDLE -->
      <div class="island-slot slot-idle">
        <div class="slot-left-pet-anchor"></div>
        <div class="idle-clock">10:42</div>
      </div>

      <!-- SLOT 3: NOTIFICATION -->
      <div class="island-slot slot-notification">
        <div class="slot-left-pet-anchor notif-face-anchor"></div>
        <div class="notif-body">
          <div class="notif-header">
            <div class="notif-source-badge">
              <div class="notif-app-icon" id="notif-app-icon"></div>
              <span class="notif-app-label" id="notif-app-name">Notification</span>
            </div>
            <div class="notif-text-col">
              <div class="notif-title">New message</div>
              <div class="notif-subtitle">From: Sarah "Hey there!"</div>
            </div>
            <button class="notif-dismiss-btn" id="notif-dismiss-btn" title="Dismiss">✕</button>
          </div>
          <div class="notif-actions" style="display: none;">
            <button class="notif-btn secondary" data-action="explain">Explain</button>
            <button class="notif-btn primary" data-action="fix">Fix it</button>
          </div>
        </div>
      </div>

      <!-- SLOT 4: EXPANDED (IMAGE B AI CHAT SHELL) -->
      <div class="island-slot slot-expanded">
        <!-- Top bar with Pet anchor and header actions -->
        <div class="expanded-top-bar">
          <div class="slot-left-pet-anchor expanded-pet"></div>
          <div class="expanded-header-info" style="position: relative;">
            <span class="expanded-pet-name">Mintu AI</span>
            <span class="expanded-model-badge" id="mintu-model-tag" role="button" tabindex="0" title="Switch provider / model">Loading...</span>
            <span class="expanded-level-badge" id="mintu-level-badge" title="Focus Level &amp; XP">Lvl 1 · 0 XP</span>
            <div class="model-switcher-popover" id="model-switcher-popover"></div>
          </div>
          <div class="expanded-top-actions">
            <button class="icon-btn" id="btn-new-chat" title="New chat (Ctrl+N)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="icon-btn" id="btn-chat-list-toggle" title="All chats">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            <button class="icon-btn" id="btn-export-chat" title="Export to Markdown">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <button class="icon-btn" id="btn-clear-chat" title="Clear conversation">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <button class="icon-btn" id="btn-settings-toggle" title="Settings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            <button class="icon-btn" id="btn-collapse-island" title="Collapse (Esc)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- MAIN SUB-VIEW 1: CHAT -->
        <div class="expanded-subview subview-chat active">
          <!-- Chat list drawer (Milestone 5 Part 1) -->
          <div class="chat-drawer" id="chat-drawer">
            <div class="chat-drawer-header">
              <span class="chat-drawer-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Conversations
              </span>
              <button class="icon-btn" id="btn-close-chat-drawer" title="Close drawer">✕</button>
            </div>
            <div class="chat-search-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" class="chat-search-input" id="chat-search-input" placeholder="Search chats with FTS5..." />
            </div>
            <div class="chat-items-scroll" id="chat-items-scroll"></div>
          </div>

          <!-- 30-Second Undo Banner -->
          <div class="chat-undo-banner" id="chat-undo-banner" style="display: none;">
            <span id="chat-undo-text">Chat deleted.</span>
            <button class="btn-undo" id="btn-chat-undo">Undo (<span id="chat-undo-sec">30</span>s)</button>
          </div>

          <!-- Smart Clipboard Pill (Milestone 8) -->
          <div class="smart-clipboard-pill" id="smart-clipboard-pill" style="display: none;">
            <div class="smart-clip-content">
              <span class="smart-clip-badge" id="smart-clip-badge">Code</span>
              <span class="smart-clip-text" id="smart-clip-text">Koddakı xətanı yoxla</span>
            </div>
            <button class="smart-clip-action-btn" id="btn-smart-clip-action">Sorğu ver</button>
            <button class="smart-clip-close-btn" id="btn-smart-clip-close">✕</button>
          </div>

          <!-- Update Available Banner (Milestone 8) -->
          <div class="mintu-update-banner" id="mintu-update-banner" style="display: none;">
            <span id="mintu-update-text">Mintu v0.1.3 hazırdır!</span>
            <button class="btn-update-action" id="btn-mintu-update-open">Yenilə</button>
            <button class="btn-update-close" id="btn-mintu-update-close">✕</button>
          </div>

          <!-- Image B Greeting row -->
          <div class="expanded-greeting-row">
            <div class="greeting-heading">How can I<br/>help you?</div>
          </div>

          <!-- Message list container -->
          <div class="chat-messages-scroll-area">
            <div class="chat-messages-container"></div>
          </div>

          <!-- Image B Suggestion chips row -->
          <div class="expanded-chips-row">
            <button class="chip-btn" data-chip="Check Tasks">Check Tasks</button>
            <button class="chip-btn" data-chip="Ask AI">Ask AI</button>
            <button class="chip-btn" data-chip="Explain code">Explain code</button>
            <button class="chip-btn" data-chip="Tell a joke">Tell a joke</button>
          </div>

          <!-- Input row (Image E 3) -->
          <div class="expanded-input-row">
            <div class="chat-attached-chips" id="chat-attached-chips"></div>
            <div class="chat-input-pill">
              <input type="text" placeholder="Type a message or speak..." class="chat-text-input" />
              <button class="chat-mic-btn" id="chat-mic-btn" title="Voice Input / Click or hold to talk">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
              </button>
              <button class="chat-stop-btn" style="display: none;" title="Stop generation">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2.5"></rect>
                </svg>
              </button>
              <button class="chat-send-btn" title="Send message (Enter)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- MAIN SUB-VIEW 2: ONBOARDING (IMAGE H) -->
        <div class="expanded-subview subview-onboarding">
          <!-- CARD 1: HARDWARE CHECK -->
          <div class="onboarding-card onboarding-card-check" id="onboarding-card-check">
            <div class="onboard-top-header">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <div class="onboard-title">Hardware check</div>
                <div style="display: flex; gap: 6px;">
                  <button class="btn-text" id="btn-close-onboard" style="padding: 2px 8px; font-size: 11px;">← Chat</button>
                  <button class="btn-text" id="btn-collapse-onboard" title="Collapse Island (Esc)" style="padding: 2px 8px; font-size: 11px;">✕ Close</button>
                </div>
              </div>
              <div class="onboard-subtitle" id="hw-telemetry-text">Your PC: 16 GB RAM, 8 cores</div>
              <!-- Storage Drive Selector (Milestone 6) -->
              <div class="onboard-storage-box" id="onboard-storage-box" style="margin-top: 8px; padding: 6px 10px; background: rgba(0, 0, 0, 0.4); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-weight: 500; color: #9CA3AF;">Download Drive & Folder:</span>
                  <span id="onboard-storage-free-badge" style="color: #34D399; font-weight: 600;">-- GB free</span>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <input type="text" class="chat-text-input" id="onboard-storage-path-input" style="flex: 1; height: 26px; font-size: 11px; padding: 2px 8px;" readonly />
                  <button class="btn-small-action" id="btn-onboard-browse-storage" style="padding: 2px 10px; height: 26px; font-size: 11px; white-space: nowrap;">Browse...</button>
                </div>
                <div id="onboard-quick-drives" style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;"></div>
              </div>
            </div>

            <div class="onboard-glass-card">
              <div class="onboard-card-tag" id="onboard-rec-badge">Recommended: Medium model 2.0 GB</div>
              <div class="onboard-illustration-row">
                <div class="onboard-mintu-magnifying">
                  <svg viewBox="0 0 80 80" width="56" height="56">
                    <ellipse cx="36" cy="48" rx="22" ry="20" fill="#A8E8D5" stroke="#2D5A4C" stroke-width="2.5" />
                    <path d="M22 32 C18 18, 26 14, 30 26" fill="#A8E8D5" stroke="#2D5A4C" stroke-width="2.5" stroke-linejoin="round" />
                    <path d="M42 28 C46 14, 54 18, 48 32" fill="#A8E8D5" stroke="#2D5A4C" stroke-width="2.5" stroke-linejoin="round" />
                    <ellipse cx="28" cy="44" rx="2.5" ry="3.5" fill="#2D5A4C" />
                    <ellipse cx="44" cy="44" rx="2.5" ry="3.5" fill="#2D5A4C" />
                    <circle cx="29" cy="43" r="1" fill="#FFFFFF" />
                    <circle cx="45" cy="43" r="1" fill="#FFFFFF" />
                    <path d="M33 49 Q36 52 39 49" fill="none" stroke="#2D5A4C" stroke-width="2" stroke-linecap="round" />
                    <circle cx="56" cy="40" r="13" fill="rgba(168, 232, 213, 0.25)" stroke="#60A5FA" stroke-width="3" />
                    <line x1="65" y1="49" x2="75" y2="59" stroke="#60A5FA" stroke-width="4" stroke-linecap="round" />
                    <line x1="65" y1="49" x2="75" y2="59" stroke="#1E3A8A" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </div>
                <div class="onboard-model-info">
                  <div class="onboard-model-name" id="onboard-rec-name">Qwen 2.5 1.5B Instruct</div>
                  <div class="onboard-model-desc" id="onboard-rec-desc">Balanced everyday companion. Fast and private on your machine.</div>
                </div>
              </div>

              <div class="onboard-picker-section" id="onboard-picker-section" style="display: none;">
                <label class="input-label">Select Model:</label>
                <select class="mintu-select" id="onboard-model-select"></select>
                <div class="model-meta-note" id="onboard-model-meta"></div>
              </div>

              <div class="onboard-actions-row">
                <button class="btn-primary-mint" id="btn-start-download">Download & Start</button>
                <button class="btn-outline-choice" id="btn-choose-another">Choose another</button>
              </div>
            </div>

            <div class="onboard-skip-row">
              <button class="btn-text" id="btn-skip-onboard">Continue with Mintu Smart AI (Instant)</button>
            </div>
          </div>

          <!-- CARD 2: DOWNLOADING (IMAGE H) -->
          <div class="onboarding-card onboarding-card-downloading" id="onboarding-card-downloading" style="display: none;">
            <div class="onboard-top-header">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <div class="onboard-title">Downloading</div>
                <button class="btn-text" id="btn-collapse-dl" title="Collapse Island">✕ Close</button>
              </div>
            </div>

            <div class="onboard-glass-card onboard-downloading-glass">
              <div class="onboard-dl-avatar">
                <svg viewBox="0 0 80 80" width="70" height="70">
                  <ellipse cx="40" cy="46" rx="24" ry="22" fill="#A8E8D5" stroke="#2D5A4C" stroke-width="2.5" />
                  <path d="M24 28 C20 14, 28 10, 32 22" fill="#A8E8D5" stroke="#2D5A4C" stroke-width="2.5" stroke-linejoin="round" />
                  <path d="M48 24 C52 10, 60 14, 54 28" fill="#A8E8D5" stroke="#2D5A4C" stroke-width="2.5" stroke-linejoin="round" />
                  <path d="M26 42 Q30 38 34 42" fill="none" stroke="#2D5A4C" stroke-width="2.5" stroke-linecap="round" />
                  <path d="M46 42 Q50 38 54 42" fill="none" stroke="#2D5A4C" stroke-width="2.5" stroke-linecap="round" />
                  <ellipse cx="40" cy="48" rx="3" ry="4" fill="#F87171" />
                  <ellipse cx="23" cy="46" rx="3" ry="2" fill="#FCA5A5" opacity="0.6" />
                  <ellipse cx="57" cy="46" rx="3" ry="2" fill="#FCA5A5" opacity="0.6" />
                </svg>
              </div>

              <div class="onboard-dl-name" id="onboard-dl-title">Qwen 2.5 1.5B Instruct</div>

              <!-- Large progress bar with percentage inside filled part (Image H) -->
              <div class="onboard-large-progress-track">
                <div class="onboard-large-progress-fill" id="onboard-large-progress-fill" style="width: 0%;">
                  <span class="onboard-progress-pct-inside" id="onboard-progress-pct-inside">0%</span>
                </div>
              </div>

              <!-- Real-time line: "2.9 GB of 4.7 GB · 18 MB/s · 1 min left" -->
              <div class="onboard-dl-telemetry" id="onboard-dl-telemetry">
                0 MB of 0 MB · 0 MB/s · -- left
              </div>

              <!-- Two small dark buttons: Pause and Cancel (Image H) -->
              <div class="onboard-dl-actions" id="onboard-dl-buttons">
                <button class="btn-dark-small" id="btn-pause-download">Pause</button>
                <button class="btn-dark-small" id="btn-cancel-download">Cancel</button>
              </div>

              <!-- In-card Verification Error state (replaces alert) -->
              <div class="onboard-dl-error-container" id="onboard-dl-error-box" style="display: none;">
                <div class="onboard-error-title">Verification failed</div>
                <div class="onboard-error-text" id="onboard-error-msg">The file did not pass verification. It was removed. Retry?</div>
                <div class="onboard-error-actions">
                  <button class="btn-primary-mint" id="btn-retry-download">Retry</button>
                  <button class="btn-dark-small" id="btn-choose-another-model">Choose another</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- MAIN SUB-VIEW 3: SETTINGS -->
        <div class="expanded-subview subview-settings">
          <div class="settings-card">
            <div class="settings-header-row">
              <span class="settings-title">Settings</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button class="btn-primary-mint" id="btn-save-settings-top" style="padding: 4px 12px; font-size: 11px;">Save</button>
                <button class="btn-text" id="btn-close-settings" style="padding: 4px 8px; font-size: 11px;">← Chat</button>
                <button class="btn-text" id="btn-collapse-settings" title="Collapse Island" style="padding: 4px 8px; font-size: 11px;">✕ Close</button>
              </div>
            </div>

            <div class="settings-scroll-area">
              <div class="setting-item">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <label class="input-label">Active Model</label>
                  <button class="btn-text" id="btn-open-model-download" style="padding: 2px 6px; font-size: 10.5px; color: #10b981;">+ Download Models</button>
                </div>
                <select class="mintu-select" id="settings-active-model"></select>
                <div class="setting-hint">Choose which local model powers Mintu.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">System Persona Prompt</label>
                <textarea class="mintu-textarea" id="settings-system-prompt" rows="3"></textarea>
                <div class="setting-hint">Defines Mintu's personality and instructions.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Inference Options</label>
                <div class="settings-row-chips">
                  <span class="info-pill">Context: 2048 tokens</span>
                  <span class="info-pill">Idle Unload: 10 mins</span>
                  <span class="info-pill">Hardware: CPU Auto</span>
                </div>
              </div>

              <div class="setting-item">
                <label class="input-label">When Mintu is Outside (Free Mode)</label>
                <select class="mintu-select" id="settings-outside-behavior">
                  <option value="empty-pill">Show empty pill</option>
                  <option value="hide">Hide the island</option>
                </select>
                <div class="setting-hint">Island appearance while Mintu roams the desktop.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Mintu Walks on Windows (Free Mode)</label>
                <select class="mintu-select" id="settings-walk-windows">
                  <option value="on">Enabled</option>
                  <option value="off">Disabled</option>
                </select>
                <div class="setting-hint">Allows Mintu to walk on top of active application windows.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Window Walking Ignored Apps</label>
                <textarea class="mintu-textarea" id="settings-window-ignore-list" rows="2" placeholder="game.exe, player.exe"></textarea>
                <div class="setting-hint">Comma-separated list of process names Mintu should not walk on.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Privacy App Blocklist</label>
                <textarea class="mintu-textarea" id="settings-privacy-blocklist" rows="2" placeholder="1password.exe, bitwarden.exe, keepass.exe"></textarea>
                <div class="setting-hint">Mintu will never read or capture text/screen from these apps.</div>
              </div>

              <!-- SYSTEM & STARTUP CONVENIENCE (MILESTONE 7) -->
              <div class="settings-section-divider">System &amp; Startup Convenience</div>
              <div class="setting-item">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <label class="input-label" style="margin-bottom: 0;">Auto-start with Windows</label>
                  <input type="checkbox" id="settings-autostart-toggle" style="accent-color: #34D399; width: 16px; height: 16px; cursor: pointer;" />
                </div>
                <div class="setting-hint">Launch Mintu automatically in background when your PC boots.</div>
              </div>

              <!-- VOICE & SPEECH ENGINE (MILESTONE 7) -->
              <div class="settings-section-divider">Voice &amp; Speech (Milestone 7)</div>
              <div class="setting-item">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <label class="input-label" style="margin-bottom: 0;">Mintu Voice (Text-to-Speech)</label>
                  <input type="checkbox" id="settings-tts-toggle" style="accent-color: #34D399; width: 16px; height: 16px; cursor: pointer;" />
                </div>
                <div class="setting-hint">Speaks answers aloud with synchronized pet mouth animations.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Voice Recognition Language (STT)</label>
                <select class="mintu-select" id="settings-stt-language">
                  <option value="az-AZ">Azərbaycan (az-AZ)</option>
                  <option value="en-US">English (en-US)</option>
                  <option value="tr-TR">Türkçe (tr-TR)</option>
                  <option value="ru-RU">Русский (ru-RU)</option>
                  <option value="de-DE">Deutsch (de-DE)</option>
                </select>
                <div class="setting-hint">Target language for microphone speech input.</div>
              </div>

              <!-- GAMIFICATION & WARDROBE (MILESTONE 8) -->
              <div class="settings-section-divider">Gamification &amp; Wardrobe (Milestone 8)</div>
              <div class="setting-item">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 12px; font-weight: 600; color: #E5E7EB;" id="settings-xp-level-title">Level 1 Mintu</span>
                  <span style="font-size: 11px; color: #34D399; font-weight: 600;" id="settings-xp-points-badge">0 XP</span>
                </div>
                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; margin-bottom: 6px;">
                  <div id="settings-xp-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10B981, #34D399); transition: width 0.3s ease;"></div>
                </div>
                <div class="setting-hint" id="settings-xp-hint">Earn 10 XP for each minute of Pomodoro focus. Complete pomodoros to level up and unlock exclusive pet accessories!</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Mintu's Wardrobe Accessories</label>
                <div class="wardrobe-grid" id="wardrobe-items-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 6px;">
                  <!-- Accessories injected dynamically by XPManager -->
                </div>
                <div class="setting-hint">Select any unlocked accessory to dress Mintu on your desktop and island.</div>
              </div>

              <!-- SMART CLIPBOARD & AUTO-UPDATER (MILESTONE 8) -->
              <div class="settings-section-divider">Smart Productivity &amp; Updates (Milestone 8)</div>
              <div class="setting-item">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <label class="input-label" style="margin-bottom: 0;">Smart Clipboard Assistant</label>
                  <input type="checkbox" id="settings-smart-clipboard-toggle" checked style="accent-color: #34D399; width: 16px; height: 16px; cursor: pointer;" />
                </div>
                <div class="setting-hint">Shows quick action pill on Ctrl+C (code check, JSON formatting, or Azerbaijani translation).</div>
              </div>

              <div class="setting-item">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <div style="font-size: 12px; font-weight: 500; color: #E5E7EB;">Mintu Version v0.1.2</div>
                    <div class="setting-hint" id="settings-updater-status">Up to date with GitHub Releases.</div>
                  </div>
                  <button class="btn-small-action" id="btn-check-updates-now" style="font-size: 11px; height: 28px;">Check Updates</button>
                </div>
              </div>

              <div class="setting-item">
                <label class="input-label">Developer Panel (Ctrl+Shift+D)</label>
                <select class="mintu-select" id="settings-dev-panel">
                  <option value="off">Disabled</option>
                  <option value="on">Enabled</option>
                </select>
                <div class="setting-hint">Enables Ctrl+Shift+D debug overlay and hit-test visualizer.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Local Model Storage & Disk Drive</label>
                <div style="display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; background: rgba(0, 0, 0, 0.35); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #9CA3AF;">Active Storage:</span>
                    <span id="settings-storage-free-badge" style="color: #34D399; font-weight: 600;">-- GB free</span>
                  </div>
                  <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="text" class="chat-text-input" id="settings-storage-path-input" style="flex: 1; height: 28px; font-size: 11px; padding: 2px 8px;" />
                    <button class="btn-small-action" id="btn-settings-browse-storage" style="height: 28px; font-size: 11px; white-space: nowrap;">Browse...</button>
                    <button class="btn-small-action" id="btn-settings-save-storage" style="height: 28px; font-size: 11px; white-space: nowrap;">Apply</button>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                    <label style="display: flex; align-items: center; gap: 5px; color: #9CA3AF; font-size: 10.5px; cursor: pointer;">
                      <input type="checkbox" id="settings-storage-move-existing" style="accent-color: #34D399;" />
                      Move existing models to new folder to free up space
                    </label>
                  </div>
                  <div id="settings-quick-drives" style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;"></div>
                  <div class="setting-hint" id="settings-storage-hint">Choose any drive (e.g. D:\Mintu-Models) to save models offline without filling C: disk.</div>
                </div>
              </div>

              <div class="setting-item">
                <label class="input-label">Installed Models</label>
                <div class="installed-models-list" id="settings-models-list"></div>
              </div>

              <!-- CLOUD AI PROVIDERS (OPTIONAL) -->
              <div class="settings-section-divider">Cloud AI Providers (Optional)</div>
              <div class="setting-item">
                <label class="input-label">AI Engine Provider</label>
                <select class="mintu-select" id="settings-cloud-provider">
                  <option value="local">Local llama.cpp (Bundled &amp; Offline)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="openai">OpenAI</option>
                  <option value="groq">Groq (Ultra-Fast Whisper &amp; LLMs)</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">Qwen (DashScope)</option>
                  <option value="kimi">Moonshot Kimi</option>
                  <option value="custom">Custom (OpenAI-Compatible / Ollama / Groq / OpenRouter)</option>
                </select>
                <div class="setting-hint">Choose between local offline model or cloud API.</div>
              </div>

              <div class="setting-item" id="settings-cloud-key-section" style="display: none;">
                <label class="input-label">Provider API Key</label>
                <div class="settings-input-row">
                  <input type="password" class="chat-text-input" id="settings-cloud-key-input" placeholder="Enter API key..." style="font-size: 11.5px; height: 32px;" />
                  <button class="btn-small-action" id="btn-save-cloud-key">Save Key</button>
                  <button class="btn-small-action danger" id="btn-delete-cloud-key">Delete</button>
                </div>
                <div class="setting-hint" id="settings-key-status-hint">Stored securely in Windows Credential Manager.</div>
              </div>

              <div class="setting-item" id="settings-cloud-model-section" style="display: none;">
                <label class="input-label">Model Name / ID</label>
                <div class="settings-input-row">
                  <input type="text" class="chat-text-input" id="settings-cloud-model-input" placeholder="e.g. gemini-2.5-flash or gpt-4o" style="font-size: 11.5px; height: 32px;" />
                  <button class="btn-small-action" id="btn-reset-cloud-model" title="Reset to default model">Reset</button>
                </div>
                <div class="setting-hint" id="settings-model-hint">Specify exact model ID. You can enter any custom model name.</div>
              </div>

              <div class="setting-item" id="settings-cloud-url-section" style="display: none;">
                <label class="input-label">API Base URL / Endpoint Link</label>
                <div class="settings-input-row">
                  <input type="text" class="chat-text-input" id="settings-cloud-url-input" placeholder="e.g. https://generativelanguage.googleapis.com/v1beta/openai" style="font-size: 11.5px; height: 32px;" />
                  <button class="btn-small-action" id="btn-reset-cloud-url" title="Reset to default URL">Reset</button>
                </div>
                <div class="setting-hint" id="settings-url-hint">Endpoint for completions. Enter proxy, OpenRouter, or custom link.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Privacy Safeguard</label>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #e5e7eb; cursor: pointer; margin-top: 4px;">
                  <input type="checkbox" id="settings-never-cloud-context" checked />
                  <span>Never send screen captures or window context to cloud</span>
                </label>
                <div class="setting-hint">Automatically routes messages with screen context to local model.</div>
              </div>

              <!-- DESKTOP TOOLS & PERMISSIONS -->
              <div class="settings-section-divider">Desktop Tools &amp; Permissions</div>
              <div class="setting-item">
                <label class="input-label">Always-Allowed Tools</label>
                <div class="settings-table-card" id="settings-allowed-tools-list">
                  <em>No tools always allowed. Mintu will ask each time.</em>
                </div>
              </div>

              <div class="setting-item">
                <label class="input-label">Allowed Folders for File Search &amp; Recycle</label>
                <div class="settings-table-card" id="settings-allowed-folders-list">
                  <div>Downloads (Userprofile\\Downloads)</div>
                  <div>Desktop (Userprofile\\Desktop)</div>
                </div>
                <div class="setting-hint">Mintu is restricted to these directories for search and recycle.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Scheduled Reminders</label>
                <div class="settings-table-card" id="settings-reminders-list">
                  <em>No active reminders.</em>
                </div>
              </div>

              <div class="setting-item">
                <label class="input-label">Tool Audit Log</label>
                <div class="settings-input-row">
                  <button class="btn-small-action" id="btn-refresh-audit-logs">View Logs</button>
                  <button class="btn-small-action danger" id="btn-clear-audit-logs">Clear Logs</button>
                </div>
                <div class="settings-table-card" id="settings-audit-logs-card" style="margin-top: 6px; display: none;"></div>
              </div>

              <!-- MILESTONE 5: MEMORY (LOCAL ONLY) -->
              <div class="settings-section-divider">Memory (Local Only &amp; User Controlled)</div>
              <div class="setting-item">
                <label class="input-label">Memory System</label>
                <select class="mintu-select" id="settings-memory-enabled">
                  <option value="on">Enabled</option>
                  <option value="off">Disabled (Paused)</option>
                </select>
                <div class="setting-hint">When disabled, no memories are read or written. Search uses local FTS5 keyword indexing.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Saved Memories</label>
                <div class="settings-input-row" style="margin-bottom: 6px;">
                  <button class="btn-small-action" id="btn-export-memories">Export Markdown</button>
                  <button class="btn-small-action danger" id="btn-forget-all-memories">Forget Everything</button>
                </div>
                <div class="settings-table-card" id="settings-memories-list" style="max-height: 140px;">
                  <em>No memories saved yet.</em>
                </div>
              </div>

              <!-- MILESTONE 5: PET MOOD -->
              <div class="settings-section-divider">Pet Mood (App Events Only)</div>
              <div class="setting-item">
                <label class="input-label">Mood System</label>
                <select class="mintu-select" id="settings-mood-enabled">
                  <option value="on">Enabled</option>
                  <option value="off">Disabled</option>
                </select>
                <div class="setting-hint">Mintu's mood reflects app events (music, tasks, idle sleep). Never changes AI answers.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Quiet Mode</label>
                <select class="mintu-select" id="settings-quiet-mode">
                  <option value="off">Disabled (Animations &amp; Speech)</option>
                  <option value="on">Enabled (Animations only, no speech bubbles)</option>
                </select>
                <div class="setting-hint">Keep Mintu completely silent during work sessions.</div>
              </div>

              <!-- MILESTONE 6: MODULES & FOCUS -->
              <div class="settings-section-divider">Island Modules &amp; Focus</div>
              <div class="setting-item">
                <label class="input-label">Timer &amp; Focus Module</label>
                <select class="mintu-select" id="settings-module-timer">
                  <option value="on">Enabled</option>
                  <option value="off">Disabled</option>
                </select>
                <div class="setting-hint">Shows headphones pet, countdown / Pomodoro progress ring, and focus mode notification silencing.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Status Widgets Module</label>
                <select class="mintu-select" id="settings-module-status">
                  <option value="on">Enabled</option>
                  <option value="off">Disabled</option>
                </select>
                <div class="setting-hint">Local Win32 hardware inspection (Battery, CPU, RAM, Disk, Net, AI). Click or scroll idle island to cycle.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Reduce Motion (Accessibility)</label>
                <select class="mintu-select" id="settings-reduce-motion">
                  <option value="system">Follow Windows System Setting</option>
                  <option value="on">Always Reduced Motion</option>
                  <option value="off">Full Motion</option>
                </select>
                <div class="setting-hint">Replaces fluid liquid springs and bouncy transitions with gentle fade and instant updates.</div>
              </div>

              <div class="setting-item">
                <label class="input-label">Focus Sessions History (Local SQLite Only)</label>
                <div class="settings-input-row" style="margin-bottom: 6px;">
                  <button class="btn-small-action" id="btn-export-focus-history">Export History</button>
                  <button class="btn-small-action danger" id="btn-clear-focus-history">Clear History</button>
                </div>
                <div class="settings-table-card" id="settings-focus-history-list" style="max-height: 120px;">
                  <em>No completed focus sessions yet.</em>
                </div>
              </div>

              <div class="setting-item">
                <button class="btn-primary-mint" id="btn-save-settings">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SLOT 5: TIMER (STATIC DEMO) -->
      <div class="island-slot slot-timer">
        <div class="slot-left-pet-anchor"></div>
        <div class="timer-center">
          <div class="circular-progress">
            <svg viewBox="0 0 36 36" class="circular-chart">
              <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="circle" stroke-dasharray="75, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
          </div>
          <div class="timer-digits">24:30</div>
        </div>
      </div>

      <!-- SLOT 6: MUSIC (REAL SMTC) -->
      <div class="island-slot slot-music">
        <div class="slot-left-pet-anchor"></div>
        <div class="music-art-thumb">
          <img class="music-art-img" id="music-art-image" style="display: none;" />
          <div class="music-art-gradient" id="music-art-fallback"></div>
        </div>
        <div class="music-info-col">
          <div class="music-track-title-marquee" id="music-track-title">Not Playing</div>
          <div class="music-artist-subtitle" id="music-artist-subtitle">--</div>
          <div class="music-waveform" id="music-waveform-bars">
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
          </div>
        </div>
        <div class="music-controls">
          <button class="music-btn" id="music-btn-prev" title="Previous"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
          <button class="music-btn play-pause is-paused" id="music-btn-play-pause" title="Play"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
          <button class="music-btn" id="music-btn-next" title="Next"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
        </div>
      </div>

      <!-- SLOT 7: CONSENT (IMAGE G) -->
      <div class="island-slot slot-consent">
        <div class="consent-header-row">
          <div class="slot-left-pet-anchor"></div>
          <div class="consent-title">Can I look at what you select?</div>
        </div>
        <div class="consent-rows-container">
          <div class="consent-row">
            <div class="consent-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12"></path>
              </svg>
            </div>
            <span>Only when you press the hotkey</span>
          </div>
          <div class="consent-row">
            <div class="consent-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                <line x1="6" y1="16" x2="6.01" y2="16"></line>
                <line x1="10" y1="16" x2="10.01" y2="16"></line>
              </svg>
            </div>
            <span>Everything stays on your computer</span>
          </div>
          <div class="consent-row">
            <div class="consent-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </div>
            <span>You can block any app in settings</span>
          </div>
        </div>
        <div class="consent-actions-row">
          <button class="btn-consent-deny" id="btn-consent-deny">Not now</button>
          <button class="btn-consent-allow" id="btn-consent-allow">Allow</button>
        </div>
        <div class="consent-link-row">
          <a class="consent-settings-link" id="link-consent-blocklist">Choose apps I should never look at</a>
        </div>
      </div>

      <!-- SLOT 8: CONTEXT CAPTURED (IMAGE E 1-2) -->
      <div class="island-slot slot-context">
        <div class="context-card-top">
          <div class="slot-left-pet-anchor"></div>
          <div class="context-header-text" id="context-summary-text">Got 3 lines from active app</div>
        </div>
        <div class="context-card-actions" id="context-actions-row">
          <button class="context-action-btn secondary" data-action="explain">Explain</button>
          <button class="context-action-btn primary" data-action="fix">Fix it</button>
        </div>
      </div>

      <!-- SLOT 9: BLOCKED APP (IMAGE E 4) -->
      <div class="island-slot slot-blocked">
        <div class="slot-left-pet-anchor"></div>
        <div class="blocked-text-col">
          <div class="blocked-title">I can't look at this one</div>
          <div class="blocked-desc" id="blocked-app-desc">This app is on your privacy blocklist</div>
        </div>
      </div>

      <!-- SLOT 10: ANSWER READY (IMAGE E 5) -->
      <div class="island-slot slot-answer-ready">
        <div class="slot-left-pet-anchor"></div>
        <div class="answer-ready-text">Answer ready</div>
        <div class="answer-ready-badge"></div>
      </div>

      <!-- SLOT 11: READING -->
      <div class="island-slot slot-reading">
        <div class="slot-left-pet-anchor"></div>
        <div class="reading-body">
          <div class="reading-spinner"></div>
          <div class="reading-text">Reading the text...</div>
        </div>
      </div>

      <!-- SLOT 12: TRANSLATE -->
      <div class="island-slot slot-translate">
        <div class="translate-container">
          <div class="translate-header">
            <div class="slot-left-pet-anchor"></div>
            <div class="translate-header-text">
              <div class="translate-detected" id="translate-detected-label">Detected: German</div>
              <div class="translate-prompt">Which language should I translate to?</div>
            </div>
            <button class="icon-btn-close" id="btn-close-translate" title="Close (Esc)">✕</button>
          </div>

          <!-- Collapsible original text chip -->
          <div class="translate-orig-chip" id="translate-orig-chip" title="Click to expand/collapse">
            <span class="orig-tag">Original</span>
            <span class="orig-preview" id="translate-orig-text">...</span>
          </div>

          <!-- Staggered spring language chips -->
          <div class="translate-chips-row" id="translate-chips-row">
            <button class="translate-chip stagger-1" data-lang="Azərbaycan">Azərbaycan</button>
            <button class="translate-chip stagger-2" data-lang="English">English</button>
            <button class="translate-chip stagger-3" data-lang="Türkçe">Türkçe</button>
            <button class="translate-chip stagger-4" data-lang="Русский">Русский</button>
            <button class="translate-chip stagger-5" data-lang="Deutsch">Deutsch</button>
          </div>

          <!-- Streaming translation result view -->
          <div class="translate-result-wrap" id="translate-result-wrap" style="display: none;">
            <div class="translate-target-label" id="translate-target-label">Translating...</div>
            <div class="translate-stream-content" id="translate-stream-content"></div>
            <div class="translate-actions">
              <button class="btn-dark-small" id="btn-copy-trans">Copy</button>
              <button class="btn-primary-mint" id="btn-open-trans-chat">Open in chat</button>
            </div>
          </div>
        </div>
      </div>

      <!-- SLOT 13: TOOL APPROVAL (IMAGE E STYLE) -->
      <div class="island-slot slot-tool-approval">
        <div class="tool-approval-top">
          <div class="slot-left-pet-anchor"></div>
          <div class="tool-approval-title-col">
            <div class="tool-approval-title" id="tool-approval-title">Permission Request</div>
            <div class="tool-approval-desc" id="tool-approval-desc">Mintu wants to execute an action</div>
          </div>
        </div>
        <div class="tool-approval-actions" id="tool-approval-actions"></div>
      </div>

      <!-- SLOT 14: CLOUD CONSENT (IMAGE G STYLE) -->
      <div class="island-slot slot-cloud-consent">
        <div class="consent-header-row">
          <div class="slot-left-pet-anchor"></div>
          <div class="consent-title" id="cloud-consent-title">Use Cloud AI Provider?</div>
        </div>
        <div class="consent-rows-container">
          <div class="consent-row">
            <div class="consent-icon">•</div>
            <span id="cloud-consent-desc">Mintu will send prompts to external servers over HTTPS.</span>
          </div>
          <div class="consent-row">
            <div class="consent-icon">•</div>
            <span>API keys are stored securely in Windows Credential Manager.</span>
          </div>
          <div class="consent-row">
            <div class="consent-icon">•</div>
            <span>Local llama.cpp model remains available offline at any time.</span>
          </div>
        </div>
        <div class="consent-actions-row">
          <button class="btn-consent-deny" id="btn-cloud-consent-deny">Stay Local</button>
          <button class="btn-consent-allow" id="btn-cloud-consent-allow">Allow Cloud</button>
        </div>
      </div>
    `;

    this.slotCollapsed = this.container.querySelector(".slot-collapsed")!;
    this.slotIdle = this.container.querySelector(".slot-idle")!;
    this.slotNotification = this.container.querySelector(".slot-notification")!;
    this.slotExpanded = this.container.querySelector(".slot-expanded")!;
    this.slotTimer = this.container.querySelector(".slot-timer")!;
    this.slotMusic = this.container.querySelector(".slot-music")!;
    this.slotConsent = this.container.querySelector(".slot-consent")!;
    this.slotContext = this.container.querySelector(".slot-context")!;
    this.slotBlocked = this.container.querySelector(".slot-blocked")!;
    this.slotToolApproval = this.container.querySelector(".slot-tool-approval")!;
    this.slotCloudConsent = this.container.querySelector(".slot-cloud-consent")!;
    this.slotAnswerReady = this.container.querySelector(".slot-answer-ready")!;
    this.slotReading = this.container.querySelector(".slot-reading")!;
    this.slotTranslate = this.container.querySelector(".slot-translate")!;
    this.attachedChipsEl = this.container.querySelector("#chat-attached-chips")!;

    this.clockEl = this.container.querySelector(".idle-clock")!;

    // Chat elements
    this.chatMessagesEl = this.slotExpanded.querySelector(".chat-messages-container")!;
    this.chatInputEl = this.slotExpanded.querySelector(".chat-text-input")!;
    this.sendBtnEl = this.slotExpanded.querySelector(".chat-send-btn")!;
    this.stopBtnEl = this.slotExpanded.querySelector(".chat-stop-btn")!;
    this.chipsRowEl = this.slotExpanded.querySelector(".expanded-chips-row")!;
    this.greetingRowEl = this.slotExpanded.querySelector(".expanded-greeting-row")!;

    this.setupExpandedEventHandlers();
    this.startWaveformAnimation();
  }

  private setupExpandedEventHandlers(): void {
    // Input submit on Enter (Shift+Enter for newline)
    this.chatInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.submitUserMessage();
      } else if (e.key === "Escape") {
        if (this.onRequestCollapse) this.onRequestCollapse();
      }
    });

    this.sendBtnEl.addEventListener("click", () => {
      this.submitUserMessage();
    });

    this.stopBtnEl.addEventListener("click", () => {
      chatManager.stopGeneration();
      voiceManager.stopSpeaking();
    });

    // Milestone 7: Voice Input (Microphone / STT)
    const micBtn = this.slotExpanded.querySelector("#chat-mic-btn") as HTMLButtonElement;
    if (micBtn) {
      micBtn.addEventListener("click", () => {
        if (voiceManager.isListening()) {
          voiceManager.stopListening();
          micBtn.classList.remove("listening");
          micBtn.classList.add("transcribing");
          this.chatInputEl.placeholder = "Səs mətnə çevrilir...";
        } else {
          micBtn.classList.remove("transcribing");
          micBtn.classList.add("listening");
          this.chatInputEl.placeholder = "Danışın... Bitirdikdə mikrofona vurun";

          const started = voiceManager.startListening(
            (transcript, isFinal) => {
              this.chatInputEl.value = transcript;
              if (isFinal && transcript.trim()) {
                micBtn.classList.remove("listening");
                micBtn.classList.remove("transcribing");
                this.chatInputEl.placeholder = "Mintu-ya bir şey yaz və ya soruş...";
                this.submitUserMessage();
              }
            },
            (err) => {
              micBtn.classList.remove("listening");
              micBtn.classList.remove("transcribing");
              this.chatInputEl.placeholder = "Mintu-ya bir şey yaz və ya soruş...";
              eventBus.emit("pet:say", { text: err });
            },
            (listening, statusText) => {
              if (statusText === "transcribing") {
                micBtn.classList.remove("listening");
                micBtn.classList.add("transcribing");
                this.chatInputEl.placeholder = "Səs mətnə çevrilir...";
              } else if (listening) {
                micBtn.classList.add("listening");
                micBtn.classList.remove("transcribing");
                this.chatInputEl.placeholder = "Danışın... Bitirdikdə mikrofona vurun";
              } else {
                micBtn.classList.remove("listening");
                micBtn.classList.remove("transcribing");
                this.chatInputEl.placeholder = "Mintu-ya bir şey yaz və ya soruş...";
              }
            }
          );
          if (!started) {
            micBtn.classList.remove("listening");
            micBtn.classList.remove("transcribing");
            this.chatInputEl.placeholder = "Mintu-ya bir şey yaz və ya soruş...";
          }
        }
      });
    }

    // Suggestion chips click
    this.chipsRowEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".chip-btn") as HTMLElement;
      if (btn && btn.dataset.chip) {
        this.chatInputEl.value = btn.dataset.chip;
        this.submitUserMessage();
      }
    });

    // Milestone 5: Chat drawer & history handlers
    const newChatBtn = this.slotExpanded.querySelector("#btn-new-chat");
    newChatBtn?.addEventListener("click", async () => {
      await chatManager.startNewChat();
      this.chatInputEl.value = "";
      this.chatInputEl.focus();
      this.closeChatDrawer();
    });

    const chatListToggleBtn = this.slotExpanded.querySelector("#btn-chat-list-toggle");
    chatListToggleBtn?.addEventListener("click", () => {
      this.toggleChatDrawer();
    });

    const closeDrawerBtn = this.slotExpanded.querySelector("#btn-close-chat-drawer");
    closeDrawerBtn?.addEventListener("click", () => {
      this.closeChatDrawer();
    });

    const searchInput = this.slotExpanded.querySelector("#chat-search-input") as HTMLInputElement;
    searchInput?.addEventListener("input", () => {
      this.renderChatList(searchInput.value);
    });

    // In-app shortcut Ctrl+N when island is expanded
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
        const isExpanded = this.slotExpanded.classList.contains("active");
        if (isExpanded) {
          e.preventDefault();
          chatManager.startNewChat().then(() => {
            this.chatInputEl.value = "";
            this.chatInputEl.focus();
            this.closeChatDrawer();
          });
        }
      }
    });

    // Draft persistence on typing
    this.chatInputEl.addEventListener("input", () => {
      chatManager.setDraft(this.chatInputEl.value);
    });

    // Top action buttons
    const clearBtn = this.slotExpanded.querySelector("#btn-clear-chat");
    clearBtn?.addEventListener("click", async () => {
      if (confirm("Clear all messages in this chat? The conversation will be kept.")) {
        await chatManager.clearConversation();
        eventBus.emit("pet:say", { text: "Chat messages cleared." });
      }
    });

    const undoBtn = this.slotExpanded.querySelector("#btn-chat-undo");
    undoBtn?.addEventListener("click", () => {
      if (this.undoDeleteTimer) {
        clearInterval(this.undoDeleteTimer);
        this.undoDeleteTimer = null;
      }
      this.pendingDeleteChatId = null;
      const banner = this.slotExpanded.querySelector("#chat-undo-banner") as HTMLElement;
      if (banner) banner.style.display = "none";
      this.renderChatList();
      eventBus.emit("pet:say", { text: "Chat restored." });
    });

    const exportBtn = this.slotExpanded.querySelector("#btn-export-chat");
    exportBtn?.addEventListener("click", async () => {
      const md = await chatManager.exportMarkdown();
      navigator.clipboard.writeText(md).then(() => {
        eventBus.emit("pet:say", { text: "Chat exported to clipboard!" });
      });
    });

    const settingsBtn = this.slotExpanded.querySelector("#btn-settings-toggle");
    settingsBtn?.addEventListener("click", () => {
      this.switchSubView(this.expandedSubView === "settings" ? "chat" : "settings");
    });

    const closeSettingsBtn = this.slotExpanded.querySelector("#btn-close-settings");
    closeSettingsBtn?.addEventListener("click", () => {
      this.switchSubView("chat");
    });

    const collapseSettingsBtn = this.slotExpanded.querySelector("#btn-collapse-settings");
    collapseSettingsBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.switchSubView("chat");
      if (this.onRequestCollapse) this.onRequestCollapse();
    });

    const collapseBtn = this.slotExpanded.querySelector("#btn-collapse-island");
    collapseBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.switchSubView("chat");
      if (this.onRequestCollapse) this.onRequestCollapse();
    });

    const closeOnboardBtn = this.slotExpanded.querySelector("#btn-close-onboard");
    closeOnboardBtn?.addEventListener("click", () => {
      this.switchSubView("chat");
    });

    const collapseOnboardBtn = this.slotExpanded.querySelector("#btn-collapse-onboard");
    collapseOnboardBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.switchSubView("chat");
      if (this.onRequestCollapse) this.onRequestCollapse();
    });

    const collapseDlBtn = this.slotExpanded.querySelector("#btn-collapse-dl");
    collapseDlBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.onRequestCollapse) this.onRequestCollapse();
    });

    const openModelDlBtn = this.slotExpanded.querySelector("#btn-open-model-download");
    openModelDlBtn?.addEventListener("click", () => {
      this.switchSubView("onboarding");
    });

    // Settings save handler (used by both top and bottom save buttons)
    const handleSaveSettings = () => {
      const promptInput = this.slotExpanded.querySelector("#settings-system-prompt") as HTMLTextAreaElement;
      if (promptInput) {
        chatManager.setSystemPrompt(promptInput.value);
      }
      const modelSelect = this.slotExpanded.querySelector("#settings-active-model") as HTMLSelectElement;
      if (modelSelect && modelSelect.value) {
        modelManager.setActiveModelId(modelSelect.value);
        this.updateModelBadge();
      }

      const outsideSelect = this.slotExpanded.querySelector("#settings-outside-behavior") as HTMLSelectElement;
      if (outsideSelect) {
        localStorage.setItem("mintu_outside_behavior", outsideSelect.value);
        eventBus.emit("settings:outside-behavior-changed", outsideSelect.value);
      }

      const blocklistInput = this.slotExpanded.querySelector("#settings-privacy-blocklist") as HTMLTextAreaElement;
      if (blocklistInput) {
        const val = blocklistInput.value;
        localStorage.setItem("mintu_privacy_blocklist", val);
        const apps = val.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
        appBridge.setPrivacyBlocklist(apps);
      }

      const devPanelSelect = this.slotExpanded.querySelector("#settings-dev-panel") as HTMLSelectElement;
      if (devPanelSelect) {
        const enabled = devPanelSelect.value === "on";
        localStorage.setItem("mintu_dev_panel", enabled ? "true" : "false");
        eventBus.emit("settings:dev-panel-changed", enabled);
      }

      const cloudProvSelect = this.slotExpanded.querySelector("#settings-cloud-provider") as HTMLSelectElement;
      if (cloudProvSelect) {
        const prov = cloudProvSelect.value;
        cloudProviderManager.setActiveProviderId(prov);
        if (prov !== "local") {
          const modelInp = this.slotExpanded.querySelector("#settings-cloud-model-input") as HTMLInputElement;
          const urlInp = this.slotExpanded.querySelector("#settings-cloud-url-input") as HTMLInputElement;
          if (modelInp && modelInp.value.trim()) {
            cloudProviderManager.setModel(prov, modelInp.value.trim());
          }
          if (urlInp && urlInp.value.trim()) {
            cloudProviderManager.setBaseUrl(prov, urlInp.value.trim());
          }
        }
      }

      const neverCloudCheck = this.slotExpanded.querySelector("#settings-never-cloud-context") as HTMLInputElement;
      if (neverCloudCheck) {
        cloudProviderManager.setNeverCloudForContextCaptures(neverCloudCheck.checked);
      }

      const memoryEnabledSelect = this.slotExpanded.querySelector("#settings-memory-enabled") as HTMLSelectElement;
      if (memoryEnabledSelect) {
        memoryManager.setMemoryEnabled(memoryEnabledSelect.value === "on");
      }

      const moodEnabledSelect = this.slotExpanded.querySelector("#settings-mood-enabled") as HTMLSelectElement;
      if (moodEnabledSelect) {
        moodManager.setMoodEnabled(moodEnabledSelect.value === "on");
      }

      const quietModeSelect = this.slotExpanded.querySelector("#settings-quiet-mode") as HTMLSelectElement;
      if (quietModeSelect) {
        moodManager.setQuietMode(quietModeSelect.value === "on");
      }

      const modTimerSelect = this.slotExpanded.querySelector("#settings-module-timer") as HTMLSelectElement;
      if (modTimerSelect) {
        moduleRegistry.setModuleEnabled("timer", modTimerSelect.value === "on");
      }

      const modStatusSelect = this.slotExpanded.querySelector("#settings-module-status") as HTMLSelectElement;
      if (modStatusSelect) {
        moduleRegistry.setModuleEnabled("status", modStatusSelect.value === "on");
      }

      const reduceMotionSelect = this.slotExpanded.querySelector("#settings-reduce-motion") as HTMLSelectElement;
      if (reduceMotionSelect) {
        moduleRegistry.setReduceMotion(reduceMotionSelect.value as any);
      }

      // Milestone 7: Autostart with Windows
      const autostartCheck = this.slotExpanded.querySelector("#settings-autostart-toggle") as HTMLInputElement;
      if (autostartCheck) {
        appBridge.setAutostart(autostartCheck.checked);
      }

      // Milestone 7: Voice TTS & STT settings
      const ttsCheck = this.slotExpanded.querySelector("#settings-tts-toggle") as HTMLInputElement;
      const sttLangSelect = this.slotExpanded.querySelector("#settings-stt-language") as HTMLSelectElement;
      if (ttsCheck && sttLangSelect) {
        voiceManager.saveConfig({
          ttsEnabled: ttsCheck.checked,
          sttLanguage: sttLangSelect.value,
        });
      }

      eventBus.emit("pet:say", { text: "Settings saved!" });
      eventBus.emit("pet:action", { type: "state", payload: "happy" });
      this.switchSubView("chat");
    };

    const saveSettingsBtn = this.slotExpanded.querySelector("#btn-save-settings");
    saveSettingsBtn?.addEventListener("click", handleSaveSettings);

    const saveSettingsTopBtn = this.slotExpanded.querySelector("#btn-save-settings-top");
    saveSettingsTopBtn?.addEventListener("click", handleSaveSettings);

    // Model Tag Popover Switcher Wiring (Image J fix)
    const modelTagEl = this.slotExpanded.querySelector("#mintu-model-tag");
    modelTagEl?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleModelSwitcherPopover();
    });
    modelTagEl?.addEventListener("keydown", (e: any) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        this.toggleModelSwitcherPopover();
      }
    });

    document.addEventListener("click", (e) => {
      const popover = this.slotExpanded.querySelector("#model-switcher-popover");
      if (popover && popover.classList.contains("open")) {
        if (!popover.contains(e.target as Node) && e.target !== modelTagEl) {
          popover.classList.remove("open");
        }
      }
    });

    // Milestone 6 Focus History buttons
    const exportFocusBtn = this.slotExpanded.querySelector("#btn-export-focus-history");
    exportFocusBtn?.addEventListener("click", () => {
      const history = timerEngine.getFocusHistory("all");
      const md = "# Mintu Focus History\n\n" + (history.length === 0 ? "No completed focus sessions yet." : history.map(h => `- **${h.label || "Focus Session"}**: ${Math.round(h.durationSec / 60)} min (${new Date(h.timestamp).toLocaleString()}) - ${h.phase}`).join("\n"));
      navigator.clipboard.writeText(md).then(() => {
        eventBus.emit("pet:say", { text: "Focus history copied to clipboard!" });
      });
    });

    const clearFocusBtn = this.slotExpanded.querySelector("#btn-clear-focus-history");
    clearFocusBtn?.addEventListener("click", () => {
      if (confirm("Clear local focus session history?")) {
        timerEngine.deleteFocusHistory();
        this.switchSubView("settings");
        eventBus.emit("pet:say", { text: "Focus history cleared." });
      }
    });

    // Memory Export and Forget Everything buttons (Milestone 5 Part 2)
    const exportMemoriesBtn = this.slotExpanded.querySelector("#btn-export-memories");
    exportMemoriesBtn?.addEventListener("click", async () => {
      const md = await memoryManager.exportMarkdown();
      navigator.clipboard.writeText(md).then(() => {
        eventBus.emit("pet:say", { text: "Memories exported to clipboard!" });
      });
    });

    const forgetAllMemoriesBtn = this.slotExpanded.querySelector("#btn-forget-all-memories");
    forgetAllMemoriesBtn?.addEventListener("click", async () => {
      if (confirm("Are you sure you want to forget and delete all memory data? This cannot be undone.")) {
        await memoryManager.forgetAllMemories();
        await this.renderMemorySettingsList();
        eventBus.emit("pet:say", { text: "All memory data forgotten." });
      }
    });

    // Cloud AI Provider, Model & URL Settings Handlers
    const cloudProviderSelect = this.slotExpanded.querySelector("#settings-cloud-provider") as HTMLSelectElement;
    const cloudKeySection = this.slotExpanded.querySelector("#settings-cloud-key-section") as HTMLElement;
    const cloudKeyInput = this.slotExpanded.querySelector("#settings-cloud-key-input") as HTMLInputElement;
    const saveCloudKeyBtn = this.slotExpanded.querySelector("#btn-save-cloud-key");
    const deleteCloudKeyBtn = this.slotExpanded.querySelector("#btn-delete-cloud-key");
    const keyStatusHint = this.slotExpanded.querySelector("#settings-key-status-hint") as HTMLElement;

    const cloudModelSection = this.slotExpanded.querySelector("#settings-cloud-model-section") as HTMLElement;
    const cloudModelInput = this.slotExpanded.querySelector("#settings-cloud-model-input") as HTMLInputElement;
    const cloudUrlSection = this.slotExpanded.querySelector("#settings-cloud-url-section") as HTMLElement;
    const cloudUrlInput = this.slotExpanded.querySelector("#settings-cloud-url-input") as HTMLInputElement;
    const resetModelBtn = this.slotExpanded.querySelector("#btn-reset-cloud-model");
    const resetUrlBtn = this.slotExpanded.querySelector("#btn-reset-cloud-url");
    const modelHint = this.slotExpanded.querySelector("#settings-model-hint") as HTMLElement;
    const urlHint = this.slotExpanded.querySelector("#settings-url-hint") as HTMLElement;

    const refreshKeyStatus = async () => {
      if (!cloudProviderSelect) return;
      const prov = cloudProviderSelect.value;
      if (prov === "local") {
        if (cloudKeySection) cloudKeySection.style.display = "none";
        if (cloudModelSection) cloudModelSection.style.display = "none";
        if (cloudUrlSection) cloudUrlSection.style.display = "none";
      } else {
        if (cloudKeySection) cloudKeySection.style.display = "block";
        if (cloudModelSection) cloudModelSection.style.display = "block";
        if (cloudUrlSection) cloudUrlSection.style.display = "block";

        const config = CLOUD_PROVIDERS[prov];
        if (cloudModelInput) {
          cloudModelInput.value = cloudProviderManager.getModel(prov);
        }
        if (cloudUrlInput) {
          cloudUrlInput.value = cloudProviderManager.getBaseUrl(prov);
        }
        if (modelHint && config) {
          modelHint.textContent = `Default: ${config.defaultModel}. Supported: ${config.models.join(", ")}`;
        }
        if (urlHint && config) {
          urlHint.textContent = config.docUrl
            ? `Default: ${config.baseUrl} (Docs: ${config.docUrl})`
            : `Default: ${config.baseUrl}`;
        }

        const st = await cloudProviderManager.getKeyStatus(prov);
        if (st.has_key && st.masked) {
          if (cloudKeyInput) {
            cloudKeyInput.value = "";
            cloudKeyInput.placeholder = `Configured: ${st.masked}`;
          }
          if (keyStatusHint) keyStatusHint.textContent = `Stored in Windows Credential Manager: ${st.masked}`;
        } else {
          if (cloudKeyInput) {
            cloudKeyInput.value = "";
            cloudKeyInput.placeholder = "Enter API key...";
          }
          if (keyStatusHint) keyStatusHint.textContent = "No API key stored in Windows Credential Manager.";
        }
      }
    };

    resetModelBtn?.addEventListener("click", () => {
      const prov = cloudProviderSelect?.value;
      if (prov && prov !== "local") {
        const config = CLOUD_PROVIDERS[prov];
        if (config && cloudModelInput) {
          cloudModelInput.value = config.defaultModel;
          cloudProviderManager.setModel(prov, config.defaultModel);
          eventBus.emit("pet:say", { text: `Model reset to ${config.defaultModel}!` });
        }
      }
    });

    resetUrlBtn?.addEventListener("click", () => {
      const prov = cloudProviderSelect?.value;
      if (prov && prov !== "local") {
        const config = CLOUD_PROVIDERS[prov];
        if (config && cloudUrlInput) {
          cloudUrlInput.value = config.baseUrl;
          cloudProviderManager.setBaseUrl(prov, config.baseUrl);
          eventBus.emit("pet:say", { text: `Base URL reset to default!` });
        }
      }
    });

    cloudModelInput?.addEventListener("change", () => {
      const prov = cloudProviderSelect?.value;
      if (prov && prov !== "local" && cloudModelInput.value.trim()) {
        cloudProviderManager.setModel(prov, cloudModelInput.value.trim());
      }
    });

    cloudUrlInput?.addEventListener("change", () => {
      const prov = cloudProviderSelect?.value;
      if (prov && prov !== "local" && cloudUrlInput.value.trim()) {
        cloudProviderManager.setBaseUrl(prov, cloudUrlInput.value.trim());
      }
    });

    cloudProviderSelect?.addEventListener("change", () => {
      const val = cloudProviderSelect.value;
      if (val !== "local" && !cloudProviderManager.hasConsent(val)) {
        this.showCloudConsent(val, (allowed) => {
          if (allowed) {
            cloudProviderSelect.value = val;
            cloudProviderManager.setActiveProviderId(val);
          } else {
            cloudProviderSelect.value = "local";
            cloudProviderManager.setActiveProviderId("local");
          }
          refreshKeyStatus();
        });
      } else {
        cloudProviderManager.setActiveProviderId(val);
        refreshKeyStatus();
      }
    });

    saveCloudKeyBtn?.addEventListener("click", async () => {
      const prov = cloudProviderSelect?.value;
      const key = cloudKeyInput?.value.trim();
      if (prov && prov !== "local" && key) {
        await cloudProviderManager.storeApiKey(prov, key);
        eventBus.emit("pet:say", { text: "API key stored securely in Windows Credential Manager!" });
        await refreshKeyStatus();
      }
    });

    deleteCloudKeyBtn?.addEventListener("click", async () => {
      const prov = cloudProviderSelect?.value;
      if (prov && prov !== "local") {
        await cloudProviderManager.deleteApiKey(prov);
        eventBus.emit("pet:say", { text: "API key removed from Windows Credential Manager." });
        await refreshKeyStatus();
      }
    });

    // Model Storage Browse & Save Handlers (Milestone 6)
    const browseSettingsBtn = this.slotExpanded.querySelector("#btn-settings-browse-storage");
    browseSettingsBtn?.addEventListener("click", async () => {
      const picked = await modelManager.browseModelsDir();
      if (picked) {
        const input = this.slotExpanded.querySelector("#settings-storage-path-input") as HTMLInputElement;
        if (input) input.value = picked;
        const moveCheck = this.slotExpanded.querySelector("#settings-storage-move-existing") as HTMLInputElement;
        await modelManager.setModelsDir(picked, moveCheck ? moveCheck.checked : false);
        await this.refreshStorageUI();
        this.populateModelSelects();
        eventBus.emit("pet:say", { text: `Model storage set to ${picked}` });
      }
    });

    const saveSettingsStorageBtn = this.slotExpanded.querySelector("#btn-settings-save-storage");
    saveSettingsStorageBtn?.addEventListener("click", async () => {
      const input = this.slotExpanded.querySelector("#settings-storage-path-input") as HTMLInputElement;
      const moveCheck = this.slotExpanded.querySelector("#settings-storage-move-existing") as HTMLInputElement;
      if (input && input.value.trim()) {
        try {
          await modelManager.setModelsDir(input.value.trim(), moveCheck ? moveCheck.checked : false);
          await this.refreshStorageUI();
          this.populateModelSelects();
          eventBus.emit("pet:say", { text: "Storage location updated!" });
        } catch (err: any) {
          alert(`Failed to set directory: ${err}`);
        }
      }
    });

    const viewLogsBtn = this.slotExpanded.querySelector("#btn-refresh-audit-logs");
    const clearLogsBtn = this.slotExpanded.querySelector("#btn-clear-audit-logs");
    const auditLogsCard = this.slotExpanded.querySelector("#settings-audit-logs-card") as HTMLElement;

    viewLogsBtn?.addEventListener("click", async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const logs = await invoke<any[]>("db_list_audit_logs", { limit: 50 });
        if (auditLogsCard) {
          auditLogsCard.style.display = "block";
          if (!logs || logs.length === 0) {
            auditLogsCard.innerHTML = "<em>No audit log records yet.</em>";
          } else {
            auditLogsCard.innerHTML = logs
              .map(
                (l) => `
              <div style="margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 2px;">
                <div style="display: flex; justify-content: space-between;">
                  <strong style="color: ${
                    l.status === "executed" ? "#10b981" : l.status === "denied" ? "#f59e0b" : "#ef4444"
                  }">${l.tool_name} (${l.status})</strong>
                  <span style="opacity: 0.6; font-size: 10px;">${new Date(l.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style="opacity: 0.8; font-size: 11px;">${l.params_summary}</div>
                ${l.error ? `<div style="color: #f87171; font-size: 10.5px;">${l.error}</div>` : ""}
              </div>
            `
              )
              .join("");
          }
        }
      } catch (e) {
        console.warn("Failed to load audit logs", e);
      }
    });

    clearLogsBtn?.addEventListener("click", async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("db_clear_audit_logs");
        if (auditLogsCard) auditLogsCard.innerHTML = "<em>Audit logs cleared.</em>";
        eventBus.emit("pet:say", { text: "Audit logs cleared." });
      } catch (e) {
        console.warn("Failed to clear audit logs", e);
      }
    });

    // Skip onboarding button
    const skipOnboardBtn = this.slotExpanded.querySelector("#btn-skip-onboard");
    skipOnboardBtn?.addEventListener("click", () => {
      eventBus.emit("pet:say", { text: "Chat opened! How can I help?" });
      eventBus.emit("pet:action", { type: "state", payload: "happy" });
      this.switchSubView("chat");
    });

    this.setupContextAndMediaHandlers();
    this.setupActivityManagerBridge();
    this.initIPCListeners();
    this.setupMilestone8Handlers();
  }

  private setupMilestone8Handlers(): void {
    // 1. Gamification: Level & XP Stats
    const updateLevelBadge = () => {
      const progress = xpManager.getProgress();
      const stats = xpManager.getStats();
      const badgeEl = this.slotExpanded.querySelector("#mintu-level-badge");
      if (badgeEl) {
        badgeEl.textContent = `Lvl ${progress.level} · ${stats.totalXP} XP`;
      }

      const titleEl = this.slotExpanded.querySelector("#settings-xp-level-title");
      const pointsBadge = this.slotExpanded.querySelector("#settings-xp-points-badge");
      const progressBar = this.slotExpanded.querySelector("#settings-xp-progress-bar") as HTMLElement;
      const hintEl = this.slotExpanded.querySelector("#settings-xp-hint");

      if (titleEl) titleEl.textContent = `Level ${progress.level} Mintu`;
      if (pointsBadge) pointsBadge.textContent = `${stats.totalXP} XP (${progress.xpInLevel}/${progress.xpNeededForLevel} XP)`;
      if (progressBar) progressBar.style.width = `${progress.progressPercent}%`;
      if (hintEl) {
        hintEl.textContent = `${stats.pomodorosCompleted} Pomodoros tamamlandı, ${stats.focusMinutes} fokus dəqiqəsi qazanıldı. Səviyyə artdıqca yeni aksesuarlar açılır!`;
      }
    };

    const renderWardrobe = () => {
      const gridEl = this.slotExpanded.querySelector("#wardrobe-items-grid");
      if (!gridEl) return;
      const stats = xpManager.getStats();
      const equipped = xpManager.getEquippedAccessory();

      const accessories = [
        { id: "none", name: "Standart Mintu", reqLevel: 1 },
        { id: "glasses", name: "Dəbli Eynək", reqLevel: 1 },
        { id: "coffee_cup", name: "İsti Qəhvə Fincanı", reqLevel: 2 },
        { id: "winter_hat", name: "Qış Papağı", reqLevel: 3 },
        { id: "headphones", name: "Fokus Qulaqlıqları", reqLevel: 4 },
      ];

      gridEl.innerHTML = accessories
        .map((acc) => {
          const isUnlocked = stats.unlockedAccessories.includes(acc.id) || stats.level >= acc.reqLevel;
          const isEquipped = equipped === acc.id;
          const statusText = isEquipped ? "İstifadədədir" : isUnlocked ? "Təchiz et" : `Lvl ${acc.reqLevel}-də açılır`;
          return `
            <div class="wardrobe-item-card ${isEquipped ? "equipped" : ""} ${!isUnlocked ? "locked" : ""}" data-acc-id="${acc.id}">
              <div class="wardrobe-item-name">${acc.name}</div>
              <div class="wardrobe-item-status">${statusText}</div>
            </div>
          `;
        })
        .join("");

      gridEl.querySelectorAll(".wardrobe-item-card").forEach((card) => {
        card.addEventListener("click", () => {
          const id = (card as HTMLElement).dataset.accId;
          if (!id) return;
          const isUnlocked = stats.unlockedAccessories.includes(id) || stats.level >= (accessories.find((a) => a.id === id)?.reqLevel || 1);
          if (!isUnlocked) {
            eventBus.emit("pet:say", { text: "Bu aksesuar daha yüksək səviyyədə açılır!" });
            return;
          }
          xpManager.equipAccessory(id);
          renderWardrobe();
          eventBus.emit("pet:say", { text: "Aksesuar dəyişdirildi!" });
        });
      });
    };

    updateLevelBadge();
    renderWardrobe();

    eventBus.on("gamification:xp-gained", () => {
      updateLevelBadge();
      renderWardrobe();
    });
    eventBus.on("gamification:stats-updated", () => {
      updateLevelBadge();
      renderWardrobe();
    });

    // 2. Smart Clipboard Assistant
    const clipPill = this.slotExpanded.querySelector("#smart-clipboard-pill") as HTMLElement;
    const clipBadge = this.slotExpanded.querySelector("#smart-clip-badge") as HTMLElement;
    const clipText = this.slotExpanded.querySelector("#smart-clip-text") as HTMLElement;
    const clipActionBtn = this.slotExpanded.querySelector("#btn-smart-clip-action") as HTMLButtonElement;
    const clipCloseBtn = this.slotExpanded.querySelector("#btn-smart-clip-close") as HTMLButtonElement;
    const clipToggle = this.slotExpanded.querySelector("#settings-smart-clipboard-toggle") as HTMLInputElement;

    if (clipToggle) {
      clipToggle.checked = smartClipboard.isEnabled();
      clipToggle.addEventListener("change", () => {
        smartClipboard.setEnabled(clipToggle.checked);
      });
    }

    eventBus.on("clipboard:action-suggested", (action: any) => {
      if (!clipPill || !action) return;
      if (clipBadge) clipBadge.textContent = String(action.type).toUpperCase();
      if (clipText) clipText.textContent = action.label;
      clipPill.style.display = "flex";
    });

    eventBus.on("clipboard:action-cleared", () => {
      if (clipPill) clipPill.style.display = "none";
    });

    clipCloseBtn?.addEventListener("click", () => {
      smartClipboard.clearAction();
    });

    clipActionBtn?.addEventListener("click", () => {
      const action = smartClipboard.getCurrentAction();
      if (action) {
        smartClipboard.clearAction();
        this.chatInputEl.value = action.prompt;
        this.submitUserMessage();
      }
    });

    // 3. GitHub Releases Auto-Updater
    const updateBanner = this.slotExpanded.querySelector("#mintu-update-banner") as HTMLElement;
    const updateText = this.slotExpanded.querySelector("#mintu-update-text") as HTMLElement;
    const updateOpenBtn = this.slotExpanded.querySelector("#btn-mintu-update-open") as HTMLButtonElement;
    const updateCloseBtn = this.slotExpanded.querySelector("#btn-mintu-update-close") as HTMLButtonElement;
    const checkUpdatesBtn = this.slotExpanded.querySelector("#btn-check-updates-now") as HTMLButtonElement;
    const updaterStatusHint = this.slotExpanded.querySelector("#settings-updater-status") as HTMLElement;

    eventBus.on("app:update-available", (info: any) => {
      if (updateBanner && info) {
        if (updateText) updateText.textContent = `Mintu v${info.latestVersion} hazırdır, yenilənsin?`;
        updateBanner.style.display = "flex";
      }
    });

    updateCloseBtn?.addEventListener("click", () => {
      if (updateBanner) updateBanner.style.display = "none";
    });

    updateOpenBtn?.addEventListener("click", () => {
      const cached = updateChecker.getCachedUpdate();
      const url = cached?.releaseUrl || "https://github.com/TalibliTural/Mintu/releases";
      if (typeof window !== "undefined") {
        import("@tauri-apps/api/core")
          .then(({ invoke }) => {
            invoke("tools_open_url", { url }).catch(() => window.open(url, "_blank"));
          })
          .catch(() => window.open(url, "_blank"));
      }
    });

    checkUpdatesBtn?.addEventListener("click", async () => {
      if (updaterStatusHint) updaterStatusHint.textContent = "Yoxlanılır...";
      try {
        const res = await updateChecker.checkForUpdates();
        if (res.available) {
          if (updaterStatusHint) updaterStatusHint.textContent = `Yeni versiya tapıldı: v${res.latestVersion}`;
          if (updateBanner) {
            if (updateText) updateText.textContent = `Mintu v${res.latestVersion} hazırdır, yenilənsin?`;
            updateBanner.style.display = "flex";
          }
        } else {
          if (updaterStatusHint) updaterStatusHint.textContent = "Mintu ən son versiyadadır (v0.1.2).";
          eventBus.emit("pet:say", { text: "Mintu artıq ən son versiyadadır!" });
        }
      } catch {
        if (updaterStatusHint) updaterStatusHint.textContent = "Yeniləmə yoxlanılarkən xəta baş verdi.";
      }
    });
  }

  private setupContextAndMediaHandlers(): void {
    // Media playback controls
    const playPauseBtn = this.slotMusic.querySelector("#music-btn-play-pause") as HTMLButtonElement;
    playPauseBtn?.addEventListener("click", async (e) => {
      e.stopPropagation();
      // 1. Instantly flip local state for immediate 0ms visual feedback
      this.isMusicPlaying = !this.isMusicPlaying;
      this.updatePlayPauseIcon(this.isMusicPlaying);

      const artistEl = this.slotMusic.querySelector("#music-artist-subtitle");
      if (artistEl) {
        const rawArtist = (artistEl.getAttribute("data-base-artist") || artistEl.textContent?.replace(" · Paused", "") || "").trim();
        artistEl.textContent = this.isMusicPlaying ? rawArtist : (rawArtist ? `${rawArtist} · Paused` : "Paused");
      }

      if (this.isMusicPlaying) {
        activityManager.push({
          id: "music_live",
          type: "music_active",
          islandState: "music",
          petState: "dance",
        });
      } else {
        // Paused state: stay visible for 20 seconds so user can see paused state & resume anytime
        activityManager.push({
          id: "music_live",
          type: "music_active",
          islandState: "music",
          petState: "idle",
          autoDismissMs: 20000,
        });
      }

      // 2. Call backend SMTC control
      try {
        await appBridge.mediaTogglePlayPause();
      } catch (err) {
        console.warn("mediaTogglePlayPause error:", err);
      }
    });
    const prevBtn = this.slotMusic.querySelector("#music-btn-prev") as HTMLButtonElement;
    prevBtn?.addEventListener("click", () => {
      appBridge.mediaPrevious();
    });
    const nextBtn = this.slotMusic.querySelector("#music-btn-next") as HTMLButtonElement;
    nextBtn?.addEventListener("click", () => {
      appBridge.mediaNext();
    });

    // Consent card buttons (Image G)
    const allowBtn = this.slotConsent.querySelector("#btn-consent-allow");
    allowBtn?.addEventListener("click", () => {
      localStorage.setItem("mintu_context_consent", "granted");
      activityManager.removeByType("consent_card");
      this.handleHotkeyAsk();
    });

    const denyBtn = this.slotConsent.querySelector("#btn-consent-deny");
    denyBtn?.addEventListener("click", () => {
      activityManager.removeByType("consent_card");
    });

    const chooseAppsLink = this.slotConsent.querySelector("#link-consent-blocklist");
    chooseAppsLink?.addEventListener("click", () => {
      activityManager.removeByType("consent_card");
      eventBus.emit("island:request-state", "expanded");
      this.switchSubView("settings");
      setTimeout(() => {
        const bl = this.slotExpanded.querySelector("#settings-privacy-blocklist") as HTMLTextAreaElement;
        bl?.focus();
      }, 200);
    });

    // Context card action buttons (Image E 1-2)
    const contextActionsRow = this.slotContext.querySelector("#context-actions-row");
    contextActionsRow?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".context-action-btn") as HTMLElement;
      if (btn && btn.dataset.action && this.activeContextData) {
        const act = btn.dataset.action;
        this.executeContextAction(act);
      }
    });

    // Answer ready pill click (Image E 5)
    this.slotAnswerReady.addEventListener("click", () => {
      activityManager.removeByType("normal_notif");
      this.onRequestResize?.(440, 440);
      eventBus.emit("island:request-state", "expanded");
    });

    // Choose another model button (Image H)
    const chooseAnotherBtn = this.slotExpanded.querySelector("#btn-choose-another");
    const pickerSection = this.slotExpanded.querySelector("#onboard-picker-section") as HTMLElement;
    chooseAnotherBtn?.addEventListener("click", () => {
      if (pickerSection) {
        const isHidden = pickerSection.style.display === "none";
        pickerSection.style.display = isHidden ? "block" : "none";
        chooseAnotherBtn.textContent = isHidden ? "Hide choices" : "Choose another";
        this.updateCardDimensions();
        if (isHidden) {
          setTimeout(() => {
            const startBtn = this.slotExpanded.querySelector("#btn-start-download");
            startBtn?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 80);
        }
      }
    });

    // Cancel download button (Image H)
    const cancelDlBtn = this.slotExpanded.querySelector("#btn-cancel-download") as HTMLButtonElement;
    cancelDlBtn?.addEventListener("click", async () => {
      const select = this.slotExpanded.querySelector("#onboard-model-select") as HTMLSelectElement;
      const rec = modelManager.getRecommendedModel();
      const modelId = this.currentDownloadingModelId || (select && select.value) || (rec?.id || "qwen2.5-1.5b-instruct");
      await modelManager.cancelDownload(modelId);
      this.resetDownloadProgressUi();
    });

    // Onboarding Storage Browse Handler (Milestone 6)
    const browseOnboardBtn = this.slotExpanded.querySelector("#btn-onboard-browse-storage");
    browseOnboardBtn?.addEventListener("click", async () => {
      const picked = await modelManager.browseModelsDir();
      if (picked) {
        await modelManager.setModelsDir(picked, false);
        await this.refreshStorageUI();
        eventBus.emit("pet:say", { text: `Download folder set to ${picked}` });
      }
    });

    // Start download button with pre-flight check (Image H)
    const startDlBtn = this.slotExpanded.querySelector("#btn-start-download");
    startDlBtn?.addEventListener("click", async () => {
      const select = this.slotExpanded.querySelector("#onboard-model-select") as HTMLSelectElement;
      const rec = modelManager.getRecommendedModel();
      const modelId = (select && select.value) ? select.value : (rec?.id || "qwen2.5-1.5b-instruct");
      const catalog = modelManager.getCatalog();
      const spec = catalog.find((m) => m.id === modelId);

      // If already installed, directly activate it!
      if (modelManager.isModelInstalled(modelId)) {
        modelManager.setActiveModelId(modelId);
        this.updateModelBadge();
        eventBus.emit("pet:say", { text: `Model ${spec?.name || modelId} activated! Let's chat!` });
        eventBus.emit("pet:action", { type: "state", payload: "happy" });
        this.switchSubView("chat");
        return;
      }

      const hw = await modelManager.detectHardware();
      if (spec && hw.free_disk_mb * 1024 * 1024 < spec.size_bytes + 200_000_000) {
        const curDir = await modelManager.getModelsDir();
        alert(`Not enough free disk space on ${curDir}! ${(hw.free_disk_mb / 1024).toFixed(1)} GB available, but model requires ${(spec.size_bytes / (1024 * 1024 * 1024)).toFixed(1)} GB. Please choose D: drive or another folder with more space.`);
        return;
      }
      this.currentDownloadingModelId = modelId;
      const dlTitle = this.slotExpanded.querySelector("#onboard-dl-title");
      if (dlTitle && spec) dlTitle.textContent = spec.name;
      const cardCheck = this.slotExpanded.querySelector("#onboarding-card-check") as HTMLElement;
      const cardDl = this.slotExpanded.querySelector("#onboarding-card-downloading") as HTMLElement;
      if (cardCheck) cardCheck.style.display = "none";
      if (cardDl) cardDl.style.display = "flex";
      modelManager.startDownload(modelId);
      eventBus.emit("pet:action", { type: "state", payload: "happy" });
    });

    // Pause / Resume download button (Image H)
    const pauseDlBtn = this.slotExpanded.querySelector("#btn-pause-download") as HTMLButtonElement;
    pauseDlBtn?.addEventListener("click", () => {
      const select = this.slotExpanded.querySelector("#onboard-model-select") as HTMLSelectElement;
      const rec = modelManager.getRecommendedModel();
      const modelId = this.currentDownloadingModelId || (select && select.value) || (rec?.id || "qwen2.5-1.5b-instruct");
      if (pauseDlBtn.textContent === "Resume") {
        modelManager.startDownload(modelId);
        pauseDlBtn.textContent = "Pause";
      } else {
        modelManager.pauseDownload(modelId);
        pauseDlBtn.textContent = "Resume";
      }
    });

    // Notification dismiss 'x' button (0.6)
    const notifDismissBtn = this.slotNotification.querySelector("#notif-dismiss-btn");
    notifDismissBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      activityManager.removeByType("normal_notif");
      activityManager.removeByType("urgent_notif");
    });

    // Notification hover pause / resume auto-dismiss (0.6)
    this.slotNotification.addEventListener("mouseenter", () => {
      activityManager.pauseAutoDismiss();
    });
    this.slotNotification.addEventListener("mouseleave", () => {
      activityManager.resumeAutoDismiss();
    });

    // In-card retry download button
    const retryDlBtn = this.slotExpanded.querySelector("#btn-retry-download");
    retryDlBtn?.addEventListener("click", () => {
      const errorBox = this.slotExpanded.querySelector("#onboard-dl-error-box") as HTMLElement;
      if (errorBox) errorBox.style.display = "none";
      const buttons = this.slotExpanded.querySelector("#onboard-dl-buttons") as HTMLElement;
      if (buttons) buttons.style.display = "flex";
      const track = this.slotExpanded.querySelector(".onboard-large-progress-track") as HTMLElement;
      if (track) track.style.display = "block";
      const telemetry = this.slotExpanded.querySelector("#onboard-dl-telemetry") as HTMLElement;
      if (telemetry) telemetry.style.display = "block";

      const select = this.slotExpanded.querySelector("#onboard-model-select") as HTMLSelectElement;
      const rec = modelManager.getRecommendedModel();
      const modelId = this.currentDownloadingModelId || (select && select.value) || (rec?.id || "qwen2.5-1.5b-instruct");
      modelManager.startDownload(modelId);
    });

    // Choose another model from error card
    const chooseAnotherErrorBtn = this.slotExpanded.querySelector("#btn-choose-another-model");
    chooseAnotherErrorBtn?.addEventListener("click", () => {
      this.resetDownloadProgressUi();
    });

    // Translate card event handlers
    const closeTranslateBtn = this.slotTranslate.querySelector("#btn-close-translate");
    closeTranslateBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      activityManager.dismissCurrent();
      if (this.onRequestCollapse) this.onRequestCollapse();
    });

    const origChip = this.slotTranslate.querySelector("#translate-orig-chip");
    origChip?.addEventListener("click", () => {
      origChip.classList.toggle("expanded");
    });

    const chipsRow = this.slotTranslate.querySelector("#translate-chips-row") as HTMLElement;
    chipsRow?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".translate-chip") as HTMLElement;
      if (btn && btn.dataset.lang) {
        this.executeTranslation(btn.dataset.lang);
      }
    });

    const copyTransBtn = this.slotTranslate.querySelector("#btn-copy-trans") as HTMLButtonElement;
    copyTransBtn?.addEventListener("click", () => {
      const content = this.slotTranslate.querySelector("#translate-stream-content")?.textContent || "";
      if (content) {
        navigator.clipboard.writeText(content).then(() => {
          copyTransBtn.textContent = "✓ Copied!";
          setTimeout(() => {
            copyTransBtn.textContent = "Copy";
          }, 2000);
        });
      }
    });

    const openTransChatBtn = this.slotTranslate.querySelector("#btn-open-trans-chat") as HTMLButtonElement;
    openTransChatBtn?.addEventListener("click", () => {
      const content = this.slotTranslate.querySelector("#translate-stream-content")?.textContent || "";
      if (content) {
        this.addAttachedChip({
          type: "code",
          label: "Translation",
          data: content,
          appName: "Translator",
        });
        this.switchSubView("chat");
        this.onRequestResize?.(440, 440);
        eventBus.emit("island:request-state", "expanded");
        activityManager.dismissCurrent();
      }
    });
  }

  private setupActivityManagerBridge(): void {
    activityManager.onStateTransition = (item) => {
      eventBus.emit("island:request-state", item.islandState);
    };
  }

  private initIPCListeners(): void {
    // 0. Sync initial privacy blocklist to backend
    const savedBlocklist = localStorage.getItem("mintu_privacy_blocklist");
    if (savedBlocklist) {
      const apps = savedBlocklist.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
      appBridge.setPrivacyBlocklist(apps);
    }

    // 1. Media state
    appBridge.listenToEvent<any>("media-state-changed", (media) => {
      this.updateMusicUi(media);
    });

    // 2. System notifications
    appBridge.listenToEvent<any>("system-notification-received", (notif) => {
      this.setNotification({
        title: notif.title,
        text: notif.text,
        appName: notif.app_name,
        appIcon: notif.app_icon,
        target: notif.target,
        actions: notif.actions,
      });
      activityManager.push({
        id: "sys_notif_" + notif.id,
        type: notif.priority === "urgent" ? "urgent_notif" : "normal_notif",
        islandState: "notification",
        petState: "alert",
        autoDismissMs: 6500,
      });
    });

    // 3. Global hotkeys
    appBridge.listenToEvent<string>("hotkey-triggered", (action) => {
      if (action === "ask") {
        this.handleHotkeyAsk();
      } else if (action === "capture") {
        const consent = localStorage.getItem("mintu_context_consent");
        if (consent !== "granted") {
          activityManager.push({
            id: "consent",
            type: "consent_card",
            islandState: "consent",
            petState: "curious",
          });
        } else {
          this.isTranslatingFlow = false;
          appBridge.openRegionCapture();
        }
      } else if (action === "translate-area") {
        const consent = localStorage.getItem("mintu_context_consent");
        if (consent !== "granted") {
          activityManager.push({
            id: "consent",
            type: "consent_card",
            islandState: "consent",
            petState: "curious",
          });
        } else {
          this.isTranslatingFlow = true;
          appBridge.openRegionCapture();
        }
      } else if (action === "translate-selection") {
        this.handleTranslateSelection();
      }
    });

    // 4. Region capture result
    appBridge.listenToEvent<any>("context-captured", (data) => {
      if (!data) return;
      if (data.app_info?.is_blocked) {
        const descEl = this.slotBlocked.querySelector("#blocked-app-desc");
        if (descEl) descEl.textContent = `${data.app_info.process_name || "This application"} is on your privacy blocklist`;
        activityManager.push({
          id: "blocked",
          type: "context_card",
          islandState: "blocked",
          petState: "alert",
          autoDismissMs: 4000,
        });
        return;
      }

      if (this.isTranslatingFlow) {
        this.isTranslatingFlow = false;
        const text = data.text?.trim() || "";
        if (!text) {
          eventBus.emit("pet:say", { text: "No words found in this area." });
          if (this.onRequestCollapse) this.onRequestCollapse();
          return;
        }
        this.startTranslateFlow(text);
        return;
      }

      if (data.text) {
        this.showContextCard(data.text, data.app_info?.process_name || "Screen Selection", data.image_base64);
      } else if (data.image_base64) {
        this.addAttachedChip({
          type: "image",
          label: "Screenshot",
          data: data.image_base64,
          appName: data.app_info?.process_name,
        });
        eventBus.emit("island:request-state", "expanded");
      }
    });

    // 5. Answer ready notification when LLM finishes generating while island is collapsed
    chatManager.onStateChanged = (state) => {
      if (state === "streaming" || state === "thinking") {
        this.sendBtnEl.style.display = "none";
        this.stopBtnEl.style.display = "flex";
      } else {
        this.sendBtnEl.style.display = "flex";
        this.stopBtnEl.style.display = "none";
      }
    };
  }

  public async handleHotkeyAsk(): Promise<void> {
    const consent = localStorage.getItem("mintu_context_consent");
    if (consent !== "granted") {
      activityManager.push({
        id: "consent",
        type: "consent_card",
        islandState: "consent",
        petState: "curious",
      });
      return;
    }

    const captured = await appBridge.captureContext();
    if (!captured) return;

    if (captured.app_info.is_blocked) {
      const descEl = this.slotBlocked.querySelector("#blocked-app-desc");
      if (descEl) {
        descEl.textContent = `${captured.app_info.process_name || "This application"} is on your privacy blocklist`;
      }
      activityManager.push({
        id: "blocked",
        type: "context_card",
        islandState: "blocked",
        petState: "alert",
        autoDismissMs: 4500,
      });
      return;
    }

    if (captured.text && captured.text.trim()) {
      this.showContextCard(captured.text.trim(), captured.app_info.process_name || captured.app_info.title);
    } else {
      eventBus.emit("island:request-state", "expanded");
    }
  }

  public showContextCard(text: string, appName?: string, imgB64?: string): void {
    this.activeContextData = { text, imgB64, appName };

    const summaryEl = this.slotContext.querySelector("#context-summary-text");
    const actionsRow = this.slotContext.querySelector("#context-actions-row");

    const lineCount = text.split("\n").length;
    if (summaryEl) {
      summaryEl.textContent = `Got ${lineCount} ${lineCount === 1 ? "line" : "lines"} from ${appName || "active app"}`;
    }

    const isCodeOrError =
      text.includes("error") ||
      text.includes("Error") ||
      text.includes("fn ") ||
      text.includes("function") ||
      text.includes("const ") ||
      text.includes("import ");

    if (actionsRow) {
      if (isCodeOrError) {
        actionsRow.innerHTML = `
          <button class="context-action-btn secondary" data-action="explain">Explain</button>
          <button class="context-action-btn primary" data-action="fix">Fix it</button>
        `;
      } else {
        actionsRow.innerHTML = `
          <button class="context-action-btn secondary" data-action="summarize">Summarize</button>
          <button class="context-action-btn primary" data-action="translate">Translate</button>
        `;
      }
    }

    activityManager.push({
      id: "context_captured",
      type: "context_card",
      islandState: "context",
      petState: "think",
      autoDismissMs: 8000,
    });
  }

  private executeContextAction(actionId: string): void {
    if (!this.activeContextData) return;
    const { text, imgB64, appName } = this.activeContextData;

    const template = CONTEXT_TEMPLATES[actionId] || CONTEXT_TEMPLATES.explain;
    const prompt = template.promptBuilder(text || "[Screenshot attached]", appName);

    if (imgB64) {
      this.addAttachedChip({
        type: "image",
        label: "Screenshot",
        data: imgB64,
        appName,
      });
    } else if (text) {
      this.addAttachedChip({
        type: "code",
        label: `${text.split("\n").length} lines`,
        data: text,
        appName,
      });
    }

    activityManager.removeByType("context_card");
    eventBus.emit("island:request-state", "expanded");
    chatManager.sendMessage(prompt);
    this.activeContextData = null;
  }

  public updatePlayPauseIcon(isPlaying: boolean): void {
    const playPauseBtn = this.slotMusic.querySelector("#music-btn-play-pause") as HTMLButtonElement;
    if (playPauseBtn) {
      if (isPlaying) {
        // Music is playing -> show Pause icon (||)
        playPauseBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        `;
        playPauseBtn.title = "Pause";
        playPauseBtn.classList.remove("is-paused");
        playPauseBtn.classList.add("is-playing");
      } else {
        // Music is paused -> show Play icon (▶)
        playPauseBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        `;
        playPauseBtn.title = "Play";
        playPauseBtn.classList.remove("is-playing");
        playPauseBtn.classList.add("is-paused");
      }
    }
  }

  public updateMusicUi(media: any): void {
    if (!media) return;
    const titleEl = this.slotMusic.querySelector("#music-track-title");
    const artistEl = this.slotMusic.querySelector("#music-artist-subtitle");
    const artImg = this.slotMusic.querySelector("#music-art-image") as HTMLImageElement;
    const artFallback = this.slotMusic.querySelector("#music-art-fallback") as HTMLElement;

    if (titleEl) {
      titleEl.textContent = media.title || (media.has_session ? "Media Playing" : "Not Playing");
    }

    if (artistEl) {
      const baseArtist = (media.artist || media.album || (media.has_session ? "Audio Player" : "--")).trim();
      artistEl.setAttribute("data-base-artist", baseArtist);
      artistEl.textContent = media.is_playing ? baseArtist : (media.has_session && (media.title || media.artist) ? `${baseArtist} · Paused` : baseArtist);
    }

    if (artImg && artFallback) {
      if (media.thumbnail_base64) {
        artImg.src = media.thumbnail_base64;
        artImg.style.display = "block";
        artFallback.style.display = "none";
      } else {
        artImg.style.display = "none";
        artFallback.style.display = "block";
      }
    }

    this.isMusicPlaying = !!media.is_playing;
    this.updatePlayPauseIcon(this.isMusicPlaying);

    if (media.is_playing) {
      activityManager.push({
        id: "music_live",
        type: "music_active",
        islandState: "music",
        petState: "dance",
      });
    } else if (media.has_session && (media.title || media.artist)) {
      // Paused state: keep music card active with idle pet and auto-dismiss after 20 seconds
      activityManager.push({
        id: "music_live",
        type: "music_active",
        islandState: "music",
        petState: "idle",
        autoDismissMs: 20000,
      });
    } else {
      activityManager.remove("music_live");
    }
  }

  public getIsMusicPlaying(): boolean {
    return this.isMusicPlaying;
  }

  public addAttachedChip(chip: { type: "code" | "image"; label: string; data: string; appName?: string }): void {
    const id = "chip-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    this.attachedChips.push({ ...chip, id });
    this.renderAttachedChips();
  }

  public removeAttachedChip(id: string): void {
    this.attachedChips = this.attachedChips.filter((c) => c.id !== id);
    this.renderAttachedChips();
  }

  public clearAttachedChips(): void {
    this.attachedChips = [];
    this.renderAttachedChips();
  }

  private renderAttachedChips(): void {
    if (!this.attachedChipsEl) return;
    this.attachedChipsEl.innerHTML = "";
    this.attachedChips.forEach((c) => {
      const el = document.createElement("div");
      el.className = "chat-context-chip";
      const icon = c.type === "code" ? "&lt;/&gt;" : "IMG";
      el.innerHTML = `
        <span>${icon} ${c.label}</span>
        <button class="chip-remove-btn" data-id="${c.id}" title="Remove">✕</button>
      `;
      el.querySelector(".chip-remove-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeAttachedChip(c.id);
      });
      this.attachedChipsEl.appendChild(el);
    });
  }

  private submitUserMessage(): void {
    const text = this.chatInputEl.value.trim();
    if (!text && this.attachedChips.length === 0) return;

    let fullPrompt = text;
    if (this.attachedChips.length > 0) {
      const chipParts = this.attachedChips
        .map(
          (c) =>
            `<untrusted_user_context>\n[${c.label}${c.appName ? ` from ${c.appName}` : ""}]\n${c.data}\n</untrusted_user_context>`
        )
        .join("\n\n");
      fullPrompt = fullPrompt ? `${fullPrompt}\n\n${chipParts}` : chipParts;
      this.clearAttachedChips();
    }

    this.chatInputEl.value = "";
    if (this.editingMessageId) {
      const editId = this.editingMessageId;
      this.editingMessageId = null;
      chatManager.editMessageAndResend(editId, fullPrompt);
    } else {
      chatManager.sendMessage(fullPrompt);
    }
  }

  private async initAIIntegration(): Promise<void> {
    // 1. Load catalog & hardware
    await modelManager.loadCatalog();
    const hw = await modelManager.detectHardware();
    await modelManager.refreshInstalledModels();
    await this.refreshStorageUI();

    // Sync conversations list
    chatManager.onConversationsChanged = () => {
      this.renderChatList();
    };

    // Populate hardware badge (Image H)
    const hwText = this.slotExpanded.querySelector("#hw-telemetry-text");
    if (hwText) {
      hwText.textContent = `Your PC: ${(hw.total_ram_mb / 1024).toFixed(0)} GB RAM, ${hw.cpu_cores} cores`;
    }

    // Populate recommendation card (Image H)
    const rec = modelManager.getRecommendedModel();
    if (rec) {
      this.currentDownloadingModelId = rec.id;
      const recBadge = this.slotExpanded.querySelector("#onboard-rec-badge");
      const recName = this.slotExpanded.querySelector("#onboard-rec-name");
      const recDesc = this.slotExpanded.querySelector("#onboard-rec-desc");
      if (recBadge) recBadge.textContent = `Recommended: ${rec.tier.toUpperCase()} model ${rec.size_human}`;
      if (recName) recName.textContent = rec.name;
      if (recDesc) recDesc.textContent = rec.description;
    }

    // Populate onboarding select
    this.populateModelSelects();

    // Check if onboarding is needed
    const installed = modelManager.getInstalledModels();
    if (installed.length === 0) {
      this.switchSubView("onboarding");
    } else {
      this.switchSubView("chat");
    }

    this.updateModelBadge();

    // Listen to messages changed
    chatManager.onMessagesChanged = (messages) => {
      this.renderMessages(messages);
      this.updateCardDimensions();
    };

    // Listen to streaming delta
    chatManager.onStreamDelta = (_delta, _full) => {
      this.renderMessages(chatManager.getMessages());
      this.scrollToBottom();
    };

    // Listen to AI state
    let prevAiState = "idle";
    chatManager.onStateChanged = (state) => {
      if (state === "streaming" || state === "thinking") {
        this.sendBtnEl.style.display = "none";
        this.stopBtnEl.style.display = "flex";
      } else {
        this.sendBtnEl.style.display = "flex";
        this.stopBtnEl.style.display = "none";

        // Milestone 7: Speak assistant answer if TTS is enabled
        if (prevAiState === "streaming" && state === "idle") {
          const msgs = chatManager.getMessages();
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.role === "assistant" && lastMsg.content) {
            voiceManager.speak(lastMsg.content);
          }
        }
      }
      prevAiState = state;
    };

    // Milestone 7: Enriched System Tray Action listeners
    appBridge.listenToEvent<string>("tray-action", (action) => {
      if (action === "start-pomodoro") {
        timerEngine.startPomodoro({ focusDurationSec: 25 * 60 }, "Focus Session");
        eventBus.emit("island:request-state", "timer");
        eventBus.emit("pet:say", { text: "25-minute Pomodoro started!" });
      } else if (action === "stop-timer") {
        timerEngine.reset();
        eventBus.emit("pet:say", { text: "Timer stopped." });
      } else if (action === "toggle-quiet") {
        const curQuiet = moodManager.isQuietMode();
        moodManager.setQuietMode(!curQuiet);
        eventBus.emit("pet:say", { text: !curQuiet ? "Quiet mode enabled." : "Quiet mode disabled." });
      }
    });

    // Listen to download progress
    modelManager.onDownloadProgress = (prog: DownloadProgress) => {
      this.handleDownloadProgress(prog);
    };

    // Listen to installed models change
    modelManager.onInstalledModelsChanged = () => {
      this.populateModelSelects();
      this.updateModelBadge();
    };

    // Listen to tool approval requests
    eventBus.on("island:tool_approval_opened", (approval: PendingToolApproval) => {
      this.showToolApproval(approval);
    });

    eventBus.on("island:tool_approval_dismissed", () => {
      toolExecutor.resolveCurrentApproval("deny");
    });

    // Load initial conversation
    chatManager.loadConversations();
  }

  private showToolApproval(approval: PendingToolApproval): void {
    const titleEl = this.slotToolApproval.querySelector("#tool-approval-title");
    const descEl = this.slotToolApproval.querySelector("#tool-approval-desc");
    const actionsEl = this.slotToolApproval.querySelector("#tool-approval-actions");

    if (titleEl) {
      titleEl.textContent =
        approval.risk === "modify"
          ? "Move file to Recycle Bin?"
          : `Allow Mintu to open ${approval.toolName === "open_app" ? "app" : "URL"}?`;
    }

    if (descEl) {
      descEl.textContent = approval.paramsSummary;
      (descEl as HTMLElement).title = approval.paramsSummary;
    }

    if (actionsEl) {
      actionsEl.innerHTML = "";
      if (approval.risk === "modify") {
        // ALWAYS emphasize Deny as primary default, NO always allow
        const denyBtn = document.createElement("button");
        denyBtn.className = "btn-tool-deny primary";
        denyBtn.textContent = "Deny";
        denyBtn.onclick = (e) => {
          e.stopPropagation();
          activityManager.remove("tool_approval");
          approval.resolve("deny");
          eventBus.emit("island:request-state", "idle");
        };

        const allowOnceBtn = document.createElement("button");
        allowOnceBtn.className = "btn-tool-allow";
        allowOnceBtn.textContent = "Allow once";
        allowOnceBtn.onclick = (e) => {
          e.stopPropagation();
          activityManager.remove("tool_approval");
          approval.resolve("allow_once");
          eventBus.emit("island:request-state", "idle");
        };

        actionsEl.appendChild(denyBtn);
        actionsEl.appendChild(allowOnceBtn);
      } else {
        const allowOnceBtn = document.createElement("button");
        allowOnceBtn.className = "btn-tool-allow";
        allowOnceBtn.textContent = "Allow once";
        allowOnceBtn.onclick = (e) => {
          e.stopPropagation();
          activityManager.remove("tool_approval");
          approval.resolve("allow_once");
          eventBus.emit("island:request-state", "idle");
        };

        const alwaysBtn = document.createElement("button");
        alwaysBtn.className = "btn-tool-always";
        alwaysBtn.textContent = "Always allow";
        alwaysBtn.onclick = (e) => {
          e.stopPropagation();
          activityManager.remove("tool_approval");
          approval.resolve("always_allow");
          eventBus.emit("island:request-state", "idle");
        };

        const denyBtn = document.createElement("button");
        denyBtn.className = "btn-tool-deny";
        denyBtn.textContent = "Deny";
        denyBtn.onclick = (e) => {
          e.stopPropagation();
          activityManager.remove("tool_approval");
          approval.resolve("deny");
          eventBus.emit("island:request-state", "idle");
        };

        actionsEl.appendChild(denyBtn);
        actionsEl.appendChild(alwaysBtn);
        actionsEl.appendChild(allowOnceBtn);
      }
    }

    activityManager.push({
      id: "tool_approval",
      type: "tool_approval",
      islandState: "tool-approval",
      petState: approval.risk === "modify" ? "curious" : "think",
    });
  }

  public showCloudConsent(providerId: string, onResolve?: (allowed: boolean) => void): void {
    const config = CLOUD_PROVIDERS[providerId];
    const provName = config ? config.name : providerId;

    const titleEl = this.slotCloudConsent.querySelector("#cloud-consent-title");
    const descEl = this.slotCloudConsent.querySelector("#cloud-consent-desc");

    if (titleEl) titleEl.textContent = `Use ${provName}?`;
    if (descEl) descEl.textContent = `Mintu will send your prompts to ${provName} servers over HTTPS.`;

    const denyBtn = this.slotCloudConsent.querySelector("#btn-cloud-consent-deny") as HTMLButtonElement;
    const allowBtn = this.slotCloudConsent.querySelector("#btn-cloud-consent-allow") as HTMLButtonElement;

    if (denyBtn) {
      denyBtn.onclick = (e) => {
        e.stopPropagation();
        cloudProviderManager.setConsent(providerId, false);
        cloudProviderManager.setActiveProviderId("local");
        activityManager.remove("cloud_consent");
        eventBus.emit("island:request-state", "idle");
        onResolve?.(false);
      };
    }

    if (allowBtn) {
      allowBtn.onclick = (e) => {
        e.stopPropagation();
        cloudProviderManager.setConsent(providerId, true);
        cloudProviderManager.setActiveProviderId(providerId);
        activityManager.remove("cloud_consent");
        eventBus.emit("island:request-state", "idle");
        onResolve?.(true);
      };
    }

    activityManager.push({
      id: "cloud_consent",
      type: "consent_card",
      islandState: "cloud-consent",
      petState: "curious",
    });
  }

  private populateModelSelects(): void {
    const catalog = modelManager.getCatalog();
    const installed = modelManager.getInstalledModels();
    const rec = modelManager.getRecommendedModel();

    // Onboarding select
    const onboardSelect = this.slotExpanded.querySelector("#onboard-model-select") as HTMLSelectElement;
    const metaNote = this.slotExpanded.querySelector("#onboard-model-meta") as HTMLElement;

    if (onboardSelect) {
      onboardSelect.innerHTML = "";
      catalog.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.id;
        const isRec = rec && rec.id === item.id ? " (Recommended)" : "";
        opt.textContent = `${item.name} [${item.tier.toUpperCase()}] - ${item.size_human}${isRec}`;
        if (rec && rec.id === item.id) opt.selected = true;
        onboardSelect.appendChild(opt);
      });

      const updateMeta = () => {
        const cur = catalog.find((m) => m.id === onboardSelect.value);
        if (cur) {
          this.currentDownloadingModelId = cur.id;
          if (metaNote) metaNote.textContent = `${cur.description} • Languages: ${cur.languages_note}`;
          const recBadge = this.slotExpanded.querySelector("#onboard-rec-badge");
          const recName = this.slotExpanded.querySelector("#onboard-rec-name");
          const recDesc = this.slotExpanded.querySelector("#onboard-rec-desc");
          const dlBtn = this.slotExpanded.querySelector("#btn-start-download");
          const isInstalled = modelManager.isModelInstalled(cur.id);
          if (dlBtn) dlBtn.textContent = isInstalled ? "Activate Model" : "Download & Start";
          if (recBadge) recBadge.textContent = isInstalled ? `Installed: ${cur.name}` : `Selected: ${cur.tier.toUpperCase()} model ${cur.size_human}`;
          if (recName) recName.textContent = cur.name;
          if (recDesc) recDesc.textContent = cur.description;
        }
      };
      onboardSelect.onchange = updateMeta;
      updateMeta();
    }

    // Settings select
    const settingsSelect = this.slotExpanded.querySelector("#settings-active-model") as HTMLSelectElement;
    if (settingsSelect) {
      settingsSelect.innerHTML = "";
      if (installed.length === 0) {
        const opt = document.createElement("option");
        opt.value = "mock";
        opt.textContent = "Mock AI (No models installed)";
        settingsSelect.appendChild(opt);
      } else {
        installed.forEach((inst) => {
          const opt = document.createElement("option");
          opt.value = inst.id;
          opt.textContent = `${inst.id} (${(inst.size_bytes / (1024 * 1024)).toFixed(0)} MB)`;
          if (inst.id === modelManager.getActiveModelId()) opt.selected = true;
          settingsSelect.appendChild(opt);
        });
      }
    }

    // Installed models list with Delete buttons
    const listEl = this.slotExpanded.querySelector("#settings-models-list");
    if (listEl) {
      listEl.innerHTML = "";
      if (installed.length === 0) {
        listEl.innerHTML = `<div class="empty-hint">No models downloaded yet.</div>`;
      } else {
        installed.forEach((m) => {
          const row = document.createElement("div");
          row.className = "model-item-row";
          row.innerHTML = `
            <div class="model-item-info">
              <span class="model-item-name">${m.id}</span>
              <span class="model-item-size">${(m.size_bytes / (1024 * 1024)).toFixed(0)} MB</span>
            </div>
            <button class="btn-delete-model" data-id="${m.id}" title="Delete model">Delete</button>
          `;
          const delBtn = row.querySelector(".btn-delete-model") as HTMLButtonElement;
          delBtn?.addEventListener("click", async () => {
            if (confirm(`Delete ${m.id} from disk?`)) {
              await modelManager.deleteModel(m.id);
            }
          });
          listEl.appendChild(row);
        });
      }
    }
  }

  public async refreshStorageUI(): Promise<void> {
    try {
      const currentDir = await modelManager.getModelsDir();
      const hw = await modelManager.detectHardware();
      const disks = await modelManager.getAvailableDisks();

      const freeGb = (hw.free_disk_mb / 1024).toFixed(1);
      const isLowSpace = hw.free_disk_mb < 3000;

      // Update Onboarding card
      const onboardInput = this.slotExpanded.querySelector("#onboard-storage-path-input") as HTMLInputElement;
      const onboardBadge = this.slotExpanded.querySelector("#onboard-storage-free-badge") as HTMLElement;
      const onboardDrives = this.slotExpanded.querySelector("#onboard-quick-drives") as HTMLElement;

      if (onboardInput) onboardInput.value = currentDir;
      if (onboardBadge) {
        onboardBadge.textContent = `${freeGb} GB free`;
        onboardBadge.style.color = isLowSpace ? "#F87171" : "#34D399";
      }
      if (onboardDrives) {
        onboardDrives.innerHTML = "";
        disks.forEach((disk) => {
          const btn = document.createElement("button");
          btn.className = "btn-small-action";
          const dFreeGb = (disk.free_mb / 1024).toFixed(0);
          btn.textContent = `${disk.drive_letter} (${dFreeGb} GB free)`;
          btn.style.fontSize = "10.5px";
          btn.style.padding = "2px 8px";
          btn.style.height = "22px";
          btn.style.whiteSpace = "nowrap";

          const currentUpper = currentDir.toUpperCase();
          const driveUpper = disk.drive_letter.toUpperCase().replace(/\\$/, "");
          const isCurrent = currentUpper.startsWith(driveUpper);

          if (isCurrent) {
            btn.style.borderColor = "#34D399";
            btn.style.color = "#34D399";
            btn.style.fontWeight = "600";
            btn.title = "Current target storage drive";
          } else if (disk.free_mb > 10000) {
            btn.style.borderColor = "rgba(52, 211, 153, 0.4)";
            btn.title = "Click to switch download storage to this drive";
          } else {
            btn.style.opacity = "0.6";
            btn.title = "Low free space on this drive";
          }

          btn.addEventListener("click", async () => {
            const newPath = `${disk.drive_letter.replace(/\\$/, "")}\\Mintu-Models`;
            await modelManager.setModelsDir(newPath, false);
            await this.refreshStorageUI();
            eventBus.emit("pet:say", { text: `Target drive set to ${disk.drive_letter} (${dFreeGb} GB free)` });
          });
          onboardDrives.appendChild(btn);
        });
      }

      // Update Settings card
      const settingsInput = this.slotExpanded.querySelector("#settings-storage-path-input") as HTMLInputElement;
      const settingsBadge = this.slotExpanded.querySelector("#settings-storage-free-badge") as HTMLElement;
      const settingsDrives = this.slotExpanded.querySelector("#settings-quick-drives") as HTMLElement;

      if (settingsInput && document.activeElement !== settingsInput) {
        settingsInput.value = currentDir;
      }
      if (settingsBadge) {
        settingsBadge.textContent = `${freeGb} GB free`;
        settingsBadge.style.color = isLowSpace ? "#F87171" : "#34D399";
      }
      if (settingsDrives) {
        settingsDrives.innerHTML = "";
        disks.forEach((disk) => {
          const btn = document.createElement("button");
          btn.className = "btn-small-action";
          const dFreeGb = (disk.free_mb / 1024).toFixed(0);
          btn.textContent = `${disk.drive_letter} (${dFreeGb} GB free)`;
          btn.style.fontSize = "10.5px";
          btn.style.padding = "2px 8px";
          btn.style.height = "22px";
          btn.style.whiteSpace = "nowrap";

          const currentUpper = currentDir.toUpperCase();
          const driveUpper = disk.drive_letter.toUpperCase().replace(/\\$/, "");
          const isCurrent = currentUpper.startsWith(driveUpper);

          if (isCurrent) {
            btn.style.borderColor = "#34D399";
            btn.style.color = "#34D399";
            btn.style.fontWeight = "600";
            btn.title = "Current target storage drive";
          }

          btn.addEventListener("click", async () => {
            const newPath = `${disk.drive_letter.replace(/\\$/, "")}\\Mintu-Models`;
            if (settingsInput) settingsInput.value = newPath;
            const moveCheck = this.slotExpanded.querySelector("#settings-storage-move-existing") as HTMLInputElement;
            await modelManager.setModelsDir(newPath, moveCheck ? moveCheck.checked : false);
            await this.refreshStorageUI();
            this.populateModelSelects();
            eventBus.emit("pet:say", { text: `Storage moved to ${disk.drive_letter} (${dFreeGb} GB free)!` });
          });
          settingsDrives.appendChild(btn);
        });
      }
    } catch (e) {
      console.warn("[IslandContent] Failed to refresh storage UI", e);
    }
  }

  private handleDownloadProgress(prog: DownloadProgress): void {
    const cardCheck = this.slotExpanded.querySelector("#onboarding-card-check") as HTMLElement;
    const cardDl = this.slotExpanded.querySelector("#onboarding-card-downloading") as HTMLElement;
    const fill = this.slotExpanded.querySelector("#onboard-large-progress-fill") as HTMLElement;
    const pctInside = this.slotExpanded.querySelector("#onboard-progress-pct-inside") as HTMLElement;
    const telemetry = this.slotExpanded.querySelector("#onboard-dl-telemetry") as HTMLElement;
    const pauseBtn = this.slotExpanded.querySelector("#btn-pause-download") as HTMLButtonElement;
    const dot = this.slotCollapsed.querySelector("#collapsed-status-dot") as HTMLElement;
    const ring = this.slotCollapsed.querySelector("#collapsed-progress-ring") as HTMLElement;
    const ringBar = this.slotCollapsed.querySelector("#collapsed-ring-bar") as HTMLElement;

    if (prog.status === "downloading") {
      if (cardCheck) cardCheck.style.display = "none";
      if (cardDl) cardDl.style.display = "flex";
      if (pauseBtn) pauseBtn.textContent = "Pause";

      const percent = prog.total_bytes > 0 ? (prog.downloaded_bytes / prog.total_bytes) * 100 : 0;
      const pctClamped = Math.min(100, Math.max(0, percent));

      if (fill) fill.style.width = `${Math.max(6, pctClamped).toFixed(1)}%`;
      if (pctInside) pctInside.textContent = `${Math.round(pctClamped)}%`;

      if (telemetry) {
        telemetry.textContent = `${this.formatBytes(prog.downloaded_bytes)} of ${this.formatBytes(prog.total_bytes)} · ${this.formatSpeed(prog.speed_bps)} · ${this.formatEta(prog.eta_seconds)}`;
      }

      // Update Collapsed Pill Ring
      if (dot) dot.style.display = "none";
      if (ring) ring.style.display = "block";
      if (ringBar) {
        const offset = 56.54 * (1 - pctClamped / 100);
        ringBar.style.strokeDashoffset = offset.toFixed(2);
      }
    } else if (prog.status === "verifying") {
      if (telemetry) telemetry.textContent = "Verifying checksum (SHA-256)...";
      if (fill) fill.style.width = "100%";
      if (pctInside) pctInside.textContent = "100%";
    } else if (prog.status === "completed") {
      this.resetDownloadProgressUi();
      eventBus.emit("pet:say", { text: "Model ready! Let's chat!" });
      eventBus.emit("pet:action", { type: "state", payload: "happy" });
      setTimeout(() => {
        this.switchSubView("chat");
      }, 1000);
    } else if (prog.status === "paused") {
      if (pauseBtn) pauseBtn.textContent = "Resume";
      if (telemetry) {
        telemetry.textContent = `Paused (${this.formatBytes(prog.downloaded_bytes)} downloaded)`;
      }
    } else if (prog.status === "cancelled") {
      this.resetDownloadProgressUi();
    } else if (prog.status === "error") {
      this.showDownloadError(prog.error || "The file did not pass verification. It was removed. Retry?");
    }
  }

  private resetDownloadProgressUi(): void {
    const cardCheck = this.slotExpanded.querySelector("#onboarding-card-check") as HTMLElement;
    const cardDl = this.slotExpanded.querySelector("#onboarding-card-downloading") as HTMLElement;
    const errorBox = this.slotExpanded.querySelector("#onboard-dl-error-box") as HTMLElement;
    const progressTrack = this.slotExpanded.querySelector(".onboard-large-progress-track") as HTMLElement;
    const telemetry = this.slotExpanded.querySelector("#onboard-dl-telemetry") as HTMLElement;
    const buttons = this.slotExpanded.querySelector("#onboard-dl-buttons") as HTMLElement;

    if (cardCheck) cardCheck.style.display = "flex";
    if (cardDl) cardDl.style.display = "none";
    if (errorBox) errorBox.style.display = "none";
    if (progressTrack) progressTrack.style.display = "block";
    if (telemetry) telemetry.style.display = "block";
    if (buttons) buttons.style.display = "flex";

    const dot = this.slotCollapsed.querySelector("#collapsed-status-dot") as HTMLElement;
    const ring = this.slotCollapsed.querySelector("#collapsed-progress-ring") as HTMLElement;
    if (dot) dot.style.display = "block";
    if (ring) ring.style.display = "none";
  }

  private showDownloadError(errorMsg: string): void {
    const cardCheck = this.slotExpanded.querySelector("#onboarding-card-check") as HTMLElement;
    const cardDl = this.slotExpanded.querySelector("#onboarding-card-downloading") as HTMLElement;
    const errorBox = this.slotExpanded.querySelector("#onboard-dl-error-box") as HTMLElement;
    const errorMsgEl = this.slotExpanded.querySelector("#onboard-error-msg") as HTMLElement;
    const progressTrack = this.slotExpanded.querySelector(".onboard-large-progress-track") as HTMLElement;
    const telemetry = this.slotExpanded.querySelector("#onboard-dl-telemetry") as HTMLElement;
    const buttons = this.slotExpanded.querySelector("#onboard-dl-buttons") as HTMLElement;

    if (cardCheck) cardCheck.style.display = "none";
    if (cardDl) cardDl.style.display = "flex";
    if (progressTrack) progressTrack.style.display = "none";
    if (telemetry) telemetry.style.display = "none";
    if (buttons) buttons.style.display = "none";

    if (errorBox) errorBox.style.display = "flex";
    if (errorMsgEl) {
      errorMsgEl.textContent =
        errorMsg.includes("verification") || errorMsg.includes("Checksum") || errorMsg.includes("magic")
          ? "The file did not pass verification. It was removed. Retry?"
          : errorMsg;
    }

    eventBus.emit("pet:action", { type: "state", payload: "alert" });
    eventBus.emit("pet:say", { text: "The file did not pass verification. It was removed. Retry?" });
  }

  private formatBytes(bytes: number): string {
    if (bytes <= 0) return "0 MB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  private formatSpeed(bps: number): string {
    const mbps = bps / (1024 * 1024);
    return `${mbps.toFixed(1)} MB/s`;
  }

  private formatEta(seconds: number): string {
    if (!seconds || seconds <= 0) return "-- left";
    if (seconds < 60) return `${seconds}s left`;
    const mins = Math.ceil(seconds / 60);
    return `${mins} min left`;
  }

  private updateModelBadge(): void {
    const badge = this.slotExpanded.querySelector("#mintu-model-tag") as HTMLElement;
    if (!badge) return;

    if (chatManager.isDevMockActive()) {
      badge.className = "expanded-model-badge local";
      badge.innerHTML = `<span style="width: 5px; height: 5px; border-radius: 50%; background: #A8E8D5; display: inline-block;"></span><span>Mock AI · Dev</span>`;
      badge.title = "Mock AI (Developer Provider)";
      return;
    }

    const cloudProv = cloudProviderManager.getActiveProviderId();
    if (cloudProv !== "local") {
      const provConfig = CLOUD_PROVIDERS[cloudProv];
      const modelName = cloudProviderManager.getModel(cloudProv) || "Cloud";
      const shortModel = modelName.includes("flash")
        ? "flash"
        : modelName.includes("pro")
        ? "pro"
        : modelName.length > 12
        ? modelName.slice(0, 10) + "..."
        : modelName;
      const provShort = provConfig?.name?.split(" ")[0] || cloudProv;
      badge.className = "expanded-model-badge cloud";
      badge.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
        </svg>
        <span>${provShort} · ${shortModel}</span>
      `;
      badge.title = `${provConfig?.name || cloudProv} (${modelName}) - Cloud Provider`;
      return;
    }

    const active = modelManager.getActiveModelId();
    const isInstalled = active ? modelManager.isModelInstalled(active) : false;
    badge.className = "expanded-model-badge local";
    if (active && isInstalled) {
      const cleanName = active.replace("qwen2.5-", "Qwen ").replace("-instruct-q4_k_m.gguf", "").replace("-instruct-q4_0.gguf", "");
      badge.innerHTML = `
        <span style="width: 5px; height: 5px; border-radius: 50%; background: #A8E8D5; display: inline-block;"></span>
        <span>Local · ${cleanName}</span>
      `;
      badge.title = `${cleanName} (Local on-device GGUF)`;
    } else {
      badge.innerHTML = `
        <span style="width: 5px; height: 5px; border-radius: 50%; background: #9ca3af; display: inline-block;"></span>
        <span>No model · Local</span>
      `;
      badge.title = "No model installed - Click to choose or download";
    }
  }

  private toggleModelSwitcherPopover(): void {
    const popover = this.slotExpanded.querySelector("#model-switcher-popover") as HTMLElement;
    if (!popover) return;

    if (popover.classList.contains("open")) {
      popover.classList.remove("open");
      return;
    }

    const currentProv = cloudProviderManager.getActiveProviderId();
    const activeLocal = modelManager.getActiveModelId();
    const installed = modelManager.getInstalledModels();

    const localModels = [
      { id: "qwen2.5-0.5b-instruct-q4_k_m.gguf", name: "Qwen 2.5 0.5B", tag: "Fast · 400MB" },
      { id: "qwen2.5-1.5b-instruct-q4_k_m.gguf", name: "Qwen 2.5 1.5B", tag: "Balanced · 1GB" },
      { id: "qwen2.5-3b-instruct-q4_k_m.gguf", name: "Qwen 2.5 3B", tag: "Smart · 2GB" },
      { id: "qwen2.5-7b-instruct-q4_k_m.gguf", name: "Qwen 2.5 7B", tag: "Capable · 4.7GB" },
    ];

    const cloudEntries = [
      { id: "gemini", name: "Google Gemini", model: "gemini-2.0-flash" },
      { id: "openai", name: "OpenAI", model: "gpt-4o-mini" },
      { id: "anthropic", name: "Anthropic Claude", model: "claude-3-5-sonnet-latest" },
      { id: "groq", name: "Groq", model: "llama-3.3-70b-versatile" },
    ];

    popover.innerHTML = `
      <div class="popover-section">
        <div class="popover-section-title">On this computer</div>
        ${localModels
          .map((m) => {
            const isInst = installed.some((x) => x.id === m.id);
            const isAct = currentProv === "local" && activeLocal === m.id;
            return `
              <div class="popover-item ${isAct ? 'active' : ''}" data-type="local" data-model="${m.id}">
                <div class="popover-item-name">
                  <span style="width: 5px; height: 5px; border-radius: 50%; background: ${isInst ? '#10B981' : '#6b7280'}; display: inline-block;"></span>
                  <span>${m.name}</span>
                </div>
                <span class="popover-item-status ${isInst ? '' : 'warning'}">${isInst ? 'Ready' : 'Download'}</span>
              </div>
            `;
          })
          .join("")}
      </div>

      <div class="popover-section">
        <div class="popover-section-title">Cloud</div>
        ${cloudEntries
          .map((c) => {
            const isAct = currentProv === c.id;
            const hasKey = cloudProviderManager.hasApiKey(c.id);
            return `
              <div class="popover-item ${isAct ? 'active' : ''}" data-type="cloud" data-provider="${c.id}">
                <div class="popover-item-name">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                  </svg>
                  <span>${c.name}</span>
                </div>
                <span class="popover-item-status ${hasKey ? '' : 'warning'}">${hasKey ? 'Ready' : 'Needs Key'}</span>
              </div>
            `;
          })
          .join("")}
        <div class="popover-cloud-note">Messages are sent to the selected cloud provider</div>
      </div>

      <button class="popover-settings-link" id="btn-popover-open-settings">
        Configure providers in Settings →
      </button>
    `;

    popover.querySelectorAll(".popover-item").forEach((item) => {
      item.addEventListener("click", () => {
        const type = (item as HTMLElement).dataset.type;
        if (type === "local") {
          const modId = (item as HTMLElement).dataset.model!;
          cloudProviderManager.setActiveProviderId("local");
          modelManager.setActiveModelId(modId);
          chatManager.setConversationModel(modId);
        } else {
          const provId = (item as HTMLElement).dataset.provider!;
          cloudProviderManager.setActiveProviderId(provId);
          chatManager.setConversationModel(provId);
        }
        popover.classList.remove("open");
        this.updateModelBadge();
      });
    });

    popover.querySelector("#btn-popover-open-settings")?.addEventListener("click", () => {
      popover.classList.remove("open");
      this.switchSubView("settings");
    });

    popover.classList.add("open");
  }

  private switchSubView(view: "chat" | "onboarding" | "settings"): void {
    this.expandedSubView = view;
    const subviews = this.slotExpanded.querySelectorAll(".expanded-subview");
    subviews.forEach((sv) => sv.classList.remove("active"));

    const target = this.slotExpanded.querySelector(`.subview-${view}`);
    if (target) target.classList.add("active");

    if (view === "settings") {
      this.populateModelSelects();
      this.refreshStorageUI();
      const promptInput = this.slotExpanded.querySelector("#settings-system-prompt") as HTMLTextAreaElement;
      if (promptInput) promptInput.value = chatManager.getSystemPrompt();

      const outsideSelect = this.slotExpanded.querySelector("#settings-outside-behavior") as HTMLSelectElement;
      if (outsideSelect) {
        outsideSelect.value = localStorage.getItem("mintu_outside_behavior") || "empty-pill";
      }

      const blocklistInput = this.slotExpanded.querySelector("#settings-privacy-blocklist") as HTMLTextAreaElement;
      if (blocklistInput) {
        const defaultBlocklist = "1password.exe, bitwarden.exe, keepass.exe, keepassxc.exe, lastpass.exe, authy.exe, dashlane.exe, nordpass.exe, enpass.exe";
        blocklistInput.value = localStorage.getItem("mintu_privacy_blocklist") ?? defaultBlocklist;
      }

      const walkWindowsSelect = this.slotExpanded.querySelector("#settings-walk-windows") as HTMLSelectElement;
      if (walkWindowsSelect) {
        walkWindowsSelect.value = localStorage.getItem("mintu_walk_windows") || "on";
      }

      const windowIgnoreInput = this.slotExpanded.querySelector("#settings-window-ignore-list") as HTMLTextAreaElement;
      if (windowIgnoreInput) {
        windowIgnoreInput.value = localStorage.getItem("mintu_window_ignore_list") || "";
      }

      const devPanelSelect = this.slotExpanded.querySelector("#settings-dev-panel") as HTMLSelectElement;
      if (devPanelSelect) {
        const saved = localStorage.getItem("mintu_dev_panel");
        const isDev = saved !== null ? saved === "true" : Boolean((import.meta as any).env?.DEV);
        devPanelSelect.value = isDev ? "on" : "off";
      }

      // Populate Cloud Provider settings
      const cloudProviderSelect = this.slotExpanded.querySelector("#settings-cloud-provider") as HTMLSelectElement;
      if (cloudProviderSelect) {
        cloudProviderSelect.value = cloudProviderManager.getActiveProviderId();
        const cloudKeySection = this.slotExpanded.querySelector("#settings-cloud-key-section") as HTMLElement;
        const cloudKeyInput = this.slotExpanded.querySelector("#settings-cloud-key-input") as HTMLInputElement;
        const keyStatusHint = this.slotExpanded.querySelector("#settings-key-status-hint") as HTMLElement;

        const cloudModelSection = this.slotExpanded.querySelector("#settings-cloud-model-section") as HTMLElement;
        const cloudModelInput = this.slotExpanded.querySelector("#settings-cloud-model-input") as HTMLInputElement;
        const cloudUrlSection = this.slotExpanded.querySelector("#settings-cloud-url-section") as HTMLElement;
        const cloudUrlInput = this.slotExpanded.querySelector("#settings-cloud-url-input") as HTMLInputElement;
        const modelHint = this.slotExpanded.querySelector("#settings-model-hint") as HTMLElement;
        const urlHint = this.slotExpanded.querySelector("#settings-url-hint") as HTMLElement;

        const prov = cloudProviderSelect.value;
        if (prov === "local") {
          if (cloudKeySection) cloudKeySection.style.display = "none";
          if (cloudModelSection) cloudModelSection.style.display = "none";
          if (cloudUrlSection) cloudUrlSection.style.display = "none";
        } else {
          if (cloudKeySection) cloudKeySection.style.display = "block";
          if (cloudModelSection) cloudModelSection.style.display = "block";
          if (cloudUrlSection) cloudUrlSection.style.display = "block";

          const config = CLOUD_PROVIDERS[prov];
          if (cloudModelInput) {
            cloudModelInput.value = cloudProviderManager.getModel(prov);
          }
          if (cloudUrlInput) {
            cloudUrlInput.value = cloudProviderManager.getBaseUrl(prov);
          }
          if (modelHint && config) {
            modelHint.textContent = `Default: ${config.defaultModel}. Supported: ${config.models.join(", ")}`;
          }
          if (urlHint && config) {
            urlHint.textContent = config.docUrl
              ? `Default: ${config.baseUrl} (Docs: ${config.docUrl})`
              : `Default: ${config.baseUrl}`;
          }

          cloudProviderManager.getKeyStatus(prov).then((st) => {
            if (st.has_key && st.masked) {
              if (cloudKeyInput) cloudKeyInput.placeholder = `Configured: ${st.masked}`;
              if (keyStatusHint) keyStatusHint.textContent = `Stored in Windows Credential Manager: ${st.masked}`;
            } else {
              if (cloudKeyInput) cloudKeyInput.placeholder = "Enter API key...";
              if (keyStatusHint) keyStatusHint.textContent = "No API key stored in Windows Credential Manager.";
            }
          });
        }
      }

      const neverCloudCheck = this.slotExpanded.querySelector("#settings-never-cloud-context") as HTMLInputElement;
      if (neverCloudCheck) {
        neverCloudCheck.checked = cloudProviderManager.getNeverCloudForContextCaptures();
      }

      // Populate Always-Allowed Tools
      const allowedTools = toolExecutor.getAllowedToolsList();
      const allowedToolsEl = this.slotExpanded.querySelector("#settings-allowed-tools-list");
      if (allowedToolsEl) {
        if (allowedTools.length === 0) {
          allowedToolsEl.innerHTML = "<em>No tools always allowed. Mintu will ask each time.</em>";
        } else {
          allowedToolsEl.innerHTML = allowedTools
            .map(
              (t) => `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span>${t}</span>
              <button class="btn-small-action danger btn-revoke-tool" data-tool="${t}">Revoke</button>
            </div>
          `
            )
            .join("");
          allowedToolsEl.querySelectorAll(".btn-revoke-tool").forEach((btn) => {
            btn.addEventListener("click", () => {
              const t = (btn as HTMLElement).dataset.tool;
              if (t) {
                toolExecutor.setAlwaysAllowed(t, false);
                this.switchSubView("settings");
              }
            });
          });
        }
      }

      // Populate Reminders
      const remindersListEl = this.slotExpanded.querySelector("#settings-reminders-list");
      if (remindersListEl) {
        (async () => {
          try {
            const { invoke } = await import("@tauri-apps/api/core");
            const list = await invoke<any[]>("db_list_reminders");
            if (!list || list.length === 0) {
              remindersListEl.innerHTML = "<em>No scheduled reminders.</em>";
            } else {
              remindersListEl.innerHTML = list
                .map(
                  (r) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 2px 0;">
                  <div>
                    <span style="font-weight: 600;">${r.text}</span>
                    <span style="opacity: 0.65; font-size: 10px; margin-left: 6px;">${new Date(
                      r.due_time
                    ).toLocaleTimeString()} (${r.status})</span>
                  </div>
                  <button class="btn-small-action danger btn-del-rem" data-id="${r.id}">✕</button>
                </div>
              `
                )
                .join("");
              remindersListEl.querySelectorAll(".btn-del-rem").forEach((btn) => {
                btn.addEventListener("click", async () => {
                  const id = Number((btn as HTMLElement).dataset.id);
                  await invoke("db_delete_reminder", { id });
                  this.switchSubView("settings");
                });
              });
            }
          } catch {}
        })();
      }

      // Populate Memory & Mood settings (Milestone 5)
      const memoryEnabledSelect = this.slotExpanded.querySelector("#settings-memory-enabled") as HTMLSelectElement;
      if (memoryEnabledSelect) {
        memoryEnabledSelect.value = memoryManager.isMemoryEnabled() ? "on" : "off";
      }

      const moodEnabledSelect = this.slotExpanded.querySelector("#settings-mood-enabled") as HTMLSelectElement;
      if (moodEnabledSelect) {
        moodEnabledSelect.value = moodManager.isMoodEnabled() ? "on" : "off";
      }

      const quietModeSelect = this.slotExpanded.querySelector("#settings-quiet-mode") as HTMLSelectElement;
      if (quietModeSelect) {
        quietModeSelect.value = moodManager.isQuietMode() ? "on" : "off";
      }

      this.renderMemorySettingsList();

      // Populate Module & Focus settings (Milestone 6)
      const modTimerSelect = this.slotExpanded.querySelector("#settings-module-timer") as HTMLSelectElement;
      if (modTimerSelect) {
        modTimerSelect.value = moduleRegistry.isModuleEnabled("timer") ? "on" : "off";
      }

      const modStatusSelect = this.slotExpanded.querySelector("#settings-module-status") as HTMLSelectElement;
      if (modStatusSelect) {
        modStatusSelect.value = moduleRegistry.isModuleEnabled("status") ? "on" : "off";
      }

      const reduceMotionSelect = this.slotExpanded.querySelector("#settings-reduce-motion") as HTMLSelectElement;
      if (reduceMotionSelect) {
        reduceMotionSelect.value = moduleRegistry.getReduceMotionSetting();
      }

      const focusHistoryList = this.slotExpanded.querySelector("#settings-focus-history-list");
      if (focusHistoryList) {
        const history = timerEngine.getFocusHistory("all");
        if (history.length === 0) {
          focusHistoryList.innerHTML = "<em>No completed focus sessions yet.</em>";
        } else {
          focusHistoryList.innerHTML = history
            .slice(0, 10)
            .map(
              (h) => `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; padding: 2px 0;">
              <div>
                <span style="font-weight: 600; color: #10B981;">${h.label || "Focus Session"}</span>
                <span style="opacity: 0.65; font-size: 10px; margin-left: 6px;">${Math.round(h.durationSec / 60)} min · ${new Date(h.timestamp).toLocaleDateString()}</span>
              </div>
              <span style="font-size: 9.5px; opacity: 0.7;">${h.phase}</span>
            </div>
          `
            )
            .join("");
        }
      }

      // Milestone 7: Populate Windows Auto-Start
      appBridge.getAutostart().then((enabled) => {
        const autostartCheck = this.slotExpanded.querySelector("#settings-autostart-toggle") as HTMLInputElement;
        if (autostartCheck) autostartCheck.checked = enabled;
      });

      // Milestone 7: Populate Voice settings
      const voiceCfg = voiceManager.getConfig();
      const ttsCheck = this.slotExpanded.querySelector("#settings-tts-toggle") as HTMLInputElement;
      if (ttsCheck) ttsCheck.checked = voiceCfg.ttsEnabled;
      const sttLangSelect = this.slotExpanded.querySelector("#settings-stt-language") as HTMLSelectElement;
      if (sttLangSelect) sttLangSelect.value = voiceCfg.sttLanguage;
    }

    if (view === "onboarding") {
      this.populateModelSelects();
      this.refreshStorageUI();
    }

    this.updateCardDimensions();
  }

  private updateCardDimensions(): void {
    if (!this.onRequestResize) return;

    if (this.expandedSubView === "onboarding") {
      this.onRequestResize(450, 530);
    } else if (this.expandedSubView === "settings") {
      this.onRequestResize(450, 480);
    } else {
      const hasMsgs = chatManager.getMessages().length > 0;
      if (hasMsgs) {
        this.onRequestResize(440, 440);
      } else {
        // Image B initial empty card size
        this.onRequestResize(360, 260);
      }
    }
  }

  private renderMessages(messages: any[]): void {
    if (!this.chatMessagesEl) return;

    if (messages.length === 0) {
      this.greetingRowEl.style.display = "block";
      this.chipsRowEl.style.display = "flex";
      this.chatMessagesEl.innerHTML = "";
      return;
    }

    // Hide greeting and chips once messages start
    this.greetingRowEl.style.display = "none";
    this.chipsRowEl.style.display = "none";

    this.chatMessagesEl.innerHTML = "";
    messages.forEach((msg, idx) => {
      const bubble = document.createElement("div");
      bubble.className = `mintu-chat-bubble bubble-${msg.role}`;
      bubble.dataset.msgId = msg.id;

      // Parse versions
      let versionsArr: string[] = [];
      try {
        if (msg.versions) {
          versionsArr = JSON.parse(msg.versions);
        }
      } catch {}
      if (!Array.isArray(versionsArr) || versionsArr.length === 0) {
        versionsArr = [msg.content];
      }

      const currentVer = msg.version_index || 1;
      const totalVers = versionsArr.length;

      let versionBarHtml = "";
      if (totalVers > 1) {
        versionBarHtml = `
          <div class="msg-version-bar">
            <button class="msg-version-btn btn-ver-prev" data-id="${msg.id}" title="Previous version">‹</button>
            <span class="version-label">Version ${currentVer} / ${totalVers}</span>
            <button class="msg-version-btn btn-ver-next" data-id="${msg.id}" title="Next version">›</button>
          </div>
        `;
      }

      if (msg.role === "assistant") {
        const renderedHtml = MarkdownRenderer.render(msg.content);
        let toolChipsHtml = "";
        if (msg.tool_calls) {
          try {
            const chips = JSON.parse(msg.tool_calls);
            if (Array.isArray(chips) && chips.length > 0) {
              toolChipsHtml = `
                <div class="bubble-tool-chips">
                  ${chips
                    .map(
                      (c: any) => `
                    <div class="mintu-tool-chip ${c.status || "executed"}" title="${c.error || c.summary || ""}">
                      <span class="tool-chip-icon">${c.status === "executed" ? "✓" : c.status === "denied" ? "✕" : "!"}</span>
                      <span class="tool-chip-label">Mintu checked:</span>
                      <span class="tool-chip-text">${c.summary || c.name}</span>
                    </div>
                  `
                    )
                    .join("")}
                </div>
              `;
            }
          } catch {}
        }

        // Assistant provider and model footer tag (0.2)
        const currentProv = cloudProviderManager.getActiveProviderId();
        const isCloud = currentProv !== "local";
        let modelLabel = "";
        if (isCloud) {
          const cfg = CLOUD_PROVIDERS[currentProv];
          const mod = cloudProviderManager.getModel(currentProv) || "Cloud";
          modelLabel = `${cfg?.name?.split(" ")[0] || currentProv} · ${mod}`;
        } else {
          const act = modelManager.getActiveModelId();
          const clean = act ? act.replace("qwen2.5-", "Qwen ").replace("-instruct-q4_k_m.gguf", "").replace("-instruct-q4_0.gguf", "") : "No model";
          modelLabel = `Local · ${clean}`;
        }

        const tagIcon = isCloud
          ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`
          : `<span style="width: 5px; height: 5px; border-radius: 50%; background: #A8E8D5; display: inline-block;"></span>`;

        bubble.innerHTML = `
          <div class="bubble-header">
            <span class="bubble-name">Mintu</span>
            <div class="msg-actions-row" style="margin-top: 0; opacity: 1; pointer-events: auto;">
              <button class="msg-action-btn btn-copy-msg" title="Copy message" aria-label="Copy message" tabindex="0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
              ${
                idx === messages.length - 1
                  ? `<button class="msg-action-btn btn-regen-last" title="Regenerate" aria-label="Regenerate" tabindex="0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    </button>`
                  : ""
              }
              <button class="msg-action-btn btn-remember-msg" data-id="${msg.id}" title="Remember this" aria-label="Remember this" tabindex="0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              </button>
            </div>
          </div>
          ${toolChipsHtml}
          <div class="bubble-body">${renderedHtml || '<span class="thinking-dots">...</span>'}</div>
          ${versionBarHtml}
          <div class="remember-chip-slot"></div>
          <div class="assistant-model-tag ${isCloud ? "cloud" : "local"}">
            ${tagIcon}
            <span>${modelLabel}</span>
          </div>
        `;

        const copyAsstBtn = bubble.querySelector(".btn-copy-msg");
        copyAsstBtn?.addEventListener("click", () => {
          navigator.clipboard.writeText(msg.content);
        });

        const regenBtn = bubble.querySelector(".btn-regen-last");
        regenBtn?.addEventListener("click", () => {
          chatManager.regenerateLast();
        });

        const rememberBtn = bubble.querySelector(".btn-remember-msg");
        rememberBtn?.addEventListener("click", () => {
          const slot = bubble.querySelector(".remember-chip-slot") as HTMLElement;
          if (!slot) return;
          const snippet = msg.content.length > 50 ? msg.content.slice(0, 50) + "..." : msg.content;
          slot.innerHTML = `
            <div class="remember-confirm-chip">
              <span>Save: "${snippet}"?</span>
              <button class="btn-small-action btn-confirm-remember" style="padding: 1px 6px; font-size: 10px;">Save</button>
              <button class="btn-small-action danger btn-cancel-remember" style="padding: 1px 6px; font-size: 10px;">✕</button>
            </div>
          `;
          slot.querySelector(".btn-cancel-remember")?.addEventListener("click", () => {
            slot.innerHTML = "";
          });
          slot.querySelector(".btn-confirm-remember")?.addEventListener("click", async () => {
            await memoryManager.addMemory("fact", msg.content, "user_remember");
            slot.innerHTML = `
              <div class="remember-confirm-chip" style="background: rgba(16, 185, 129, 0.25);">
                <span>Saved to memory ✓</span>
              </div>
            `;
            eventBus.emit("pet:say", { text: "Saved to memory!" });
            eventBus.emit("pet:action", { type: "state", payload: "happy" });
            setTimeout(() => {
              slot.innerHTML = "";
            }, 3000);
          });
        });
      } else if (msg.role === "user") {
        bubble.innerHTML = `
          <div class="bubble-body">${msg.content}</div>
          <div class="msg-actions-row">
            <button class="msg-action-btn btn-edit-msg" title="Edit message" aria-label="Edit message" tabindex="0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="msg-action-btn btn-copy-msg" title="Copy message" aria-label="Copy message" tabindex="0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="msg-action-btn btn-remember-user-msg" title="Remember this" aria-label="Remember this" tabindex="0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            </button>
          </div>
          ${versionBarHtml}
          <div class="remember-chip-slot"></div>
        `;

        const copyUserBtn = bubble.querySelector(".btn-copy-msg");
        copyUserBtn?.addEventListener("click", () => {
          navigator.clipboard.writeText(msg.content);
        });

        const editBtn = bubble.querySelector(".btn-edit-msg");
        editBtn?.addEventListener("click", () => {
          bubble.innerHTML = `
            <div class="msg-inline-editor">
              <textarea class="msg-inline-textarea" aria-label="Edit message">${msg.content}</textarea>
              <div class="msg-inline-actions">
                <button class="btn-inline-cancel">Cancel</button>
                <button class="btn-inline-save">Save and send</button>
              </div>
            </div>
          `;
          const ta = bubble.querySelector(".msg-inline-textarea") as HTMLTextAreaElement;
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
          ta.style.height = "auto";
          ta.style.height = `${Math.min(220, ta.scrollHeight)}px`;
          ta.addEventListener("input", () => {
            ta.style.height = "auto";
            ta.style.height = `${Math.min(220, ta.scrollHeight)}px`;
          });

          const doSave = () => {
            const val = ta.value.trim();
            if (val && val !== msg.content) {
              chatManager.editMessageAndResend(msg.id, val);
            } else {
              this.renderMessages(chatManager.getMessages());
            }
          };

          const doCancel = () => {
            this.renderMessages(chatManager.getMessages());
          };

          bubble.querySelector(".btn-inline-save")?.addEventListener("click", doSave);
          bubble.querySelector(".btn-inline-cancel")?.addEventListener("click", doCancel);

          ta.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              doSave();
            } else if (e.key === "Escape") {
              e.preventDefault();
              doCancel();
            }
          });
        });

        const rememberUserBtn = bubble.querySelector(".btn-remember-user-msg");
        rememberUserBtn?.addEventListener("click", () => {
          const slot = bubble.querySelector(".remember-chip-slot") as HTMLElement;
          if (!slot) return;
          const snippet = msg.content.length > 50 ? msg.content.slice(0, 50) + "..." : msg.content;
          slot.innerHTML = `
            <div class="remember-confirm-chip">
              <span>Save: "${snippet}"?</span>
              <button class="btn-small-action btn-confirm-remember" style="padding: 1px 6px; font-size: 10px;">Save</button>
              <button class="btn-small-action danger btn-cancel-remember" style="padding: 1px 6px; font-size: 10px;">✕</button>
            </div>
          `;
          slot.querySelector(".btn-cancel-remember")?.addEventListener("click", () => {
            slot.innerHTML = "";
          });
          slot.querySelector(".btn-confirm-remember")?.addEventListener("click", async () => {
            await memoryManager.addMemory("fact", msg.content, "user_remember");
            slot.innerHTML = `
              <div class="remember-confirm-chip" style="background: rgba(16, 185, 129, 0.25);">
                <span>Saved to memory ✓</span>
              </div>
            `;
            eventBus.emit("pet:say", { text: "Saved to memory!" });
            eventBus.emit("pet:action", { type: "state", payload: "happy" });
            setTimeout(() => {
              slot.innerHTML = "";
            }, 3000);
          });
        });
      }

      // Version switcher buttons
      bubble.querySelector(".btn-ver-prev")?.addEventListener("click", (e) => {
        e.stopPropagation();
        chatManager.switchMessageVersion(msg.id, "prev");
      });
      bubble.querySelector(".btn-ver-next")?.addEventListener("click", (e) => {
        e.stopPropagation();
        chatManager.switchMessageVersion(msg.id, "next");
      });

      this.chatMessagesEl.appendChild(bubble);
    });

    this.scrollToBottom();
  }

  // ==========================================
  // Milestone 5: Chat Drawer & Memory List UI
  // ==========================================

  private toggleChatDrawer(): void {
    const drawer = this.slotExpanded.querySelector("#chat-drawer");
    if (!drawer) return;
    if (drawer.classList.contains("open")) {
      this.closeChatDrawer();
    } else {
      this.openChatDrawer();
    }
  }

  private openChatDrawer(): void {
    const drawer = this.slotExpanded.querySelector("#chat-drawer");
    if (!drawer) return;
    drawer.classList.add("open");
    const searchInput = this.slotExpanded.querySelector("#chat-search-input") as HTMLInputElement;
    if (searchInput) {
      searchInput.value = "";
      setTimeout(() => searchInput.focus(), 100);
    }
    this.renderChatList();
  }

  private closeChatDrawer(): void {
    const drawer = this.slotExpanded.querySelector("#chat-drawer");
    if (drawer) drawer.classList.remove("open");
  }

  private async renderChatList(filterQuery?: string): Promise<void> {
    const listEl = this.slotExpanded.querySelector("#chat-items-scroll");
    if (!listEl) return;

    let convs: Array<any> = [];
    const q = filterQuery?.trim();

    if (q) {
      const searchResults = await chatManager.searchChats(q);
      const allConvs = chatManager.getConversations();
      convs = searchResults.map((sr) => {
        const found = allConvs.find((c) => c.id === sr.conversation_id);
        return {
          id: sr.conversation_id,
          title: sr.title,
          model: found?.model || "local",
          pinned: found?.pinned || 0,
          updated_at: found?.updated_at || Date.now(),
          snippet: sr.snippet,
        };
      });
      if (convs.length === 0) {
        listEl.innerHTML = `<div class="empty-hint" style="padding: 16px; text-align: center; color: #9ca3af; font-size: 11.5px;">No matches found for "${q}".</div>`;
        return;
      }
    } else {
      convs = chatManager.getConversations();
    }

    if (this.pendingDeleteChatId) {
      convs = convs.filter((c) => c.id !== this.pendingDeleteChatId);
    }

    if (convs.length === 0) {
      listEl.innerHTML = `<div class="empty-hint" style="padding: 16px; text-align: center; color: #9ca3af; font-size: 11.5px;">No conversations yet. Click "+" above to start one!</div>`;
      return;
    }

    const currentChat = chatManager.getCurrentConversation();

    listEl.innerHTML = "";
    convs.forEach((c) => {
      const isActive = currentChat?.id === c.id;
      const isStreaming = chatManager.isConversationStreaming(c.id);
      const row = document.createElement("div");
      row.className = `chat-item-row ${isActive ? "active" : ""}`;
      row.dataset.id = c.id;

      const dateStr = new Date(c.updated_at).toLocaleDateString([], { month: "short", day: "numeric" });
      const modelShort = (c.model || "Local").replace("qwen2.5-", "Qwen ");

      row.innerHTML = `
        <div class="chat-item-main">
          <div class="chat-item-title-row">
            ${c.pinned ? '<span class="chat-item-pin-badge">PIN</span>' : ""}
            <span class="chat-item-title" title="${c.title}">${c.title}</span>
            <span class="chat-item-model-badge">${modelShort}</span>
            ${isStreaming ? '<span class="streaming-indicator-dot" title="Generating in background..."></span>' : ""}
          </div>
          <div class="chat-item-preview">${c.snippet || dateStr}</div>
        </div>
        <div class="chat-item-actions">
          <button class="chat-mini-btn btn-pin" data-id="${c.id}" title="${c.pinned ? "Unpin" : "Pin"}">
            ${c.pinned ? "Unpin" : "Pin"}
          </button>
          <button class="chat-mini-btn btn-rename" data-id="${c.id}" title="Rename">✎</button>
          <button class="chat-mini-btn btn-dup" data-id="${c.id}" title="Duplicate">❐</button>
          <button class="chat-mini-btn delete btn-del" data-id="${c.id}" title="Delete">✕</button>
        </div>
      `;

      // Click to switch conversation
      row.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        if (target.closest(".chat-item-actions")) return;
        await chatManager.switchConversation(c.id);
        const restoredDraft = chatManager.getDraft(c.id);
        this.chatInputEl.value = restoredDraft;
        this.closeChatDrawer();
        this.chatInputEl.focus();
      });

      // Pin
      row.querySelector(".btn-pin")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await chatManager.pinConversation(c.id, !c.pinned);
        this.renderChatList(filterQuery);
      });

      // Rename
      row.querySelector(".btn-rename")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const newTitle = prompt("Rename chat title:", c.title);
        if (newTitle && newTitle.trim()) {
          await chatManager.renameConversation(c.id, newTitle.trim());
          this.renderChatList(filterQuery);
        }
      });

      // Duplicate
      row.querySelector(".btn-dup")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await chatManager.duplicateConversation(c.id);
        this.renderChatList(filterQuery);
        eventBus.emit("pet:say", { text: "Chat duplicated!" });
      });

      // Delete with 30s Undo
      row.querySelector(".btn-del")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`Delete conversation "${c.title}"?`)) {
          this.showUndoBanner(c.id, c.title);
          this.renderChatList(filterQuery);
        }
      });

      listEl.appendChild(row);
    });
  }

  private showUndoBanner(chatId: string, title: string): void {
    if (this.undoDeleteTimer) {
      clearInterval(this.undoDeleteTimer);
      if (this.pendingDeleteChatId) {
        chatManager.deleteConversation(this.pendingDeleteChatId);
      }
    }

    this.pendingDeleteChatId = chatId;
    let secondsLeft = 30;

    const banner = this.slotExpanded.querySelector("#chat-undo-banner") as HTMLElement;
    const textEl = this.slotExpanded.querySelector("#chat-undo-text");
    const secEl = this.slotExpanded.querySelector("#chat-undo-sec");

    if (textEl) textEl.textContent = `Deleted "${title}".`;
    if (secEl) secEl.textContent = String(secondsLeft);
    if (banner) banner.style.display = "flex";

    this.undoDeleteTimer = window.setInterval(async () => {
      secondsLeft--;
      if (secEl) secEl.textContent = String(secondsLeft);
      if (secondsLeft <= 0) {
        if (this.undoDeleteTimer) {
          clearInterval(this.undoDeleteTimer);
          this.undoDeleteTimer = null;
        }
        if (banner) banner.style.display = "none";
        if (this.pendingDeleteChatId === chatId) {
          this.pendingDeleteChatId = null;
          await chatManager.deleteConversation(chatId);
          this.renderChatList();
        }
      }
    }, 1000);
  }

  private async renderMemorySettingsList(): Promise<void> {
    const listEl = this.slotExpanded.querySelector("#settings-memories-list");
    if (!listEl) return;
    const memories = await memoryManager.refreshMemories();
    if (memories.length === 0) {
      listEl.innerHTML = "<em>No memories saved yet.</em>";
      return;
    }

    listEl.innerHTML = memories
      .map(
        (m) => `
      <div class="memory-entry-card" data-id="${m.id}">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span class="memory-kind-badge ${m.kind}">${m.kind}</span>
            ${m.pinned ? '<span style="font-size: 9.5px; color: #facc15; font-weight: 700;">PINNED</span>' : ""}
            <span style="opacity: 0.6; font-size: 10px;">${new Date(m.created_at).toLocaleDateString()}</span>
          </div>
          <div style="font-size: 11px; color: #f3f4f6; word-break: break-word;">${m.text}</div>
          <div style="font-size: 9.5px; opacity: 0.65; margin-top: 2px;">Source: ${m.source}</div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="btn-small-action btn-pin-mem" data-id="${m.id}" title="${m.pinned ? "Unpin" : "Pin"}">
            ${m.pinned ? "Unpin" : "Pin"}
          </button>
          <button class="btn-small-action danger btn-del-mem" data-id="${m.id}" title="Delete">
            ✕
          </button>
        </div>
      </div>
    `
      )
      .join("");

    listEl.querySelectorAll(".btn-pin-mem").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = (btn as HTMLElement).dataset.id;
        const mem = memories.find((m) => m.id === id);
        if (id && mem) {
          await memoryManager.pinMemory(id, !mem.pinned);
          this.renderMemorySettingsList();
        }
      });
    });

    listEl.querySelectorAll(".btn-del-mem").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = (btn as HTMLElement).dataset.id;
        if (id) {
          await memoryManager.deleteMemory(id);
          this.renderMemorySettingsList();
        }
      });
    });
  }

  private scrollToBottom(): void {
    const scrollArea = this.slotExpanded.querySelector(".chat-messages-scroll-area");
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }

  getPetAnchor(slotName: string): HTMLElement | null {
    switch (slotName) {
      case "collapsed":
        return this.slotCollapsed.querySelector(".slot-left-pet-anchor");
      case "idle":
      case "peek":
        return this.slotIdle.querySelector(".slot-left-pet-anchor");
      case "notification":
        return this.slotNotification.querySelector(".slot-left-pet-anchor");
      case "expanded":
        return this.slotExpanded.querySelector(".slot-left-pet-anchor");
      case "timer":
        return this.slotTimer.querySelector(".slot-left-pet-anchor");
      case "music":
        return this.slotMusic.querySelector(".slot-left-pet-anchor");
      case "consent":
        return this.slotConsent.querySelector(".slot-left-pet-anchor");
      case "context":
        return this.slotContext.querySelector(".slot-left-pet-anchor");
      case "blocked":
        return this.slotBlocked.querySelector(".slot-left-pet-anchor");
      case "answer-ready":
        return this.slotAnswerReady.querySelector(".slot-left-pet-anchor");
      case "reading":
        return this.slotReading.querySelector(".slot-left-pet-anchor");
      case "translate":
        return this.slotTranslate.querySelector(".slot-left-pet-anchor");
      case "tool-approval":
        return this.slotToolApproval.querySelector(".slot-left-pet-anchor");
      case "cloud-consent":
        return this.slotCloudConsent.querySelector(".slot-left-pet-anchor");
      default:
        return null;
    }
  }

  showSlot(name: string): void {
    this.currentSlotName = name;
    const slots = [
      this.slotCollapsed,
      this.slotIdle,
      this.slotNotification,
      this.slotExpanded,
      this.slotTimer,
      this.slotMusic,
      this.slotConsent,
      this.slotContext,
      this.slotBlocked,
      this.slotAnswerReady,
      this.slotReading,
      this.slotTranslate,
      this.slotToolApproval,
      this.slotCloudConsent,
    ];

    let target: HTMLElement;
    switch (name) {
      case "collapsed":
        target = this.slotCollapsed;
        break;
      case "empty-pill":
      case "docking":
        slots.forEach((s) => {
          s.classList.remove("active");
          s.classList.add("fade-out");
        });
        return;
      case "idle":
      case "peek":
        target = this.slotIdle;
        statusModule.renderCompact(this.slotIdle, {
          mintuInside: !document.body.classList.contains("mintu-outside"),
        });
        break;
      case "notification":
        target = this.slotNotification;
        break;
      case "expanded":
        target = this.slotExpanded;
        this.updateCardDimensions();
        // Focus input when expanding
        setTimeout(() => this.chatInputEl?.focus(), 150);
        break;
      case "timer":
        target = this.slotTimer;
        timerModule.renderCompact(this.slotTimer, {
          mintuInside: !document.body.classList.contains("mintu-outside"),
        });
        break;
      case "music":
        target = this.slotMusic;
        break;
      case "consent":
        target = this.slotConsent;
        break;
      case "context":
        target = this.slotContext;
        break;
      case "blocked":
        target = this.slotBlocked;
        break;
      case "answer-ready":
        target = this.slotAnswerReady;
        break;
      case "reading":
        target = this.slotReading;
        break;
      case "translate":
        target = this.slotTranslate;
        break;
      case "tool-approval":
        target = this.slotToolApproval;
        break;
      case "cloud-consent":
        target = this.slotCloudConsent;
        break;
      default:
        target = this.slotIdle;
    }

    slots.forEach((s) => {
      if (s === target) {
        s.classList.add("active");
        s.classList.remove("fade-out");
      } else {
        s.classList.remove("active");
        s.classList.add("fade-out");
      }
    });
  }

  setNotification(payload: NotificationPayload): void {
    this.currentNotification = payload;

    // Wake up pet if not in focus mode (Bug fix: sleeping Mintu behind notification)
    if (!timerEngine.isFocusModeActive()) {
      eventBus.emit("pet:action", { type: "state", payload: "alert" });
    }

    const isOutside = document.body.classList.contains("mintu-outside");
    const mode = isOutside ? "island-outside" : "island-inside";

    NotificationRow.render(this.slotNotification, payload, mode, {
      onDismiss: () => {
        activityManager.dismissCurrent();
        if (this.onRequestCollapse) this.onRequestCollapse();
      },
      onAction: async (actionId) => {
        eventBus.emit("island:notification-action", { actionId });
        if (actionId === "explain" || actionId === "fix") {
          this.chatInputEl.value = `${actionId === "fix" ? "Fix this issue: " : "Explain this notification: "} ${payload.title} - ${payload.text}`;
          this.switchSubView("chat");
          this.onRequestResize?.(440, 440);
          eventBus.emit("island:request-state", "expanded");
          activityManager.dismissCurrent();
          this.submitUserMessage();
          return;
        }
        if (actionId === "start_break" || actionId === "start_focus" || actionId === "add_5" || actionId === "skip") {
          timerModule.handleActionClick(actionId);
          return;
        }
        activityManager.dismissCurrent();
      },
      onClick: async () => {
        if (!this.currentNotification) return;

        if (this.currentNotification.target === "chat") {
          this.switchSubView("chat");
          this.onRequestResize?.(440, 440);
          eventBus.emit("island:request-state", "expanded");
          activityManager.dismissCurrent();
          return;
        }
        if (this.currentNotification.target === "model-settings") {
          this.switchSubView("settings");
          this.onRequestResize?.(440, 440);
          eventBus.emit("island:request-state", "expanded");
          activityManager.dismissCurrent();
          return;
        }
        if (this.currentNotification.target === "download-error") {
          this.switchSubView("onboarding");
          this.onRequestResize?.(440, 440);
          eventBus.emit("island:request-state", "expanded");
          activityManager.dismissCurrent();
          return;
        }

        const appName = this.currentNotification.appName || this.currentNotification.title;
        try {
          await appBridge.focusAppWindow(appName);
          activityManager.dismissCurrent();
          if (this.onRequestCollapse) this.onRequestCollapse();
        } catch {
          eventBus.emit("pet:action", { type: "state", payload: "alert" });
          eventBus.emit("pet:say", { text: `Couldn't open ${appName}` });
        }
      },
    });
  }

  private executeTranslation(targetLanguage: string): void {
    const streamWrap = this.slotTranslate.querySelector("#translate-result-wrap") as HTMLElement;
    const chipsRow = this.slotTranslate.querySelector("#translate-chips-row") as HTMLElement;
    const targetLabel = this.slotTranslate.querySelector("#translate-target-label") as HTMLElement;
    const streamContent = this.slotTranslate.querySelector("#translate-stream-content") as HTMLElement;
    const copyBtn = this.slotTranslate.querySelector("#btn-copy-trans") as HTMLButtonElement;

    if (chipsRow) chipsRow.style.display = "none";
    if (streamWrap) streamWrap.style.display = "flex";
    if (targetLabel) targetLabel.textContent = `${this.currentDetectedLang} → ${targetLanguage}`;
    if (streamContent) streamContent.textContent = "Translating...";
    if (copyBtn) copyBtn.textContent = "Copy";

    eventBus.emit("pet:action", { type: "lookAt", payload: { x: 0, y: 0.2 } });

    const prompt = CONTEXT_TEMPLATES.translate.promptBuilder(this.currentTranslationSourceText, targetLanguage);
    let fullOutput = "";

    const aiProvider = chatManager.getProvider();
    aiProvider.chatStream(
      [
        {
          role: "system",
          content: "You are an expert translator. Translate the text accurately into the requested language. Output only the translation without commentary.",
        },
        { role: "user", content: prompt },
      ],
      (chunk: string) => {
        fullOutput += chunk;
        if (streamContent) streamContent.textContent = fullOutput;
      },
      () => {
        if (!fullOutput && streamContent) {
          streamContent.textContent = "Translation finished.";
        }
      },
      (err: string) => {
        if (streamContent) streamContent.textContent = `Translation error: ${err}`;
      }
    );
  }

  private setupTranslateCard(text: string): void {
    this.currentTranslationSourceText = text;
    const detected = detectLanguage(text);
    this.currentDetectedLang = detected.name;

    const detectedLabel = this.slotTranslate.querySelector("#translate-detected-label");
    if (detectedLabel) {
      detectedLabel.textContent = `Detected: ${detected.name}${detected.isUncertain ? " (uncertain)" : ""}`;
    }

    const origTextEl = this.slotTranslate.querySelector("#translate-orig-text");
    if (origTextEl) {
      origTextEl.textContent = text;
    }

    const chipsRow = this.slotTranslate.querySelector("#translate-chips-row") as HTMLElement;
    const resultWrap = this.slotTranslate.querySelector("#translate-result-wrap") as HTMLElement;
    if (chipsRow) {
      chipsRow.style.display = "flex";
      const chips = chipsRow.querySelectorAll(".translate-chip");
      chips.forEach((c) => {
        c.classList.remove("slide-in");
        void (c as HTMLElement).offsetWidth;
        c.classList.add("slide-in");
      });
    }
    if (resultWrap) resultWrap.style.display = "none";

    // Mintu glances at the chips
    eventBus.emit("pet:action", { type: "lookAt", payload: { x: 0.25, y: 0.35 } });
  }

  private startTranslateFlow(text: string): void {
    activityManager.push({
      id: "reading",
      type: "reading",
      islandState: "reading",
      petState: "think",
    });

    setTimeout(() => {
      this.setupTranslateCard(text);
      activityManager.push({
        id: "translate",
        type: "translate_card",
        islandState: "translate",
        petState: "curious",
      });
    }, 600);
  }

  private async handleTranslateSelection(): Promise<void> {
    const ctx = await appBridge.captureContext();
    if (ctx?.app_info?.is_blocked) {
      const descEl = this.slotBlocked.querySelector("#blocked-app-desc");
      if (descEl) descEl.textContent = `${ctx.app_info.process_name || "This application"} is on your privacy blocklist`;
      activityManager.push({
        id: "blocked",
        type: "context_card",
        islandState: "blocked",
        petState: "alert",
        autoDismissMs: 4000,
      });
      return;
    }
    const text = ctx?.text?.trim() || "";
    if (!text) {
      eventBus.emit("pet:say", { text: "No text selected! Select words first." });
      return;
    }
    this.startTranslateFlow(text);
  }

  private startClock(): void {
    const update = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const mins = now.getMinutes().toString().padStart(2, "0");
      this.clockEl.textContent = `${hours}:${mins}`;
    };
    update();
    this.clockInterval = window.setInterval(update, 10000);
  }

  private startWaveformAnimation(): void {
    const bars = this.container.querySelectorAll(".wave-bar");
    const animate = () => {
      if (!this.isMusicPlaying) {
        // Paused state: calm flat bars
        bars.forEach((bar) => {
          (bar as HTMLElement).style.height = "3px";
        });
      } else {
        // Playing state: dynamic energetic frequency bars
        const t = performance.now() / 150;
        bars.forEach((bar, idx) => {
          const h = Math.abs(Math.sin(t + idx * 0.7)) * 14 + 3;
          (bar as HTMLElement).style.height = `${h}px`;
        });
      }
      this.waveformAnimId = requestAnimationFrame(animate);
    };
    this.waveformAnimId = requestAnimationFrame(animate);
  }

  destroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.waveformAnimId) cancelAnimationFrame(this.waveformAnimId);
  }
}

export function detectLanguage(text: string): { name: string; isUncertain: boolean } {
  const t = text.trim();
  if (!t) return { name: "Unknown", isUncertain: true };

  // Cyrillic script (Russian)
  if (/[\u0400-\u04FF]/.test(t)) {
    return { name: "Russian", isUncertain: false };
  }
  // Chinese / CJK
  if (/[\u4E00-\u9FFF]/.test(t)) {
    return { name: "Chinese", isUncertain: false };
  }
  // Azerbaijani specific letters or common words
  if (/[əƏ]/.test(t) || /\b(və|üçün|bir|olan|ilə|necə|bəli|xeyr|yaxşı|gözəl|çox)\b/i.test(t)) {
    return { name: "Azərbaycan", isUncertain: false };
  }
  // Turkish specific letters or common words
  if (/[ıİğĞşŞ]/.test(t) || /\b(ve|bir|bu|için|olan|ile|merhaba|evet|hayır|tamam|güzel)\b/i.test(t)) {
    return { name: "Türkçe", isUncertain: false };
  }
  // German specific letters or common words
  if (/[äöüßÄÖÜ]/.test(t) || /\b(und|der|die|das|nicht|ein|eine|ist|mit|für|deutsch|aber|wie)\b/i.test(t)) {
    return { name: "Deutsch", isUncertain: false };
  }
  // English common words
  if (/\b(the|and|is|in|to|of|that|it|with|as|for|this|are|on|be|have|from|you|we)\b/i.test(t)) {
    return { name: "English", isUncertain: false };
  }

  return { name: "English", isUncertain: true };
}
