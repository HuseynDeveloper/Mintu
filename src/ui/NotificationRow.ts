import { getAppIconSvg } from "./AppIcons";

export interface NotificationAction {
  id: string;
  label: string;
  primary?: boolean;
}

export interface NotificationPayload {
  id?: string;
  title: string;
  text: string;
  appName?: string;
  appIcon?: string;
  icon?: string;
  source?: string;
  target?: string;
  urgent?: boolean;
  actions?: NotificationAction[];
  timestamp?: number;
}

export type NotificationRenderMode = "island-inside" | "island-outside" | "free-card" | "collapsed";

export class NotificationRow {
  /**
   * Render a notification strictly adhering to Image B and Image K bugfix rules:
   * 1. Exactly ONE source icon per notification.
   * 2. When Mintu is inside the island: Mintu occupies the pet slot; the single source icon sits in the source badge next to the app label. NEVER in the pet slot.
   * 3. When Mintu is outside roaming: the single source icon occupies the left pet anchor (28-32px), and the badge icon is omitted.
   * 4. Text columns have min-width: 0 and text-overflow: ellipsis to prevent clipping or layout breakage.
   * 5. Fallback icon is used if app icon is missing; never an empty gap and never a second icon.
   */
  public static render(
    container: HTMLElement,
    payload: NotificationPayload,
    mode: NotificationRenderMode,
    handlers?: {
      onAction?: (actionId: string) => void;
      onDismiss?: () => void;
      onClick?: () => void;
    }
  ): void {
    const isPrivacyHidden = localStorage.getItem("mintu_privacy_hide_notif_content") === "true";
    const appName = payload.appName || "Notification";
    const titleText = isPrivacyHidden ? appName : payload.title || "Notification";
    const subText = isPrivacyHidden ? "New notification" : payload.text || "";

    const rawIcon = payload.appIcon || payload.icon;
    let iconHtml = "";
    if (rawIcon && (rawIcon.startsWith("data:image/") || rawIcon.startsWith("http://") || rawIcon.startsWith("https://"))) {
      iconHtml = `<img src="${rawIcon}" class="notif-img-icon" alt="${appName}" />`;
    } else if (rawIcon && rawIcon.includes("<svg")) {
      iconHtml = rawIcon;
    } else {
      iconHtml = getAppIconSvg(appName, rawIcon);
    }

    if (mode === "island-inside") {
      // Mintu is inside: reserved 52px mintuSlot guarantees Mintu never overlaps the source badge.
      // Layout: [mintuSlot] -> [Source badge: 1 icon + app name] -> [Text: title + subtitle] -> [Actions] -> [Dismiss]
      container.innerHTML = `
        <div class="island-layout has-mintu-slot">
          <div class="island-slot-mintu" data-slot="mintuSlot"></div>
          <div class="island-slot-content" data-slot="content">
            <div class="notif-header" style="display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0;">
              <div class="notif-source-badge" title="${appName}">
                <div class="notif-app-icon">${iconHtml}</div>
                <span class="notif-app-label">${appName}</span>
              </div>
              <div class="notif-text-col" style="min-width: 0; flex: 1;">
                <div class="notif-title" title="${titleText}">${titleText}</div>
                <div class="notif-subtitle" title="${subText}">${subText}</div>
              </div>
            </div>
            <div class="notif-actions" style="display: ${payload.actions && payload.actions.length > 0 ? "flex" : "none"};">
              ${(payload.actions || [])
                .map(
                  (act) => `
                <button class="notif-btn ${act.primary ? "primary" : "secondary"}" data-action-id="${act.id}">
                  ${act.label}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
          <div class="island-slot-trailing" data-slot="trailing">
            <button class="notif-dismiss-btn" id="notif-dismiss-btn" title="Dismiss" aria-label="Dismiss notification">✕</button>
          </div>
        </div>
      `;
    } else if (mode === "island-outside") {
      // Mintu is outside roaming: mintuSlot is omitted, content takes the left edge with no leftover gap.
      // The single large source icon (28-32px) sits on the left edge.
      container.innerHTML = `
        <div class="island-layout mintu-less">
          <div class="island-slot-content" data-slot="content">
            <div class="notif-outside-layout" style="display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0;">
              <div class="notif-large-icon-anchor" style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                ${iconHtml}
              </div>
              <div class="notif-text-col" style="min-width: 0; flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="notif-app-label">${appName}</span>
                </div>
                <div class="notif-title" title="${titleText}">${titleText}</div>
                <div class="notif-subtitle" title="${subText}">${subText}</div>
              </div>
            </div>
            <div class="notif-actions" style="display: ${payload.actions && payload.actions.length > 0 ? "flex" : "none"};">
              ${(payload.actions || [])
                .map(
                  (act) => `
                <button class="notif-btn ${act.primary ? "primary" : "secondary"}" data-action-id="${act.id}">
                  ${act.label}
                </button>
              `
                )
                .join("")}
            </div>
          </div>
          <div class="island-slot-trailing" data-slot="trailing">
            <button class="notif-dismiss-btn" id="notif-dismiss-btn" title="Dismiss" aria-label="Dismiss notification">✕</button>
          </div>
        </div>
      `;
    } else if (mode === "free-card") {
      container.innerHTML = `
        <div class="free-notif-row" style="display: flex; align-items: center; gap: 8px; width: 100%;">
          <div class="notif-app-icon" style="width: 24px; height: 24px; flex-shrink: 0;">${iconHtml}</div>
          <div class="notif-text-col" style="min-width: 0; flex: 1;">
            <div class="notif-title" style="font-size: 12px; font-weight: 600;" title="${titleText}">${titleText}</div>
            <div class="notif-subtitle" style="font-size: 11px; color: #9ca3af;" title="${subText}">${subText}</div>
          </div>
          <button class="notif-dismiss-btn" id="notif-dismiss-btn" title="Dismiss">✕</button>
        </div>
      `;
    } else if (mode === "collapsed") {
      container.innerHTML = `
        <div class="collapsed-notif-peek" style="display: flex; align-items: center; gap: 6px;">
          <div class="notif-collapsed-icon" style="width: 14px; height: 14px;">${iconHtml}</div>
          <span style="font-size: 10px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${titleText}</span>
        </div>
      `;
    }

    // Attach button listeners
    const dismissBtn = container.querySelector("#notif-dismiss-btn");
    dismissBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers?.onDismiss?.();
    });

    const actionButtons = container.querySelectorAll(".notif-btn");
    actionButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const actionId = (btn as HTMLElement).dataset.actionId;
        if (actionId) {
          handlers?.onAction?.(actionId);
        }
      });
    });

    container.onclick = (e) => {
      const target = e.target as HTMLElement;
      if (target.closest("#notif-dismiss-btn") || target.closest(".notif-btn")) {
        return;
      }
      handlers?.onClick?.();
    };
  }
}
