/**
 * Mintu Free Mode Floating Chat Card
 * Appears anchored next to Mintu on desktop when clicked.
 * Syncs seamlessly with SQLite and ChatManager.
 * Full parity with Island mode: chat switching, new chat, draft persistence,
 * message version branching, and local memory saving.
 */

import { chatManager } from "../ai/ChatManager";
import { memoryManager } from "../ai/MemoryManager";
import { MarkdownRenderer } from "../ai/MarkdownRenderer";
import { ChatMessage, Conversation } from "../ai/types";
import { eventBus } from "../core/EventBus";

export class FreeChatCard {
  public readonly el: HTMLElement;
  private messageAreaEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private sendBtnEl: HTMLButtonElement;
  private closeBtnEl: HTMLButtonElement;
  private convSelectEl: HTMLSelectElement;
  private newChatBtnEl: HTMLButtonElement;
  private exportBtnEl: HTMLButtonElement;

  private isVisible: boolean = false;
  private editingMessageId: string | null = null;

  public onClose?: () => void;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "free-chat-card";
    this.el.style.display = "none";

    this.el.innerHTML = `
      <div class="free-card-header">
        <div class="free-card-title">
          <select class="free-card-conv-select" id="free-conv-select" title="Switch chat"></select>
          <button class="free-card-btn-action" id="free-btn-new-chat" title="New chat">+</button>
          <button class="free-card-btn-action" id="free-btn-export-chat" title="Export Markdown">⤓</button>
        </div>
        <button class="free-card-close" title="Close (Esc)">✕</button>
      </div>

      <div class="free-card-body">
        <div class="free-card-messages"></div>
      </div>

      <div class="free-card-input-row">
        <input type="text" class="free-card-input" placeholder="Ask Mintu anything..." />
        <button class="free-card-send" title="Send">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        </button>
      </div>
    `;

    this.messageAreaEl = this.el.querySelector(".free-card-messages")!;
    this.inputEl = this.el.querySelector(".free-card-input")!;
    this.sendBtnEl = this.el.querySelector(".free-card-send")!;
    this.closeBtnEl = this.el.querySelector(".free-card-close")!;
    this.convSelectEl = this.el.querySelector("#free-conv-select")!;
    this.newChatBtnEl = this.el.querySelector("#free-btn-new-chat")!;
    this.exportBtnEl = this.el.querySelector("#free-btn-export-chat")!;

    this.setupEvents();
    this.syncWithChatManager();
  }

  private setupEvents(): void {
    this.closeBtnEl.addEventListener("click", () => {
      this.hide();
      if (this.onClose) this.onClose();
    });

    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.submit();
      } else if (e.key === "Escape") {
        this.hide();
        if (this.onClose) this.onClose();
      }
    });

    // Draft persistence on typing
    this.inputEl.addEventListener("input", () => {
      chatManager.setDraft(this.inputEl.value);
    });

    this.sendBtnEl.addEventListener("click", () => {
      this.submit();
    });

    // Chat switcher
    this.convSelectEl.addEventListener("change", async () => {
      const selectedId = this.convSelectEl.value;
      if (selectedId) {
        await chatManager.switchConversation(selectedId);
        this.inputEl.value = chatManager.getDraft(selectedId);
        this.inputEl.focus();
      }
    });

    // New chat
    this.newChatBtnEl.addEventListener("click", async () => {
      await chatManager.startNewChat();
      this.inputEl.value = "";
      this.inputEl.focus();
    });

    // Export Markdown
    this.exportBtnEl.addEventListener("click", async () => {
      const md = await chatManager.exportMarkdown();
      navigator.clipboard.writeText(md).then(() => {
        eventBus.emit("pet:say", { text: "Chat exported to clipboard!" });
      });
    });
  }

  private submit(): void {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = "";

    if (this.editingMessageId) {
      const editId = this.editingMessageId;
      this.editingMessageId = null;
      chatManager.editMessageAndResend(editId, text);
    } else {
      chatManager.sendMessage(text);
    }
  }

  private syncWithChatManager(): void {
    eventBus.on("chat:messages-changed", (messages: ChatMessage[]) => {
      this.renderMessages(messages);
    });

    eventBus.on("chat:conversations-changed", (conversations: Conversation[]) => {
      this.updateConversationSelect(conversations);
    });

    eventBus.on("chat:stream-delta", () => {
      this.renderMessages(chatManager.getMessages());
    });
  }

  private updateConversationSelect(conversations?: Conversation[]): void {
    const list = conversations || chatManager.getConversations();
    const current = chatManager.getCurrentConversation();
    this.convSelectEl.innerHTML = "";

    list.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      const pinTag = c.pinned ? "[PIN] " : "";
      opt.textContent = `${pinTag}${c.title}`;
      if (current && c.id === current.id) {
        opt.selected = true;
      }
      this.convSelectEl.appendChild(opt);
    });
  }

  private renderMessages(messages: ChatMessage[]): void {
    this.messageAreaEl.innerHTML = "";
    if (messages.length === 0) {
      this.messageAreaEl.innerHTML = `
        <div class="free-empty-hint">
          How can I help you today? Type a question below!
        </div>
      `;
      return;
    }

    // Show last 6 messages in free mode compact card
    const recent = messages.slice(-6);
    recent.forEach((m, idx) => {
      const bubble = document.createElement("div");
      bubble.className = `free-bubble free-bubble-${m.role}`;

      // Parse versions
      let versionsArr: string[] = [];
      try {
        if (m.versions) versionsArr = JSON.parse(m.versions);
      } catch {}
      if (!Array.isArray(versionsArr) || versionsArr.length === 0) {
        versionsArr = [m.content];
      }

      const currentVer = m.version_index || 1;
      const totalVers = versionsArr.length;

      let versionBarHtml = "";
      if (totalVers > 1) {
        versionBarHtml = `
          <div class="free-version-bar">
            <button class="free-version-btn btn-free-prev" data-id="${m.id}" title="Previous version">‹</button>
            <span>v${currentVer}/${totalVers}</span>
            <button class="free-version-btn btn-free-next" data-id="${m.id}" title="Next version">›</button>
          </div>
        `;
      }

      if (m.role === "assistant") {
        const html = MarkdownRenderer.render(m.content);
        bubble.innerHTML = `
          <div>${html || '<span class="thinking-dots">...</span>'}</div>
          ${versionBarHtml}
          <div class="free-actions-row">
            ${idx === recent.length - 1 ? '<button class="free-action-btn btn-free-regen" title="Regenerate" aria-label="Regenerate"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg></button>' : ""}
            <button class="free-action-btn btn-free-copy" title="Copy message" aria-label="Copy message"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
            <button class="free-action-btn btn-free-remember" data-id="${m.id}" title="Remember this" aria-label="Remember this"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></button>
          </div>
        `;

        bubble.querySelector(".btn-free-regen")?.addEventListener("click", () => {
          chatManager.regenerateLast();
        });

        bubble.querySelector(".btn-free-copy")?.addEventListener("click", () => {
          navigator.clipboard.writeText(m.content);
        });

        bubble.querySelector(".btn-free-remember")?.addEventListener("click", async () => {
          await memoryManager.addMemory("fact", m.content, "free_chat");
          eventBus.emit("pet:say", { text: "Saved to memory!" });
          eventBus.emit("pet:action", { type: "state", payload: "happy" });
        });
      } else {
        bubble.innerHTML = `
          <div>${m.content}</div>
          ${versionBarHtml}
          <div class="free-actions-row" style="justify-content: flex-end;">
            <button class="free-action-btn btn-free-edit" title="Edit message" aria-label="Edit message"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
            <button class="free-action-btn btn-free-copy" title="Copy message" aria-label="Copy message"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
        `;

        bubble.querySelector(".btn-free-copy")?.addEventListener("click", () => {
          navigator.clipboard.writeText(m.content);
        });

        bubble.querySelector(".btn-free-edit")?.addEventListener("click", () => {
          bubble.innerHTML = `
            <div class="msg-inline-editor">
              <textarea class="msg-inline-textarea" aria-label="Edit message">${m.content}</textarea>
              <div class="msg-inline-actions">
                <button class="btn-inline-cancel">Cancel</button>
                <button class="btn-inline-save">Save and send</button>
              </div>
            </div>
          `;
          const ta = bubble.querySelector(".msg-inline-textarea") as HTMLTextAreaElement;
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);

          const doSave = () => {
            const val = ta.value.trim();
            if (val && val !== m.content) {
              chatManager.editMessageAndResend(m.id, val);
            } else {
              this.renderMessages(messages);
            }
          };

          bubble.querySelector(".btn-inline-save")?.addEventListener("click", doSave);
          bubble.querySelector(".btn-inline-cancel")?.addEventListener("click", () => this.renderMessages(messages));
          ta.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              doSave();
            } else if (e.key === "Escape") {
              e.preventDefault();
              this.renderMessages(messages);
            }
          });
        });
      }

      // Version switcher buttons
      bubble.querySelector(".btn-free-prev")?.addEventListener("click", (e) => {
        e.stopPropagation();
        chatManager.switchMessageVersion(m.id, "prev");
      });
      bubble.querySelector(".btn-free-next")?.addEventListener("click", (e) => {
        e.stopPropagation();
        chatManager.switchMessageVersion(m.id, "next");
      });

      this.messageAreaEl.appendChild(bubble);
    });

    this.messageAreaEl.scrollTop = this.messageAreaEl.scrollHeight;
  }

  public show(): void {
    this.isVisible = true;
    this.el.style.display = "flex";
    this.updateConversationSelect();
    this.inputEl.value = chatManager.getDraft();
    this.renderMessages(chatManager.getMessages());
    setTimeout(() => this.inputEl.focus(), 100);
  }

  public hide(): void {
    this.isVisible = false;
    this.el.style.display = "none";
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public getIsOpen(): boolean {
    return this.isVisible;
  }

  public updatePosition(petX: number, petY: number): void {
    const cardW = 320;
    const cardH = 220;
    let left = petX - cardW - 16;
    let top = petY - cardH + 40;
    if (left < 16) left = petX + 110;
    if (left + cardW > window.innerWidth - 16) left = window.innerWidth - cardW - 16;
    if (top < 60) top = 60;
    if (top + cardH > window.innerHeight - 16) top = window.innerHeight - cardH - 16;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }
}
