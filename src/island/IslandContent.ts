/**
 * Mintu Dynamic Island Content (Pure Living Desktop Pet & Dynamic Island v0.2.4 — ZERO AI)
 * Features:
 * 1. 3-Tab Pet Hub (Pet | Tools | Settings)
 * 2. Pet Care (Energy/Happiness, Cookie, Mint Tea, Pat) + Daily Water Tracker + Catch Falling Star
 * 3. Quick Calc (Math & Currency/Unit), Focus Timer, Ambient Focus Sound Mixer, Mini To-Do & SQLite Reminders
 * 4. Notch File Shelf (Drag-and-Drop) + Clipboard History (Last 15, Ctrl+Shift+V) + Quick Note (Ctrl+Shift+N)
 * 5. Dynamic Island Live HUDs: Volume/Mute, Screen Brightness, USB/Audio Device Pop-up, Caps/Num Lock, Color Picker (Ctrl+Alt+C), Startup Greeting, Hourly Chime & Network Status
 * 6. Now Playing Pro (SMTC Album Art + Live Timeline + Controls)
 * 7. Custom Pet Name, 6 Built-in Pet Skins, Wardrobe, Optional Weather, Monitor Selector, Fullscreen Auto-Hide, Bongo-Cat Typing & 4-Language i18n
 */

import { moodManager } from "../pet/MoodManager";
import { petCareManager } from "../pet/PetCareManager";
import { skinLoader } from "../pet/skins/SkinLoader";
import { eventBus } from "../core/EventBus";
import { appBridge } from "../core/AppBridge";
import { activityManager } from "../core/ActivityManager";
import { NotificationRow } from "../ui/NotificationRow";
import { timerModule } from "../modules/timer/TimerModule";
import { timerEngine } from "../modules/timer/TimerEngine";
import { statusModule } from "../modules/status/StatusModule";
import { moduleRegistry } from "../modules/ModuleRegistry";
import { xpManager } from "../gamification/XPManager";
import { smartClipboard } from "../clipboard/SmartClipboard";
import { clipboardHistory } from "../clipboard/ClipboardHistory";
import { updateChecker } from "../updater/UpdateChecker";
import { soundEngine, AmbientSoundMode } from "../core/SoundEngine";
import { weatherService, WeatherSnapshot } from "../core/WeatherService";
import { tryEvaluateInline } from "../core/InlineEvaluator";
import { wellnessManager } from "../productivity/WellnessManager";
import { i18n, SupportedLanguage } from "../core/i18n";
import { dailyRecapManager } from "../productivity/DailyRecap";

export interface NotificationPayload {
  icon?: string;
  appIcon?: string;
  appName?: string;
  title: string;
  text: string;
  target?: string;
  actions?: Array<{ id: string; label: string; primary?: boolean }>;
}

interface ShelfFileItem {
  path: string;
  name: string;
  ext: string;
  addedAt: number;
}

const MEMO_STORAGE_KEY = "mintu_quick_memo_v1";
const SHELF_STORAGE_KEY = "mintu_notch_shelf_v1";
const MAX_SHELF_ITEMS = 12;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export class IslandContentRenderer {
  public readonly container: HTMLElement;

  // Core Slots
  private slotCollapsed!: HTMLElement;
  private slotIdle!: HTMLElement;
  private slotNotification!: HTMLElement;
  private slotExpanded!: HTMLElement;
  private slotTimer!: HTMLElement;
  private slotMusic!: HTMLElement;
  private slotMusicExpanded!: HTMLElement;
  private slotVolume!: HTMLElement;
  private slotHud!: HTMLElement;
  private slotShelf!: HTMLElement;
  private slotClipboard!: HTMLElement;
  private slotMemo!: HTMLElement;

  private memoTextarea!: HTMLTextAreaElement;
  private idleMusicWave!: HTMLElement;
  private idlePowerBadge!: HTMLElement;
  private idleWeatherBadge!: HTMLElement;
  private idleNetBadge!: HTMLElement;

  private currentNotification: NotificationPayload | null = null;
  private clockEl!: HTMLElement;
  private clockInterval: number | null = null;
  private waveformAnimId: number | null = null;
  private wellnessTimer: number | null = null;
  private batteryTimer: number | null = null;
  private weatherTimer: number | null = null;
  private networkTimer: number | null = null;
  private focusTickTimer: number | null = null;

  private isMusicPlaying: boolean = false;
  private mediaPositionMs: number = 0;
  private mediaDurationMs: number = 0;
  private mediaLastUpdateMs: number = 0;
  private lastVolumeState: { percent: number; muted: boolean } = { percent: 50, muted: false };
  private lastOnlineState: boolean | null = null;
  private lastChimeHour: number = -1;
  private lastWaterReminderAt: number = Date.now();
  private shelfFiles: ShelfFileItem[] = [];
  private isChasingCursor: boolean = false;
  private expandedSubView: "hub" | "tools" | "settings" = "hub";
  private currentSlotName: string = "idle";

  public onRequestResize?: (width: number, height: number) => void;
  public onRequestCollapse?: () => void;

  constructor() {
    this.container = document.createElement("div");
    this.container.className = "island-content-container";
    this.loadShelfFiles();
    this.initSlots();
    this.initModules();
    this.setupHandlers();
    this.initIPCListeners();
    this.applyUiTranslations(i18n.getLang());
    this.startClock();
    this.startWaveformAnimation();
    this.setupWellnessAndChimeTimers();
    this.setupBatteryCheck();
    this.setupWeatherPolling();
    this.setupNetworkMonitor();
    this.syncPetNameUI();
    this.updateLevelBadge();
    this.refreshPetCareUI();
    this.refreshWaterUI();
    this.renderTodosList();
    this.refreshRemindersList();
    this.renderSkinsPicker();
    this.renderWardrobe();
    this.renderShelfList();
    this.renderClipboardList();
    this.populateMonitorsDropdown();
    this.refreshDailyRecapUI();
    this.checkUpdatesSilently();
    this.scheduleStartupGreeting();
  }

  private initModules(): void {
    moduleRegistry.init({
      eventBus,
      activityManager,
      requestExpand: () => {
        this.switchSubView("hub");
        eventBus.emit("island:request-state", "expanded");
      },
      requestCollapse: () => {
        this.onRequestCollapse?.();
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
      this.syncHubTimerUI();
    });
  }

  private initSlots(): void {
    this.container.innerHTML = `
      <!-- SLOT 1: COLLAPSED -->
      <div class="island-slot slot-collapsed">
        <div class="slot-left-pet-anchor"></div>
        <div class="collapsed-status-wrap">
          <div class="collapsed-status-dot" id="collapsed-status-dot"></div>
        </div>
      </div>

      <!-- SLOT 2: IDLE -->
      <div class="island-slot slot-idle active">
        <div class="slot-left-pet-anchor"></div>
        <div class="idle-content-row">
          <div class="idle-clock">10:42</div>
          <div class="idle-weather-badge" id="idle-weather-badge" style="display: none;"></div>
          <div class="idle-net-badge" id="idle-net-badge" style="display: none;"></div>
          <div class="idle-music-wave" id="idle-music-wave" style="display: none;" title="Music playing">
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
          </div>
          <div class="idle-power-badge" id="idle-power-badge" style="display: none;" title="Battery"></div>
        </div>
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
              <div class="notif-title">Notification</div>
              <div class="notif-subtitle"></div>
            </div>
            <button class="notif-dismiss-btn" id="notif-dismiss-btn" title="Dismiss">✕</button>
          </div>
          <div class="notif-actions" style="display: none;"></div>
        </div>
      </div>

      <!-- SLOT 4: EXPANDED (3-TAB PET HUB: PET | TOOLS | SETTINGS) -->
      <div class="island-slot slot-expanded">
        <div class="expanded-top-bar">
          <div class="slot-left-pet-anchor expanded-pet"></div>
          <div class="expanded-header-info">
            <span class="expanded-pet-name" id="expanded-pet-name">Mintu</span>
            <span class="expanded-level-badge" id="mintu-level-badge" title="Level &amp; XP">Lvl 1 | 0 XP</span>
          </div>
          <div class="expanded-top-actions">
            <button class="icon-btn" id="btn-shelf-top" title="File Shelf">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span class="top-btn-badge" id="shelf-count-top" style="display: none;">0</span>
            </button>
            <button class="icon-btn" id="btn-clipboard-top" title="Clipboard History (Ctrl+Shift+V)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
            </button>
            <button class="icon-btn" id="btn-free-mode-top" title="Free Desktop Mode (Ctrl+Alt+M)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
            <button class="icon-btn" id="btn-quick-memo-top" title="Quick Note (Ctrl+Shift+N)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </button>
            <button class="icon-btn" id="btn-collapse-island" title="Collapse (Esc)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
            </button>
          </div>
        </div>

        <!-- 3-Tab Segmented Switcher -->
        <div class="hub-tab-bar">
          <button class="hub-tab-btn active" data-tab="hub" id="tab-btn-pet">Pet</button>
          <button class="hub-tab-btn" data-tab="tools" id="tab-btn-tools">Tools</button>
          <button class="hub-tab-btn" data-tab="settings" id="tab-btn-settings">Settings</button>
        </div>

        <!-- TAB 1: PET COMPANION -->
        <div class="expanded-subview subview-hub active" id="subview-hub">
          <div class="mintu-update-banner" id="mintu-update-banner" style="display: none;">
            <span id="mintu-update-text">New Mintu version available!</span>
            <button class="btn-update-action" id="btn-mintu-update-open">Update</button>
            <button class="btn-update-close" id="btn-mintu-update-close">✕</button>
          </div>

          <div class="smart-clipboard-pill" id="smart-clipboard-pill" style="display: none;">
            <div class="smart-clip-content">
              <span class="smart-clip-badge" id="smart-clip-badge">JSON</span>
              <span class="smart-clip-text" id="smart-clip-text">Format copied JSON</span>
            </div>
            <button class="smart-clip-action-btn" id="btn-smart-clip-format">Format</button>
            <button class="smart-clip-close-btn" id="btn-smart-clip-close">✕</button>
          </div>

          <!-- Pet Care Meters + Feed/Tea/Pat -->
          <div class="pet-hub-card" id="hub-care-card">
            <div class="care-meters-row">
              <div class="care-meter">
                <div class="care-meter-head">
                  <span id="lbl-care-energy">Energy</span>
                  <span id="care-energy-val">84%</span>
                </div>
                <div class="care-meter-track">
                  <div class="care-meter-fill energy" id="care-energy-fill" style="width: 84%;"></div>
                </div>
              </div>
              <div class="care-meter">
                <div class="care-meter-head">
                  <span id="lbl-care-happy">Happiness</span>
                  <span id="care-happy-val">88%</span>
                </div>
                <div class="care-meter-track">
                  <div class="care-meter-fill happy" id="care-happy-fill" style="width: 88%;"></div>
                </div>
              </div>
            </div>
            <div class="care-actions-row">
              <button class="pet-hub-chip care-btn" id="btn-care-cookie">Cookie</button>
              <button class="pet-hub-chip care-btn" id="btn-care-tea">Mint Tea</button>
              <button class="pet-hub-chip care-btn" id="btn-pet-pat">Pat (+5 XP)</button>
            </div>
          </div>

          <!-- Daily Water Intake & Star Collection -->
          <div class="pet-hub-card" id="hub-water-card">
            <div class="pet-hub-card-row">
              <div style="flex: 1; min-width: 0;">
                <div class="care-meter-head" style="margin-bottom: 4px;">
                  <span id="lbl-water-title">Daily Water</span>
                  <span id="water-count-val">0 / 8</span>
                </div>
                <div class="care-meter-track">
                  <div class="care-meter-fill water" id="water-progress-fill" style="width: 0%;"></div>
                </div>
              </div>
              <button class="pet-hub-btn primary" id="btn-water-drink">+1 Glass</button>
            </div>
          </div>

          <!-- Interactive Pet Actions -->
          <div class="pet-hub-actions-grid">
            <button class="pet-hub-action" id="btn-pet-chase">Chase Cursor</button>
            <button class="pet-hub-action" id="btn-pet-star">Drop Star</button>
            <button class="pet-hub-action" id="btn-pet-dance">Dance</button>
            <button class="pet-hub-action" id="btn-pet-sleep">Sleep</button>
            <button class="pet-hub-action" id="btn-pet-free">Desktop Mode</button>
            <button class="pet-hub-action" id="btn-pet-color">Color Picker</button>
          </div>

          <!-- Mini Music Preview inside Hub -->
          <div class="pet-hub-card clickable-card" id="hub-music-card" style="display: none;">
            <div class="pet-hub-card-row">
              <div class="pet-hub-music-meta">
                <div class="pet-hub-card-label" id="lbl-hub-now-playing">Now Playing</div>
                <div class="pet-hub-music-title" id="hub-music-title">Not Playing</div>
                <div class="pet-hub-music-artist" id="hub-music-artist">--</div>
              </div>
              <div class="pet-hub-btn-group">
                <button class="pet-hub-btn" id="hub-music-prev" title="Previous">‹</button>
                <button class="pet-hub-btn primary" id="hub-music-play" title="Play/Pause">▶</button>
                <button class="pet-hub-btn" id="hub-music-next" title="Next">›</button>
              </div>
            </div>
          </div>

          <!-- Daily Progress Recap -->
          <div class="pet-hub-stats-bar four-col">
            <div class="pet-hub-stat">
              <span class="pet-hub-stat-val" id="recap-focus-val">0m</span>
              <span class="pet-hub-stat-lbl" id="lbl-stat-focus">Focus</span>
            </div>
            <div class="pet-hub-stat">
              <span class="pet-hub-stat-val" id="recap-xp-val">0</span>
              <span class="pet-hub-stat-lbl" id="lbl-stat-xp">XP Today</span>
            </div>
            <div class="pet-hub-stat">
              <span class="pet-hub-stat-val" id="recap-stars-val">0</span>
              <span class="pet-hub-stat-lbl" id="lbl-stat-stars">Stars</span>
            </div>
            <div class="pet-hub-stat">
              <span class="pet-hub-stat-val" id="recap-streak-val">1d</span>
              <span class="pet-hub-stat-lbl" id="lbl-stat-streak">Streak</span>
            </div>
          </div>
        </div>

        <!-- TAB 2: PRODUCTIVITY & FOCUS TOOLS -->
        <div class="expanded-subview subview-tools" id="subview-tools">
          <!-- Quick Calculator & Unit/Currency Converter -->
          <div class="pet-hub-card">
            <div class="quick-calc-row">
              <input type="text" id="quick-calc-input" class="settings-input" placeholder="Calc: 450*18, 50 usd to azn" />
              <button class="pet-hub-btn primary" id="quick-calc-result" style="display: none;"></button>
            </div>
          </div>

          <!-- Focus Timer Card -->
          <div class="pet-hub-card" id="hub-focus-card">
            <div class="pet-hub-card-row">
              <div>
                <div class="pet-hub-card-label" id="hub-timer-label">Focus Timer</div>
                <div class="pet-hub-timer-digits" id="focus-timer-digits">25:00</div>
              </div>
              <div class="pet-hub-btn-group">
                <button class="pet-hub-btn primary" id="btn-focus-timer-toggle-run">Start</button>
                <button class="pet-hub-btn" id="btn-focus-timer-reset">Reset</button>
              </div>
            </div>
            <div class="pet-hub-presets">
              <button class="pet-hub-chip" data-timer-min="5">5m</button>
              <button class="pet-hub-chip" data-timer-min="15">15m</button>
              <button class="pet-hub-chip" data-timer-min="25">25m</button>
              <button class="pet-hub-chip" data-timer-min="45">45m</button>
            </div>
          </div>

          <!-- Ambient Focus Sound Mixer -->
          <div class="pet-hub-card" id="hub-ambient-card">
            <div class="ambient-header-row">
              <span class="pet-hub-card-label" id="lbl-ambient-title">Focus Sounds</span>
              <input type="range" id="ambient-volume-slider" class="ambient-slider" min="5" max="100" value="45" />
            </div>
            <div class="pet-hub-presets ambient-pills">
              <button class="pet-hub-chip active" data-ambient-mode="off" id="btn-amb-off">Off</button>
              <button class="pet-hub-chip" data-ambient-mode="rain" id="btn-amb-rain">Rain</button>
              <button class="pet-hub-chip" data-ambient-mode="fireplace" id="btn-amb-fire">Fireplace</button>
              <button class="pet-hub-chip" data-ambient-mode="brown-noise" id="btn-amb-brown">Brown</button>
              <button class="pet-hub-chip" data-ambient-mode="white-noise" id="btn-amb-white">White</button>
            </div>
          </div>

          <!-- Mini Daily To-Do Checklist & Timed Reminders -->
          <div class="pet-hub-card">
            <div class="pet-hub-card-label" id="lbl-todos-title">Daily Tasks</div>
            <div class="quick-calc-row">
              <input type="text" id="todo-input" class="settings-input" placeholder="Add a quick task..." />
              <button class="pet-hub-btn primary" id="btn-todo-add">Add</button>
            </div>
            <div class="mini-list" id="todo-list"></div>

            <div class="pet-hub-card-label" id="lbl-reminders-title" style="margin-top: 4px;">Reminder</div>
            <div class="quick-calc-row">
              <input type="text" id="reminder-input" class="settings-input" placeholder="Remind me to..." />
              <select id="reminder-minutes" class="settings-select" style="width: 64px;">
                <option value="5">5m</option>
                <option value="15" selected>15m</option>
                <option value="30">30m</option>
                <option value="60">60m</option>
              </select>
              <button class="pet-hub-btn primary" id="btn-reminder-add">Set</button>
            </div>
            <div class="mini-list" id="reminder-list"></div>
          </div>

          <!-- Quick Drawers Row -->
          <div class="pet-hub-actions-grid">
            <button class="pet-hub-action" id="btn-tools-shelf">File Shelf</button>
            <button class="pet-hub-action" id="btn-tools-clipboard">Clipboard</button>
            <button class="pet-hub-action" id="btn-tools-tip">Daily Tip</button>
          </div>
        </div>

        <!-- TAB 3: SETTINGS, NAME, SKINS & WARDROBE -->
        <div class="expanded-subview subview-settings" id="subview-settings">
          <div class="settings-scroll-area">
            <!-- Custom Pet Name -->
            <div class="settings-section-card">
              <div class="settings-card-title" id="lbl-pet-name">Pet Name</div>
              <div class="weather-city-row">
                <input type="text" id="setting-pet-name" class="settings-input" maxlength="18" value="Mintu" />
                <button class="pet-hub-btn primary" id="btn-pet-name-save">Save</button>
              </div>
            </div>

            <!-- 6 Built-in Pet Skins Switcher -->
            <div class="settings-section-card">
              <div class="settings-card-title" id="lbl-skins-title">Pet Skins</div>
              <div class="skins-picker-grid" id="skins-picker-grid"></div>
            </div>

            <!-- Level Progress & Wardrobe Accessories -->
            <div class="settings-section-card">
              <div class="settings-xp-header">
                <span id="settings-xp-level-title" style="font-weight: 600;">Level 1 Mintu</span>
                <span id="settings-xp-points-badge" style="font-size: 11px; opacity: 0.8;">0 XP</span>
              </div>
              <div class="settings-xp-track">
                <div class="settings-xp-fill" id="settings-xp-progress-bar" style="width: 0%;"></div>
              </div>
              <div id="settings-xp-hint" style="font-size: 11px; opacity: 0.7; margin-top: 2px;"></div>
              <div class="wardrobe-grid" id="wardrobe-items-grid" style="margin-top: 6px;"></div>
            </div>

            <!-- Weather & Atmosphere -->
            <div class="settings-section-card">
              <div class="settings-row">
                <label for="setting-weather-toggle" id="lbl-setting-weather">Live Weather in Pill</label>
                <input type="checkbox" id="setting-weather-toggle" />
              </div>
              <div class="weather-city-row">
                <input type="text" id="setting-weather-city" class="settings-input" placeholder="City (e.g. Baku)" />
                <button class="pet-hub-btn primary" id="btn-weather-save">Update</button>
              </div>
              <div class="settings-row">
                <label for="setting-water-interval" id="lbl-setting-water-int">Water Reminder (min)</label>
                <select id="setting-water-interval" class="settings-select">
                  <option value="0">Off</option>
                  <option value="20">20m</option>
                  <option value="30">30m</option>
                  <option value="45">45m</option>
                  <option value="60">60m</option>
                </select>
              </div>
              <div class="settings-row">
                <label for="setting-eye-break" id="lbl-setting-eyebreak">20-20-20 Eye Break</label>
                <input type="checkbox" id="setting-eye-break" checked />
              </div>
              <div class="settings-row">
                <label for="setting-hourly-chime" id="lbl-setting-chime">Gentle Hourly Chime</label>
                <input type="checkbox" id="setting-hourly-chime" />
              </div>
            </div>

            <!-- Core & Display Preferences -->
            <div class="settings-section-card">
              <div class="settings-row">
                <label for="setting-language" id="lbl-setting-lang">Language</label>
                <select id="setting-language" class="settings-select">
                  <option value="az">Azərbaycan</option>
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                  <option value="ru">Русский</option>
                </select>
              </div>

              <div class="settings-row">
                <label for="setting-monitor" id="lbl-setting-monitor">Active Monitor</label>
                <select id="setting-monitor" class="settings-select"></select>
              </div>

              <div class="settings-row">
                <label for="setting-bongo-typing" id="lbl-setting-bongo">Bongo-Cat Typing Reaction</label>
                <input type="checkbox" id="setting-bongo-typing" checked />
              </div>

              <div class="settings-row">
                <label for="setting-fullscreen-hide" id="lbl-setting-fullscreen">Auto-Hide in Fullscreen</label>
                <input type="checkbox" id="setting-fullscreen-hide" checked />
              </div>

              <div class="settings-row">
                <label for="setting-net-speed" id="lbl-setting-netspeed">Live Network Speed in Pill</label>
                <input type="checkbox" id="setting-net-speed" />
              </div>

              <div class="settings-row">
                <label for="setting-mood-toggle" id="lbl-setting-mood">Pet Mood Reactions</label>
                <input type="checkbox" id="setting-mood-toggle" checked />
              </div>

              <div class="settings-row">
                <label for="setting-quiet-toggle" id="lbl-setting-quiet">Quiet Mode</label>
                <input type="checkbox" id="setting-quiet-toggle" />
              </div>

              <div class="settings-row">
                <label for="setting-walk-windows" id="lbl-setting-walk">Walk on Open Windows</label>
                <input type="checkbox" id="setting-walk-windows" checked />
              </div>

              <div class="settings-row">
                <label for="setting-sound-toggle" id="lbl-setting-sound">Cute Sound Effects</label>
                <input type="checkbox" id="setting-sound-toggle" checked />
              </div>

              <div class="settings-row">
                <label for="setting-autostart" id="lbl-setting-autostart">Launch on Windows Startup</label>
                <input type="checkbox" id="setting-autostart" />
              </div>

              <div class="settings-row">
                <label for="setting-outside-behavior" id="lbl-setting-outside">Island When Pet Is Free</label>
                <select id="setting-outside-behavior" class="settings-select">
                  <option value="empty-pill" id="opt-outside-pill">Mini Pill</option>
                  <option value="hide" id="opt-outside-hide">Hide Island</option>
                </select>
              </div>

              <div class="settings-row">
                <label for="setting-dev-panel" id="lbl-setting-dev">Developer Debug Panel</label>
                <input type="checkbox" id="setting-dev-panel" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SLOT 5: TIMER -->
      <div class="island-slot slot-timer">
        <div class="slot-left-pet-anchor"></div>
        <div class="timer-center">
          <div class="circular-progress">
            <svg viewBox="0 0 36 36" class="circular-chart">
              <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="circle" stroke-dasharray="75, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
          </div>
          <div class="timer-digits">25:00</div>
        </div>
      </div>

      <!-- SLOT 6: MUSIC (COMPACT SMTC PILL) -->
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
          </div>
        </div>
        <div class="music-controls">
          <button class="music-btn" id="music-btn-prev" title="Previous"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
          <button class="music-btn play-pause is-paused" id="music-btn-play-pause" title="Play"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
          <button class="music-btn" id="music-btn-next" title="Next"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
        </div>
      </div>

      <!-- SLOT 7: MUSIC EXPANDED PRO (NOW PLAYING CARD) -->
      <div class="island-slot slot-music-expanded">
        <div class="music-pro-top">
          <div class="music-pro-art-wrap">
            <img class="music-pro-art-img" id="music-pro-art-img" style="display: none;" />
            <div class="music-pro-art-fallback" id="music-pro-art-fallback"></div>
          </div>
          <div class="music-pro-meta">
            <div class="music-pro-title" id="music-pro-title">Not Playing</div>
            <div class="music-pro-artist" id="music-pro-artist">--</div>
            <div class="music-pro-album" id="music-pro-album"></div>
          </div>
          <button class="icon-btn" id="btn-music-pro-collapse" title="Compact">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
        </div>
        <div class="music-pro-progress-wrap">
          <span class="music-pro-time" id="music-pro-elapsed">0:00</span>
          <div class="music-pro-progress-track">
            <div class="music-pro-progress-fill" id="music-pro-progress-fill" style="width: 0%;"></div>
          </div>
          <span class="music-pro-time" id="music-pro-duration">0:00</span>
        </div>
        <div class="music-pro-controls">
          <button class="music-pro-btn" id="music-pro-prev" title="Previous">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button class="music-pro-btn primary" id="music-pro-play" title="Play/Pause">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="music-pro-btn" id="music-pro-next" title="Next">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
        </div>
      </div>

      <!-- SLOT 8: SYSTEM VOLUME & MUTE HUD -->
      <div class="island-slot slot-volume">
        <div class="slot-left-pet-anchor"></div>
        <button class="volume-icon-btn" id="btn-volume-mute-toggle" title="Toggle Mute">
          <svg id="volume-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
          </svg>
        </button>
        <div class="volume-bar-track">
          <div class="volume-bar-fill" id="volume-bar-fill" style="width: 50%;"></div>
        </div>
        <span class="volume-percent-text" id="volume-percent-text">50%</span>
      </div>

      <!-- SLOT 9: UNIVERSAL LIVE HUD (BRIGHTNESS / DEVICE / CAPS-NUM / COLOR / GREETING) -->
      <div class="island-slot slot-hud">
        <div class="slot-left-pet-anchor"></div>
        <div class="hud-body" id="hud-body"></div>
      </div>

      <!-- SLOT 10: NOTCH FILE SHELF -->
      <div class="island-slot slot-shelf">
        <div class="shelf-header">
          <div class="shelf-header-left">
            <span class="shelf-title" id="lbl-shelf-title">Notch File Shelf</span>
            <span class="shelf-hint" id="lbl-shelf-hint">Drop files onto the island</span>
          </div>
          <div class="shelf-header-actions">
            <button class="pet-hub-btn" id="btn-shelf-clear">Clear All</button>
            <button class="icon-btn" id="btn-shelf-close" title="Close">✕</button>
          </div>
        </div>
        <div class="shelf-drop-zone" id="shelf-drop-zone">
          <div class="shelf-empty-state" id="shelf-empty-state">Shelf is empty. Drag any file onto the top island to hold it here.</div>
          <div class="shelf-list" id="shelf-list"></div>
        </div>
      </div>

      <!-- SLOT 11: CLIPBOARD HISTORY (LAST 15) -->
      <div class="island-slot slot-clipboard">
        <div class="shelf-header">
          <div class="shelf-header-left">
            <span class="shelf-title" id="lbl-clipboard-title">Clipboard History</span>
          </div>
          <div class="shelf-header-actions">
            <button class="pet-hub-btn" id="btn-clipboard-clear">Clear</button>
            <button class="icon-btn" id="btn-clipboard-close" title="Close (Esc)">✕</button>
          </div>
        </div>
        <div class="shelf-drop-zone" id="clipboard-scroll">
          <div class="shelf-empty-state" id="clipboard-empty-state">Nothing copied yet (Ctrl+C).</div>
          <div class="shelf-list" id="clipboard-list"></div>
        </div>
      </div>

      <!-- SLOT 12: QUICK MEMO -->
      <div class="island-slot slot-memo">
        <div class="memo-header">
          <div class="memo-header-left">
            <span class="memo-title" id="lbl-memo-title">Quick Note</span>
            <span class="memo-char-count" id="memo-char-count">0 chars</span>
          </div>
          <div class="memo-header-actions">
            <button class="pet-hub-btn" id="btn-memo-copy">Copy</button>
            <button class="pet-hub-btn" id="btn-memo-clear">Clear</button>
            <button class="icon-btn" id="btn-memo-close" title="Close (Esc)">✕</button>
          </div>
        </div>
        <textarea class="memo-textarea" id="memo-textarea" placeholder="Write a quick note... (auto-saved)"></textarea>
      </div>
    `;

    this.slotCollapsed = this.container.querySelector(".slot-collapsed")!;
    this.slotIdle = this.container.querySelector(".slot-idle")!;
    this.slotNotification = this.container.querySelector(".slot-notification")!;
    this.slotExpanded = this.container.querySelector(".slot-expanded")!;
    this.slotTimer = this.container.querySelector(".slot-timer")!;
    this.slotMusic = this.container.querySelector(".slot-music")!;
    this.slotMusicExpanded = this.container.querySelector(".slot-music-expanded")!;
    this.slotVolume = this.container.querySelector(".slot-volume")!;
    this.slotHud = this.container.querySelector(".slot-hud")!;
    this.slotShelf = this.container.querySelector(".slot-shelf")!;
    this.slotClipboard = this.container.querySelector(".slot-clipboard")!;
    this.slotMemo = this.container.querySelector(".slot-memo")!;

    this.memoTextarea = this.slotMemo.querySelector("#memo-textarea") as HTMLTextAreaElement;
    this.clockEl = this.slotIdle.querySelector(".idle-clock")!;
    this.idleMusicWave = this.slotIdle.querySelector("#idle-music-wave")!;
    this.idlePowerBadge = this.slotIdle.querySelector("#idle-power-badge")!;
    this.idleWeatherBadge = this.slotIdle.querySelector("#idle-weather-badge")!;
    this.idleNetBadge = this.slotIdle.querySelector("#idle-net-badge")!;
  }

  private setupHandlers(): void {
    // 3-Tab Switcher
    this.slotExpanded.querySelectorAll<HTMLButtonElement>(".hub-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tab = (btn.dataset.tab || "hub") as "hub" | "tools" | "settings";
        this.switchSubView(tab);
      });
    });

    // Header buttons
    this.slotExpanded.querySelector("#btn-collapse-island")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRequestCollapse?.();
    });

    this.slotExpanded.querySelector("#btn-shelf-top")?.addEventListener("click", (e) => {
      e.stopPropagation();
      eventBus.emit("island:request-state", "shelf");
    });

    this.slotExpanded.querySelector("#btn-clipboard-top")?.addEventListener("click", (e) => {
      e.stopPropagation();
      eventBus.emit("island:request-state", "clipboard");
    });

    this.slotExpanded.querySelector("#btn-free-mode-top")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRequestCollapse?.();
      eventBus.emit("app:toggle-mode", {});
    });

    this.slotExpanded.querySelector("#btn-quick-memo-top")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleQuickNote();
    });

    // Pet Care actions
    this.slotExpanded.querySelector("#btn-care-cookie")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const res = petCareManager.feedCookie();
      xpManager.addXP(res.xpAwarded, "Fed cookie");
      dailyRecapManager.recordXP(res.xpAwarded);
      moodManager.triggerHappyHop("Cookie fed");
      soundEngine.playCuteChirp("happy");
      eventBus.emit("pet:action", { type: "state", payload: "happy" });
      eventBus.emit("pet:say", { text: i18n.t().petHub.cookieFedMsg });
      this.refreshPetCareUI();
      this.updateLevelBadge();
      this.refreshDailyRecapUI();
    });

    this.slotExpanded.querySelector("#btn-care-tea")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const res = petCareManager.giveTea();
      xpManager.addXP(res.xpAwarded, "Gave mint tea");
      dailyRecapManager.recordXP(res.xpAwarded);
      moodManager.triggerHappyHop("Mint tea given");
      soundEngine.playCuteChirp("purr");
      eventBus.emit("pet:action", { type: "state", payload: "happy" });
      eventBus.emit("pet:say", { text: i18n.t().petHub.teaGivenMsg });
      this.refreshPetCareUI();
      this.updateLevelBadge();
      this.refreshDailyRecapUI();
    });

    this.slotExpanded.querySelector("#btn-pet-pat")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const res = petCareManager.pat();
      xpManager.addXP(res.xpAwarded, "Petted Mintu");
      dailyRecapManager.recordXP(res.xpAwarded);
      moodManager.triggerHappyHop("Petted by user");
      soundEngine.playCuteChirp("happy");
      eventBus.emit("pet:action", { type: "state", payload: "happy" });
      this.refreshPetCareUI();
      this.updateLevelBadge();
      this.refreshDailyRecapUI();
    });

    // Daily Water Tracker
    this.slotExpanded.querySelector("#btn-water-drink")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const res = wellnessManager.drinkWater();
      xpManager.addXP(res.xpAwarded, "Drank water");
      dailyRecapManager.recordXP(res.xpAwarded);
      soundEngine.playCuteChirp("happy");
      this.refreshWaterUI();
      this.updateLevelBadge();
      this.refreshDailyRecapUI();
    });

    // Interactive Pet Actions Grid
    this.slotExpanded.querySelector("#btn-pet-chase")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRequestCollapse?.();
      eventBus.emit("pet:toggle-chase-cursor", !this.isChasingCursor);
    });

    eventBus.on("pet:chase-state-changed", (active: boolean) => {
      this.isChasingCursor = Boolean(active);
      this.updateChaseButtonLabel();
    });

    this.slotExpanded.querySelector("#btn-pet-star")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRequestCollapse?.();
      eventBus.emit("pet:drop-star", {});
    });

    eventBus.on("pet:star-caught", () => {
      this.refreshDailyRecapUI();
      this.updateLevelBadge();
    });

    this.slotExpanded.querySelector("#btn-pet-dance")?.addEventListener("click", (e) => {
      e.stopPropagation();
      soundEngine.playCuteChirp("happy");
      eventBus.emit("pet:action", { type: "state", payload: "dance" });
    });

    this.slotExpanded.querySelector("#btn-pet-sleep")?.addEventListener("click", (e) => {
      e.stopPropagation();
      eventBus.emit("island:request-state", "collapsed");
    });

    this.slotExpanded.querySelector("#btn-pet-free")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRequestCollapse?.();
      eventBus.emit("app:toggle-mode", {});
    });

    this.slotExpanded.querySelector("#btn-pet-color")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.triggerColorPicker();
    });

    // Quick Calc (Tools Tab)
    const calcInput = this.slotExpanded.querySelector("#quick-calc-input") as HTMLInputElement;
    const calcResBtn = this.slotExpanded.querySelector("#quick-calc-result") as HTMLButtonElement;
    if (calcInput && calcResBtn) {
      calcInput.addEventListener("input", () => {
        const res = tryEvaluateInline(calcInput.value);
        if (res) {
          calcResBtn.textContent = res;
          calcResBtn.style.display = "inline-flex";
        } else {
          calcResBtn.style.display = "none";
        }
      });
      calcResBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const clean = calcResBtn.textContent?.replace(/^=\s*/, "") || "";
        if (!clean) return;
        try {
          await navigator.clipboard.writeText(clean);
          soundEngine.playCuteChirp("click");
          calcResBtn.textContent = i18n.t().petHub.shelfCopied;
          setTimeout(() => {
            const again = tryEvaluateInline(calcInput.value);
            if (again) calcResBtn.textContent = again;
          }, 1100);
        } catch {}
      });
    }

    // Mini Daily To-Do List (Tools Tab)
    const addTodoAction = () => {
      const inp = this.slotExpanded.querySelector("#todo-input") as HTMLInputElement;
      if (!inp || !inp.value.trim()) return;
      wellnessManager.addTodo(inp.value);
      inp.value = "";
      soundEngine.playCuteChirp("click");
      this.renderTodosList();
    };
    this.slotExpanded.querySelector("#btn-todo-add")?.addEventListener("click", (e) => {
      e.stopPropagation();
      addTodoAction();
    });
    this.slotExpanded.querySelector("#todo-input")?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.stopPropagation();
        addTodoAction();
      }
    });

    // Timed SQLite Reminders (Tools Tab)
    const addReminderAction = async () => {
      const inp = this.slotExpanded.querySelector("#reminder-input") as HTMLInputElement;
      const minsSel = this.slotExpanded.querySelector("#reminder-minutes") as HTMLSelectElement;
      if (!inp || !inp.value.trim()) return;
      const mins = Math.max(1, Number(minsSel?.value || 15));
      const dueAt = Math.floor(Date.now() / 1000) + mins * 60;
      await appBridge.createReminder(inp.value.trim(), dueAt);
      inp.value = "";
      soundEngine.playCuteChirp("happy");
      this.refreshRemindersList();
    };
    this.slotExpanded.querySelector("#btn-reminder-add")?.addEventListener("click", (e) => {
      e.stopPropagation();
      addReminderAction();
    });
    this.slotExpanded.querySelector("#reminder-input")?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.stopPropagation();
        addReminderAction();
      }
    });

    // Tools tab quick drawer buttons
    this.slotExpanded.querySelector("#btn-tools-shelf")?.addEventListener("click", (e) => {
      e.stopPropagation();
      eventBus.emit("island:request-state", "shelf");
    });
    this.slotExpanded.querySelector("#btn-tools-clipboard")?.addEventListener("click", (e) => {
      e.stopPropagation();
      eventBus.emit("island:request-state", "clipboard");
    });
    this.slotExpanded.querySelector("#btn-tools-tip")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showRandomDailyTip();
    });

    // Ambient Focus Sound Mixer
    this.slotExpanded.querySelectorAll<HTMLButtonElement>("[data-ambient-mode]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const mode = (btn.dataset.ambientMode || "off") as AmbientSoundMode;
        const slider = this.slotExpanded.querySelector("#ambient-volume-slider") as HTMLInputElement;
        const vol = slider ? (Number(slider.value) / 100) * 0.35 : 0.18;
        if (mode === "off") {
          soundEngine.stopAmbientSound();
          eventBus.emit("pet:ambient-headphones", false);
        } else {
          soundEngine.startAmbientSound(mode, vol);
          eventBus.emit("pet:ambient-headphones", true);
        }
        this.syncAmbientMixerUI();
      });
    });

    const ambSlider = this.slotExpanded.querySelector("#ambient-volume-slider") as HTMLInputElement;
    if (ambSlider) {
      ambSlider.addEventListener("input", (e) => {
        e.stopPropagation();
        soundEngine.setAmbientVolume((Number(ambSlider.value) / 100) * 0.35);
      });
    }

    // Focus timer controls
    this.slotExpanded.querySelector("#btn-focus-timer-toggle-run")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const st = timerEngine.getState();
      if (st === "running") timerEngine.pause();
      else if (st === "paused") timerEngine.resume();
      else timerEngine.startCountdown(25 * 60, "Focus", true);
      this.syncHubTimerUI();
    });

    this.slotExpanded.querySelector("#btn-focus-timer-reset")?.addEventListener("click", (e) => {
      e.stopPropagation();
      timerEngine.reset();
      this.syncHubTimerUI();
    });

    this.slotExpanded.querySelectorAll<HTMLButtonElement>("[data-timer-min]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const mins = Number(btn.dataset.timerMin || 25);
        timerEngine.startCountdown(mins * 60, `${mins}m Focus`, true);
        soundEngine.playCuteChirp("happy");
        this.syncHubTimerUI();
      });
    });

    // Hub Mini Music card click -> open Now Playing Pro
    this.slotExpanded.querySelector("#hub-music-card")?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.stopPropagation();
      eventBus.emit("island:request-state", "music-expanded");
    });

    // Music controls
    const togglePlay = async (e: Event) => {
      e.stopPropagation();
      this.isMusicPlaying = !this.isMusicPlaying;
      this.mediaLastUpdateMs = Date.now();
      this.updatePlayPauseIcon(this.isMusicPlaying);
      eventBus.emit("music:ambient-update", { is_playing: this.isMusicPlaying });
      if (this.currentSlotName !== "music-expanded") {
        if (this.isMusicPlaying) {
          activityManager.push({ id: "music_live", type: "music_active", islandState: "music", petState: "dance" });
        } else {
          activityManager.push({ id: "music_live", type: "music_active", islandState: "music", petState: "idle", autoDismissMs: 20000 });
        }
      }
      try {
        await appBridge.mediaTogglePlayPause();
      } catch {}
    };

    const prevTrack = (e: Event) => { e.stopPropagation(); appBridge.mediaPrevious(); };
    const nextTrack = (e: Event) => { e.stopPropagation(); appBridge.mediaNext(); };

    this.slotMusic.querySelector("#music-btn-play-pause")?.addEventListener("click", togglePlay);
    this.slotMusic.querySelector("#music-btn-prev")?.addEventListener("click", prevTrack);
    this.slotMusic.querySelector("#music-btn-next")?.addEventListener("click", nextTrack);

    this.slotMusicExpanded.querySelector("#music-pro-play")?.addEventListener("click", togglePlay);
    this.slotMusicExpanded.querySelector("#music-pro-prev")?.addEventListener("click", prevTrack);
    this.slotMusicExpanded.querySelector("#music-pro-next")?.addEventListener("click", nextTrack);
    this.slotMusicExpanded.querySelector("#btn-music-pro-collapse")?.addEventListener("click", (e) => {
      e.stopPropagation();
      eventBus.emit("island:request-state", this.isMusicPlaying ? "music" : "idle");
    });

    this.slotExpanded.querySelector("#hub-music-play")?.addEventListener("click", togglePlay);
    this.slotExpanded.querySelector("#hub-music-prev")?.addEventListener("click", prevTrack);
    this.slotExpanded.querySelector("#hub-music-next")?.addEventListener("click", nextTrack);

    // Volume HUD mute toggle
    this.slotVolume.querySelector("#btn-volume-mute-toggle")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const updated = await appBridge.setSystemVolume(this.lastVolumeState.percent, !this.lastVolumeState.muted);
      if (updated) this.showVolumeHud(updated);
    });

    // Shelf & Clipboard drawers
    this.slotShelf.querySelector("#btn-shelf-clear")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.shelfFiles = [];
      this.saveShelfFiles();
      this.renderShelfList();
    });
    this.slotShelf.querySelector("#btn-shelf-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      activityManager.remove("notch_shelf_live");
      this.onRequestCollapse?.();
    });

    this.slotClipboard.querySelector("#btn-clipboard-clear")?.addEventListener("click", (e) => {
      e.stopPropagation();
      clipboardHistory.clearUnpinned();
      this.renderClipboardList();
    });
    this.slotClipboard.querySelector("#btn-clipboard-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRequestCollapse?.();
    });

    // Quick Memo handlers
    this.memoTextarea.addEventListener("input", () => {
      try {
        localStorage.setItem(MEMO_STORAGE_KEY, this.memoTextarea.value);
      } catch {}
      this.updateMemoCharCount();
    });
    this.slotMemo.querySelector("#btn-memo-copy")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget as HTMLButtonElement;
      try {
        await navigator.clipboard.writeText(this.memoTextarea.value);
        soundEngine.playCuteChirp("click");
        btn.textContent = i18n.t().scratchpad.copied;
        setTimeout(() => { btn.textContent = i18n.t().scratchpad.copy; }, 1200);
      } catch {}
    });
    this.slotMemo.querySelector("#btn-memo-clear")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.memoTextarea.value = "";
      try { localStorage.removeItem(MEMO_STORAGE_KEY); } catch {}
      this.updateMemoCharCount();
      this.memoTextarea.focus();
    });
    this.slotMemo.querySelector("#btn-memo-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRequestCollapse?.();
    });

    // Smart Clipboard JSON pill
    eventBus.on("clipboard:action-suggested", (action: any) => {
      if (!action || action.type !== "json") return;
      const pill = this.slotExpanded.querySelector("#smart-clipboard-pill") as HTMLElement;
      if (pill) pill.style.display = "flex";
    });
    this.slotExpanded.querySelector("#btn-smart-clip-format")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const cur = smartClipboard.getCurrentAction();
      if (cur && cur.type === "json") {
        try {
          await navigator.clipboard.writeText(JSON.stringify(JSON.parse(cur.content), null, 2));
          soundEngine.playCuteChirp("happy");
        } catch {}
      }
      const pill = this.slotExpanded.querySelector("#smart-clipboard-pill") as HTMLElement;
      if (pill) pill.style.display = "none";
    });
    this.slotExpanded.querySelector("#btn-smart-clip-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const pill = this.slotExpanded.querySelector("#smart-clipboard-pill") as HTMLElement;
      if (pill) pill.style.display = "none";
    });

    // Settings: Custom Pet Name
    const petNameInp = this.slotExpanded.querySelector("#setting-pet-name") as HTMLInputElement;
    if (petNameInp) petNameInp.value = wellnessManager.getPetName();
    this.slotExpanded.querySelector("#btn-pet-name-save")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!petNameInp) return;
      const saved = wellnessManager.setPetName(petNameInp.value);
      petNameInp.value = saved;
      this.syncPetNameUI();
      this.updateLevelBadge();
      eventBus.emit("pet:name-changed", saved);
      soundEngine.playCuteChirp("happy");
    });

    // Settings: Weather
    const weatherCb = this.slotExpanded.querySelector("#setting-weather-toggle") as HTMLInputElement;
    const weatherCityInput = this.slotExpanded.querySelector("#setting-weather-city") as HTMLInputElement;
    const wSettings = weatherService.getSettings();
    if (weatherCb) {
      weatherCb.checked = wSettings.enabled;
      weatherCb.addEventListener("change", async () => {
        weatherService.setEnabled(weatherCb.checked);
        this.renderWeatherBadge(weatherCb.checked ? await weatherService.fetchWeather(true) : null);
      });
    }
    if (weatherCityInput) weatherCityInput.value = wSettings.city;
    this.slotExpanded.querySelector("#btn-weather-save")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!weatherCityInput) return;
      weatherService.setEnabled(true);
      if (weatherCb) weatherCb.checked = true;
      const snap = await weatherService.setCity(weatherCityInput.value);
      this.renderWeatherBadge(snap);
      if (snap) soundEngine.playCuteChirp("click");
    });

    // Settings: Wellness & Atmosphere
    const wState = wellnessManager.getState();
    const waterIntSel = this.slotExpanded.querySelector("#setting-water-interval") as HTMLSelectElement;
    if (waterIntSel) {
      waterIntSel.value = String(wState.waterIntervalMin);
      waterIntSel.addEventListener("change", () => {
        wellnessManager.setWaterInterval(Number(waterIntSel.value));
        this.lastWaterReminderAt = Date.now();
      });
    }

    const eyeCb = this.slotExpanded.querySelector("#setting-eye-break") as HTMLInputElement;
    if (eyeCb) {
      eyeCb.checked = wState.eyeBreak2020;
      eyeCb.addEventListener("change", () => wellnessManager.setEyeBreak2020(eyeCb.checked));
    }

    const chimeCb = this.slotExpanded.querySelector("#setting-hourly-chime") as HTMLInputElement;
    if (chimeCb) {
      chimeCb.checked = wState.hourlyChime;
      chimeCb.addEventListener("change", () => wellnessManager.setHourlyChime(chimeCb.checked));
    }

    // Settings: Bongo-Cat Typing, Fullscreen Auto-Hide, Network Speed, Monitor
    const bongoCb = this.slotExpanded.querySelector("#setting-bongo-typing") as HTMLInputElement;
    const bongoInit = localStorage.getItem("mintu_bongo_typing") !== "off";
    appBridge.setTypingPulseEnabled(bongoInit);
    if (bongoCb) {
      bongoCb.checked = bongoInit;
      bongoCb.addEventListener("change", () => {
        localStorage.setItem("mintu_bongo_typing", bongoCb.checked ? "on" : "off");
        appBridge.setTypingPulseEnabled(bongoCb.checked);
      });
    }

    const fsCb = this.slotExpanded.querySelector("#setting-fullscreen-hide") as HTMLInputElement;
    if (fsCb) {
      fsCb.checked = localStorage.getItem("mintu_fullscreen_autohide") !== "off";
      fsCb.addEventListener("change", () => {
        localStorage.setItem("mintu_fullscreen_autohide", fsCb.checked ? "on" : "off");
        eventBus.emit("settings:fullscreen-autohide-changed", fsCb.checked);
      });
    }

    const netCb = this.slotExpanded.querySelector("#setting-net-speed") as HTMLInputElement;
    if (netCb) {
      netCb.checked = localStorage.getItem("mintu_net_speed_pill") === "on";
      netCb.addEventListener("change", () => {
        localStorage.setItem("mintu_net_speed_pill", netCb.checked ? "on" : "off");
        if (!netCb.checked && this.idleNetBadge) this.idleNetBadge.style.display = "none";
      });
    }

    const monSel = this.slotExpanded.querySelector("#setting-monitor") as HTMLSelectElement;
    if (monSel) {
      monSel.addEventListener("change", async () => {
        const idx = Number(monSel.value || 0);
        await appBridge.moveToMonitor(idx);
      });
    }

    // Core Settings
    const langSel = this.slotExpanded.querySelector("#setting-language") as HTMLSelectElement;
    if (langSel) {
      langSel.value = i18n.getLang();
      langSel.addEventListener("change", () => {
        this.applyUiTranslations(langSel.value as SupportedLanguage);
      });
    }

    const moodCb = this.slotExpanded.querySelector("#setting-mood-toggle") as HTMLInputElement;
    if (moodCb) {
      moodCb.checked = moodManager.isMoodEnabled();
      moodCb.addEventListener("change", () => moodManager.setMoodEnabled(moodCb.checked));
    }

    const quietCb = this.slotExpanded.querySelector("#setting-quiet-toggle") as HTMLInputElement;
    if (quietCb) {
      quietCb.checked = moodManager.isQuietMode();
      quietCb.addEventListener("change", () => moodManager.setQuietMode(quietCb.checked));
    }

    const walkCb = this.slotExpanded.querySelector("#setting-walk-windows") as HTMLInputElement;
    if (walkCb) {
      walkCb.checked = localStorage.getItem("mintu_walk_windows") !== "off";
      walkCb.addEventListener("change", () => {
        localStorage.setItem("mintu_walk_windows", walkCb.checked ? "on" : "off");
        eventBus.emit("settings:walk-windows-changed", walkCb.checked);
      });
    }

    const soundCb = this.slotExpanded.querySelector("#setting-sound-toggle") as HTMLInputElement;
    if (soundCb) {
      soundCb.checked = localStorage.getItem("mintu_sound_enabled") !== "off";
      soundCb.addEventListener("change", () => {
        localStorage.setItem("mintu_sound_enabled", soundCb.checked ? "on" : "off");
        soundEngine.setMuted(!soundCb.checked);
        this.syncAmbientMixerUI();
      });
    }

    const autostartCb = this.slotExpanded.querySelector("#setting-autostart") as HTMLInputElement;
    if (autostartCb) {
      appBridge.getAutostart().then((v) => { autostartCb.checked = Boolean(v); });
      autostartCb.addEventListener("change", () => { appBridge.setAutostart(autostartCb.checked); });
    }

    const outsideSel = this.slotExpanded.querySelector("#setting-outside-behavior") as HTMLSelectElement;
    if (outsideSel) {
      outsideSel.value = localStorage.getItem("mintu_outside_behavior") || "empty-pill";
      outsideSel.addEventListener("change", () => {
        localStorage.setItem("mintu_outside_behavior", outsideSel.value);
        eventBus.emit("settings:outside-behavior-changed", outsideSel.value);
      });
    }

    const devCb = this.slotExpanded.querySelector("#setting-dev-panel") as HTMLInputElement;
    if (devCb) {
      devCb.checked = localStorage.getItem("mintu_dev_panel") === "on";
      devCb.addEventListener("change", () => {
        localStorage.setItem("mintu_dev_panel", devCb.checked ? "on" : "off");
        eventBus.emit("settings:dev-panel-changed", devCb.checked);
      });
    }

    // ActivityManager bridge -> Island states
    activityManager.onStateTransition = (item) => {
      if (
        (this.currentSlotName === "expanded" ||
          this.currentSlotName === "memo" ||
          this.currentSlotName === "shelf" ||
          this.currentSlotName === "clipboard" ||
          this.currentSlotName === "music-expanded") &&
        item.type !== "urgent_notif" &&
        item.type !== "volume_hud" &&
        item.type !== "status_hud" &&
        item.type !== "notch_shelf"
      ) {
        return;
      }
      eventBus.emit("island:request-state", item.islandState);
      if (item.petState) {
        eventBus.emit("pet:action", { type: "state", payload: item.petState });
      }
    };

    eventBus.on("gamification:stats-updated", () => {
      this.updateLevelBadge();
      this.renderWardrobe();
      this.refreshDailyRecapUI();
    });

    // 1-second tick for Focus Timer, Music Pro timeline, and Sleep energy recovery
    this.focusTickTimer = window.setInterval(() => {
      this.syncHubTimerUI();
      this.tickMusicProgressUI();
      if (this.currentSlotName === "collapsed") {
        petCareManager.restTick();
      }
    }, 1000);
  }

  private initIPCListeners(): void {
    // Live SMTC Music polling
    appBridge.listenToEvent<any>("media-state-changed", (media) => this.updateMusicUi(media));
    appBridge.mediaGetState().then((st) => { if (st) this.updateMusicUi(st); });

    // Live Windows Master Volume & Mute HUD
    appBridge.listenToEvent<{ percent: number; muted: boolean }>("volume-changed", (vol) => {
      if (vol) this.showVolumeHud(vol);
    });

    // Live Laptop Screen Brightness HUD
    appBridge.listenToEvent<{ percent: number }>("brightness-changed", (b) => {
      if (b) this.showBrightnessHud(b.percent);
    });

    // Live USB / Audio Device Connect & Disconnect Pop-up (AirPods Style)
    appBridge.listenToEvent<{ kind: string; name: string; category: string }>("device-event", (ev) => {
      if (ev && !moodManager.isQuietMode()) this.showDeviceHud(ev);
    });

    // Live Caps Lock / Num Lock Pill
    appBridge.listenToEvent<{ key: string; enabled: boolean }>("lock-key-changed", (ev) => {
      if (ev) this.showLockKeyHud(ev);
    });

    // Clipboard History listener (last 15 copies)
    appBridge.listenToEvent<string>("clipboard-copied", (text) => {
      if (text) {
        clipboardHistory.add(text);
        this.renderClipboardList();
      }
    });

    // Reminder triggered -> chime & refresh list
    appBridge.listenToEvent("reminder:triggered", () => {
      soundEngine.playChime();
      this.refreshRemindersList();
    });

    // Native OS Drag-and-Drop onto Dynamic Island -> Notch File Shelf
    appBridge.listenToEvent<string[]>("notch-drag-enter", () => {
      this.slotShelf.querySelector("#shelf-drop-zone")?.classList.add("drag-active");
      activityManager.push({
        id: "notch_shelf_live",
        type: "notch_shelf",
        islandState: "shelf",
        petState: "happy",
      });
    });

    appBridge.listenToEvent("notch-drag-leave", () => {
      this.slotShelf.querySelector("#shelf-drop-zone")?.classList.remove("drag-active");
      if (this.shelfFiles.length === 0) {
        activityManager.remove("notch_shelf_live");
      }
    });

    appBridge.listenToEvent<string[]>("notch-files-dropped", (paths) => {
      this.slotShelf.querySelector("#shelf-drop-zone")?.classList.remove("drag-active");
      if (Array.isArray(paths) && paths.length > 0) {
        this.addShelfFiles(paths);
        soundEngine.playCuteChirp("happy");
        xpManager.addXP(3, "Parked file in Notch Shelf");
        dailyRecapManager.recordXP(3);
        this.updateLevelBadge();
        this.refreshDailyRecapUI();
      }
      activityManager.push({
        id: "notch_shelf_live",
        type: "notch_shelf",
        islandState: "shelf",
        petState: "happy",
      });
    });

    // Windows notifications
    appBridge.listenToEvent<any>("system-notification", (notif) => {
      if (!notif || moodManager.isQuietMode()) return;
      const payload: NotificationPayload = {
        appName: notif.app_name || notif.title || "Notification",
        appIcon: notif.app_icon || undefined,
        title: notif.title || "Notification",
        text: notif.text || "",
        target: notif.target || undefined,
        actions: notif.actions || undefined,
      };
      this.setNotification(payload);
      activityManager.push({
        id: notif.id || `notif_${Date.now()}`,
        type: notif.priority === "urgent" ? "urgent_notif" : "normal_notif",
        islandState: payload.actions && payload.actions.length > 0 ? "notification-actions" : "notification",
        petState: "alert",
        autoDismissMs: 6500,
      });
    });

    // System Tray actions
    appBridge.listenToEvent<string>("tray-action", (act) => {
      if (act === "start-pomodoro") {
        timerEngine.startCountdown(25 * 60, "Pomodoro", true);
        eventBus.emit("island:request-state", "timer");
      } else if (act === "stop-timer") {
        timerEngine.reset();
        eventBus.emit("island:request-state", "idle");
      } else if (act === "toggle-quiet") {
        moodManager.setQuietMode(!moodManager.isQuietMode());
      }
    });

    appBridge.listenToEvent("open-settings", () => {
      this.switchSubView("settings");
      eventBus.emit("island:request-state", "expanded");
    });

    appBridge.listenToEvent<string>("hotkey-triggered", (action) => {
      if (action === "quick-note") {
        if (this.currentSlotName === "memo") this.onRequestCollapse?.();
        else this.handleQuickNote();
      } else if (action === "open-settings") {
        if (this.currentSlotName === "expanded" && this.expandedSubView === "settings") {
          this.onRequestCollapse?.();
        } else {
          this.switchSubView("settings");
          eventBus.emit("island:request-state", "expanded");
        }
      } else if (action === "toggle-hub") {
        if (this.currentSlotName === "expanded" && this.expandedSubView === "hub") {
          this.onRequestCollapse?.();
        } else {
          this.switchSubView("hub");
          eventBus.emit("island:request-state", "expanded");
        }
      } else if (action === "clipboard-history") {
        if (this.currentSlotName === "clipboard") this.onRequestCollapse?.();
        else eventBus.emit("island:request-state", "clipboard");
      } else if (action === "color-picker") {
        this.triggerColorPicker();
      }
    });
  }

  // ==========================================
  // Universal Live HUDs (Brightness, Device, Caps/Num, Color, Greeting, Network)
  // ==========================================

  private showCustomHud(html: string, durationMs: number = 2200, petState: string = "curious"): void {
    const body = this.slotHud.querySelector("#hud-body");
    if (body) body.innerHTML = html;
    activityManager.push({
      id: "status_hud_live",
      type: "status_hud",
      islandState: "hud",
      petState,
      autoDismissMs: durationMs,
    });
  }

  private showBrightnessHud(percent: number): void {
    const pct = Math.max(0, Math.min(100, percent));
    const html = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" style="flex-shrink:0;">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
      <div class="volume-bar-track"><div class="volume-bar-fill brightness" style="width: ${pct}%;"></div></div>
      <span class="volume-percent-text">${pct}%</span>
    `;
    this.showCustomHud(html, 2000, "curious");
  }

  private showDeviceHud(ev: { kind: string; name: string; category: string }): void {
    const h = i18n.t().petHub;
    const isConn = ev.kind === "connected";
    const label = ev.category === "audio" ? h.audioDevice : h.usbDevice;
    const statusText = isConn ? h.deviceConnected : h.deviceDisconnected;
    const badgeCls = isConn ? "hud-pill-ok" : "hud-pill-warn";
    const iconSvg =
      ev.category === "audio"
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" stroke-width="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><circle cx="10" cy="7" r="1"></circle><circle cx="4" cy="20" r="1"></circle><path d="M4.7 19.3 19 5"></path><path d="m21 3-3 1 2 2Z"></path><path d="M9.26 7.68 5 12l2 5"></path><path d="m10 14 5 2 3.5-3.5"></path></svg>`;
    const html = `
      <div class="hud-device-row">
        ${iconSvg}
        <span class="hud-text-main">${escapeHtml(label)}</span>
        <span class="hud-status-pill ${badgeCls}">${escapeHtml(statusText)}</span>
      </div>
    `;
    soundEngine.playCuteChirp(isConn ? "happy" : "click");
    this.showCustomHud(html, 2600, isConn ? "happy" : "curious");
  }

  private showLockKeyHud(ev: { key: string; enabled: boolean }): void {
    const h = i18n.t().petHub;
    const txt =
      ev.key === "CAPS"
        ? ev.enabled ? h.capsOn : h.capsOff
        : ev.enabled ? h.numOn : h.numOff;
    const badgeCls = ev.enabled ? "hud-pill-ok" : "hud-pill-muted";
    const html = `
      <div class="hud-device-row">
        <span class="hud-key-cap">${escapeHtml(ev.key)}</span>
        <span class="hud-text-main">${escapeHtml(txt)}</span>
        <span class="hud-status-pill ${badgeCls}">${ev.enabled ? "ON" : "OFF"}</span>
      </div>
    `;
    this.showCustomHud(html, 1500, "curious");
  }

  private async triggerColorPicker(): Promise<void> {
    const hex = await appBridge.pickCursorColor();
    if (!hex) return;
    try {
      await navigator.clipboard.writeText(hex);
    } catch {}
    soundEngine.playCuteChirp("click");
    const h = i18n.t().petHub;
    const html = `
      <div class="hud-device-row">
        <span class="hud-color-swatch" style="background:${escapeHtml(hex)};"></span>
        <span class="hud-text-main" style="font-family: Consolas, monospace;">${escapeHtml(hex)}</span>
        <span class="hud-status-pill hud-pill-ok">${escapeHtml(h.colorCopied)}</span>
      </div>
    `;
    this.showCustomHud(html, 2600, "happy");
  }

  private scheduleStartupGreeting(): void {
    window.setTimeout(() => {
      if (moodManager.isQuietMode()) return;
      const hr = new Date().getHours();
      const h = i18n.t().petHub;
      const petName = wellnessManager.getPetName();
      let msg = h.greetingAfternoon;
      let petState = "happy";
      if (hr >= 5 && hr < 12) msg = h.greetingMorning;
      else if (hr >= 18 && hr < 23) msg = h.greetingEvening;
      else if (hr >= 23 || hr < 5) {
        msg = h.greetingNight;
        petState = "sleep";
      }
      const html = `
        <div class="hud-device-row">
          <span class="hud-text-main">${escapeHtml(petName)}: ${escapeHtml(msg)}</span>
        </div>
      `;
      this.showCustomHud(html, 3000, petState);
    }, 1700);
  }

  private setupWellnessAndChimeTimers(): void {
    this.wellnessTimer = window.setInterval(() => {
      const now = new Date();
      const w = wellnessManager.getState();

      // Gentle Hourly Chime at :00
      if (w.hourlyChime && now.getMinutes() === 0 && this.lastChimeHour !== now.getHours() && !moodManager.isQuietMode()) {
        this.lastChimeHour = now.getHours();
        soundEngine.playChime();
        const hh = String(now.getHours()).padStart(2, "0");
        const html = `<div class="hud-device-row"><span class="hud-text-main">${hh}:00 | ${escapeHtml(w.petName)}</span></div>`;
        this.showCustomHud(html, 2600, "happy");
      }

      // Late-night cozy auto-sleep after 23:00 if idle & no music
      if ((now.getHours() >= 23 || now.getHours() < 5) && !this.isMusicPlaying && this.currentSlotName === "idle") {
        eventBus.emit("pet:action", { type: "state", payload: "sleep" });
      }

      // Water & 20-20-20 Eye Break Reminder
      if (w.waterIntervalMin > 0 && !moodManager.isQuietMode()) {
        const elapsedMin = (Date.now() - this.lastWaterReminderAt) / 60000;
        if (elapsedMin >= w.waterIntervalMin) {
          this.lastWaterReminderAt = Date.now();
          const h = i18n.t().petHub;
          soundEngine.playChime();
          this.setNotification({
            appName: w.petName,
            title: h.waterRemTitle,
            text: h.waterRemText,
            actions: [{ id: "wellness_drank", label: `${h.waterDrink} (+5 XP)`, primary: true }],
          });
          activityManager.push({
            id: `water_${Date.now()}`,
            type: "normal_notif",
            islandState: "notification-actions",
            petState: "happy",
            autoDismissMs: 9000,
          });
        }
      }
    }, 30000);
  }

  private setupNetworkMonitor(): void {
    const poll = async () => {
      const st = await appBridge.getSystemStatusInfo();
      if (!st) return;

      const online = Boolean(st.network_connected);
      if (this.lastOnlineState !== null && this.lastOnlineState !== online && !moodManager.isQuietMode()) {
        const h = i18n.t().petHub;
        const txt = online ? h.netReconnected : h.netDisconnected;
        const badgeCls = online ? "hud-pill-ok" : "hud-pill-warn";
        const html = `<div class="hud-device-row"><span class="hud-text-main">${escapeHtml(txt)}</span><span class="hud-status-pill ${badgeCls}">${online ? "ON" : "OFF"}</span></div>`;
        this.showCustomHud(html, 2600, online ? "happy" : "alert");
      }
      this.lastOnlineState = online;

      const showSpeed = localStorage.getItem("mintu_net_speed_pill") === "on";
      if (this.idleNetBadge) {
        if (showSpeed && online) {
          const down = st.network_down_kbps || 0;
          this.idleNetBadge.textContent = down >= 1024 ? `${(down / 1024).toFixed(1)} MB/s` : `${Math.round(down)} KB/s`;
          this.idleNetBadge.style.display = "inline-flex";
        } else {
          this.idleNetBadge.style.display = "none";
        }
      }
    };
    poll();
    this.networkTimer = window.setInterval(poll, 5000);
  }

  // ==========================================
  // System Volume HUD
  // ==========================================

  private showVolumeHud(vol: { percent: number; muted: boolean }): void {
    this.lastVolumeState = vol;
    const fill = this.slotVolume.querySelector("#volume-bar-fill") as HTMLElement;
    const pctText = this.slotVolume.querySelector("#volume-percent-text");
    const svg = this.slotVolume.querySelector("#volume-svg-icon");
    const t = i18n.t().petHub;

    const effectivePct = vol.muted ? 0 : Math.max(0, Math.min(100, vol.percent));
    if (fill) {
      fill.style.width = `${effectivePct}%`;
      fill.classList.toggle("muted", vol.muted);
    }
    if (pctText) pctText.textContent = vol.muted ? t.volumeMuted : `${effectivePct}%`;
    if (svg) {
      svg.innerHTML = vol.muted
        ? `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`
        : `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>`;
    }

    activityManager.push({
      id: "volume_hud_live",
      type: "volume_hud",
      islandState: "volume",
      petState: vol.muted ? "alert" : "curious",
      autoDismissMs: 2100,
    });
  }

  // ==========================================
  // Notch File Shelf & Clipboard History
  // ==========================================

  private loadShelfFiles(): void {
    try {
      const raw = localStorage.getItem(SHELF_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.shelfFiles = parsed.slice(0, MAX_SHELF_ITEMS);
      }
    } catch {
      this.shelfFiles = [];
    }
  }

  private saveShelfFiles(): void {
    try { localStorage.setItem(SHELF_STORAGE_KEY, JSON.stringify(this.shelfFiles)); } catch {}
  }

  private addShelfFiles(paths: string[]): void {
    for (const p of paths) {
      const clean = String(p || "").trim();
      if (!clean || this.shelfFiles.some((f) => f.path === clean)) continue;
      const parts = clean.split(/[\\/]/);
      const name = parts[parts.length - 1] || clean;
      const dotIdx = name.lastIndexOf(".");
      const ext = dotIdx > 0 ? name.slice(dotIdx + 1).toUpperCase().slice(0, 5) : "FILE";
      this.shelfFiles.unshift({ path: clean, name, ext, addedAt: Date.now() });
    }
    this.shelfFiles = this.shelfFiles.slice(0, MAX_SHELF_ITEMS);
    this.saveShelfFiles();
    this.renderShelfList();
  }

  private renderShelfList(): void {
    const listEl = this.slotShelf.querySelector("#shelf-list") as HTMLElement;
    const emptyEl = this.slotShelf.querySelector("#shelf-empty-state") as HTMLElement;
    const badgeTop = this.slotExpanded.querySelector("#shelf-count-top") as HTMLElement;
    const toolsShelfBtn = this.slotExpanded.querySelector("#btn-tools-shelf");
    const t = i18n.t().petHub;

    if (badgeTop) {
      badgeTop.textContent = String(this.shelfFiles.length);
      badgeTop.style.display = this.shelfFiles.length > 0 ? "inline-flex" : "none";
    }
    if (toolsShelfBtn) {
      toolsShelfBtn.textContent =
        this.shelfFiles.length > 0 ? `${t.fileShelf} (${this.shelfFiles.length})` : t.fileShelf;
    }

    if (!listEl || !emptyEl) return;
    if (this.shelfFiles.length === 0) {
      emptyEl.style.display = "block";
      listEl.innerHTML = "";
      return;
    }

    emptyEl.style.display = "none";
    listEl.innerHTML = this.shelfFiles
      .map(
        (f, idx) => `
        <div class="shelf-item">
          <span class="shelf-ext-badge">${escapeHtml(f.ext)}</span>
          <span class="shelf-file-name" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
          <div class="shelf-item-actions">
            <button class="shelf-mini-btn primary" data-act="open" data-idx="${idx}">${escapeHtml(t.shelfOpen)}</button>
            <button class="shelf-mini-btn" data-act="reveal" data-idx="${idx}">${escapeHtml(t.shelfReveal)}</button>
            <button class="shelf-mini-btn" data-act="copy" data-idx="${idx}">${escapeHtml(t.shelfCopy)}</button>
            <button class="shelf-mini-btn danger" data-act="remove" data-idx="${idx}">✕</button>
          </div>
        </div>
      `
      )
      .join("");

    listEl.querySelectorAll<HTMLButtonElement>(".shelf-mini-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.idx);
        const item = this.shelfFiles[idx];
        if (!item) return;
        const act = btn.dataset.act;
        if (act === "open") await appBridge.openShelfFile(item.path);
        else if (act === "reveal") await appBridge.revealShelfFile(item.path);
        else if (act === "copy") {
          try {
            await navigator.clipboard.writeText(item.path);
            btn.textContent = t.shelfCopied;
            setTimeout(() => { btn.textContent = t.shelfCopy; }, 1200);
          } catch {}
        } else if (act === "remove") {
          this.shelfFiles.splice(idx, 1);
          this.saveShelfFiles();
          this.renderShelfList();
        }
      });
    });
  }

  private renderClipboardList(): void {
    const listEl = this.slotClipboard.querySelector("#clipboard-list") as HTMLElement;
    const emptyEl = this.slotClipboard.querySelector("#clipboard-empty-state") as HTMLElement;
    const toolsBtn = this.slotExpanded.querySelector("#btn-tools-clipboard");
    const items = clipboardHistory.getAll();
    const h = i18n.t().petHub;

    if (toolsBtn) {
      toolsBtn.textContent = items.length > 0 ? `${h.clipboardTitle} (${items.length})` : h.clipboardTitle;
    }
    if (!listEl || !emptyEl) return;
    if (items.length === 0) {
      emptyEl.style.display = "block";
      listEl.innerHTML = "";
      return;
    }
    emptyEl.style.display = "none";
    listEl.innerHTML = items
      .map(
        (c) => `
        <div class="shelf-item ${c.pinned ? "pinned-clip" : ""}">
          <span class="shelf-file-name" title="${escapeHtml(c.text)}">${escapeHtml(c.text.replace(/\s+/g, " ").slice(0, 80))}</span>
          <div class="shelf-item-actions">
            <button class="shelf-mini-btn primary" data-clip-act="copy" data-clip-id="${c.id}">${escapeHtml(i18n.t().scratchpad.copy)}</button>
            <button class="shelf-mini-btn ${c.pinned ? "primary" : ""}" data-clip-act="pin" data-clip-id="${c.id}">${escapeHtml(h.clipboardPin)}</button>
            <button class="shelf-mini-btn danger" data-clip-act="del" data-clip-id="${c.id}">✕</button>
          </div>
        </div>
      `
      )
      .join("");

    listEl.querySelectorAll<HTMLButtonElement>("[data-clip-act]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.clipId || "";
        const act = btn.dataset.clipAct;
        const found = clipboardHistory.getAll().find((x) => x.id === id);
        if (act === "copy" && found) {
          try {
            await navigator.clipboard.writeText(found.text);
            soundEngine.playCuteChirp("click");
            btn.textContent = h.shelfCopied;
            setTimeout(() => { btn.textContent = i18n.t().scratchpad.copy; }, 1100);
          } catch {}
        } else if (act === "pin") {
          clipboardHistory.togglePin(id);
          this.renderClipboardList();
        } else if (act === "del") {
          clipboardHistory.remove(id);
          this.renderClipboardList();
        }
      });
    });
  }

  // ==========================================
  // To-Do, Reminders, Water, Pet Care & Monitors
  // ==========================================

  private renderTodosList(): void {
    const listEl = this.slotExpanded.querySelector("#todo-list");
    if (!listEl) return;
    const todos = wellnessManager.getState().todos;
    listEl.innerHTML = todos
      .map(
        (item) => `
        <div class="mini-list-row ${item.done ? "done" : ""}">
          <input type="checkbox" class="todo-chk" data-todo-id="${item.id}" ${item.done ? "checked" : ""} />
          <span class="mini-list-text">${escapeHtml(item.text)}</span>
          <button class="shelf-mini-btn danger" data-todo-del="${item.id}">✕</button>
        </div>
      `
      )
      .join("");

    listEl.querySelectorAll<HTMLInputElement>(".todo-chk").forEach((chk) => {
      chk.addEventListener("change", (e) => {
        e.stopPropagation();
        const res = wellnessManager.toggleTodo(chk.dataset.todoId || "");
        if (res?.done && res.xpAwarded > 0) {
          xpManager.addXP(res.xpAwarded, "Completed daily task");
          dailyRecapManager.recordXP(res.xpAwarded);
          soundEngine.playCuteChirp("happy");
          this.updateLevelBadge();
          this.refreshDailyRecapUI();
        }
        this.renderTodosList();
      });
    });

    listEl.querySelectorAll<HTMLButtonElement>("[data-todo-del]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        wellnessManager.removeTodo(btn.dataset.todoDel || "");
        this.renderTodosList();
      });
    });
  }

  private async refreshRemindersList(): Promise<void> {
    const listEl = this.slotExpanded.querySelector("#reminder-list");
    if (!listEl) return;
    const rows = (await appBridge.listReminders()).filter((r) => r.status === "pending").slice(0, 4);
    listEl.innerHTML = rows
      .map((r) => {
        const dt = new Date(r.due_time * 1000);
        const timeStr = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
        return `
          <div class="mini-list-row">
            <span class="shelf-ext-badge">${timeStr}</span>
            <span class="mini-list-text">${escapeHtml(r.text)}</span>
            <button class="shelf-mini-btn danger" data-rem-del="${r.id}">✕</button>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll<HTMLButtonElement>("[data-rem-del]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await appBridge.deleteReminder(Number(btn.dataset.remDel));
        this.refreshRemindersList();
      });
    });
  }

  private async populateMonitorsDropdown(): Promise<void> {
    const sel = this.slotExpanded.querySelector("#setting-monitor") as HTMLSelectElement;
    if (!sel) return;
    const mons = await appBridge.getAvailableMonitors();
    if (!mons || mons.length === 0) {
      sel.innerHTML = `<option value="0">Monitor 1</option>`;
      return;
    }
    sel.innerHTML = mons
      .map((m, idx) => `<option value="${idx}" ${m.is_primary ? "selected" : ""}>Monitor ${idx + 1} (${m.width}x${m.height})</option>`)
      .join("");
  }

  private syncPetNameUI(): void {
    const name = wellnessManager.getPetName();
    const el = this.slotExpanded.querySelector("#expanded-pet-name");
    if (el) el.textContent = name;
  }

  private refreshWaterUI(): void {
    const w = wellnessManager.getState();
    const valEl = this.slotExpanded.querySelector("#water-count-val");
    const fillEl = this.slotExpanded.querySelector("#water-progress-fill") as HTMLElement;
    if (valEl) valEl.textContent = `${w.waterGlasses} / ${w.waterGoal}`;
    if (fillEl) {
      const pct = Math.min(100, Math.round((w.waterGlasses / w.waterGoal) * 100));
      fillEl.style.width = `${pct}%`;
    }
  }

  private refreshPetCareUI(): void {
    const st = petCareManager.applyDecay();
    const eFill = this.slotExpanded.querySelector("#care-energy-fill") as HTMLElement;
    const hFill = this.slotExpanded.querySelector("#care-happy-fill") as HTMLElement;
    const eVal = this.slotExpanded.querySelector("#care-energy-val");
    const hVal = this.slotExpanded.querySelector("#care-happy-val");
    if (eFill) eFill.style.width = `${st.energy}%`;
    if (hFill) hFill.style.width = `${st.happiness}%`;
    if (eVal) eVal.textContent = `${st.energy}%`;
    if (hVal) hVal.textContent = `${st.happiness}%`;
  }

  private syncAmbientMixerUI(): void {
    const activeMode = soundEngine.getAmbientMode();
    this.slotExpanded.querySelectorAll<HTMLButtonElement>("[data-ambient-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.ambientMode === activeMode);
    });
  }

  private renderSkinsPicker(): void {
    const grid = this.slotExpanded.querySelector("#skins-picker-grid");
    if (!grid) return;
    const current = skinLoader.getCurrentSkin();
    grid.innerHTML = skinLoader
      .getPresets()
      .map(
        (skin) => `
        <button class="skin-swatch-card ${skin.id === current.id ? "active" : ""}" data-skin-id="${skin.id}">
          <span class="skin-swatch-dot" style="background: linear-gradient(135deg, ${skin.swatch[0]} 50%, ${skin.swatch[1]} 50%);"></span>
          <span class="skin-swatch-name">${escapeHtml(skin.name)}</span>
        </button>
      `
      )
      .join("");

    grid.querySelectorAll<HTMLButtonElement>(".skin-swatch-card").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const applied = skinLoader.selectSkin(btn.dataset.skinId || "");
        if (applied) {
          soundEngine.playCuteChirp("click");
          this.renderSkinsPicker();
        }
      });
    });
  }

  private updateChaseButtonLabel(): void {
    const btn = this.slotExpanded.querySelector("#btn-pet-chase");
    if (!btn) return;
    const t = i18n.t().petHub;
    btn.textContent = this.isChasingCursor ? t.stopChase : t.chaseCursor;
    btn.classList.toggle("active-toggle", this.isChasingCursor);
  }

  // ==========================================
  // Weather, Tabs, Timer & Music Pro
  // ==========================================

  private setupWeatherPolling(): void {
    const refresh = async () => {
      if (!weatherService.getSettings().enabled) {
        this.renderWeatherBadge(null);
        return;
      }
      this.renderWeatherBadge(await weatherService.fetchWeather(false));
    };
    refresh();
    this.weatherTimer = window.setInterval(refresh, 20 * 60 * 1000);
  }

  private renderWeatherBadge(snap: WeatherSnapshot | null): void {
    if (!this.idleWeatherBadge) return;
    if (!snap) {
      this.idleWeatherBadge.style.display = "none";
      return;
    }
    const condMap = i18n.t().petHub.weatherConditions;
    this.idleWeatherBadge.textContent = `${snap.tempC}°C`;
    this.idleWeatherBadge.title = `${snap.city} | ${condMap[snap.condition] || snap.condition}`;
    this.idleWeatherBadge.style.display = "inline-flex";
  }

  private switchSubView(view: "hub" | "tools" | "settings"): void {
    this.expandedSubView = view;
    this.slotExpanded.querySelectorAll<HTMLButtonElement>(".hub-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === view);
    });
    this.slotExpanded.querySelector("#subview-hub")?.classList.toggle("active", view === "hub");
    this.slotExpanded.querySelector("#subview-tools")?.classList.toggle("active", view === "tools");
    this.slotExpanded.querySelector("#subview-settings")?.classList.toggle("active", view === "settings");

    if (view === "settings") {
      this.updateLevelBadge();
      this.renderSkinsPicker();
      this.renderWardrobe();
      this.populateMonitorsDropdown();
    } else if (view === "tools") {
      this.syncHubTimerUI();
      this.syncAmbientMixerUI();
      this.renderTodosList();
      this.refreshRemindersList();
    } else {
      this.refreshPetCareUI();
      this.refreshWaterUI();
      this.refreshDailyRecapUI();
    }
    this.onRequestResize?.(408, 472);
  }

  private syncHubTimerUI(): void {
    const st = timerEngine.getState();
    const t = i18n.t().petHub;
    const digitsEl = this.slotExpanded.querySelector("#focus-timer-digits");
    const btnEl = this.slotExpanded.querySelector("#btn-focus-timer-toggle-run");
    const secs = st === "idle" || st === "finished" ? 25 * 60 : Math.max(0, timerEngine.getRemainingSec());
    const m = String(Math.floor(secs / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    if (digitsEl) digitsEl.textContent = `${m}:${s}`;
    if (btnEl) btnEl.textContent = st === "running" ? t.pause : st === "paused" ? t.resume : t.start;
  }

  private refreshDailyRecapUI(): void {
    const stats = dailyRecapManager.getTodayStats();
    const xpStats = xpManager.getStats();
    const wState = wellnessManager.getState();
    const fEl = this.slotExpanded.querySelector("#recap-focus-val");
    const xEl = this.slotExpanded.querySelector("#recap-xp-val");
    const stEl = this.slotExpanded.querySelector("#recap-stars-val");
    const sEl = this.slotExpanded.querySelector("#recap-streak-val");
    if (fEl) fEl.textContent = `${stats.focusMinutes}m`;
    if (xEl) xEl.textContent = `${stats.xpEarned}`;
    if (stEl) stEl.textContent = `${wState.starsCaught}`;
    if (sEl) sEl.textContent = `${xpStats.streakDays}d`;
  }

  public updatePlayPauseIcon(isPlaying: boolean): void {
    const playPauseBtn = this.slotMusic.querySelector("#music-btn-play-pause") as HTMLButtonElement;
    const pauseSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    const playSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    if (playPauseBtn) {
      playPauseBtn.innerHTML = isPlaying ? pauseSvg : playSvg;
      playPauseBtn.classList.toggle("is-playing", isPlaying);
      playPauseBtn.classList.toggle("is-paused", !isPlaying);
    }
    const proPlayBtn = this.slotMusicExpanded.querySelector("#music-pro-play") as HTMLButtonElement;
    if (proPlayBtn) {
      proPlayBtn.innerHTML = isPlaying
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    }
    const hubPlay = this.slotExpanded.querySelector("#hub-music-play");
    if (hubPlay) hubPlay.textContent = isPlaying ? "❚❚" : "▶";
  }

  private tickMusicProgressUI(): void {
    let pos = this.mediaPositionMs;
    if (this.isMusicPlaying && this.mediaLastUpdateMs > 0) pos += Date.now() - this.mediaLastUpdateMs;
    if (this.mediaDurationMs > 0) pos = Math.min(pos, this.mediaDurationMs);
    const elapsedEl = this.slotMusicExpanded.querySelector("#music-pro-elapsed");
    const durEl = this.slotMusicExpanded.querySelector("#music-pro-duration");
    const fillEl = this.slotMusicExpanded.querySelector("#music-pro-progress-fill") as HTMLElement;
    if (elapsedEl) elapsedEl.textContent = formatDurationMs(pos);
    if (durEl) durEl.textContent = this.mediaDurationMs > 0 ? formatDurationMs(this.mediaDurationMs) : "--:--";
    if (fillEl) {
      const pct = this.mediaDurationMs > 0 ? Math.min(100, (pos / this.mediaDurationMs) * 100) : 0;
      fillEl.style.width = `${pct.toFixed(1)}%`;
    }
  }

  public updateMusicUi(media: any): void {
    if (!media) return;
    eventBus.emit("music:ambient-update", media);

    const tMusic = i18n.t().music;
    const title = media.title || (media.has_session ? tMusic.audioPlayer : tMusic.notPlaying);
    const baseArtist = (media.artist || media.album || (media.has_session ? tMusic.audioPlayer : "--")).trim();
    const album = (media.album || "").trim();

    const titleEl = this.slotMusic.querySelector("#music-track-title");
    const artistEl = this.slotMusic.querySelector("#music-artist-subtitle");
    if (titleEl) titleEl.textContent = title;
    if (artistEl) {
      artistEl.textContent = media.is_playing
        ? baseArtist
        : media.has_session && (media.title || media.artist)
          ? `${baseArtist} (${tMusic.paused})`
          : baseArtist;
    }

    const proTitle = this.slotMusicExpanded.querySelector("#music-pro-title");
    const proArtist = this.slotMusicExpanded.querySelector("#music-pro-artist");
    const proAlbum = this.slotMusicExpanded.querySelector("#music-pro-album");
    if (proTitle) proTitle.textContent = title;
    if (proArtist) proArtist.textContent = baseArtist;
    if (proAlbum) proAlbum.textContent = album && album !== title ? album : "";

    const applyArt = (imgSel: string, fbSel: string, root: HTMLElement) => {
      const img = root.querySelector(imgSel) as HTMLImageElement | null;
      const fb = root.querySelector(fbSel) as HTMLElement | null;
      if (!img || !fb) return;
      if (media.thumbnail_base64) {
        img.src = media.thumbnail_base64;
        img.style.display = "block";
        fb.style.display = "none";
      } else {
        img.style.display = "none";
        fb.style.display = "block";
      }
    };
    applyArt("#music-art-image", "#music-art-fallback", this.slotMusic);
    applyArt("#music-pro-art-img", "#music-pro-art-fallback", this.slotMusicExpanded);

    this.mediaPositionMs = Number(media.position_ms || 0);
    this.mediaDurationMs = Number(media.duration_ms || 0);
    this.mediaLastUpdateMs = Date.now();
    this.tickMusicProgressUI();

    const hubCard = this.slotExpanded.querySelector("#hub-music-card") as HTMLElement;
    const hubTitle = this.slotExpanded.querySelector("#hub-music-title");
    const hubArtist = this.slotExpanded.querySelector("#hub-music-artist");
    if (hubCard) hubCard.style.display = media.has_session && (media.title || media.artist) ? "block" : "none";
    if (hubTitle) hubTitle.textContent = title;
    if (hubArtist) hubArtist.textContent = baseArtist;

    this.isMusicPlaying = !!media.is_playing;
    this.updatePlayPauseIcon(this.isMusicPlaying);
    if (this.idleMusicWave) this.idleMusicWave.style.display = this.isMusicPlaying ? "flex" : "none";

    if (this.currentSlotName === "music-expanded") {
      if (!media.has_session) {
        activityManager.remove("music_live");
        eventBus.emit("island:request-state", "idle");
      }
      return;
    }

    if (media.is_playing) {
      activityManager.push({ id: "music_live", type: "music_active", islandState: "music", petState: "dance" });
    } else if (media.has_session && (media.title || media.artist)) {
      activityManager.push({ id: "music_live", type: "music_active", islandState: "music", petState: "idle", autoDismissMs: 20000 });
    } else {
      activityManager.remove("music_live");
    }
  }

  public getIsMusicPlaying(): boolean {
    return this.isMusicPlaying;
  }

  public getPetAnchor(slotName: string): HTMLElement | null {
    switch (slotName) {
      case "collapsed": return this.slotCollapsed.querySelector(".slot-left-pet-anchor");
      case "idle":
      case "peek": return this.slotIdle.querySelector(".slot-left-pet-anchor");
      case "notification": return this.slotNotification.querySelector(".slot-left-pet-anchor");
      case "expanded": return this.slotExpanded.querySelector(".slot-left-pet-anchor");
      case "timer": return this.slotTimer.querySelector(".slot-left-pet-anchor");
      case "music": return this.slotMusic.querySelector(".slot-left-pet-anchor");
      case "volume": return this.slotVolume.querySelector(".slot-left-pet-anchor");
      case "hud": return this.slotHud.querySelector(".slot-left-pet-anchor");
      default: return null;
    }
  }

  public showSlot(name: string): void {
    this.currentSlotName = name;
    const slots = [
      this.slotCollapsed,
      this.slotIdle,
      this.slotNotification,
      this.slotExpanded,
      this.slotTimer,
      this.slotMusic,
      this.slotMusicExpanded,
      this.slotVolume,
      this.slotHud,
      this.slotShelf,
      this.slotClipboard,
      this.slotMemo,
    ];

    let target: HTMLElement;
    switch (name) {
      case "collapsed": target = this.slotCollapsed; break;
      case "empty-pill":
      case "docking":
        slots.forEach((s) => { s.classList.remove("active"); s.classList.add("fade-out"); });
        return;
      case "idle":
      case "peek": target = this.slotIdle; break;
      case "notification": target = this.slotNotification; break;
      case "expanded":
        target = this.slotExpanded;
        this.refreshPetCareUI();
        this.refreshWaterUI();
        this.syncAmbientMixerUI();
        this.syncHubTimerUI();
        this.refreshDailyRecapUI();
        this.onRequestResize?.(408, 472);
        break;
      case "timer":
        target = this.slotTimer;
        timerModule.renderCompact(this.slotTimer, { mintuInside: !document.body.classList.contains("mintu-outside") });
        break;
      case "music": target = this.slotMusic; break;
      case "music-expanded":
        target = this.slotMusicExpanded;
        this.tickMusicProgressUI();
        break;
      case "volume": target = this.slotVolume; break;
      case "hud": target = this.slotHud; break;
      case "shelf":
        target = this.slotShelf;
        this.renderShelfList();
        break;
      case "clipboard":
        target = this.slotClipboard;
        this.renderClipboardList();
        break;
      case "memo":
        target = this.slotMemo;
        this.initMemoView();
        setTimeout(() => this.memoTextarea?.focus(), 120);
        break;
      default: target = this.slotIdle;
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

  public setNotification(payload: NotificationPayload): void {
    this.currentNotification = payload;
    if (!timerEngine.isFocusModeActive()) {
      eventBus.emit("pet:action", { type: "state", payload: "alert" });
    }
    const mode = document.body.classList.contains("mintu-outside") ? "island-outside" : "island-inside";

    NotificationRow.render(this.slotNotification, payload, mode, {
      onDismiss: () => {
        activityManager.dismissCurrent();
        this.onRequestCollapse?.();
      },
      onAction: async (actionId) => {
        eventBus.emit("island:notification-action", { actionId });
        if (actionId === "wellness_drank") {
          const res = wellnessManager.drinkWater();
          xpManager.addXP(res.xpAwarded, "Drank water");
          dailyRecapManager.recordXP(res.xpAwarded);
          soundEngine.playCuteChirp("happy");
          this.refreshWaterUI();
          this.updateLevelBadge();
          this.refreshDailyRecapUI();
          activityManager.dismissCurrent();
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
        const appName = this.currentNotification.appName || this.currentNotification.title;
        try {
          await appBridge.focusAppWindow(appName);
          activityManager.dismissCurrent();
          this.onRequestCollapse?.();
        } catch {
          activityManager.dismissCurrent();
          this.onRequestCollapse?.();
        }
      },
    });
  }

  private startClock(): void {
    const update = () => {
      const now = new Date();
      if (this.clockEl) {
        this.clockEl.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      }
    };
    update();
    this.clockInterval = window.setInterval(update, 10000);
  }

  private startWaveformAnimation(): void {
    const bars = Array.from(this.slotMusic.querySelectorAll<HTMLElement>(".wave-bar"));
    const idleBars = Array.from(this.slotIdle.querySelectorAll<HTMLElement>(".wave-bar"));
    const tick = (t: number) => {
      if (this.isMusicPlaying) {
        bars.forEach((bar, i) => {
          bar.style.height = `${4 + Math.round((Math.sin(t * 0.008 + i * 0.85) * 0.5 + 0.5) * 10)}px`;
        });
        idleBars.forEach((bar, i) => {
          bar.style.height = `${4 + Math.round((Math.sin(t * 0.009 + i * 1.1) * 0.5 + 0.5) * 8)}px`;
        });
      }
      this.waveformAnimId = requestAnimationFrame(tick);
    };
    this.waveformAnimId = requestAnimationFrame(tick);
  }

  private initMemoView(): void {
    try { this.memoTextarea.value = localStorage.getItem(MEMO_STORAGE_KEY) || ""; } catch {}
    this.updateMemoCharCount();
  }

  private updateMemoCharCount(): void {
    const el = this.slotMemo.querySelector("#memo-char-count");
    if (el) el.textContent = `${this.memoTextarea.value.length} ${i18n.t().scratchpad.characters}`;
  }

  public handleQuickNote(): void {
    eventBus.emit("island:request-state", "memo");
  }

  private setupBatteryCheck(): void {
    const poll = async () => {
      try {
        const st = await appBridge.getPowerStatus();
        if (st && this.idlePowerBadge) {
          if (st.is_battery && st.battery_percent <= 30) {
            this.idlePowerBadge.textContent = `${st.battery_percent}%`;
            this.idlePowerBadge.style.display = "inline-flex";
          } else {
            this.idlePowerBadge.style.display = "none";
          }
        }
      } catch {}
    };
    poll();
    this.batteryTimer = window.setInterval(poll, 60000);
  }

  private checkUpdatesSilently(): void {
    updateChecker
      .checkForUpdates()
      .then((info: any) => {
        if (info && info.available) {
          const banner = this.slotExpanded.querySelector("#mintu-update-banner") as HTMLElement;
          const text = this.slotExpanded.querySelector("#mintu-update-text");
          if (banner && text) {
            text.textContent = `Mintu v${info.latestVersion} available!`;
            banner.style.display = "flex";
            this.slotExpanded.querySelector("#btn-mintu-update-open")?.addEventListener("click", () => {
              if (info.releaseUrl) window.open(info.releaseUrl, "_blank");
            });
            this.slotExpanded.querySelector("#btn-mintu-update-close")?.addEventListener("click", () => {
              banner.style.display = "none";
            });
          }
        }
      })
      .catch(() => {});
  }

  public showRandomDailyTip(): void {
    const tips = i18n.t().petHub.tips;
    const pick = tips[Math.floor(Math.random() * tips.length)];
    soundEngine.playCuteChirp("happy");
    eventBus.emit("pet:say", { text: pick });
    this.showCustomHud(`<div class="hud-device-row"><span class="hud-text-main">${escapeHtml(pick)}</span></div>`, 3600, "happy");
  }

  public updateLevelBadge(): void {
    const progress = xpManager.getProgress();
    const stats = xpManager.getStats();
    const t = i18n.t();
    const petName = wellnessManager.getPetName();
    const badgeEl = this.slotExpanded.querySelector("#mintu-level-badge");
    if (badgeEl) badgeEl.textContent = `Lvl ${progress.level} | ${stats.totalXP} XP`;

    const titleEl = this.slotExpanded.querySelector("#settings-xp-level-title");
    const pointsBadge = this.slotExpanded.querySelector("#settings-xp-points-badge");
    const progressBar = this.slotExpanded.querySelector("#settings-xp-progress-bar") as HTMLElement;
    const hintEl = this.slotExpanded.querySelector("#settings-xp-hint");

    if (titleEl) titleEl.textContent = `Level ${progress.level} ${petName}`;
    if (pointsBadge) pointsBadge.textContent = `${stats.totalXP} XP (${progress.xpInLevel}/${progress.xpNeededForLevel} XP)`;
    if (progressBar) progressBar.style.width = `${progress.progressPercent}%`;
    if (hintEl) {
      hintEl.textContent = (t.settings.xpStatsHint || "")
        .replace("{pomodoros}", String(stats.pomodorosCompleted))
        .replace("{minutes}", String(stats.focusMinutes));
    }
  }

  public renderWardrobe(): void {
    const gridEl = this.slotExpanded.querySelector("#wardrobe-items-grid");
    if (!gridEl) return;
    const stats = xpManager.getStats();
    const equipped = xpManager.getEquippedAccessory();
    const t = i18n.t();

    const accessories = [
      { id: "none", name: t.settings.wardrobeItems.none, reqLevel: 1 },
      { id: "glasses", name: t.settings.wardrobeItems.glasses, reqLevel: 1 },
      { id: "coffee_cup", name: t.settings.wardrobeItems.coffee_cup, reqLevel: 2 },
      { id: "winter_hat", name: t.settings.wardrobeItems.winter_hat, reqLevel: 3 },
      { id: "headphones", name: t.settings.wardrobeItems.headphones, reqLevel: 4 },
    ];

    gridEl.innerHTML = accessories
      .map((acc) => {
        const isUnlocked = stats.unlockedAccessories.includes(acc.id) || stats.level >= acc.reqLevel;
        const isEquipped = equipped === acc.id;
        const statusText = isEquipped
          ? t.settings.wardrobeStatus.equipped
          : isUnlocked
            ? t.settings.wardrobeStatus.equip
            : t.settings.wardrobeStatus.unlocksAt.replace("{lvl}", String(acc.reqLevel)).replace("{level}", String(acc.reqLevel));
        return `
          <div class="wardrobe-item-card ${isEquipped ? "equipped" : ""} ${!isUnlocked ? "locked" : ""}" data-acc-id="${acc.id}">
            <div class="wardrobe-item-name">${escapeHtml(acc.name)}</div>
            <div class="wardrobe-item-status">${escapeHtml(statusText)}</div>
          </div>
        `;
      })
      .join("");

    gridEl.querySelectorAll(".wardrobe-item-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (card as HTMLElement).dataset.accId;
        if (!id) return;
        const targetAcc = accessories.find((a) => a.id === id);
        const reqLevel = targetAcc?.reqLevel || 1;
        if (!(stats.unlockedAccessories.includes(id) || stats.level >= reqLevel)) return;
        xpManager.equipAccessory(id);
        this.renderWardrobe();
      });
    });
  }

  public applyUiTranslations(lang: SupportedLanguage): void {
    i18n.setLang(lang);
    const t = i18n.t();
    const h = t.petHub;
    const setText = (sel: string, val: string) => {
      const el = this.container.querySelector(sel);
      if (el) el.textContent = val;
    };
    const setPh = (sel: string, val: string) => {
      const el = this.container.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) el.placeholder = val;
    };

    // 3 Tabs
    setText("#tab-btn-pet", h.tabPet);
    setText("#tab-btn-tools", h.tabTools);
    setText("#tab-btn-settings", h.tabSettings);

    // Pet Tab
    setText("#lbl-care-energy", h.energy);
    setText("#lbl-care-happy", h.happiness);
    setText("#btn-care-cookie", h.feedCookie);
    setText("#btn-care-tea", h.giveTea);
    setText("#btn-pet-pat", h.patMintu);
    setText("#lbl-water-title", h.waterTitle);
    setText("#btn-water-drink", h.waterDrink);
    this.updateChaseButtonLabel();
    setText("#btn-pet-star", h.dropStar);
    setText("#btn-pet-dance", h.dance);
    setText("#btn-pet-sleep", h.sleep);
    setText("#btn-pet-free", h.desktopMode);
    setText("#btn-pet-color", h.colorPicker);
    setText("#lbl-hub-now-playing", h.nowPlaying);
    setText("#lbl-stat-focus", h.focusStat);
    setText("#lbl-stat-xp", h.xpToday);
    setText("#lbl-stat-stars", h.starsCaught);
    setText("#lbl-stat-streak", h.streak);

    // Tools Tab
    setPh("#quick-calc-input", h.quickCalcPlaceholder);
    setText("#hub-timer-label", h.focusTimer);
    setText("#btn-focus-timer-reset", h.reset);
    this.syncHubTimerUI();
    setText("#lbl-ambient-title", h.ambientTitle);
    setText("#btn-amb-off", h.ambientOff);
    setText("#btn-amb-rain", h.ambientRain);
    setText("#btn-amb-fire", h.ambientFireplace);
    setText("#btn-amb-brown", h.ambientBrown);
    setText("#btn-amb-white", h.ambientWhite);
    setText("#lbl-todos-title", h.todosTitle);
    setPh("#todo-input", h.todoPlaceholder);
    setText("#btn-todo-add", h.todoAdd);
    setText("#lbl-reminders-title", h.remindersTitle);
    setPh("#reminder-input", h.reminderPlaceholder);
    setText("#btn-reminder-add", h.reminderAdd);
    setText("#btn-tools-tip", h.dailyTip);

    // Drawers & Memo
    setText("#lbl-shelf-title", h.shelfTitle);
    setText("#lbl-shelf-hint", h.shelfDropHint);
    setText("#shelf-empty-state", h.shelfEmpty);
    setText("#btn-shelf-clear", h.shelfClear);
    setText("#lbl-clipboard-title", h.clipboardTitle);
    setText("#clipboard-empty-state", h.clipboardEmpty);
    setText("#btn-clipboard-clear", h.clipboardClear);
    setText("#lbl-memo-title", t.scratchpad.title);
    setText("#btn-memo-copy", t.scratchpad.copy);
    setText("#btn-memo-clear", t.scratchpad.clear);
    setPh("#memo-textarea", t.scratchpad.placeholder);
    this.updateMemoCharCount();

    // Settings Tab
    setText("#lbl-pet-name", h.petNameLabel);
    setText("#btn-pet-name-save", h.petNameSave);
    setText("#lbl-skins-title", h.skinsTitle);
    setText("#lbl-setting-weather", h.weatherToggle);
    setText("#btn-weather-save", h.weatherSave);
    setPh("#setting-weather-city", h.weatherCityPlaceholder);
    setText("#lbl-setting-water-int", h.waterIntervalLabel);
    setText("#lbl-setting-eyebreak", h.eyeBreak2020);
    setText("#lbl-setting-chime", h.hourlyChime);
    setText("#lbl-setting-lang", t.settings.appLanguage);
    setText("#lbl-setting-monitor", h.monitorSelect);
    setText("#lbl-setting-bongo", h.bongoTyping);
    setText("#lbl-setting-fullscreen", h.fullscreenAutoHide);
    setText("#lbl-setting-netspeed", h.netSpeedPill);
    setText("#lbl-setting-mood", h.moodReactions);
    setText("#lbl-setting-quiet", h.quietMode);
    setText("#lbl-setting-walk", h.walkWindows);
    setText("#lbl-setting-sound", h.cuteSounds);
    setText("#lbl-setting-autostart", h.autostart);
    setText("#lbl-setting-outside", h.islandWhenFree);
    setText("#opt-outside-pill", h.miniPill);
    setText("#opt-outside-hide", h.hideIsland);
    setText("#lbl-setting-dev", h.devPanel);

    this.updateLevelBadge();
    this.renderWardrobe();
    this.renderShelfList();
    this.renderClipboardList();
    this.renderWeatherBadge(weatherService.getCached());
  }

  public dispose(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.wellnessTimer) clearInterval(this.wellnessTimer);
    if (this.batteryTimer) clearInterval(this.batteryTimer);
    if (this.weatherTimer) clearInterval(this.weatherTimer);
    if (this.networkTimer) clearInterval(this.networkTimer);
    if (this.focusTickTimer) clearInterval(this.focusTickTimer);
    if (this.waveformAnimId) cancelAnimationFrame(this.waveformAnimId);
  }
}
