"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { LocationField } from "@/components/LocationField";
import { MoodPad } from "@/components/MoodPad";
import { Comparator } from "@/components/Comparator";
import { ItineraryView } from "@/components/ItineraryView";
import { PinGlyph } from "@/components/icons";
import { DEFAULT_MOOD, customMood, isMoodId, presetMood } from "@/lib/moods";
import { buildShareParams, parseShareParams } from "@/lib/share";
import { useTripStore } from "@/lib/useTripStore";
import type { Itinerary, Place, ResolvedMood, RouteResult } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#e8e5df]" />,
});

const EXAMPLE = {
  origin: { label: "Mairie du 20e, Paris", lat: 48.8653, lon: 2.3987 } as Place,
  destination: { label: "Boulogne-Billancourt", lat: 48.8352, lon: 2.2406 } as Place,
};

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

const short = (label: string) => label.split(",")[0];

export default function Home() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [mood, setMood] = useState<ResolvedMood>(() => presetMood(DEFAULT_MOOD));
  const [result, setResult] = useState<RouteResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isDesktop = useIsDesktop();
  const store = useTripStore();

  const options: Itinerary[] = result ? [result.best, ...result.alternatives] : [];
  const selected = options.find((o) => o.id === selectedId) ?? result?.best ?? null;

  const search = useCallback(
    async (o: Place | null, d: Place | null, m: ResolvedMood) => {
      if (!o || !d) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: o, destination: d, mood: m }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Une erreur est survenue.");
          setResult(null);
          return;
        }
        const rr = data as RouteResult;
        setResult(rr);
        setSelectedId(rr.best.id);
        store.addRecent({
          origin: o,
          destination: d,
          moodId: m.id,
          moodLabel: m.label,
          moodEmoji: m.emoji,
          summary: rr.best.summary,
          durationMin: rr.best.durationMin,
          co2SavedG: Math.max(0, rr.best.carCo2g - rr.best.co2g),
          pad: m.pad,
        });
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `?${buildShareParams(o, d, m)}`);
        }
      } catch {
        setError("Impossible de contacter le serveur. Réessaie.");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [store],
  );

  // Deep-link: hydrate from the URL once on mount and auto-run.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const parsed = parseShareParams(new URLSearchParams(window.location.search));
    let m = mood;
    if (parsed.pad) m = customMood(parsed.pad);
    else if (parsed.moodId && isMoodId(parsed.moodId)) m = presetMood(parsed.moodId);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time deep-link hydration on mount */
    setMood(m);
    if (parsed.origin) setOrigin(parsed.origin);
    if (parsed.destination) setDestination(parsed.destination);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (parsed.origin && parsed.destination) search(parsed.origin, parsed.destination, m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commitMood(m: ResolvedMood) {
    setMood(m);
    if (origin && destination) search(origin, destination, m);
  }

  function swap() {
    setOrigin(destination);
    setDestination(origin);
    if (result && origin && destination) search(destination, origin, mood);
  }

  function fillExample() {
    setOrigin(EXAMPLE.origin);
    setDestination(EXAMPLE.destination);
    search(EXAMPLE.origin, EXAMPLE.destination, mood);
  }

  function fillPlace(place: Place) {
    if (!origin) setOrigin(place);
    else setDestination(place);
  }

  function replay(o: Place, d: Place, moodId: string, pad?: { x: number; y: number }) {
    const m = pad ? customMood(pad) : isMoodId(moodId) ? presetMood(moodId) : presetMood(DEFAULT_MOOD);
    setOrigin(o);
    setDestination(d);
    setMood(m);
    search(o, d, m);
  }

  function share() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const map = (
    <MapView itinerary={selected} origin={origin} destination={destination} accent={mood.accent} />
  );

  return (
    <main className="lg:grid lg:h-screen lg:grid-cols-[minmax(400px,40%)_1fr] lg:overflow-hidden">
      <section className="px-5 py-7 sm:px-7 lg:h-screen lg:overflow-y-auto">
        <header className="mb-6">
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-[26px] font-semibold tracking-tight">Moody</h1>
            <span className="h-2 w-2 rounded-full" style={{ background: mood.accent }} />
          </div>
          <p className="mt-1 text-[15px] text-[color:var(--color-ink-soft)]">
            Votre trajet à Paris, selon votre humeur.
          </p>
        </header>

        <div className="rounded-3xl border border-[color:var(--color-hair)] bg-[color:var(--color-surface)] p-4 shadow-[0_10px_40px_-28px_rgba(0,0,0,0.4)] sm:p-5">
          <div className="relative space-y-2.5">
            <LocationField
              label="Départ"
              placeholder="D'où pars-tu ?"
              value={origin}
              onChange={setOrigin}
              testid="origin"
              enableLocate
              saved={store.isPlaceSaved(origin)}
              onToggleSave={origin ? () => store.togglePlace(origin) : undefined}
            />
            <button
              type="button"
              onClick={swap}
              aria-label="Inverser départ et arrivée"
              title="Inverser"
              className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-hair)] bg-white text-[color:var(--color-ink-soft)] shadow-sm transition-colors hover:text-[color:var(--color-ink)]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 4l-3 3" />
              </svg>
            </button>
            <LocationField
              label="Arrivée"
              placeholder="Où vas-tu ?"
              value={destination}
              onChange={setDestination}
              testid="destination"
              saved={store.isPlaceSaved(destination)}
              onToggleSave={destination ? () => store.togglePlace(destination) : undefined}
            />
          </div>

          {store.places.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">
                Mes lieux
              </span>
              {store.places.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => fillPlace(p.place)}
                  className="rounded-full border border-[color:var(--color-hair)] bg-white px-2.5 py-1 text-[12px] font-medium transition-colors hover:border-[color:var(--color-ink)]"
                  title={p.place.label}
                >
                  ★ {p.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4">
            <MoodPad value={mood} onChange={setMood} onCommit={commitMood} />
          </div>

          <button
            type="button"
            onClick={() => search(origin, destination, mood)}
            disabled={!origin || !destination || loading}
            data-testid="search"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: mood.accent }}
          >
            {loading ? "Calcul en cours…" : "Trouver mon itinéraire"}
          </button>

          {!result && !loading && (
            <button
              type="button"
              onClick={fillExample}
              data-testid="example"
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-[color:var(--color-ink-soft)] transition-colors hover:text-[color:var(--color-ink)]"
            >
              <PinGlyph className="h-3.5 w-3.5" /> Essayer : 20e → Boulogne
            </button>
          )}

          <Comparator
            origin={origin}
            destination={destination}
            activeMoodId={mood.id}
            onPick={(id) => commitMood(presetMood(isMoodId(id) ? id : DEFAULT_MOOD))}
          />
        </div>

        {!isDesktop && (
          <div className="mt-5 h-64 overflow-hidden rounded-3xl border border-[color:var(--color-hair)]">{map}</div>
        )}

        {store.co2ThisWeekKg > 0.05 && (
          <div className="mt-5 rounded-2xl border border-[color:var(--color-hair)] bg-[color:var(--color-surface)] px-4 py-3 text-sm">
            🌍 <span className="font-semibold">{store.co2ThisWeekKg.toFixed(1)} kg de CO₂</span> évités cette semaine vs voiture.
          </div>
        )}

        <div className="mt-5">
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700" data-testid="error">
              {error}
            </p>
          )}
          {loading && !result && (
            <div className="space-y-3" data-testid="loading">
              <div className="h-40 animate-pulse rounded-3xl bg-[color:var(--color-hair)]/60" />
              <div className="h-16 animate-pulse rounded-2xl bg-[color:var(--color-hair)]/40" />
            </div>
          )}
          {selected && result && (
            <>
              <div className="mb-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={share}
                  data-testid="share"
                  className="flex items-center gap-1.5 rounded-full border border-[color:var(--color-hair)] bg-white px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-[color:var(--color-ink)]"
                >
                  {copied ? "Lien copié ✓" : "🔗 Partager"}
                </button>
              </div>
              <ItineraryView
                selected={selected}
                options={options}
                onSelect={setSelectedId}
                mood={mood}
                weatherNote={result.weatherNote}
              />
            </>
          )}
          {!result && !loading && !error && (
            <div className="rounded-3xl border border-dashed border-[color:var(--color-hair)] px-5 py-10 text-center">
              <p className="text-[15px] font-medium">Dis-moi ton humeur du moment</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-[color:var(--color-ink-soft)]">
                Place le curseur entre vitesse et tranquillité, souterrain et grand air — Moody compose le trajet.
              </p>
            </div>
          )}
        </div>

        {store.recents.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">
              Trajets récents
            </h3>
            <div className="flex flex-col gap-1.5">
              {store.recents.slice(0, 5).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => replay(r.origin, r.destination, r.moodId, r.pad)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-hair)] bg-white px-3.5 py-2.5 text-left transition-colors hover:border-[color:var(--color-ink)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden>{r.moodEmoji}</span>
                    <span className="truncate text-sm">
                      {short(r.origin.label)} → {short(r.destination.label)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] text-[color:var(--color-ink-soft)]">
                    {Math.round(r.durationMin)} min
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-8 text-[11px] leading-relaxed text-[color:var(--color-ink-soft)]">
          Données temps réel : Île-de-France Mobilités · Vélib’ Métropole · Base Adresse Nationale ·
          itinéraires vélo OpenRouteService.
          <br />
          Moody est une démo — vérifie les horaires officiels avant de partir.
        </footer>
      </section>

      {isDesktop && <section className="lg:h-screen">{map}</section>}
    </main>
  );
}
