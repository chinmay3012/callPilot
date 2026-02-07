/**
 * EventBus — Simulates Socket.io event transport.
 *
 * BACKEND RESPONSIBILITY:
 * In production, this would be replaced by a real Socket.io connection.
 * Events emitted here mirror the exact payloads a Node.js backend would send.
 *
 * Migration guide:
 *   - Replace `eventBus.on()`  → `socket.on()`
 *   - Replace `eventBus.emit()` → `socket.emit()` (client) / `io.to(room).emit()` (server)
 *   - Replace `eventBus.off()`  → `socket.off()`
 *
 * Supported events:
 *   swarm:start       — Swarm orchestrator initialized
 *   swarm:update      — Individual agent status change
 *   swarm:completed   — All agents finished, winner selected
 *   agent:booked      — Single agent confirmed a booking
 */

type EventCallback = (payload: unknown) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /** Subscribe to an event. Returns an unsubscribe function (mirrors socket.off). */
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => this.off(event, callback);
  }

  /** Unsubscribe a specific callback from an event (mirrors socket.off). */
  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  /** Emit an event to all subscribers (mirrors socket.emit / io.emit). */
  emit(event: string, payload?: unknown): void {
    console.log(`[EventBus] ${event}`, payload);
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }

  /** Remove all listeners, optionally scoped to an event. */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Singleton — in production this becomes the Socket.io client instance
export const eventBus = new EventBus();
