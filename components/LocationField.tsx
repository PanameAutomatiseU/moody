"use client";

import { useEffect, useRef, useState } from "react";
import type { Place } from "@/lib/types";

export function LocationField({
  label,
  placeholder,
  value,
  onChange,
  testid,
}: {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  testid: string;
}) {
  const [q, setQ] = useState(value?.label ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pickedRef = useRef<string | null>(value?.label ?? null);

  useEffect(() => {
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

  return (
    <div ref={boxRef} className="relative">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">
        {label}
      </label>
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
        className="w-full rounded-xl border border-[color:var(--color-hair)] bg-white px-3.5 py-3 text-[15px] outline-none transition-colors focus:border-[color:var(--color-ink)]"
      />
      {loading && (
        <span className="absolute right-3 top-[34px] text-xs text-[color:var(--color-ink-soft)]">…</span>
      )}
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
                <span className="text-xs text-[color:var(--color-ink-soft)]">
                  {p.context ?? p.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
