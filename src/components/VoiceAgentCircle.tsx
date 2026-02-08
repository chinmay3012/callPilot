import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import type { ConnectionStatus } from "@/hooks/useCallPilotAgent";
import type { AgentMode } from "@/hooks/useCallPilotAgent";

export type VoiceCircleState = "idle" | "connecting" | "listening" | "speaking";

function deriveCircleState(
  connectionStatus: ConnectionStatus,
  agentMode: AgentMode
): VoiceCircleState {
  if (connectionStatus === "connecting") return "connecting";
  if (connectionStatus !== "connected") return "idle";
  if (agentMode === "listening") return "listening";
  if (agentMode === "speaking") return "speaking";
  return "idle";
}

interface VoiceAgentCircleProps {
  connectionStatus: ConnectionStatus;
  agentMode: AgentMode;
  isActive: boolean;
  onStart: () => void;
  onEnd?: () => void;
}

export function VoiceAgentCircle({
  connectionStatus,
  agentMode,
  isActive,
  onStart,
  onEnd,
}: VoiceAgentCircleProps) {
  const state = deriveCircleState(connectionStatus, agentMode);

  return (
    <div className="voice-agent-circle-wrapper flex flex-col items-center justify-center py-8">
      {/* Outer radial disc with state-based animation */}
      <motion.div
        className="voice-agent-circle relative flex items-center justify-center"
        animate={{
          scale: state === "connecting" ? 1.02 : 1,
          transition: { duration: 0.3 },
        }}
      >
        {/* Glow layer — stronger when connecting / listening / speaking */}
        <div
          className={`voice-agent-glow absolute inset-0 rounded-full pointer-events-none ${
            state === "idle"
              ? "opacity-20"
              : state === "connecting"
                ? "opacity-60 voice-agent-glow-connecting"
                : state === "listening"
                  ? "opacity-50 voice-agent-glow-listening"
                  : "opacity-40 voice-agent-glow-speaking"
          }`}
        />

        {/* Rotating radial gradient ring — slow when idle, faster when connecting */}
        <motion.div
          className="voice-agent-ring absolute inset-0 rounded-full"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: state === "connecting" ? 4 : 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Inner static gradient fill */}
        <div className="voice-agent-inner absolute inset-[18%] rounded-full" />

        {/* Center: pill CTA or end button */}
        <div className="voice-agent-center relative z-10 flex items-center justify-center">
          {!isActive ? (
            <motion.button
              type="button"
              onClick={onStart}
              className="voice-agent-cta group flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Mic className="w-5 h-5 shrink-0" aria-hidden />
              <span>Call AI agent</span>
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={onEnd}
              className="voice-agent-end flex items-center gap-2 px-5 py-2.5 rounded-full bg-destructive/90 text-destructive-foreground font-medium text-xs hover:bg-destructive focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 focus:ring-offset-background"
              whileTap={{ scale: 0.98 }}
            >
              End call
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* State label */}
      <p className="mt-4 text-xs font-mono text-muted-foreground">
        {state === "idle" && !isActive && "Click to start voice conversation"}
        {state === "idle" && isActive && "Connected"}
        {state === "connecting" && "Connecting…"}
        {state === "listening" && "Listening…"}
        {state === "speaking" && "Agent speaking…"}
      </p>
    </div>
  );
}
