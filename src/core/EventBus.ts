/**
 * Mintu Typed Event Bus
 * Facilitates decoupled communication between Pet, Island, Debug Panel,
 * and future milestone modules (AI sidecar, screen context, system tools).
 */

export type MintuEventMap = {
  // Pet events
  "pet:state-change": { from: string; to: string };
  "pet:action": { type: string; payload?: unknown };
  "pet:say": { text: string; durationMs?: number };
  "pet:look-at": { x: number; y: number };
  "pet:drag-start": { x: number; y: number };
  "pet:drag-end": { x: number; y: number; vx: number; vy: number };

  // Island events
  "island:state-change": { from: string; to: string };
  "island:notify": {
    icon?: string;
    title: string;
    text: string;
    actions?: Array<{ id: string; label: string; primary?: boolean }>;
  };
  "island:notification-action": { actionId: string };
  "island:notification-appeared": { isFocusMode: boolean };
  "island:notification-dismissed": Record<string, any>;
  "island:content-change": { slot: string };
  "island:request-state": string;

  // Context & Media simulation events
  "context:set-summary": { summary: string; appName?: string; type?: string; actions?: Array<{ id: string; label: string; primary?: boolean }> };
  "context:attach-chip": { id?: string; type: "code" | "image"; label: string; data: string; appName?: string };
  "media:simulate-state": any;

  // App mode & system events
  "app:mode-change": { mode: "island" | "free" };
  "app:request-mode": { mode: "island" | "free" };
  "app:toggle-mode": Record<string, any>;
  "debug:toggle": { open?: boolean };

  // Settings events
  "settings:outside-behavior-changed": string;
  "settings:dev-panel-changed": boolean;
  "settings:walk-windows-changed": boolean;
  "settings:window-ignore-list-changed": string[];

  // Tool events
  "island:tool_approval_opened": any;
  "island:tool_approval_closed": { id: string };
  "island:tool_approval_dismissed": Record<string, any>;

  // Milestone 5: Chat, Media, and Model events
  "chat:messages-changed": any[];
  "chat:conversations-changed": any[];
  "chat:stream-delta": { delta: string; fullContent: string; convId: string };
  "media-state-changed": any;
  "model-download-progress": any;

  // Milestone 8: Gamification, Living Pet, Smart Clipboard, Updater
  "gamification:xp-gained": { amount: number; reason: string; totalXP: number; level: number; leveledUp: boolean };
  "gamification:stats-updated": any;
  "pet:accessory-changed": string;
  "timer:focus-completed": { durationSec: number; label?: string };
  "chat:message-sent": Record<string, any> | void;
  "clipboard:action-suggested": any;
  "clipboard:action-cleared": Record<string, any>;
  "app:update-available": any;
};

type EventHandler<T> = (data: T) => void;

class EventBus {
  private handlers = new Map<keyof MintuEventMap, Set<EventHandler<any>>>();

  on<K extends keyof MintuEventMap>(event: K, handler: EventHandler<MintuEventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const set = this.handlers.get(event)!;
    set.add(handler);
    return () => set.delete(handler);
  }

  emit<K extends keyof MintuEventMap>(event: K, data: MintuEventMap[K]): void {
    const set = this.handlers.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EventBus] Error in handler for event "${event}":`, err);
        }
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
