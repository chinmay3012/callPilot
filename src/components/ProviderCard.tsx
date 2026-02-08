import { motion } from "framer-motion";
import { Phone, PhoneCall, Handshake, CheckCircle2, XCircle, Search, Ban, Radio, Star, MapPin } from "lucide-react";
import type { ProviderAgent, AgentStatus } from "@/types/swarm";
import { Badge } from "@/components/ui/badge";
import { PROVIDER_METADATA } from "@/data/providerMetadata";

const statusConfig: Record<AgentStatus, { label: string; icon: React.ReactNode; className: string }> = {
  idle: {
    label: "Standby",
    icon: <Phone className="w-4 h-4" />,
    className: "bg-muted text-muted-foreground",
  },
  searching: {
    label: "Searching",
    icon: <Search className="w-4 h-4 animate-pulse" />,
    className: "bg-info/20 text-info",
  },
  calling: {
    label: "Calling",
    icon: <PhoneCall className="w-4 h-4 animate-pulse" />,
    className: "bg-warning/20 text-warning",
  },
  negotiating: {
    label: "Negotiating",
    icon: <Handshake className="w-4 h-4 animate-pulse" />,
    className: "bg-primary/20 text-primary",
  },
  booked: {
    label: "Booked",
    icon: <CheckCircle2 className="w-4 h-4" />,
    className: "bg-success/20 text-success",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="w-4 h-4" />,
    className: "bg-destructive/20 text-destructive",
  },
  cancelled: {
    label: "Cancelled",
    icon: <Ban className="w-4 h-4" />,
    className: "bg-muted text-muted-foreground",
  },
};

interface ProviderCardProps {
  provider: ProviderAgent;
  isWinner: boolean;
  /** Optional per-service metadata (rating, distance); falls back to PROVIDER_METADATA for dentist */
  metadata?: { name: string; rating: number; distanceMiles: number } | null;
}

export function ProviderCard({ provider, isWinner, metadata }: ProviderCardProps) {
  const config = statusConfig[provider.status];
  const meta = metadata ?? PROVIDER_METADATA[provider.id];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-lg border p-5 transition-all duration-500 ${
        isWinner
          ? "border-success/50 glow-success bg-success/5"
          : provider.status === "rejected" || provider.status === "cancelled"
          ? "border-border/30 opacity-50 bg-card"
          : "border-border bg-card"
      }`}
    >
      {/* Scan line effect when active */}
      {["searching", "calling", "negotiating"].includes(provider.status) && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-scan-line" />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-foreground">{provider.name}</h3>
          {provider.elevenlabsReady ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary gap-1">
              <Radio className="w-3 h-3" />
              🟢 LIVE
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/40 text-muted-foreground gap-1">
              Simulated
            </Badge>
          )}
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
          {config.icon}
          {config.label}
        </span>
      </div>

      {meta && (
        <div className="flex gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3" /> {meta.rating}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {meta.distanceMiles} mi
          </span>
        </div>
      )}
      {provider.slotTime && (
        <p className="font-mono text-sm text-muted-foreground">
          Offered: <span className="text-foreground">{provider.slotTime}</span>
        </p>
      )}

      {isWinner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 flex items-center gap-2 text-success font-medium text-sm"
        >
          <motion.span
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
          >
            <CheckCircle2 className="w-5 h-5" />
          </motion.span>
          <span className="animate-pulse">✅ Appointment Booked</span>
        </motion.div>
      )}
    </motion.div>
  );
}
