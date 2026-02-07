/**
 * useRealtimeEvents — Subscribes to the EventBus (simulated Socket.io).
 * 
 * FRONTEND RESPONSIBILITY:
 * In production, replace EventBus.on() with socket.on().
 * The hook API stays identical.
 */

import { useEffect, useRef, useCallback } from "react";
import { eventBus } from "@/backend/EventBus";

export function useRealtimeEvents() {
  const unsubscribesRef = useRef<(() => void)[]>([]);

  const on = useCallback((event: string, handler: (payload: unknown) => void) => {
    const unsub = eventBus.on(event, handler);
    unsubscribesRef.current.push(unsub);
    return unsub;
  }, []);

  const emit = useCallback((event: string, payload?: unknown) => {
    eventBus.emit(event, payload);
  }, []);

  useEffect(() => {
    return () => {
      unsubscribesRef.current.forEach((unsub) => unsub());
      unsubscribesRef.current = [];
    };
  }, []);

  return { on, emit };
}
