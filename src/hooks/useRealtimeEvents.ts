/**
 * useRealtimeEvents — Subscribes to a single EventBus event (simulated Socket.io).
 *
 * FRONTEND RESPONSIBILITY:
 * In production, replace `eventBus.on()` with `socket.on()`.
 * The hook API stays identical — just swap the transport.
 *
 * Usage:
 *   useRealtimeEvents("swarm:update", (payload) => { ... });
 *
 * The callback is stable across re-renders (stored in a ref).
 */

import { useEffect, useRef } from "react";
import { eventBus } from "@/backend/EventBus";

export function useRealtimeEvents(
  event: string,
  handler: (payload: unknown) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const callback = (payload: unknown) => handlerRef.current(payload);
    const unsub = eventBus.on(event, callback);
    return unsub;
  }, [event]);
}
