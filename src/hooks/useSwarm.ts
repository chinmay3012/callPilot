import { useState, useCallback, useRef } from "react";

export type ProviderStatus = "idle" | "searching" | "calling" | "negotiating" | "booked" | "rejected";

export interface Provider {
  id: string;
  name: string;
  status: ProviderStatus;
  slotTime: string | null;
  delay: number;
}

const PROVIDER_NAMES = ["Dentist A", "Dentist B", "Dentist C", "Dentist D", "Dentist E"];

const MOCK_SLOTS = [
  "8:00 AM", "8:30 AM", "9:00 AM", "9:15 AM", "9:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:45 AM",
  "1:00 PM", "2:15 PM", "3:00 PM", "4:30 PM",
];

const MIN_TIME = "9:30 AM";

function parseTime(t: string): number {
  const [time, period] = t.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function randomSlot(): string {
  return MOCK_SLOTS[Math.floor(Math.random() * MOCK_SLOTS.length)];
}

function randomDelay(): number {
  return 1000 + Math.random() * 4000;
}

export interface SwarmResult {
  providers: Provider[];
  winner: Provider | null;
  isRunning: boolean;
  logs: string[];
  startSwarm: () => void;
  reset: () => void;
}

export function useSwarm(): SwarmResult {
  const [providers, setProviders] = useState<Provider[]>(
    PROVIDER_NAMES.map((name, i) => ({
      id: `p${i}`,
      name,
      status: "idle",
      slotTime: null,
      delay: 0,
    }))
  );
  const [winner, setWinner] = useState<Provider | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const timeoutsRef = useRef<number[]>([]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const updateProvider = useCallback(
    (id: string, updates: Partial<Provider>) => {
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    },
    []
  );

  const startSwarm = useCallback(() => {
    setIsRunning(true);
    setWinner(null);
    setLogs([]);

    const delays = PROVIDER_NAMES.map(() => randomDelay());
    const slots = PROVIDER_NAMES.map(() => randomSlot());

    // Reset all providers
    setProviders(
      PROVIDER_NAMES.map((name, i) => ({
        id: `p${i}`,
        name,
        status: "searching",
        slotTime: null,
        delay: delays[i],
      }))
    );

    addLog("🚀 Swarm initiated — dispatching 5 AI agents...");

    const completedProviders: Provider[] = [];
    const minTime = parseTime(MIN_TIME);

    PROVIDER_NAMES.forEach((name, i) => {
      const id = `p${i}`;
      const baseDelay = delays[i];
      const slot = slots[i];

      // Phase 1: Calling
      const t1 = window.setTimeout(() => {
        updateProvider(id, { status: "calling" });
        addLog(`📞 ${name}: Dialing provider...`);
      }, baseDelay * 0.3);

      // Phase 2: Negotiating
      const t2 = window.setTimeout(() => {
        updateProvider(id, { status: "negotiating", slotTime: slot });
        addLog(`🤝 ${name}: Negotiating — offered ${slot}`);
      }, baseDelay * 0.65);

      // Phase 3: Result
      const t3 = window.setTimeout(() => {
        const valid = parseTime(slot) >= minTime;
        const finalStatus = valid ? "booked" as const : "rejected" as const;
        updateProvider(id, { status: finalStatus });

        if (valid) {
          addLog(`✅ ${name}: Slot ${slot} accepted`);
          completedProviders.push({
            id,
            name,
            status: "booked",
            slotTime: slot,
            delay: baseDelay,
          });
        } else {
          addLog(`❌ ${name}: Slot ${slot} rejected (before 9:30 AM)`);
        }

        // Check if all done
        if (completedProviders.length + (valid ? 0 : 1) >= 0) {
          // We check with a small delay to let all complete
          const t4 = window.setTimeout(() => {
            setProviders((current) => {
              const allDone = current.every(
                (p) => p.status === "booked" || p.status === "rejected"
              );
              if (allDone && !winner) {
                const booked = current.filter((p) => p.status === "booked" && p.slotTime);
                if (booked.length > 0) {
                  const best = booked.reduce((a, b) =>
                    parseTime(a.slotTime!) <= parseTime(b.slotTime!) ? a : b
                  );
                  setWinner(best);
                  addLog(`🏆 Winner: ${best.name} at ${best.slotTime}`);
                  // Mark non-winners as rejected
                  return current.map((p) =>
                    p.id === best.id
                      ? { ...p, status: "booked" as const }
                      : p.status === "booked"
                      ? { ...p, status: "rejected" as const }
                      : p
                  );
                } else {
                  addLog("⚠️ No valid slots found. Try again.");
                }
                setIsRunning(false);
              }
              return current;
            });
          }, 500);
          timeoutsRef.current.push(t4);
        }
      }, baseDelay);

      timeoutsRef.current.push(t1, t2, t3);
    });
  }, [addLog, updateProvider, winner]);

  const reset = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setProviders(
      PROVIDER_NAMES.map((name, i) => ({
        id: `p${i}`,
        name,
        status: "idle",
        slotTime: null,
        delay: 0,
      }))
    );
    setWinner(null);
    setIsRunning(false);
    setLogs([]);
  }, []);

  return { providers, winner, isRunning, logs, startSwarm, reset };
}
