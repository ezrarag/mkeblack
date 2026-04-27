"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MILWAUKEE_CENTER } from "@/lib/constants";
import { isBusinessOpenNow } from "@/lib/business-hours";
import { mapboxToken } from "@/lib/firebase/client";
import { getGoogleMapsDirectionsUrl } from "@/lib/directions";
import { getNeighborhoodBounds } from "@/lib/neighborhood";
import { Business, NeighborhoodGeoJsonFeature } from "@/lib/types";

type BusinessMapProps = {
  businesses: Business[];
  heightClassName?: string;
  userLocation?: { lat: number; lng: number } | null;
  selectedNeighborhoodFeature?: NeighborhoodGeoJsonFeature | null;
  selectedBusinessId?: string | null;
  onBusinessSelect?: (business: Business) => void;
};

type MapboxGlobal = {
  accessToken: string;
  Map: new (options: Record<string, unknown>) => MapboxMap;
  Popup: new (options?: Record<string, unknown>) => MapboxPopup;
  NavigationControl: new (options?: Record<string, unknown>) => unknown;
};

type MapboxPopup = {
  setLngLat: (lngLat: [number, number]) => MapboxPopup;
  setHTML: (html: string) => MapboxPopup;
  addTo: (map: MapboxMap) => MapboxPopup;
  remove: () => void;
};

type MapboxMap = {
  addControl: (control: unknown, position?: string) => void;
  addSource: (id: string, source: Record<string, unknown>) => void;
  getSource: (id: string) => { setData?: (data: unknown) => void; getClusterExpansionZoom?: (clusterId: number, callback: (error: Error | null, zoom: number) => void) => void } | undefined;
  removeSource: (id: string) => void;
  addLayer: (layer: Record<string, unknown>, beforeId?: string) => void;
  getLayer: (id: string) => unknown;
  removeLayer: (id: string) => void;
  on: (event: string, layerOrListener: string | ((event: MapboxEvent) => void), listener?: (event: MapboxEvent) => void) => void;
  off: (event: string, layerOrListener: string | ((event: MapboxEvent) => void), listener?: (event: MapboxEvent) => void) => void;
  loaded: () => boolean;
  flyTo: (options: Record<string, unknown>) => void;
  fitBounds: (bounds: [[number, number], [number, number]], options?: Record<string, unknown>) => void;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  getCanvas: () => HTMLCanvasElement;
  remove: () => void;
};

type MapboxEvent = {
  features?: Array<{
    properties?: Record<string, unknown>;
    geometry?: { coordinates?: [number, number] };
  }>;
  lngLat?: { lng: number; lat: number };
};

declare global {
  interface Window {
    mapboxgl?: MapboxGlobal;
  }
}

const MAPBOX_SCRIPT_ID = "mapbox-gl-js";
const MAPBOX_CSS_ID = "mapbox-gl-css";
const BUSINESSES_SOURCE_ID = "businesses";
const NEIGHBORHOOD_SOURCE_ID = "selected-neighborhood";
const USER_SOURCE_ID = "user-location";

function loadMapbox() {
  if (!document.getElementById(MAPBOX_CSS_ID)) {
    const link = document.createElement("link");
    link.id = MAPBOX_CSS_ID;
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }

  if (window.mapboxgl) {
    return Promise.resolve(window.mapboxgl);
  }

  return new Promise<MapboxGlobal>((resolve, reject) => {
    const existingScript = document.getElementById(
      MAPBOX_SCRIPT_ID
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.mapboxgl) {
          resolve(window.mapboxgl);
        } else {
          reject(new Error("Mapbox GL did not initialize."));
        }
      });
      existingScript.addEventListener("error", () =>
        reject(new Error("Mapbox GL could not load."))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = MAPBOX_SCRIPT_ID;
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js";
    script.async = true;
    script.onload = () => {
      if (window.mapboxgl) {
        resolve(window.mapboxgl);
      } else {
        reject(new Error("Mapbox GL did not initialize."));
      }
    };
    script.onerror = () => reject(new Error("Mapbox GL could not load."));
    document.head.appendChild(script);
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function businessFeatureCollection(businesses: Business[]) {
  return {
    type: "FeatureCollection",
    features: businesses
      .filter((business) =>
        Number.isFinite(business.location.lat) &&
        Number.isFinite(business.location.lng)
      )
      .map((business) => ({
        type: "Feature",
        properties: {
          id: business.id,
          name: business.name,
          category: business.category,
          openNow: isBusinessOpenNow(business.hours)
        },
        geometry: {
          type: "Point",
          coordinates: [business.location.lng, business.location.lat]
        }
      }))
  };
}

function popupHtml(
  business: Business,
  userLocation?: { lat: number; lng: number } | null
) {
  const isOpen = isBusinessOpenNow(business.hours);
  const statusClass = isOpen ? "background:#22c55e" : "background:#ef4444";
  const directionsUrl = getGoogleMapsDirectionsUrl(
    business.location,
    userLocation
  );

  return `
    <div style="min-width:190px;color:#1c1917;font-family:system-ui,sans-serif">
      <div style="font-weight:700;font-size:14px;line-height:1.3">${escapeHtml(business.name)}</div>
      <div style="margin-top:4px;color:#78716c;font-size:12px">${escapeHtml(business.category)}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#44403c">
        <span style="width:8px;height:8px;border-radius:999px;${statusClass}"></span>
        ${isOpen ? "Open now" : "Closed"}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        <a href="/business/${encodeURIComponent(business.id)}" style="color:#8d5f00;font-size:12px;font-weight:700">View listing &rarr;</a>
        <a href="${directionsUrl}" target="_blank" rel="noreferrer" style="color:#2563eb;font-size:12px;font-weight:700">Directions &rarr;</a>
      </div>
    </div>
  `;
}

export function BusinessMap({
  businesses,
  heightClassName = "h-[420px]",
  userLocation = null,
  selectedNeighborhoodFeature = null,
  selectedBusinessId = null,
  onBusinessSelect
}: BusinessMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const popupRef = useRef<MapboxPopup | null>(null);
  const businessesRef = useRef(businesses);
  const userLocationRef = useRef(userLocation);
  const onBusinessSelectRef = useRef(onBusinessSelect);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const businessData = useMemo(() => businessFeatureCollection(businesses), [businesses]);

  useEffect(() => {
    businessesRef.current = businesses;
  }, [businesses]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    onBusinessSelectRef.current = onBusinessSelect;
  }, [onBusinessSelect]);

  useEffect(() => {
    if (!mapboxToken || !containerRef.current || mapRef.current) {
      return;
    }

    let cancelled = false;

    void loadMapbox()
      .then((mapboxgl) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        mapboxgl.accessToken = mapboxToken;
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [MILWAUKEE_CENTER.lng, MILWAUKEE_CENTER.lat],
          zoom: 11,
          attributionControl: false
        });

        mapRef.current = map;
        popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: true });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

        map.on("load", () => {
          if (cancelled) {
            return;
          }

          map.addSource(BUSINESSES_SOURCE_ID, {
            type: "geojson",
            data: businessFeatureCollection(businessesRef.current),
            cluster: businessesRef.current.length > 15,
            clusterMaxZoom: 14,
            clusterRadius: 48
          });

          map.addLayer({
            id: "business-clusters",
            type: "circle",
            source: BUSINESSES_SOURCE_ID,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#D4A017",
              "circle-radius": ["step", ["get", "point_count"], 18, 25, 24, 60, 32],
              "circle-opacity": 0.9,
              "circle-stroke-color": "#0b0b0b",
              "circle-stroke-width": 2
            }
          });

          map.addLayer({
            id: "business-cluster-count",
            type: "symbol",
            source: BUSINESSES_SOURCE_ID,
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
              "text-size": 12
            },
            paint: {
              "text-color": "#0b0b0b"
            }
          });

          map.addLayer({
            id: "business-pins",
            type: "circle",
            source: BUSINESSES_SOURCE_ID,
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": "#f8d56b",
              "circle-radius": 7,
              "circle-stroke-color": "#0b0b0b",
              "circle-stroke-width": 2
            }
          });

          map.on("click", "business-clusters", (event) => {
            const feature = event.features?.[0];
            const clusterId = feature?.properties?.cluster_id;
            const coordinates = feature?.geometry?.coordinates;
            const source = map.getSource(BUSINESSES_SOURCE_ID);

            if (
              typeof clusterId !== "number" ||
              !coordinates ||
              !source?.getClusterExpansionZoom
            ) {
              return;
            }

            source.getClusterExpansionZoom(clusterId, (error, zoom) => {
              if (error) {
                return;
              }

              map.flyTo({ center: coordinates, zoom });
            });
          });

          map.on("click", "business-pins", (event) => {
            const id = event.features?.[0]?.properties?.id;
            const business = businessesRef.current.find((item) => item.id === id);

            if (business) {
              popupRef.current
                ?.setLngLat([business.location.lng, business.location.lat])
                .setHTML(popupHtml(business, userLocationRef.current))
                .addTo(map);
              onBusinessSelectRef.current?.(business);
            }
          });

          const setPointer = () => {
            map.getCanvas().style.cursor = "pointer";
          };
          const clearPointer = () => {
            map.getCanvas().style.cursor = "";
          };
          map.on("mouseenter", "business-pins", setPointer);
          map.on("mouseleave", "business-pins", clearPointer);
          map.on("mouseenter", "business-clusters", setPointer);
          map.on("mouseleave", "business-clusters", clearPointer);

          setLoaded(true);
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Mapbox could not load.");
        }
      });

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      popupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource(BUSINESSES_SOURCE_ID);

    if (!loaded || !map || !source?.setData) {
      return;
    }

    source.setData(businessData);

    const coordinates = businesses
      .filter((business) =>
        Number.isFinite(business.location.lat) &&
        Number.isFinite(business.location.lng)
      )
      .map((business) => [business.location.lng, business.location.lat] as [number, number]);

    if (coordinates.length === 1) {
      map.flyTo({ center: coordinates[0], zoom: 14, essential: true });
    } else if (coordinates.length > 1 && !selectedNeighborhoodFeature) {
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...coordinates.map((point) => point[0])), Math.min(...coordinates.map((point) => point[1]))],
        [Math.max(...coordinates.map((point) => point[0])), Math.max(...coordinates.map((point) => point[1]))]
      ];
      map.fitBounds(bounds, { padding: 64, maxZoom: 13 });
    }
  }, [businessData, businesses, loaded, selectedNeighborhoodFeature]);

  useEffect(() => {
    const map = mapRef.current;

    if (!loaded || !map) {
      return;
    }

    if (map.getLayer("neighborhood-fill")) {
      map.removeLayer("neighborhood-fill");
    }
    if (map.getLayer("neighborhood-line")) {
      map.removeLayer("neighborhood-line");
    }
    if (map.getSource(NEIGHBORHOOD_SOURCE_ID)) {
      map.removeSource(NEIGHBORHOOD_SOURCE_ID);
    }

    if (!selectedNeighborhoodFeature) {
      return;
    }

    map.addSource(NEIGHBORHOOD_SOURCE_ID, {
      type: "geojson",
      data: selectedNeighborhoodFeature
    });
    map.addLayer(
      {
        id: "neighborhood-fill",
        type: "fill",
        source: NEIGHBORHOOD_SOURCE_ID,
        paint: {
          "fill-color": "#D4A017",
          "fill-opacity": 0.15
        }
      },
      "business-clusters"
    );
    map.addLayer(
      {
        id: "neighborhood-line",
        type: "line",
        source: NEIGHBORHOOD_SOURCE_ID,
        paint: {
          "line-color": "#D4A017",
          "line-width": 3
        }
      },
      "business-clusters"
    );

    const bounds = getNeighborhoodBounds(selectedNeighborhoodFeature);
    if (bounds) {
      map.fitBounds(bounds, { padding: 52, maxZoom: 14 });
    }
  }, [loaded, selectedNeighborhoodFeature]);

  useEffect(() => {
    const map = mapRef.current;

    if (!loaded || !map) {
      return;
    }

    for (const layerId of ["user-location-pulse", "user-location-dot"]) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }
    if (map.getSource(USER_SOURCE_ID)) {
      map.removeSource(USER_SOURCE_ID);
    }

    if (!userLocation) {
      return;
    }

    map.addSource(USER_SOURCE_ID, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [userLocation.lng, userLocation.lat]
        }
      }
    });
    map.addLayer({
      id: "user-location-pulse",
      type: "circle",
      source: USER_SOURCE_ID,
      paint: {
        "circle-color": "#3b82f6",
        "circle-radius": 18,
        "circle-opacity": 0.22
      }
    });
    map.addLayer({
      id: "user-location-dot",
      type: "circle",
      source: USER_SOURCE_ID,
      paint: {
        "circle-color": "#3b82f6",
        "circle-radius": 7,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2
      }
    });
  }, [loaded, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    const business = businesses.find((item) => item.id === selectedBusinessId);

    if (!loaded || !map || !business) {
      return;
    }

    map.flyTo({
      center: [business.location.lng, business.location.lat],
      zoom: 14,
      essential: true
    });
    popupRef.current
      ?.setLngLat([business.location.lng, business.location.lat])
      .setHTML(popupHtml(business, userLocation))
      .addTo(map);
  }, [businesses, loaded, selectedBusinessId, userLocation]);

  if (!mapboxToken) {
    return (
      <div
        className={`flex items-center justify-center rounded-[2rem] border border-line bg-panel/80 p-8 text-center text-sm leading-7 text-stone-300 ${heightClassName}`}
      >
        Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to render the directory map.
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={`flex items-center justify-center rounded-[2rem] border border-danger/35 bg-danger/10 p-8 text-center text-sm leading-7 text-stone-100 ${heightClassName}`}
      >
        {loadError}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-line bg-panel/80 shadow-glow">
      <div ref={containerRef} className={`w-full ${heightClassName}`} />
    </div>
  );
}
