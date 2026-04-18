"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type BusinessGalleryProps = {
  name: string;
  photos: string[];
};

export function BusinessGallery({ name, photos }: BusinessGalleryProps) {
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    setActivePhoto(0);
  }, [photos]);

  if (!photos.length) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-[2.2rem] border border-line bg-gradient-to-br from-accent/20 via-panelAlt to-panel text-center">
        <div>
          <p className="font-display text-5xl text-accentSoft">{name}</p>
          <p className="mt-3 text-sm uppercase tracking-[0.26em] text-muted">
            Photo gallery coming soon
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[2.2rem] border border-line bg-panel">
        <Image
          src={photos[activePhoto]}
          alt={name}
          fill
          sizes="(min-width: 1280px) 55vw, 100vw"
          className="object-cover"
        />
      </div>
      {photos.length > 1 ? (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {photos.map((photo, index) => (
            <button
              key={photo}
              type="button"
              onClick={() => setActivePhoto(index)}
              className={`overflow-hidden rounded-2xl border transition ${
                index === activePhoto
                  ? "border-accent shadow-glow"
                  : "border-line hover:border-accent/40"
              }`}
            >
              <div className="relative aspect-square">
                <Image
                src={photo}
                alt={`${name} preview ${index + 1}`}
                  fill
                  sizes="25vw"
                  className="object-cover"
                />
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
