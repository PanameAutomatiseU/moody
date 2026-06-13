"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/types";

export function LocationField({
  label,
  placeholder,
  value,
  onChange,
  testid,
  enableLocate = false,
  saved = false,
  onToggleSave,
}: {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  testid: string;
  enableLocate?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const [q, setQ] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pickedRef = useRef<string | null>(value?.label ?? null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror externally-set value into the editable field
    setQ(value?.label ?? "");
    pickedRef.current = value?.label ?? null;
  }, [value?.label]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3 || query === pickedRef.current) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const data: Place[] = await res.json();
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function pick(p: Place) {
    pickedRef.current = p.label;
    onChange(p);
    setQ(p.label);
    setResults([]);
    setOpen(false);
  }

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/reverse?lat=${latitude}&lon=${longitude}`);
          const place: Place = await res.json();
          if (place && typeof place.lat === "number") pick(place);
        } catch {
          /* ignore */
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">
        {label}
      </label>
      <div className="relative">
        <input
          value={q}
          data-testid={testid}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            onChange(null);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full rounded-xl border border-[color:var(--color-hair)] bg-white py-3 pl-3.5 pr-20 text-[15px] outline-none transition-colors focus:border-[color:var(--color-ink)]"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading && <span className="text-xs text-[color:var(--color-ink-soft)]">…</span>}
          {value && onToggleSave && (
            <button
              type="button"
              onClick={onToggleSave}
              aria-label={saved ? "Retirer des lieux" : "Enregistrer ce lieu"}
              title={saved ? "Retirer des lieux" : "Enregistrer ce lieu"}
              data-testid={`${testid}-save`}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] transition-colors hover:bg-[color:var(--color-paper)]"
              style={{ color: saved ? "#E8A33D" : "var(--color-ink-soft)" }}
            >
              {saved ? "★" : "☆"}
            </button>
          )}
          {enableLocate && (
            <button
              type="button"
              onClick={locate}
              aria-label="Utiliser ma position"
              title="Utiliser ma position"
              data-testid={`${testid}-locate`}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--color-ink-soft)] transition-colors hover:bg-[color:var(--color-paper)] hover:text-[color:var(--color-ink)]"
            >
              {locating ? (
                <span className="text-xs">…</span>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-[1200] mt-1.5 w-full overflow-hidden rounded-xl border border-[color:var(--color-hair)] bg-white shadow-[0_12px_30px_-10px_rgba(0,0,0,0.25)]">
          {results.map((p, i) => (
            <li key={`${p.lat}-${p.lon}-${i}`}>
              <button
                type="button"
                data-testid={`${testid}-option`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                className="flex w-full flex-col items-start gap-0.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[color:var(--color-paper)]"
              >
                <span className="text-sm font-medium leading-tight">{p.label.split(",")[0]}</span>
                <span className="text-xs text-[color:var(--color-ink-soft)]">{p.context ?? p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
