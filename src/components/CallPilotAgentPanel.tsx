import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceAgentCircle } from "@/components/VoiceAgentCircle";
import { useCallPilotAgent } from "@/hooks/useCallPilotAgent";
import type { ConversationMessage } from "@/hooks/useCallPilotAgent";

function StatusBadge({
  connectionStatus,
  agentMode,
}: {
  connectionStatus: string;
  agentMode: string;
}) {
  const label =
    connectionStatus === "connecting"
      ? "Connecting to agent…"
      : connectionStatus === "connected" && agentMode === "listening"
        ? "Listening…"
        : connectionStatus === "connected" && agentMode === "speaking"
          ? "Agent speaking…"
          : connectionStatus === "connected"
            ? "Connected"
            : connectionStatus === "error"
              ? "Error"
              : "";

  if (!label) return null;

  return (
    <span
      className={`text-xs font-mono px-2 py-0.5 rounded ${
        connectionStatus === "error"
          ? "bg-destructive/20 text-destructive"
          : connectionStatus === "connecting"
            ? "bg-warning/20 text-warning"
            : "bg-primary/20 text-primary"
      }`}
    >
      {label}
    </span>
  );
}

function MessageBubble({ msg }: { msg: ConversationMessage }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary/20 text-primary-foreground border border-primary/30"
            : msg.isTentative
              ? "bg-muted/50 text-muted-foreground border border-border italic"
              : "bg-card border border-border text-foreground"
        }`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {isUser ? (
            <MessageSquare className="w-3 h-3 text-primary shrink-0" />
          ) : (
            <span className="text-[10px] font-mono text-muted-foreground">
              CallPilot
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
      </div>
    </motion.div>
  );
}

export function CallPilotAgentPanel() {
  const {
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
  } = useCallPilotAgent();

  const [textInput, setTextInput] = useState("");
  const conversationScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = conversationScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = textInput.trim();
    if (!trimmed || !canSendText) return;
    sendTextMessage(trimmed);
    setTextInput("");
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">CallPilot Support Agent</span>
          <StatusBadge connectionStatus={connectionStatus} agentMode={agentMode} />
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs font-mono"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Central circular voice agent UI */}
      <VoiceAgentCircle
        connectionStatus={connectionStatus}
        agentMode={agentMode}
        isActive={isActive}
        onStart={startSession}
        onEnd={endSession}
      />

      {/* Conversation timeline — shared with voice and text (scroll only inside this div, never the page) */}
      <div
        ref={conversationScrollRef}
        className="h-[8.75rem] overflow-y-auto p-4 border-t border-border/50"
      >
        <div className="space-y-3">
          {messages.length === 0 && !isActive && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Click &ldquo;Call AI agent&rdquo; to start a voice conversation, or connect then type below.
            </p>
          )}
          {messages.length === 0 && isActive && connectionStatus === "connecting" && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Connecting…
            </p>
          )}
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Text input — same agent, same conversation */}
      <div className="px-4 pt-2 pb-4 border-t border-border space-y-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value);
              sendUserActivity();
            }}
            placeholder="Type a message — same agent, same conversation"
            className="flex-1 font-mono text-sm bg-background"
            disabled={!canSendText}
          />
          <Button type="submit" size="icon" disabled={!canSendText || !textInput.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground font-mono">
          Voice and text share one conversation. Agent uses tools (find_provider, schedule_appointment, etc.) for both.
        </p>
      </div>
    </div>
  );
}

