"use client";

import { useEffect, useRef, useState } from "react";
import type { StopCandidate, TrackPoint } from "@/types/domain";

type GoogleLatLngLiteral = {
  lat: number;
  lng: number;
};

type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds) => void;
};

type GoogleLatLngBounds = {
  extend: (point: GoogleLatLngLiteral) => void;
};

type GoogleMapsApi = {
  Map: new (
    element: HTMLElement,
    options: {
      center: GoogleLatLngLiteral;
      zoom: number;
      mapTypeId?: string;
      disableDefaultUI?: boolean;
      zoomControl?: boolean;
    },
  ) => GoogleMap;
  LatLngBounds: new () => GoogleLatLngBounds;
  Polyline: new (options: {
    path: GoogleLatLngLiteral[];
    geodesic: boolean;
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    map: GoogleMap;
  }) => unknown;
  Marker: new (options: {
    position: GoogleLatLngLiteral;
    map: GoogleMap;
    title: string;
    label?: string;
  }) => unknown;
};

declare global {
  interface Window {
    google?: {
      maps?: GoogleMapsApi;
    };
    __tapiyotaGoogleMapsPromise?: Promise<GoogleMapsApi>;
  }
}

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__tapiyotaGoogleMapsPromise) {
    return window.__tapiyotaGoogleMapsPromise;
  }

  window.__tapiyotaGoogleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&v=weekly&language=ja&region=JP`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error("Google Maps API failed to initialize."));
      }
    };
    script.onerror = () => reject(new Error("Google Maps API failed to load."));
    document.head.appendChild(script);
  });

  return window.__tapiyotaGoogleMapsPromise;
}

export function VoyageMap({
  points,
  stopCandidates = [],
}: {
  points: TrackPoint[];
  stopCandidates?: StopCandidate[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const message = !apiKey
    ? "Google Maps APIキーが未設定です。"
    : points.length === 0
      ? "表示できる位置情報がありません。"
      : loadError
        ? "Google Mapsを読み込めませんでした。APIキーと制限設定を確認してください。"
        : "";

  useEffect(() => {
    if (!mapRef.current) return;
    if (!apiKey || points.length === 0) return;

    let cancelled = false;

    void loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !mapRef.current) return;

        const path = points.map((point) => ({
          lat: point.latitude,
          lng: point.longitude,
        }));
        const map = new maps.Map(mapRef.current, {
          center: path[0],
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
        });
        const bounds = new maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds);

        new maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#0f4c81",
          strokeOpacity: 0.95,
          strokeWeight: 5,
          map,
        });

        new maps.Marker({
          position: path[0],
          map,
          title: "出船地点",
          label: "出",
        });

        if (path.length > 1) {
          new maps.Marker({
            position: path[path.length - 1],
            map,
            title: "帰港地点",
            label: "帰",
          });
        }

        stopCandidates.forEach((candidate, index) => {
          new maps.Marker({
            position: {
              lat: candidate.latitude,
              lng: candidate.longitude,
            },
            map,
            title: `停船候補 ${candidate.durationMinutes}分`,
            label: `${index + 1}`,
          });
        });
      })
      .catch(() => {
        setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, points, stopCandidates]);

  return (
    <div className="overflow-hidden rounded-lg border border-sky-100 bg-slate-100">
      <div ref={mapRef} className="h-80 w-full" />
      {message ? (
        <p className="border-t border-slate-200 bg-white p-3 text-sm font-bold leading-6 text-slate-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
