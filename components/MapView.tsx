"use client";

import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type { Itinerary, Leg, Place } from "@/lib/types";

const PARIS: [number, number] = [48.8566, 2.3522];
const WALK_COLOR = "#9c968b";
const VELIB_COLOR = "#1f8a53";

type LL = [number, number];

function legStyle(leg: Leg): { color: string; weight: number; dashArray?: string } {
  if (leg.mode === "walk") return { color: WALK_COLOR, weight: 4, dashArray: "1 7" };
  if (leg.mode === "velib") return { color: VELIB_COLOR, weight: 5, dashArray: "9 7" };
  if (leg.line) return { color: leg.line.color, weight: 6 };
  return { color: "#1c1b19", weight: 5 };
}

function pinIcon(color: string, filled: boolean) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${
      filled ? color : "#ffffff"
    };border:3px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.3)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function nodeIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:11px;height:11px;border-radius:9999px;background:#fff;border:3px solid ${color};box-shadow:0 1px 2px rgba(0,0,0,.25)"></span>`,
    iconSize: [11, 11],
    iconAnchor: [5.5, 5.5],
  });
}

function Fitter({ points }: { points: LL[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [50, 50], maxZoom: 15, animate: true });
    } else if (points.length === 1) {
      map.setView(points[0], 14, { animate: true });
    }
  }, [points, map]);
  return null;
}

export interface MapViewProps {
  itinerary: Itinerary | null;
  origin: Place | null;
  destination: Place | null;
  accent: string;
}

export default function MapView({ itinerary, origin, destination, accent }: MapViewProps) {
  const polylines = (itinerary?.legs ?? [])
    .map((leg) => ({
      positions: leg.polyline.map((p) => [p.lat, p.lon] as LL),
      ...legStyle(leg),
    }))
    .filter((pl) => pl.positions.length >= 2);

  // Small dots where one mode hands off to the next (transfers / mode changes).
  const handoffs: LL[] = [];
  const legs = itinerary?.legs ?? [];
  for (let i = 0; i < legs.length - 1; i++) {
    const t = legs[i].to;
    handoffs.push([t.lat, t.lon]);
  }

  const allPoints: LL[] = [];
  for (const pl of polylines) allPoints.push(...pl.positions);
  if (origin) allPoints.push([origin.lat, origin.lon]);
  if (destination) allPoints.push([destination.lat, destination.lon]);

  return (
    <MapContainer
      center={PARIS}
      zoom={12}
      zoomControl={false}
      scrollWheelZoom
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap, &copy; CARTO'
        subdomains="abcd"
        maxZoom={20}
      />
      {polylines.map((pl, i) => (
        <Polyline
          key={i}
          positions={pl.positions}
          pathOptions={{
            color: pl.color,
            weight: pl.weight,
            dashArray: pl.dashArray,
            opacity: 0.92,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ))}
      {handoffs.map((p, i) => (
        <Marker key={`h${i}`} position={p} icon={nodeIcon(accent)} />
      ))}
      {origin && <Marker position={[origin.lat, origin.lon]} icon={pinIcon(accent, true)} />}
      {destination && (
        <Marker position={[destination.lat, destination.lon]} icon={pinIcon(accent, false)} />
      )}
      <Fitter points={allPoints} />
    </MapContainer>
  );
}
