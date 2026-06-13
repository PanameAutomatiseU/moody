import type { Itinerary } from "./types";
import { fmtDuration } from "./format";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Le mot de Moody" — a one-line, human explanation of the chosen itinerary,
 *  built from its facts and the active mood. Deterministic (no randomness). */
export function narrate(it: Itinerary, moodLabel: string): string {
  const mood = moodLabel.toLowerCase();
  const hasVelib = it.bikeMin > 0;
  const lineNames = it.linesUsed.map((l) => (l.mode === "rer" ? `RER ${l.label}` : `ligne ${l.label}`));
  const onlyVelib = it.transitMin === 0 && hasVelib;
  const onlyWalk = it.transitMin === 0 && !hasVelib;

  if (onlyWalk) {
    return `À pied de bout en bout, ${fmtDuration(it.durationMin)} de marche tranquille — le trajet le plus simple qui soit.`;
  }
  if (onlyVelib) {
    return `Que du Vélib : ${Math.round(it.bikeMin)} min de pédalage, zéro métro. Du grand air, façon ${mood}.`;
  }
  if (it.linesUsed.length === 1 && it.transfers === 0) {
    const base = `La ${lineNames[0]} en direct, zéro correspondance`;
    return hasVelib
      ? `${base} — avec juste un coup de Vélib pour rejoindre la ligne. Pile dans ton mood ${mood}.`
      : `${base}. Tu poses le cerveau, c'est tout droit. Mood ${mood} respecté.`;
  }
  if (it.linesUsed.length >= 2) {
    const join = lineNames.join(" puis ");
    const tail = hasVelib ? `, avec un bout de Vélib` : "";
    return `${cap(join)}${tail} — ${it.transfers} correspondance${it.transfers > 1 ? "s" : ""} pour gagner du temps. Choisi pour ton mood ${mood}.`;
  }
  return `${cap(lineNames[0] ?? "Itinéraire")}${hasVelib ? " + Vélib" : ""} en ${fmtDuration(it.durationMin)}, ajusté à ton mood ${mood}.`;
}
