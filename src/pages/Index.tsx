import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Plane,
  RotateCcw,
  Zap,
  Radio,
  Server,
  Globe,
  Star,
  Clock,
  CalendarPlus,
  PhoneCall,
  MessageSquare,
  Stethoscope,
  Scissors,
  Car,
  Dog,
  Wrench,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProviderCard } from "@/components/ProviderCard";
import { LogConsole } from "@/components/LogConsole";
import { CallPilotAgentPanel } from "@/components/CallPilotAgentPanel";
import { useSwarmController } from "@/hooks/useSwarmController";
import { rankProviders } from "@/data/providerMetadata";
import { getProviderMetadataByService } from "@/data/providerRegistry";
import { normalizeServiceType, getServiceTypeLabel } from "@/data/serviceType";

const DEMO_QUERY = "Find me the earliest dentist appointment within 5 miles";

/** Infer service_type from query text; returns normalized ServiceType. */
function inferServiceTypeFromQuery(query: string): string {
  const s = (query || "").trim().toLowerCase();
  if (/dentist|dental/i.test(s)) return "dentist";
  if (/doctor|physician|medical/i.test(s)) return "doctor";
  if (/vet|veterinar|animal|pet/i.test(s)) return "vet";
  if (/plumb|pipe|leak/i.test(s)) return "plumber";
  if (/hair|salon|barber|haircut/i.test(s)) return "salon";
  if (/auto|car|mechanic|repair/i.test(s)) return "auto_repair";
  if (/therapist|counsel|mental/i.test(s)) return "therapist";
  return "dentist";
}

function slotToGoogleCalendarUrl(providerName: string, slotTime: string): string {
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  const [time, period] = slotTime.toUpperCase().split(/\s+/);
  const [hVal, mVal] = (time || "10:00").split(":").map(Number);
  let h = hVal ?? 0;
  const m = mVal ?? 0;
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  const start = new Date(tom);
  start.setHours(h, m, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const text = encodeURIComponent(`Appointment - ${providerName}`);
  const dates = `${fmt(start)}/${fmt(end)}`;
  const details = encodeURIComponent(`Booked by CallPilot • ${providerName} at ${slotTime}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const Index = () => {
  const { agents, winner, rankedShortlist, serviceType, isRunning, logs, startSwarm, reset } = useSwarmController();
  const [searchQuery, setSearchQuery] = useState(DEMO_QUERY);
  const hasStarted = agents.length > 0;
  const providerMetadata = getProviderMetadataByService(serviceType);
  const serviceLabel = getServiceTypeLabel(serviceType);

  // Prefer backend ranked shortlist; fallback to client ranking (service-agnostic)
  const rankedAgents = hasStarted
    ? rankedShortlist.length > 0
      ? rankedShortlist.map((e) => ({
          id: e.agentId,
          name: e.providerName,
          slotTime: e.slotTime,
          status: "booked" as const,
          rank: e.rank,
          score: e.score,
          rating: e.rating ?? 4.5,
          distanceMiles: e.distanceMiles ?? 0,
        }))
      : rankProviders(agents, providerMetadata)
    : [];

  const handleCtaClick = useCallback(() => {
    const normalized = normalizeServiceType("dentist");
    console.log("CTA pressed — requesting live call");
    const url = `${API_BASE.replace(/\/$/, "")}/start-live-call`;
    fetch(url, { method: "POST", mode: "cors" })
      .then((res) => {
        if (res.ok) {
          console.log("start-live-call: success");
        } else {
          console.error("start-live-call: failed", res.status, res.statusText);
        }
      })
      .catch((err) => {
        console.error("start-live-call: failed", err);
      });
    setSearchQuery("Find me the earliest dentist appointment within 5 miles");
    startSwarm(normalized);
  }, [startSwarm]);

  const handleAddToCalendar = useCallback(() => {
    if (!winner?.slotTime) return;
    const url = slotToGoogleCalendarUrl(winner.name, winner.slotTime);
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Opening Google Calendar", {
      description: "Add this appointment to prevent conflicts",
    });
  }, [winner]);

  /** Query box submit — same path as CTA: resolve service_type, then start swarm. */
  const handleQuerySubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim() || DEMO_QUERY;
      setSearchQuery(q);
      const resolved = normalizeServiceType(inferServiceTypeFromQuery(q));
      startSwarm(resolved);
    },
    [searchQuery, startSwarm],
  );

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
              Up to 15 Parallel Agents
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-primary" />
              ElevenLabs Voice AI
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
            className="mb-16"
          >
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4 text-center">
              AI That Books Appointments
              <br />
              <span className="text-primary glow-text">For You</span>
            </h1>

            <p className="text-muted-foreground max-w-2xl mx-auto mb-6 text-lg text-center">
              CallPilot makes the best appointment.
            </p>

            {/* Query box — submit starts swarm like Finding buttons; infers service from text */}
            <form onSubmit={handleQuerySubmit} className="max-w-xl mx-auto mb-6">
              <div className="relative">
                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find me the earliest dentist appointment within 5 miles"
                  className="pl-10 h-12 font-mono text-sm bg-card border-border"
                  readOnly={false}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center font-mono">
                Press Enter or type your own query — starts the swarm like the buttons below
              </p>
            </form>

            {/* Agentic task buttons */}
            <p className="text-xs font-mono text-muted-foreground mb-3 text-center">
              See it in action — AI agents negotiate in parallel
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <Button
                type="button"
                size="lg"
                onClick={handleCtaClick}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
              >
                <Zap className="w-5 h-5" />
                Find Dentist
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { setSearchQuery("Find me a doctor appointment this week"); startSwarm(normalizeServiceType("doctor")); }}
                className="gap-2"
              >
                <Stethoscope className="w-5 h-5" />
                Find Doctor
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { setSearchQuery("Find a haircut appointment tomorrow"); startSwarm(normalizeServiceType("salon")); }}
                className="gap-2"
              >
                <Scissors className="w-5 h-5" />
                Find Haircut
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { setSearchQuery("Book car service appointment"); startSwarm(normalizeServiceType("auto_repair")); }}
                className="gap-2"
              >
                <Car className="w-5 h-5" />
                Auto Service
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { setSearchQuery("Find a vet for my pet"); startSwarm(normalizeServiceType("vet")); }}
                className="gap-2"
              >
                <Dog className="w-5 h-5" />
                Find Vet
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { setSearchQuery("Need a plumber"); startSwarm(normalizeServiceType("plumber")); }}
                className="gap-2"
              >
                <Wrench className="w-5 h-5" />
                Find Plumber
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { setSearchQuery("Find a therapist"); startSwarm(normalizeServiceType("therapist")); }}
                className="gap-2"
              >
                <Heart className="w-5 h-5" />
                Find Therapist
              </Button>
            </div>

            {/* CallPilot Support Agent — Voice + Text */}
            <div className="mt-10 max-w-md mx-auto">
              <CallPilotAgentPanel />
            </div>

            {/* Features */}
            <div className="mt-10 flex flex-wrap justify-center gap-4 text-xs">
              {[
                { icon: <PhoneCall className="w-3.5 h-3.5" />, label: "Up to 15 parallel calls" },
                { icon: <Clock className="w-3.5 h-3.5" />, label: "Real-time ranking" },
                { icon: <Star className="w-3.5 h-3.5" />, label: "Availability • Rating • Distance" },
                { icon: <CalendarPlus className="w-3.5 h-3.5" />, label: "Calendar sync" },
              ].map((badge) => (
                <span
                  key={badge.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground font-mono"
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
            {/* Search query bar */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50">
              <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm text-muted-foreground truncate flex-1">
                &ldquo;{searchQuery || DEMO_QUERY}&rdquo;
              </span>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {isRunning
                    ? `${agents.length} ${serviceLabel}${agents.length === 1 ? "" : "s"} Calling in Parallel`
                    : "Swarm Complete"}
                </h2>
                <p className="text-sm text-muted-foreground font-mono">
                  {isRunning
                    ? `Calling ${agents.length} ${serviceLabel.toLowerCase()} provider${agents.length === 1 ? "" : "s"} simultaneously — negotiating slots…`
                    : winner
                    ? "Best appointment booked with zero human intervention"
                    : "No valid slots found"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            </div>

            {/* Winner banner - Zero human intervention + green pulse */}
            {winner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border border-success/40 bg-success/10 p-6 glow-success pulse-booked"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-success font-bold text-xl mb-1">
                      ✅ Appointment Booked — Zero Human Intervention
                    </p>
                    <p className="text-foreground text-lg font-semibold">
                      {winner.name} — {winner.slotTime}
                    </p>
                    <p className="text-muted-foreground text-sm mt-2 font-mono">
                      Earliest valid slot selected by AI • Ranked by availability, rating, distance & your preferences
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-success/40 text-success hover:bg-success/10"
                    onClick={handleAddToCalendar}
                  >
                    <CalendarPlus className="w-4 h-4" />
                    Add to Calendar
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Real-time ranking */}
            {rankedAgents.length > 0 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Live Ranking</span>
                  <span className="text-xs text-muted-foreground font-mono ml-auto">
                    Availability • Rating • Distance
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {rankedAgents.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-center gap-4 px-4 py-3 ${
                        winner?.id === p.id ? "bg-success/5" : ""
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          p.rank === 1
                            ? "bg-success/20 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {p.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {p.slotTime} • ⭐ {p.rating} • 📍 {p.distanceMiles} mi
                        </p>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {(p.score * 100).toFixed(0)}%
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Parallel calls - Provider grid */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-primary" />
                {agents.length} {serviceLabel}{agents.length === 1 ? "" : "s"} — Calls in Parallel
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <ProviderCard
                    key={agent.id}
                    provider={agent}
                    isWinner={winner?.id === agent.id}
                    metadata={providerMetadata[agent.id]}
                  />
                ))}
              </div>
            </div>

            {/* CallPilot Support Agent — Voice + Text (always available) */}
            <div className="max-w-md">
              <CallPilotAgentPanel />
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
