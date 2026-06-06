import { useEffect, useRef } from "react";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Fix default marker icon path under bundlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(L.Icon.Default as any).mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
};

export function LeafletMap({
  markers,
  center,
  zoom = 12,
  className = "h-[420px] w-full rounded-2xl overflow-hidden border",
}: {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const first = markers[0];
    const c = center ?? (first ? [first.lat, first.lng] : [30.0444, 31.2357]);
    const map = L.map(ref.current).setView(c as [number, number], zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 60);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: [number, number][] = [];
    for (const m of markers) {
      const icon = m.color
        ? L.divIcon({
            className: "",
            html: `<div style="background:${m.color};color:white;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid white">${(m.label?.[0] ?? "•").toUpperCase()}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })
        : new L.Icon.Default();
      const mk = L.marker([m.lat, m.lng], { icon }).addTo(layer);
      if (m.label) mk.bindPopup(m.label);
      bounds.push([m.lat, m.lng]);
    }
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    else if (bounds.length === 1) map.setView(bounds[0], zoom);
  }, [markers, zoom]);

  return <div ref={ref} className={className} />;
}