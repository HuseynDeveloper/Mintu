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
  "island:content-change": { slot: string };

  // App mode & system events
  "app:mode-change": { mode: "island" | "free" };
  "app:request-mode": { mode: "island" | "free" };
  "debug:toggle": { open?: boolean };
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
