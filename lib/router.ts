import type { Itinerary, Leg, LatLng, LineInfo, Mood, MoodId, Place } from "./types";
import { MOODS } from "./moods";
import {
  CAR_CO2_PER_KM,
  METRO_CO2_PER_KM,
  TICKET_EURO,
  VELIB_OVERHEAD,
  VELIB_TRIP_EURO,
  BIKE_MPM,
  WALK_MPM,
  bikeDistanceM,
  haversineM,
  walkDistanceM,
} from "./geo";
import {
  type BoardPoint,
  type MetroStep,
  type StationNode,
  linesNear,
  metroSearch,
  nearestNodes,
} from "./metro";
import {
  type VelibStation,
  VELIB_STATIONS,
  nearestVelib,
} from "./velib";

export interface PlanCtx {
  velib: VelibStation[];
}

interface Pt {
  name: string;
  lat: number;
  lon: number;
}

const shortLabel = (label: string) => label.split(",")[0].trim();
const placePt = (p: Place, fallback: string): Pt => ({
  name: shortLabel(p.label) || fallback,
  lat: p.lat,
  lon: p.lon,
});
const nodePt = (n: StationNode): Pt => ({ name: n.name, lat: n.lat, lon: n.lon });
const velibPt = (s: VelibStation): Pt => ({ name: s.name, lat: s.lat, lon: s.lon });
const ll = (p: { lat: number; lon: number }): LatLng => ({ lat: p.lat, lon: p.lon });

// ---------------------------------------------------------------------------
// Leg builders
// ---------------------------------------------------------------------------

function walkLeg(from: Pt, to: Pt): Leg {
  const distanceM = walkDistanceM(from, to);
  return {
    mode: "walk",
    from: { name: from.name, lat: from.lat, lon: from.lon },
    to: { name: to.name, lat: to.lat, lon: to.lon },
    distanceM,
    durationMin: distanceM / WALK_MPM,
    polyline: [ll(from), ll(to)],
    instruction: `Marche jusqu'à ${to.name}`,
  };
}

function bikeLeg(from: VelibStation, to: VelibStation): Leg {
  const distanceM = bikeDistanceM(from, to);
  const detailParts: string[] = [];
  if (from.bikes !== undefined) detailParts.push(`${from.bikes} vélo${from.bikes > 1 ? "s" : ""} au départ`);
  if (to.docks !== undefined) detailParts.push(`${to.docks} borne${to.docks > 1 ? "s" : ""} à l'arrivée`);
  return {
    mode: "velib",
    from: { name: from.name, lat: from.lat, lon: from.lon },
    to: { name: to.name, lat: to.lat, lon: to.lon },
    distanceM,
    durationMin: distanceM / BIKE_MPM + VELIB_OVERHEAD,
    polyline: [ll(from), ll(to)],
    instruction: `Vélib jusqu'à ${to.name}`,
    detail: detailParts.join(" · ") || undefined,
  };
}

function metroLeg(step: Extract<MetroStep, { kind: "ride" }>): Leg {
  const names: string[] = [];
  for (const s of step.stops) if (names[names.length - 1] !== s.name) names.push(s.name);
  const first = step.stops[0];
  const last = step.stops[step.stops.length - 1];
  let distanceM = 0;
  for (let i = 1; i < step.stops.length; i++) distanceM += haversineM(step.stops[i - 1], step.stops[i]);
  const isRer = step.line.mode === "rer";
  return {
    mode: isRer ? "rer" : "metro",
    from: { name: first.name, lat: first.lat, lon: first.lon },
    to: { name: last.name, lat: last.lat, lon: last.lon },
    line: step.line,
    distanceM,
    durationMin: step.minutes,
    polyline: step.stops.map(ll),
    stops: names,
    instruction: `${isRer ? "RER" : "Ligne"} ${step.line.label} — ${first.name} → ${last.name}`,
    detail: `${Math.max(1, names.length - 1)} stations`,
  };
}

function transferLeg(step: Extract<MetroStep, { kind: "transfer" }>): Leg {
  return {
    mode: "transfer",
    from: { name: step.from.name, lat: step.from.lat, lon: step.from.lon },
    to: { name: step.to.name, lat: step.to.lat, lon: step.to.lon },
    distanceM: haversineM(step.from, step.to),
    durationMin: step.minutes,
    polyline: [ll(step.from), ll(step.to)],
    instruction: `Correspondance à ${step.to.name}`,
  };
}

// ---------------------------------------------------------------------------
// Connectors (first / last mile)
// ---------------------------------------------------------------------------

interface Connector {
  legs: Leg[];
  minutes: number;
}

function velibConnector(ctx: PlanCtx, from: Pt, to: Pt): Connector | null {
  const pick = nearestVelib(ctx.velib, from, 750, 1, "bike")[0];
  const drop = nearestVelib(ctx.velib, to, 750, 1, "dock")[0];
  if (!pick || !drop || pick.station.id === drop.station.id) return null;
  // Not worth a Vélib if the ride is shorter than the walks around it.
  if (haversineM(pick.station, drop.station) < 400) return null;
  const w1 = walkLeg(from, velibPt(pick.station));
  const ride = bikeLeg(pick.station, drop.station);
  const w2 = walkLeg(velibPt(drop.station), to);
  return { legs: [w1, ride, w2], minutes: w1.durationMin + ride.durationMin + w2.durationMin };
}

function connectorTo(ctx: PlanCtx, from: Pt, to: Pt, mode: "walk" | "velib"): Connector | null {
  if (mode === "walk") {
    const l = walkLeg(from, to);
    return { legs: [l], minutes: l.durationMin };
  }
  return velibConnector(ctx, from, to);
}

// ---------------------------------------------------------------------------
// Candidate generators
// ---------------------------------------------------------------------------

interface MetroOpts {
  access: "walk" | "velib";
  egress: "walk" | "velib";
  allowedLines?: Set<string>;
  transferPenalty?: number;
}

function genMetro(o: Place, d: Place, ctx: PlanCtx, opts: MetroOpts): Leg[] | null {
  const accessRadius = opts.access === "velib" ? 2600 : 1200;
  const egressRadius = opts.egress === "velib" ? 2600 : 1200;
  const oPt = placePt(o, "Départ");
  const dPt = placePt(d, "Arrivée");

  // For a single-line search, look at that line's own nearest stations first
  // (otherwise nearer platforms of other lines crowd it out of the top-k).
  const kAccess = opts.allowedLines ? 6 : 24;
  const boardNear = nearestNodes(o, accessRadius, kAccess, opts.allowedLines);
  const alightNear = nearestNodes(d, egressRadius, kAccess, opts.allowedLines);
  if (!boardNear.length || !alightNear.length) return null;

  const accessByNode = new Map<string, Connector>();
  const boarding: BoardPoint[] = [];
  for (const n of boardNear) {
    if (opts.allowedLines && !opts.allowedLines.has(n.node.line)) continue;
    const conn = connectorTo(ctx, oPt, nodePt(n.node), opts.access);
    if (!conn) continue;
    accessByNode.set(n.node.id, conn);
    boarding.push({ id: n.node.id, cost: conn.minutes });
  }

  const egressByNode = new Map<string, Connector>();
  const alighting: BoardPoint[] = [];
  for (const n of alightNear) {
    if (opts.allowedLines && !opts.allowedLines.has(n.node.line)) continue;
    const conn = connectorTo(ctx, nodePt(n.node), dPt, opts.egress);
    if (!conn) continue;
    egressByNode.set(n.node.id, conn);
    alighting.push({ id: n.node.id, cost: conn.minutes });
  }
  if (!boarding.length || !alighting.length) return null;

  const res = metroSearch({
    boarding,
    alighting,
    allowedLines: opts.allowedLines,
    transferPenalty: opts.transferPenalty,
  });
  if (!res || res.steps.length === 0) return null;

  const legs: Leg[] = [];
  legs.push(...(accessByNode.get(res.boardId)?.legs ?? []));
  for (const step of res.steps) {
    legs.push(step.kind === "ride" ? metroLeg(step) : transferLeg(step));
  }
  legs.push(...(egressByNode.get(res.alightId)?.legs ?? []));
  return legs;
}

function genWalkOnly(o: Place, d: Place): Leg[] | null {
  if (haversineM(o, d) > 2800) return null;
  return [walkLeg(placePt(o, "Départ"), placePt(d, "Arrivée"))];
}

function genVelibOnly(o: Place, d: Place, ctx: PlanCtx): Leg[] | null {
  if (haversineM(o, d) > 7500) return null;
  const conn = velibConnector(ctx, placePt(o, "Départ"), placePt(d, "Arrivée"));
  return conn?.legs ?? null;
}

function genSingleLinePlusVelib(o: Place, d: Place, ctx: PlanCtx): Leg[][] {
  const linesO = linesNear(o, 2700);
  const linesD = linesNear(d, 2700);
  const common = [...linesO].filter((l) => linesD.has(l));
  const out: Leg[][] = [];
  const combos: [MetroOpts["access"], MetroOpts["egress"]][] = [
    ["velib", "velib"],
    ["walk", "velib"],
    ["velib", "walk"],
    ["walk", "walk"],
  ];
  for (const line of common) {
    const allowedLines = new Set([line]);
    for (const [access, egress] of combos) {
      const legs = genMetro(o, d, ctx, { access, egress, allowedLines, transferPenalty: 0 });
      if (legs) out.push(legs);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Assembly & scoring
// ---------------------------------------------------------------------------

function assemble(rawLegs: Leg[], kind: string, mood: Mood, o: Place, d: Place): Itinerary | null {
  // Drop negligible walk hops (e.g. origin already at the Vélib/metro point).
  const legs = rawLegs.filter((l) => !(l.mode === "walk" && l.distanceM < 45));
  if (legs.length === 0) return null;

  let walkMin = 0;
  let bikeMin = 0;
  let transitMin = 0;
  let distanceM = 0;
  let transfers = 0;
  let transitKm = 0;
  const linesUsed: LineInfo[] = [];

  for (const l of legs) {
    distanceM += l.distanceM;
    if (l.mode === "walk") walkMin += l.durationMin;
    else if (l.mode === "velib") bikeMin += l.durationMin;
    else if (l.mode === "transfer") {
      transitMin += l.durationMin;
      transfers += 1;
    } else {
      transitMin += l.durationMin;
      transitKm += l.distanceM / 1000;
      if (l.line && linesUsed[linesUsed.length - 1]?.id !== l.line.id) linesUsed.push(l.line);
    }
  }

  const durationMin = walkMin + bikeMin + transitMin;

  // Ticketing: one ticket per maximal run of consecutive transit legs.
  let sessions = 0;
  let inTransit = false;
  for (const l of legs) {
    const isTransit = l.mode === "metro" || l.mode === "rer" || l.mode === "transfer";
    if (isTransit && !inTransit) sessions += 1;
    inTransit = isTransit;
  }
  const velibRides = legs.filter((l) => l.mode === "velib").length;
  const costEuro = sessions * TICKET_EURO + velibRides * VELIB_TRIP_EURO;

  const co2g = transitKm * METRO_CO2_PER_KM;
  const carCo2g = ((haversineM(o, d) * 1.4) / 1000) * CAR_CO2_PER_KM;

  const hasVelib = bikeMin > 0;
  const transitLegCount = legs.filter((l) => l.mode === "metro" || l.mode === "rer").length;

  // Summary
  let summary: string;
  if (transitLegCount === 0 && hasVelib) summary = "Vélib intégral";
  else if (transitLegCount === 0) summary = "À pied";
  else {
    const labels = linesUsed.map((l) => (l.mode === "rer" ? `RER ${l.label}` : `Ligne ${l.label}`));
    if (linesUsed.length === 1) {
      summary = labels[0] + (hasVelib ? " + Vélib" : transfers === 0 ? " directe" : "");
    } else {
      summary = linesUsed.map((l) => (l.mode === "rer" ? `RER ${l.label}` : l.label)).join(" → ") + (hasVelib ? " + Vélib" : "");
    }
  }

  // Tags
  const tags: string[] = [];
  if (linesUsed.length === 1 && transfers === 0) tags.push("1 seule ligne");
  if (transfers === 0 && transitLegCount > 0) tags.push("Zéro correspondance");
  if (hasVelib) tags.push("Vélib");
  if (walkMin + bikeMin > transitMin && transitLegCount > 0) tags.push("Grand air");
  if (transitLegCount === 0 && hasVelib) tags.push("100% à vélo");
  if (costEuro === 0 && durationMin > 0) tags.push("Gratuit");

  const w = mood.weights;
  const score =
    w.time * durationMin +
    w.transfer * transfers +
    w.walk * walkMin +
    w.bike * bikeMin +
    w.underground * transitMin +
    w.money * costEuro;

  return {
    id: `${kind}-${Math.round(durationMin)}-${linesUsed.map((l) => l.id).join("")}-${Math.round(walkMin + bikeMin)}`,
    legs,
    durationMin,
    walkMin,
    bikeMin,
    transitMin,
    transfers,
    linesUsed,
    distanceM,
    costEuro,
    co2g,
    carCo2g,
    summary,
    tags,
    score,
    kind,
  };
}

function dedupe(items: Itinerary[]): Itinerary[] {
  const best = new Map<string, Itinerary>();
  for (const it of items) {
    const key = `${it.linesUsed.map((l) => l.id).join("-")}|${it.bikeMin > 0 ? "v" : ""}|${Math.round(it.durationMin / 2)}|${it.transfers}`;
    const cur = best.get(key);
    if (!cur || it.score < cur.score) best.set(key, it);
  }
  return [...best.values()];
}

export interface PlanOptions {
  velib?: VelibStation[];
}

export function planRoutes(
  origin: Place,
  destination: Place,
  moodId: MoodId,
  options: PlanOptions = {},
): { best: Itinerary; alternatives: Itinerary[] } | null {
  const mood = MOODS[moodId];
  const ctx: PlanCtx = { velib: options.velib ?? VELIB_STATIONS };
  const candidates: Itinerary[] = [];

  const add = (legs: Leg[] | null, kind: string) => {
    if (!legs) return;
    const it = assemble(legs, kind, mood, origin, destination);
    if (it) candidates.push(it);
  };

  add(genWalkOnly(origin, destination), "walk");
  add(genVelibOnly(origin, destination, ctx), "velib");
  add(genMetro(origin, destination, ctx, { access: "walk", egress: "walk", transferPenalty: 0 }), "metro");
  add(genMetro(origin, destination, ctx, { access: "walk", egress: "walk", transferPenalty: 30 }), "metro-calm");
  add(genMetro(origin, destination, ctx, { access: "velib", egress: "walk", transferPenalty: 0 }), "metro+velib");
  add(genMetro(origin, destination, ctx, { access: "walk", egress: "velib", transferPenalty: 0 }), "metro+velib");
  add(genMetro(origin, destination, ctx, { access: "velib", egress: "velib", transferPenalty: 0 }), "metro+velib");
  for (const legs of genSingleLinePlusVelib(origin, destination, ctx)) add(legs, "1ligne+velib");

  const unique = dedupe(candidates).sort((a, b) => a.score - b.score);
  if (unique.length === 0) return null;

  const [best, ...rest] = unique;
  // Keep alternatives that are genuinely different from the winner.
  const alternatives: Itinerary[] = [];
  const seen = new Set([best.summary]);
  for (const it of rest) {
    if (seen.has(it.summary)) continue;
    seen.add(it.summary);
    alternatives.push(it);
    if (alternatives.length >= 3) break;
  }

  return { best, alternatives };
}
