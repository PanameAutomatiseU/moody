export function fmtDuration(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

export function fmtArrival(min: number, from: Date = new Date()): string {
  const d = new Date(from.getTime() + min * 60000);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtCost(euro: number): string {
  if (euro <= 0) return "Gratuit";
  return `${euro.toFixed(2).replace(".", ",")} €`;
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

export function co2SavingPct(co2g: number, carCo2g: number): number {
  if (carCo2g <= 0) return 0;
  return Math.max(0, Math.round((1 - co2g / carCo2g) * 100));
}
