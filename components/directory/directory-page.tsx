"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BusinessCard } from "@/components/directory/business-card";
import { BusinessMap } from "@/components/map/business-map";
import { StatePanel } from "@/components/ui/state-panel";
import { BUSINESS_CATEGORIES } from "@/lib/constants";
import { getDayKeyFromDate, isBusinessOpenOnDay } from "@/lib/business-hours";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { useBusinesses } from "@/hooks/use-businesses";
import { useNeighborhoods } from "@/hooks/use-neighborhoods";
import { useBusinessTags } from "@/hooks/use-business-tags";
import { Business, DAY_KEYS, DayKey } from "@/lib/types";
import { haversineKm, titleCase } from "@/lib/utils";

type DirectoryPageProps = {
  initialTags?: string[];
};

export function DirectoryPage({ initialTags = [] }: DirectoryPageProps) {
  const { businesses, loading, error } = useBusinesses();
  const { neighborhoods, error: neighborhoodsError } = useNeighborhoods();
  const { tags: businessTags, error: tagsError } = useBusinessTags();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    Array.from(
      new Set(
        initialTags
          .flatMap((value) => value.split(","))
          .map((value) => value.trim())
          .filter(Boolean)
      )
    )
  );
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayKey | "all">(
    getDayKeyFromDate()
  );
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [mobileMapEnabled, setMobileMapEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const tagParams = initialTags
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);

    if (tagParams.length) {
      setSelectedTags(Array.from(new Set(tagParams)));
      setTagsExpanded(true);
    }
  }, [initialTags]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set([...BUSINESS_CATEGORIES, ...businesses.map((business) => business.category)])
      ),
    [businesses]
  );

  const neighborhoodOptions = useMemo(
    () =>
      Array.from(
        new Set(businesses.map((business) => business.neighborhood).filter(Boolean))
      ).sort((left, right) => left.localeCompare(right)),
    [businesses]
  );

  const activeTags = useMemo(
    () => businessTags.filter((tag) => tag.active),
    [businessTags]
  );

  const selectedNeighborhoodFeature =
    selectedNeighborhood === "all"
      ? null
      : neighborhoods.find((neighborhood) => neighborhood.name === selectedNeighborhood)
          ?.geojson ?? null;

  const filteredBusinesses = useMemo(() => {
    const filtered = businesses.filter((business) => {
      const matchesSearch =
        !searchTerm.trim() ||
        [
          business.name,
          business.category,
          business.address,
          business.description,
          business.neighborhood
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || business.category === selectedCategory;

      const matchesNeighborhood =
        selectedNeighborhood === "all" ||
        business.neighborhood === selectedNeighborhood;

      const matchesTags =
        selectedTags.length === 0 ||
        (tagMatchMode === "all"
          ? selectedTags.every((tag) => business.tags.includes(tag))
          : selectedTags.some((tag) => business.tags.includes(tag)));

      const matchesDay =
        selectedDay === "all" || isBusinessOpenOnDay(business.hours, selectedDay);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesNeighborhood &&
        matchesTags &&
        matchesDay
      );
    });

    if (sortByDistance && userLocation) {
      return [...filtered].sort(
        (left, right) =>
          haversineKm(
            userLocation.lat,
            userLocation.lng,
            left.location.lat,
            left.location.lng
          ) -
          haversineKm(
            userLocation.lat,
            userLocation.lng,
            right.location.lat,
            right.location.lng
          )
      );
    }

    return filtered;
  }, [
    businesses,
    searchTerm,
    selectedCategory,
    selectedNeighborhood,
    selectedTags,
    tagMatchMode,
    selectedDay,
    sortByDistance,
    userLocation
  ]);

  function getDistanceMiles(business: Business) {
    if (!sortByDistance || !userLocation) {
      return undefined;
    }

    return (
      haversineKm(
        userLocation.lat,
        userLocation.lng,
        business.location.lat,
        business.location.lng
      ) * 0.621
    );
  }

  function handleNearMe() {
    if (sortByDistance) {
      setSortByDistance(false);
      setUserLocation(null);
      setLocationMessage(null);
      return;
    }

    if (!navigator.geolocation) {
      setLocationMessage("Location unavailable");
      return;
    }

    setGeolocating(true);
    setLocationMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setSortByDistance(true);
        setGeolocating(false);
      },
      (positionError) => {
        setLocationMessage(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Enable location to use this feature"
            : "Location unavailable"
        );
        setSortByDistance(false);
        setGeolocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 60000
      }
    );
  }

  function handleBusinessSelect(business: Business) {
    setSelectedBusinessId(business.id);
    cardRefs.current[business.id]?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function toggleSelectedTag(slug: string) {
    setSelectedTags((current) =>
      current.includes(slug)
        ? current.filter((tag) => tag !== slug)
        : [...current, slug]
    );
  }

  const renderBusinessCards = () =>
    filteredBusinesses.map((business) => (
      <div
        key={business.id}
        ref={(element) => {
          cardRefs.current[business.id] = element;
        }}
      >
        <BusinessCard
          business={business}
          layout={layout}
          selectedDay={selectedDay}
          distanceMiles={getDistanceMiles(business)}
          isHighlighted={selectedBusinessId === business.id}
          onSelect={handleBusinessSelect}
        />
      </div>
    ));

  if (!isFirebaseConfigured) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <StatePanel
          title="Connect Firebase to launch the directory"
          description="The app shell is ready, but the public business data stream needs your Firebase environment variables in .env.local."
        />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-[2.6rem] border border-line bg-panel/75 p-6 shadow-glow sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-accentSoft">
              Milwaukee directory
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl leading-none text-ink sm:text-6xl lg:text-7xl">
              Find Black-owned Milwaukee businesses by the day they&apos;re open.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
              MKE Black makes weekly-hours discovery front and center so residents
              can quickly see where to eat, shop, book, and support the city&apos;s
              Black business community.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-line bg-panelAlt/75 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Live listings
              </p>
              <p className="mt-2 font-display text-4xl text-accentSoft">
                {loading ? "--" : businesses.length}
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/75 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Highlighted day
              </p>
              <p className="mt-2 font-display text-4xl text-accentSoft">
                {selectedDay === "all" ? "All" : titleCase(selectedDay).slice(0, 3)}
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/75 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">
                Map mode
              </p>
              <p className="mt-2 font-display text-4xl text-accentSoft">
                Live
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-[2rem] border border-line bg-canvas/40 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_auto_auto]">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Search businesses
              </label>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, neighborhood, or what they offer"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Neighborhood
              </label>
              <select
                value={selectedNeighborhood}
                onChange={(event) => setSelectedNeighborhood(event.target.value)}
              >
                <option value="all">All neighborhoods</option>
                {neighborhoodOptions.map((neighborhood) => (
                  <option key={neighborhood} value={neighborhood}>
                    {neighborhood}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Directory view
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLayout("grid")}
                  className={`rounded-full px-4 py-3 text-sm transition ${
                    layout === "grid"
                      ? "bg-accent text-canvas"
                      : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
                  }`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setLayout("list")}
                  className={`rounded-full px-4 py-3 text-sm transition ${
                    layout === "list"
                      ? "bg-accent text-canvas"
                      : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
                  }`}
                >
                  List
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Distance
              </label>
              <button
                type="button"
                onClick={handleNearMe}
                disabled={geolocating}
                className={`w-full rounded-full px-4 py-3 text-sm transition ${
                  sortByDistance
                    ? "bg-accent text-canvas"
                    : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
                }`}
              >
                {geolocating ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Locating
                  </span>
                ) : sortByDistance ? (
                  "Showing nearest first ✕"
                ) : (
                  "Near me"
                )}
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                  setSelectedNeighborhood("all");
                  setSelectedTags([]);
                  setTagMatchMode("any");
                  setSelectedDay(getDayKeyFromDate());
                  setSortByDistance(false);
                  setUserLocation(null);
                  setLocationMessage(null);
                }}
                className="w-full rounded-full border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-200 transition hover:border-accent/35"
              >
                Reset
              </button>
            </div>
          </div>

          {locationMessage || neighborhoodsError || tagsError ? (
            <div className="mt-4 rounded-3xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
              {locationMessage ?? neighborhoodsError ?? tagsError}
            </div>
          ) : null}

          <div className="mt-5 border-t border-line pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setTagsExpanded((current) => !current)}
                className="rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35 md:hidden"
              >
                {tagsExpanded ? "Hide tags" : "Show tags"}
                {selectedTags.length ? ` (${selectedTags.length})` : ""}
              </button>
              <p className="hidden text-xs uppercase tracking-[0.26em] text-accentSoft md:block">
                Tags
              </p>
              <div className="flex rounded-full border border-line bg-panelAlt/70 p-1">
                {(["any", "all"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTagMatchMode(mode)}
                    className={`rounded-full px-3 py-1.5 text-xs transition ${
                      tagMatchMode === mode
                        ? "bg-accent text-canvas"
                        : "text-stone-300 hover:text-accentSoft"
                    }`}
                  >
                    Match {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className={`${tagsExpanded ? "block" : "hidden"} md:block`}>
              {activeTags.length ? (
                <div className="max-h-[6.5rem] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-2">
                    {activeTags.map((tag) => {
                      const selected = selectedTags.includes(tag.slug);

                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleSelectedTag(tag.slug)}
                          className={`rounded-full px-4 py-2 text-sm transition ${
                            selected
                              ? "border border-accent bg-accent text-canvas"
                              : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-400">
                  Tags will appear here after they are seeded in Firestore.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs uppercase tracking-[0.26em] text-accentSoft">
              Open on
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedDay("all")}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                  selectedDay === "all"
                    ? "bg-accent text-canvas"
                    : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
                }`}
              >
                All days
              </button>
              {DAY_KEYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                    selectedDay === day
                      ? "bg-accent text-canvas"
                      : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
                  }`}
                >
                  {titleCase(day)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.26em] text-muted">
            Results
          </p>
          <p className="mt-1 text-sm text-stone-300">
            {loading ? "Loading businesses..." : `${filteredBusinesses.length} matches`}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-8">
          <StatePanel
            title="Unable to load businesses"
            description={error}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[360px] animate-pulse rounded-[2rem] border border-line bg-panel/70"
            />
          ))}
        </div>
      ) : filteredBusinesses.length === 0 ? (
        <div className="mt-8">
          <StatePanel
            title="No businesses match those filters"
            description="Try another day, broaden the category, or clear the search to see more listings."
          />
        </div>
      ) : (
        <div className="mt-8">
          <div className="mb-5 flex justify-end xl:hidden">
            <button
              type="button"
              onClick={() => setMobileMapEnabled((current) => !current)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                mobileMapEnabled
                  ? "bg-accent text-canvas"
                  : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
              }`}
            >
              Map view
            </button>
          </div>

          {mobileMapEnabled ? (
            <div className="mb-6 xl:hidden">
              <BusinessMap
                businesses={filteredBusinesses}
                heightClassName="h-[280px]"
                userLocation={sortByDistance ? userLocation : null}
                selectedNeighborhoodFeature={selectedNeighborhoodFeature}
                selectedBusinessId={selectedBusinessId}
                onBusinessSelect={handleBusinessSelect}
              />
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,55%)_minmax(360px,45%)]">
          <div
            className={
              layout === "grid"
                ? "grid gap-5 md:grid-cols-2"
                : "flex flex-col gap-5"
            }
          >
            {renderBusinessCards()}
          </div>
          <div className="hidden xl:block xl:sticky xl:top-0 xl:h-screen">
            <BusinessMap
              businesses={filteredBusinesses}
              heightClassName="h-screen"
              userLocation={sortByDistance ? userLocation : null}
              selectedNeighborhoodFeature={selectedNeighborhoodFeature}
              selectedBusinessId={selectedBusinessId}
              onBusinessSelect={handleBusinessSelect}
            />
          </div>
        </div>
        </div>
      )}
    </section>
  );
}
