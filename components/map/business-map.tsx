"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  useJsApiLoader
} from "@react-google-maps/api";
import { Business } from "@/lib/types";
import { googleMapsApiKey } from "@/lib/firebase/client";
import { MILWAUKEE_CENTER } from "@/lib/constants";

type BusinessMapProps = {
  businesses: Business[];
  heightClassName?: string;
};

export function BusinessMap({
  businesses,
  heightClassName = "h-[420px]"
}: BusinessMapProps) {
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "mke-black-map",
    googleMapsApiKey
  });

  useEffect(() => {
    if (!businesses.length) {
      setActiveBusinessId(null);
      return;
    }

    if (!businesses.some((business) => business.id === activeBusinessId)) {
      setActiveBusinessId(businesses[0].id);
    }
  }, [activeBusinessId, businesses]);

  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;

  if (!googleMapsApiKey) {
    return (
      <div
        className={`flex items-center justify-center rounded-[2rem] border border-line bg-panel/80 p-8 text-center text-sm leading-7 text-stone-300 ${heightClassName}`}
      >
        Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to render business pins.
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={`flex items-center justify-center rounded-[2rem] border border-danger/35 bg-danger/10 p-8 text-center text-sm leading-7 text-stone-100 ${heightClassName}`}
      >
        Google Maps could not load for this directory view.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={`animate-pulse rounded-[2rem] border border-line bg-panel/80 ${heightClassName}`}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-line bg-panel/80 shadow-glow">
      <GoogleMap
        mapContainerClassName={`w-full ${heightClassName}`}
        center={businesses[0]?.location ?? MILWAUKEE_CENTER}
        zoom={12}
        onLoad={(map) => {
          if (!businesses.length) {
            map.setCenter(MILWAUKEE_CENTER);
            map.setZoom(11);
            return;
          }

          if (businesses.length === 1) {
            map.setCenter(businesses[0].location);
            map.setZoom(14);
            return;
          }

          const bounds = new window.google.maps.LatLngBounds();

          for (const business of businesses) {
            bounds.extend(business.location);
          }

          map.fitBounds(bounds);
        }}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false
        }}
      >
        {businesses.map((business) => (
          <MarkerF
            key={business.id}
            position={business.location}
            onClick={() => setActiveBusinessId(business.id)}
          />
        ))}

        {activeBusiness ? (
          <InfoWindowF
            position={activeBusiness.location}
            onCloseClick={() => setActiveBusinessId(null)}
          >
            <div className="max-w-[220px] p-1 text-canvas">
              <p className="font-semibold">{activeBusiness.name}</p>
              <p className="mt-1 text-xs text-stone-600">{activeBusiness.category}</p>
              <p className="mt-1 text-xs text-stone-600">{activeBusiness.address}</p>
              <Link
                href={`/business/${activeBusiness.id}`}
                className="mt-3 inline-block text-xs font-medium text-[#8d5f00]"
              >
                Open listing
              </Link>
            </div>
          </InfoWindowF>
        ) : null}
      </GoogleMap>
    </div>
  );
}
