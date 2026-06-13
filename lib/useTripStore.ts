"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Place } from "./types";

export interface RecentTrip {
  id: string;
  origin: Place;
  destination: Place;
  moodId: string;
  moodLabel: string;
  moodEmoji: string;
  summary: string;
  durationMin: number;
  co2SavedG: number;
  pad?: { x: number; y: number };
  ts: number;
}

export interface SavedPlace {
  id: string;
  name: string;
  place: Place;
}

const RECENTS_KEY = "moody.recents.v2";
const PLACES_KEY = "moody.places.v2";
const MAX_RECENTS = 8;
const MAX_PLACES = 8;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

const placeKey = (p: Place) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
const tripKey = (o: Place, d: Place, moodId: string) =>
  `${placeKey(o)}>${placeKey(d)}|${moodId}`;

export function useTripStore() {
  const [recents, setRecents] = useState<RecentTrip[]>([]);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [ready, setReady] = useState(false);
  const [nowTs, setNowTs] = useState(0);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- client-only localStorage hydration */
    setRecents(read<RecentTrip[]>(RECENTS_KEY, []));
    setPlaces(read<SavedPlace[]>(PLACES_KEY, []));
    setNowTs(Date.now());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const addRecent = useCallback((t: Omit<RecentTrip, "id" | "ts">) => {
    setRecents((prev) => {
      const key = tripKey(t.origin, t.destination, t.moodId);
      const filtered = prev.filter(
        (r) => tripKey(r.origin, r.destination, r.moodId) !== key,
      );
      const next = [{ ...t, id: newId(), ts: Date.now() }, ...filtered].slice(0, MAX_RECENTS);
      write(RECENTS_KEY, next);
      return next;
    });
  }, []);

  const removeRecent = useCallback((id: string) => {
    setRecents((prev) => {
      const next = prev.filter((r) => r.id !== id);
      write(RECENTS_KEY, next);
      return next;
    });
  }, []);

  const savePlace = useCallback((place: Place, name?: string) => {
    setPlaces((prev) => {
      if (prev.some((p) => placeKey(p.place) === placeKey(place))) return prev;
      const next = [
        { id: newId(), name: name?.trim() || place.label.split(",")[0], place },
        ...prev,
      ].slice(0, MAX_PLACES);
      write(PLACES_KEY, next);
      return next;
    });
  }, []);

  const removePlace = useCallback((id: string) => {
    setPlaces((prev) => {
      const next = prev.filter((p) => p.id !== id);
      write(PLACES_KEY, next);
      return next;
    });
  }, []);

  const togglePlace = useCallback((place: Place, name?: string) => {
    setPlaces((prev) => {
      const exists = prev.find((p) => placeKey(p.place) === placeKey(place));
      const next = exists
        ? prev.filter((p) => p.id !== exists.id)
        : [{ id: newId(), name: name?.trim() || place.label.split(",")[0], place }, ...prev].slice(0, MAX_PLACES);
      write(PLACES_KEY, next);
      return next;
    });
  }, []);

  const isPlaceSaved = useCallback(
    (place: Place | null) => !!place && places.some((p) => placeKey(p.place) === placeKey(place)),
    [places],
  );

  const co2ThisWeekKg = useMemo(() => {
    const list = nowTs ? recents.filter((r) => r.ts >= nowTs - 7 * 24 * 3600 * 1000) : recents;
    return list.reduce((s, r) => s + (r.co2SavedG || 0), 0) / 1000;
  }, [recents, nowTs]);

  return {
    ready,
    recents,
    places,
    addRecent,
    removeRecent,
    savePlace,
    removePlace,
    togglePlace,
    isPlaceSaved,
    co2ThisWeekKg,
  };
}
