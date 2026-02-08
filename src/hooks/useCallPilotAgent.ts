import { useState, useCallback, useRef } from "react";
import { Conversation } from "@elevenlabs/client";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";
export type AgentMode = "listening" | "speaking" | "idle";

export interface ConversationMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
  isTentative?: boolean;
}

const SUPPORT_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? "";

export function useCallPilotAgent() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [agentMode, setAgentMode] = useState<AgentMode>("idle");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const messageIdRef = useRef(0);

  const addMessage = useCallback(
    (role: "user" | "agent", text: string, isTentative = false) => {
      const id = `msg-${Date.now()}-${++messageIdRef.current}`;
      setMessages((prev) => {
        if (isTentative && prev.length > 0 && prev[prev.length - 1].role === "agent" && prev[prev.length - 1].isTentative) {
          return prev.slice(0, -1).concat([{ ...prev[prev.length - 1], text, id }]);
        }
        return [...prev, { id, role, text, timestamp: Date.now(), isTentative }];
      });
    },
    [],
  );

  const startSession = useCallback(async () => {
    if (!SUPPORT_AGENT_ID) {
      setError("Support Agent not configured. Set VITE_ELEVENLABS_AGENT_ID in .env");
      setConnectionStatus("error");
      return;
    }

    setError(null);
    setConnectionStatus("connecting");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError("Microphone access denied. Please allow microphone to talk to CallPilot.");
      setConnectionStatus("error");
      return;
    }

    try {
      const conversation = await Conversation.startSession({
        agentId: SUPPORT_AGENT_ID,
        connectionType: "webrtc",
        onStatusChange: (status) => {
          if (status === "connected") setConnectionStatus("connected");
          else if (status === "connecting") setConnectionStatus("connecting");
          else if (status === "disconnected") setConnectionStatus("disconnected");
        },
        onModeChange: (mode) => {
          if (mode === "listening") setAgentMode("listening");
          else if (mode === "speaking") setAgentMode("speaking");
          else setAgentMode("idle");
        },
        onMessage: (msg) => {
          const text = typeof msg === "string" ? msg : (msg as { text?: string })?.text ?? "";
          if (!text.trim()) return;
          const role = (msg as { role?: string })?.role === "user" ? "user" : "agent";
          const isTentative = (msg as { isTentative?: boolean })?.isTentative ?? false;
          addMessage(role, text, isTentative);
        },
        onConnect: () => setConnectionStatus("connected"),
        onDisconnect: () => setConnectionStatus("disconnected"),
        onError: (err) => {
          setError(typeof err === "string" ? err : (err as Error)?.message ?? "Connection error");
          setConnectionStatus("error");
        },
      });

      conversationRef.current = conversation;
      setConnectionStatus("connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setConnectionStatus("error");
    }
  }, [addMessage]);

  const endSession = useCallback(async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }
    setConnectionStatus("idle");
    setAgentMode("idle");
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    const conversation = conversationRef.current;
    if (!conversation) {
      setError("Start a conversation first by clicking Talk to CallPilot.");
      return;
    }
    addMessage("user", text.trim());
    conversation.sendUserMessage(text.trim());
  }, [addMessage]);

  const sendUserActivity = useCallback(() => {
    conversationRef.current?.sendUserActivity();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const isActive = connectionStatus === "connected" || connectionStatus === "connecting";
  const canSendText = connectionStatus === "connected";

  return {
    connectionStatus,
    agentMode,
    messages,
    error,
    isActive,
    canSendText,
    startSession,
    endSession,
    sendTextMessage,
    sendUserActivity,
    clearMessages,
  };
}
