import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LogConsoleProps {
  logs: string[];
}

export function LogConsole({ logs }: LogConsoleProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
        </div>
        <span className="text-xs font-mono text-muted-foreground ml-2">swarm_events</span>
        <span className="text-[10px] font-mono text-muted-foreground/50 ml-auto">
          {logs.length > 0 ? `${logs.length} events` : ""}
        </span>
      </div>
      <div ref={scrollContainerRef} className="p-4 h-52 overflow-y-auto font-mono text-xs space-y-1">
        {logs.length === 0 && (
          <span className="text-muted-foreground">Awaiting swarm dispatch…</span>
        )}
        <AnimatePresence>
          {logs.map((log, i) => (
            <motion.div
              key={`${i}-${log.slice(0, 20)}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-secondary-foreground"
            >
              {log}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
