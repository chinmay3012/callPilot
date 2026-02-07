import { motion } from "framer-motion";
import { Plane, RotateCcw, Zap, Radio, Server, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderCard } from "@/components/ProviderCard";
import { LogConsole } from "@/components/LogConsole";
import { useSwarmController } from "@/hooks/useSwarmController";

const Index = () => {
  const { agents, winner, isRunning, logs, startSwarm, reset } = useSwarmController();
  const hasStarted = agents.length > 0;

  return (
    <div className="min-h-screen grid-bg gradient-radial">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Plane className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Call<span className="text-primary">Pilot</span>
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              Orchestrator
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              5 Agents
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-primary" />
              ElevenLabs Ready
            </span>
          </div>
        </div>
      </header>

      <main className="container py-12 max-w-5xl">
        {/* Landing / Hero */}
        {!hasStarted && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
              AI That Books Appointments
              <br />
              <span className="text-primary glow-text">For You</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-4 text-lg">
              CallPilot dispatches a swarm of AI agents to call multiple providers
              simultaneously, negotiate available slots, and book the earliest appointment — all in seconds.
            </p>
            <p className="text-muted-foreground/60 max-w-xl mx-auto mb-10 text-sm font-mono">
              Parallel AI calls &middot; Real-time negotiation &middot; Automatic booking
            </p>
            <Button
              size="lg"
              onClick={startSwarm}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 glow-primary text-base px-8 py-6"
            >
              <Zap className="w-5 h-5" />
              Find Dentist Appointment
            </Button>

            {/* Architecture badges */}
            <div className="mt-12 flex flex-wrap justify-center gap-3">
              {[
                { icon: <Server className="w-3.5 h-3.5" />, label: "Node.js Backend Ready" },
                { icon: <Globe className="w-3.5 h-3.5" />, label: "Socket.io Events" },
                { icon: <Radio className="w-3.5 h-3.5" />, label: "ElevenLabs Voice AI" },
              ].map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs text-muted-foreground font-mono"
                >
                  {badge.icon}
                  {badge.label}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Swarm Dashboard */}
        {hasStarted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Agent Swarm</h2>
                <p className="text-sm text-muted-foreground font-mono">
                  {isRunning
                    ? "Agents active — negotiating slots…"
                    : winner
                    ? "Mission complete — appointment secured"
                    : "No valid slots found"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>

            {/* Winner banner */}
            {winner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border border-success/40 bg-success/10 p-6 text-center glow-success"
              >
                <p className="text-success font-bold text-xl mb-1">
                  ✅ Appointment Booked
                </p>
                <p className="text-foreground text-lg font-semibold">
                  {winner.name} — {winner.slotTime}
                </p>
                <p className="text-muted-foreground text-sm mt-2 font-mono">
                  Earliest valid slot selected automatically
                </p>
              </motion.div>
            )}

            {/* Provider grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <ProviderCard
                  key={agent.id}
                  provider={agent}
                  isWinner={winner?.id === agent.id}
                />
              ))}
            </div>

            {/* Log Console */}
            <LogConsole logs={logs} />
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Index;
