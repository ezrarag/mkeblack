"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BusinessCard } from "@/components/directory/business-card";
import { BusinessMap } from "@/components/map/business-map";
import { StatePanel } from "@/components/ui/state-panel";
import { isBusinessOpenNow, isBusinessOpenOnDay } from "@/lib/business-hours";
import { getGoogleMapsDirectionsUrl } from "@/lib/directions";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { useBusinesses } from "@/hooks/use-businesses";
import { useBusinessCategories } from "@/hooks/use-business-categories";
import { useNeighborhoods } from "@/hooks/use-neighborhoods";
import { useBusinessTags } from "@/hooks/use-business-tags";
import { useDirectoryHeroConfig } from "@/hooks/use-directory-hero-config";
import { Business, DAY_KEYS, DayKey } from "@/lib/types";
import { haversineKm, titleCase } from "@/lib/utils";

type DirectoryPageProps = {
  initialTags?: string[];
};

type HeroActionCard = "day" | "live" | "solidarity";

export function DirectoryPage({ initialTags = [] }: DirectoryPageProps) {
  const { businesses, loading, error } = useBusinesses();
  const { categories: businessCategories, error: categoriesError } = useBusinessCategories();
  const { neighborhoods, error: neighborhoodsError } = useNeighborhoods();
  const { tags: businessTags, error: tagsError } = useBusinessTags();
  const { config: directoryHeroConfig } = useDirectoryHeroConfig();
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
  const [openOnExpanded, setOpenOnExpanded] = useState(false);
  const [selectedDays, setSelectedDays] = useState<DayKey[]>([]);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [mobileMapEnabled, setMobileMapEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [filterOpenNow, setFilterOpenNow] = useState(false);
  const [locationFilter, setLocationFilter] = useState<"all" | "in-person" | "online">("all");
  const [geolocating, setGeolocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [listingPulse, setListingPulse] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [activeHeroCard, setActiveHeroCard] = useState<HeroActionCard>("day");
  const listingsRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const heroImages = directoryHeroConfig.heroImages;
  const selectedDayForCards: DayKey | "all" =
    selectedDays.length === 1 ? selectedDays[0] : "all";
  const selectedDayLabel =
    selectedDays.length === 0
      ? "All"
      : selectedDays.length === 1
        ? titleCase(selectedDays[0]).slice(0, 3)
        : `${selectedDays.length} days`;

  useEffect(() => {
    const tagParams = initialTags
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);

    if (tagParams.length) {
      setSelectedTags(Array.from(new Set(tagParams)));
    }
  }, [initialTags]);

  useEffect(() => {
    setHeroImageIndex(0);

    if (heroImages.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setHeroImageIndex((current) => (current + 1) % heroImages.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [heroImages.length]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set([
          ...businessCategories
            .filter((category) => category.active)
            .map((category) => category.label),
          ...businesses.map((business) => business.category)
        ])
      ).sort((left, right) => left.localeCompare(right)),
    [businessCategories, businesses]
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

  const solidarityBusinesses = useMemo(
    () => businesses.filter((business) => business.solidarityMember && business.active),
    [businesses]
  );

  const featuredSolidarityBusinesses = useMemo(
    () =>
      [...solidarityBusinesses]
        .sort((a, b) => (b.photos.length ? 1 : 0) - (a.photos.length ? 1 : 0))
        .slice(0, 6),
    [solidarityBusinesses]
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
        selectedDays.length === 0 ||
        selectedDays.some((day) => isBusinessOpenOnDay(business.hours, day));

      const matchesOpenNow = !filterOpenNow || isBusinessOpenNow(business.hours);

      const matchesLocation =
        locationFilter === "all" ||
        (locationFilter === "online" && business.onlineBased) ||
        (locationFilter === "in-person" && !business.onlineBased);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesNeighborhood &&
        matchesTags &&
        matchesDay &&
        matchesOpenNow &&
        matchesLocation
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
    selectedDays,
    filterOpenNow,
    locationFilter,
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

  function scrollToListings() {
    listingsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    setListingPulse(true);
    window.setTimeout(() => setListingPulse(false), 900);
  }

  function selectHeroCard(card: HeroActionCard) {
    setActiveHeroCard(card);

    if (card === "live") {
      scrollToListings();
    }
  }

  function toggleSelectedDay(day: DayKey) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((selected) => selected !== day)
        : [...current, day]
    );
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
          selectedDay={selectedDayForCards}
          distanceMiles={getDistanceMiles(business)}
          directionsUrl={
            sortByDistance && userLocation
              ? getGoogleMapsDirectionsUrl(business.location, userLocation)
              : undefined
          }
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
      <div className="overflow-hidden rounded-2xl border border-line bg-panel/75 shadow-glow">
        <div className="relative min-h-[560px] overflow-hidden bg-mesh-dark px-6 py-10 sm:px-8 lg:px-10 lg:py-12">
          {heroImages.length ? (
            <>
              {heroImages.map((imageUrl, index) => (
                <Image
                  key={`${imageUrl}-${index}`}
                  src={imageUrl}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(min-width: 1024px) 1184px, 100vw"
                  priority={index === 0}
                  className={`object-cover object-center transition-opacity duration-1000 ${
                    index === heroImageIndex ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
              <div
                className="absolute inset-0"
                style={{ background: "var(--directory-hero-image-overlay)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-canvas/20 via-transparent to-canvas/80" />
            </>
          ) : null}

          <div className="relative flex min-h-[480px] flex-col justify-end">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
                  {directoryHeroConfig.eyebrow}
                </p>
                <h1 className="mt-4 max-w-3xl font-display text-4xl font-black leading-tight text-ink sm:text-5xl lg:text-6xl">
                  {directoryHeroConfig.headline}
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
                  {directoryHeroConfig.description}
                </p>
              </div>

              <div className="relative min-h-[560px]">
                <button
                  type="button"
                  onClick={() => selectHeroCard("live")}
                  aria-pressed={activeHeroCard === "live"}
                  className={`absolute left-1/2 top-0 w-[92%] max-w-[560px] -translate-x-1/2 rounded-xl border p-5 text-left shadow-glow backdrop-blur transition duration-300 ${
                    activeHeroCard === "live"
                      ? "z-30 translate-y-0 border-accent/45 bg-panelAlt/90"
                      : "z-10 translate-y-2 border-line bg-panelAlt/65 hover:-translate-y-0.5 hover:border-accent/35"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">
                    Live listings
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-4">
                    <p className="font-display text-4xl font-bold text-ink">
                      {loading ? "--" : businesses.length}
                    </p>
                    <p className="text-xs font-semibold text-accent">Jump down</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => selectHeroCard("solidarity")}
                  aria-pressed={activeHeroCard === "solidarity"}
                  className={`absolute left-1/2 top-28 min-h-[164px] w-[92%] max-w-[560px] -translate-x-1/2 rounded-xl border p-5 text-left shadow-glow backdrop-blur transition duration-300 ${
                    activeHeroCard === "solidarity"
                      ? "z-30 -translate-y-16 border-success/45 bg-panelAlt/95"
                      : "z-20 translate-y-0 border-line bg-panelAlt/70 hover:-translate-y-1 hover:border-success/40"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-success/80">
                    Solidarity Circle
                  </p>
                  {solidarityBusinesses.length >= 50 ? (
                    <p className="mt-2 font-display text-4xl font-bold text-ink">
                      {loading ? "--" : solidarityBusinesses.length}
                    </p>
                  ) : (
                    <p className="mt-2 font-display text-2xl font-bold leading-tight text-ink">
                      Be one of the first to support
                    </p>
                  )}
                  <p className="mt-2 text-xs text-stone-400">
                    See members supporting the directory →
                  </p>
                </button>

                <div
                  className={`absolute left-1/2 top-60 w-[92%] max-w-[560px] -translate-x-1/2 rounded-xl border p-5 shadow-glow backdrop-blur transition duration-300 ${
                    activeHeroCard === "day"
                      ? "z-30 border-accent/45 bg-panelAlt/95"
                      : "z-20 border-line bg-panelAlt/85"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectHeroCard("day")}
                    aria-pressed={activeHeroCard === "day"}
                    className="block w-full text-left"
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-muted">
                      Highlighted day
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <p className="font-display text-5xl font-bold text-ink">
                        {selectedDayLabel}
                      </p>
                      <p className="text-xs font-semibold text-accent">
                        {selectedDays.length ? "Filtering" : "Choose days"}
                      </p>
                    </div>
                  </button>

                  <div
                    className={`grid transition-all duration-300 ${
                      activeHeroCard === "day"
                        ? "mt-5 grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDays([])}
                          className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                            selectedDays.length === 0
                              ? "bg-accent text-white"
                              : "border border-line bg-canvas/60 text-stone-200 hover:border-accent/35"
                          }`}
                        >
                          All days
                        </button>
                        {DAY_KEYS.map((day) => {
                          const selected = selectedDays.includes(day);

                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleSelectedDay(day)}
                              className={`rounded-full px-3 py-2 text-xs font-medium transition ${
                                selected
                                  ? "bg-accent text-white"
                                  : "border border-line bg-canvas/60 text-stone-200 hover:border-accent/35"
                              }`}
                            >
                              {titleCase(day).slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-4 text-xs leading-5 text-stone-400">
                        Pick one or more days to show businesses open when you need them.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {heroImages.length > 1 ? (
              <div className="mt-8 flex gap-2">
                {heroImages.map((imageUrl, index) => (
                  <button
                    key={`${imageUrl}-dot-${index}`}
                    type="button"
                    onClick={() => setHeroImageIndex(index)}
                    aria-label={`Show directory hero image ${index + 1}`}
                    className={`h-2.5 rounded-full border border-line transition ${
                      index === heroImageIndex
                        ? "w-8 bg-accent"
                        : "w-2.5 bg-panelAlt/80 hover:bg-accent/50"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          {activeHeroCard === "solidarity" && !loading && featuredSolidarityBusinesses.length ? (
            <div className="rounded-xl border border-success/25 bg-success/5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-success">
                    Solidarity Circle members
                  </p>
                  <p className="mt-1 text-sm text-stone-300">
                    These businesses chip in monthly to keep MKE Black running — and unlock
                    direct messaging, marketplace, and event tools for their community.
                  </p>
                </div>
                <Link
                  href="/membership"
                  className="shrink-0 rounded-full border border-success/40 bg-success/10 px-4 py-2 text-xs font-semibold text-success transition hover:bg-success/20"
                >
                  Become a member →
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {featuredSolidarityBusinesses.map((business) => (
                  <Link
                    key={business.id}
                    href={`/business/${business.id}`}
                    className="flex items-center gap-3 rounded-full border border-line bg-panel/70 py-1.5 pl-1.5 pr-4 transition hover:border-success/40 hover:bg-success/10"
                  >
                    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-line bg-panelAlt">
                      {business.photos[0] ? (
                        <Image
                          src={business.photos[0]}
                          alt={business.name}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-xs font-black text-stone-500">
                          {business.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-medium text-stone-100">{business.name}</span>
                  </Link>
                ))}
                {solidarityBusinesses.length > featuredSolidarityBusinesses.length ? (
                  <span className="flex items-center px-2 text-sm text-stone-400">
                    +{solidarityBusinesses.length - featuredSolidarityBusinesses.length} more
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

        <div className="mt-10 rounded-xl border border-line bg-canvas/40 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr_auto_auto_auto]">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Search businesses
              </label>
              <input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onInput={(event) => setSearchTerm(event.currentTarget.value)}
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
                      ? "bg-accent text-white"
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
                      ? "bg-accent text-white"
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
                    ? "bg-accent text-white"
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
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Status
              </label>
              <button
                type="button"
                onClick={() => setFilterOpenNow((current) => !current)}
                className={`w-full rounded-full px-4 py-3 text-sm transition ${
                  filterOpenNow
                    ? "border border-success/50 bg-success/20 text-success"
                    : "border border-line bg-panelAlt/70 text-stone-200 hover:border-success/35 hover:text-success"
                }`}
              >
                {filterOpenNow ? "Open now ✕" : "Open now"}
              </button>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Location type
              </label>
              <div className="flex rounded-full border border-line bg-panelAlt/70 p-1">
                {(["all", "in-person", "online"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setLocationFilter(opt)}
                    className={`flex-1 rounded-full px-2 py-2 text-xs font-medium transition ${
                      locationFilter === opt
                        ? "bg-accent text-white"
                        : "text-stone-300 hover:text-ink"
                    }`}
                  >
                    {opt === "all" ? "All" : opt === "in-person" ? "In-person" : "Online"}
                  </button>
                ))}
              </div>
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
                  setSelectedDays([]);
                  setFilterOpenNow(false);
                  setLocationFilter("all");
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

          {locationMessage || neighborhoodsError || tagsError || categoriesError ? (
            <div className="mt-4 rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-sm text-stone-100">
              {locationMessage ?? neighborhoodsError ?? tagsError ?? categoriesError}
            </div>
          ) : null}

          <div className="mt-5 border-t border-line pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setTagsExpanded((current) => !current)}
                className="rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35"
              >
                {tagsExpanded ? "Hide tags" : "Show tags"}
                {selectedTags.length ? ` (${selectedTags.length})` : ""}
              </button>
              <div className={`${tagsExpanded ? "flex" : "hidden"} rounded-full border border-line bg-panelAlt/70 p-1`}>
                {(["any", "all"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTagMatchMode(mode)}
                    className={`rounded-full px-3 py-1.5 text-xs transition ${
                      tagMatchMode === mode
                        ? "bg-accent text-white"
                        : "text-stone-300 hover:text-ink"
                    }`}
                  >
                    Match {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className={tagsExpanded ? "block" : "hidden"}>
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
                              ? "border border-accent bg-accent text-white"
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
            <button
              type="button"
              onClick={() => setOpenOnExpanded((current) => !current)}
              className="mb-3 rounded-full border border-line bg-panelAlt/70 px-4 py-2 text-sm text-stone-200 transition hover:border-accent/35"
            >
              {openOnExpanded ? "Hide open on" : "Show open on"}
              {selectedDays.length ? ` (${selectedDayLabel})` : " (All days)"}
            </button>
            <div className={`${openOnExpanded ? "flex" : "hidden"} gap-2 overflow-x-auto pb-1`}>
              <button
                type="button"
                onClick={() => setSelectedDays([])}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                  selectedDays.length === 0
                    ? "bg-accent text-white"
                    : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
                }`}
              >
                All days
              </button>
              {DAY_KEYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleSelectedDay(day)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                    selectedDays.includes(day)
                      ? "bg-accent text-white"
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
      </div>

      <div
        ref={listingsRef}
        className={`mt-8 scroll-mt-24 rounded-2xl transition ${
          listingPulse ? "ring-2 ring-accent/35 ring-offset-4 ring-offset-canvas" : ""
        }`}
      >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.26em] text-muted">
            Results
          </p>
          <p className="mt-1 text-sm text-stone-300">
            {loading ? "Loading businesses..." : `${filteredBusinesses.length} matches`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/contact?reason=suggest_business"
            className="rounded-full border border-line bg-panelAlt/70 px-5 py-3 text-sm font-semibold text-stone-200 transition hover:border-accent/40 hover:text-ink"
          >
            Suggest a business
          </Link>
          <Link
            href="/contact?reason=submit_business"
            className="rounded-full border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentSoft"
          >
            Submit your business
          </Link>
        </div>
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
              className="h-[360px] animate-pulse rounded-xl border border-line bg-panel/70"
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
                  ? "bg-accent text-white"
                  : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
              }`}
            >
              Map view
            </button>
          </div>

          {mobileMapEnabled ? (
            <div className="mb-6 xl:hidden">
              <BusinessMap
                businesses={filteredBusinesses.filter((b) => !b.onlineBased)}
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
              businesses={filteredBusinesses.filter((b) => !b.onlineBased)}
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
