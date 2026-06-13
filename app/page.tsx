"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { LocationField } from "@/components/LocationField";
import { MoodPicker } from "@/components/MoodPicker";
import { ItineraryView } from "@/components/ItineraryView";
import { PinGlyph } from "@/components/icons";
import { MOODS, DEFAULT_MOOD } from "@/lib/moods";
import type { Itinerary, MoodId, Place, RouteResult } from "@/lib/types";

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

export default function Home() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [mood, setMood] = useState<MoodId>(DEFAULT_MOOD);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  const activeMood = MOODS[mood];
  const options: Itinerary[] = result ? [result.best, ...result.alternatives] : [];
  const selected = options.find((o) => o.id === selectedId) ?? result?.best ?? null;

  const search = useCallback(
    async (o: Place | null, d: Place | null, m: MoodId) => {
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
        setResult(data as RouteResult);
        setSelectedId((data as RouteResult).best.id);
      } catch {
        setError("Impossible de contacter le serveur. Réessaie.");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  function handleMood(m: MoodId) {
    setMood(m);
    if (result && origin && destination) search(origin, destination, m);
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

  const map = (
    <MapView
      itinerary={selected}
      origin={origin}
      destination={destination}
      accent={activeMood.accent}
    />
  );

  return (
    <main className="lg:grid lg:h-screen lg:grid-cols-[minmax(400px,40%)_1fr] lg:overflow-hidden">
      <section className="px-5 py-7 sm:px-7 lg:h-screen lg:overflow-y-auto">
        <header className="mb-6">
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-[26px] font-semibold tracking-tight">Moody</h1>
            <span className="h-2 w-2 rounded-full" style={{ background: activeMood.accent }} />
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
            />
            <button
              type="button"
              onClick={swap}
              aria-label="Inverser départ et arrivée"
              title="Inverser"
              className="absolute right-2 top-[42px] z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[color:var(--color-hair)] bg-white text-[color:var(--color-ink-soft)] transition-colors hover:text-[color:var(--color-ink)]"
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
            />
          </div>

          <div className="mt-4">
            <MoodPicker value={mood} onChange={handleMood} />
          </div>

          <button
            type="button"
            onClick={() => search(origin, destination, mood)}
            disabled={!origin || !destination || loading}
            data-testid="search"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: activeMood.accent }}
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
        </div>

        {/* Mobile map */}
        {!isDesktop && (
          <div className="mt-5 h-64 overflow-hidden rounded-3xl border border-[color:var(--color-hair)]">
            {map}
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
            <ItineraryView
              selected={selected}
              options={options}
              onSelect={setSelectedId}
              mood={activeMood}
              weatherNote={result.weatherNote}
            />
          )}
          {!result && !loading && !error && (
            <div className="rounded-3xl border border-dashed border-[color:var(--color-hair)] px-5 py-10 text-center">
              <p className="text-[15px] font-medium">Dis-moi ton humeur du moment</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-[color:var(--color-ink-soft)]">
                Moody combine métro, Vélib et marche pour coller à ton mood — du plus pressé au plus flâneur.
              </p>
            </div>
          )}
        </div>

        <footer className="mt-8 text-[11px] leading-relaxed text-[color:var(--color-ink-soft)]">
          Données temps réel : Île-de-France Mobilités · Vélib’ Métropole · Base Adresse Nationale.
          <br />
          Moody est une démo — vérifie les horaires officiels avant de partir.
        </footer>
      </section>

      {/* Desktop map */}
      {isDesktop && <section className="lg:h-screen">{map}</section>}
    </main>
  );
}
