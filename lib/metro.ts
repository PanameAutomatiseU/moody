import rawData from "@/data/metro.json";
import type { LatLng, LineInfo } from "./types";
import { haversineM, WAIT_FIRST, WAIT_TRANSFER } from "./geo";

interface RawStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  line: string;
}
interface RawEdge {
  from: string;
  to: string;
  w: number;
  type: "ride" | "transfer";
}
interface RawData {
  lines: Record<string, LineInfo>;
  stations: RawStation[];
  edges: RawEdge[];
}

const data = rawData as unknown as RawData;

export interface StationNode {
  id: string;
  name: string;
  lat: number;
  lon: number;
  line: string;
}

export const LINES: Record<string, LineInfo> = data.lines;
export const ALL_STATIONS: StationNode[] = data.stations;

const STATION_BY_ID = new Map<string, StationNode>(
  data.stations.map((s) => [s.id, s]),
);

interface AdjEdge {
  to: string;
  w: number;
  type: "ride" | "transfer";
}
const ADJ = new Map<string, AdjEdge[]>();
for (const s of data.stations) ADJ.set(s.id, []);
for (const e of data.edges) {
  ADJ.get(e.from)?.push({ to: e.to, w: e.w, type: e.type });
}

export function getStation(id: string): StationNode | undefined {
  return STATION_BY_ID.get(id);
}
export function getLine(id: string): LineInfo | undefined {
  return LINES[id];
}

export interface NearNode {
  node: StationNode;
  distanceM: number;
}

/** Per-line platform nodes near a point, nearest first (no name de-dup, so the
 *  caller can board the optimal line directly without an artificial transfer).
 *  When `lines` is given, only those lines are considered *before* the top-k cut
 *  — essential so a single-line search isn't crowded out by nearer platforms. */
export function nearestNodes(
  point: LatLng,
  maxM: number,
  k: number,
  lines?: Set<string>,
): NearNode[] {
  const out: NearNode[] = [];
  for (const s of data.stations) {
    if (lines && !lines.has(s.line)) continue;
    const d = haversineM(point, s);
    if (d <= maxM) out.push({ node: s, distanceM: d });
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out.slice(0, k);
}

/** Distinct line ids having at least one station within maxM of the point. */
export function linesNear(point: LatLng, maxM: number): Set<string> {
  const set = new Set<string>();
  for (const s of data.stations) {
    if (haversineM(point, s) <= maxM) set.add(s.line);
  }
  return set;
}

// ---------------------------------------------------------------------------
// Dijkstra
// ---------------------------------------------------------------------------

class MinHeap {
  private a: { p: number; id: string }[] = [];
  get size() {
    return this.a.length;
  }
  push(p: number, id: string) {
    const a = this.a;
    a.push({ p, id });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].p <= a[i].p) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop(): { p: number; id: string } | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let m = i;
        if (l < a.length && a[l].p < a[m].p) m = l;
        if (r < a.length && a[r].p < a[m].p) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export interface BoardPoint {
  id: string;
  cost: number; // access/egress connector minutes (objective == real here)
}

export type MetroStep =
  | { kind: "ride"; line: LineInfo; stops: StationNode[]; minutes: number }
  | { kind: "transfer"; from: StationNode; to: StationNode; minutes: number };

export interface MetroSearchResult {
  boardId: string;
  alightId: string;
  steps: MetroStep[];
  transfers: number;
  rideRealMin: number; // WAIT_FIRST + ride weights + transfer waits (in-system time)
  objective: number; // selection objective incl. access+egress+transferPenalty
}

export interface MetroSearchOpts {
  boarding: BoardPoint[];
  alighting: BoardPoint[];
  allowedLines?: Set<string>;
  transferPenalty?: number; // minute-equivalent penalty added per transfer (objective only)
}

/**
 * Multi-source / multi-target Dijkstra over the metro graph. Boarding nodes are
 * seeded with their access cost, every alighting node is then evaluated with
 * its egress cost; the global minimum-objective pair is reconstructed.
 */
export function metroSearch(opts: MetroSearchOpts): MetroSearchResult | null {
  const { allowedLines, boarding, alighting } = opts;
  const transferPenalty = opts.transferPenalty ?? 0;
  const lineOk = (lineId: string) => !allowedLines || allowedLines.has(lineId);

  const obj = new Map<string, number>();
  const real = new Map<string, number>();
  const prev = new Map<string, { from: string; type: "ride" | "transfer"; w: number } | null>();
  const heap = new MinHeap();

  for (const b of boarding) {
    const node = STATION_BY_ID.get(b.id);
    if (!node || !lineOk(node.line)) continue;
    const o = b.cost + WAIT_FIRST;
    if (o < (obj.get(b.id) ?? Infinity)) {
      obj.set(b.id, o);
      real.set(b.id, WAIT_FIRST);
      prev.set(b.id, null);
      heap.push(o, b.id);
    }
  }

  const settled = new Set<string>();
  while (heap.size) {
    const { p, id } = heap.pop()!;
    if (settled.has(id)) continue;
    if (p > (obj.get(id) ?? Infinity)) continue;
    settled.add(id);
    for (const e of ADJ.get(id) ?? []) {
      const next = STATION_BY_ID.get(e.to);
      if (!next) continue;
      // Restricting to a single line forbids transfers and off-line rides.
      if (allowedLines && (e.type === "transfer" || !lineOk(next.line))) continue;
      const extraReal = e.w + (e.type === "transfer" ? WAIT_TRANSFER : 0);
      const extraObj = extraReal + (e.type === "transfer" ? transferPenalty : 0);
      const nObj = (obj.get(id) ?? Infinity) + extraObj;
      if (nObj < (obj.get(e.to) ?? Infinity)) {
        obj.set(e.to, nObj);
        real.set(e.to, (real.get(id) ?? 0) + extraReal);
        prev.set(e.to, { from: id, type: e.type, w: e.w });
        heap.push(nObj, e.to);
      }
    }
  }

  // Choose best alighting node (objective + egress connector).
  let bestId: string | null = null;
  let bestObj = Infinity;
  for (const a of alighting) {
    const node = STATION_BY_ID.get(a.id);
    if (!node || !lineOk(node.line)) continue;
    const base = obj.get(a.id);
    if (base === undefined) continue;
    const total = base + a.cost;
    if (total < bestObj) {
      bestObj = total;
      bestId = a.id;
    }
  }
  if (!bestId) return null;

  // Reconstruct the edge path from the alighting node back to a boarding seed.
  const revNodes: StationNode[] = [];
  const revEdges: { type: "ride" | "transfer"; w: number }[] = [];
  let cur: string | null = bestId;
  while (cur) {
    revNodes.push(STATION_BY_ID.get(cur)!);
    const p = prev.get(cur);
    if (!p) break;
    revEdges.push({ type: p.type, w: p.w });
    cur = p.from;
  }
  const nodes = revNodes.reverse();
  const edges = revEdges.reverse(); // edges[i] connects nodes[i] -> nodes[i+1]

  const steps: MetroStep[] = [];
  let transfers = 0;
  let firstRideDone = false;
  let run: StationNode[] = [nodes[0]];
  let runMin = 0;
  const flushRide = () => {
    if (run.length < 2) return; // degenerate single-stop run, skip
    steps.push({
      kind: "ride",
      line: LINES[run[0].line],
      stops: run,
      minutes: runMin + (firstRideDone ? 0 : WAIT_FIRST),
    });
    firstRideDone = true;
  };
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    if (e.type === "transfer") {
      flushRide();
      transfers++;
      steps.push({
        kind: "transfer",
        from: nodes[i],
        to: nodes[i + 1],
        minutes: e.w + WAIT_TRANSFER,
      });
      run = [nodes[i + 1]];
      runMin = 0;
    } else {
      run.push(nodes[i + 1]);
      runMin += e.w;
    }
  }
  flushRide();

  return {
    boardId: nodes[0].id,
    alightId: bestId,
    steps,
    transfers,
    rideRealMin: real.get(bestId) ?? 0,
    objective: bestObj, // already includes access + ride + egress + transfer penalty
  };
}
