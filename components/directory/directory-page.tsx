"use client";

import { useState } from "react";
import { BusinessCard } from "@/components/directory/business-card";
import { BusinessMap } from "@/components/map/business-map";
import { StatePanel } from "@/components/ui/state-panel";
import { BUSINESS_CATEGORIES } from "@/lib/constants";
import { getDayKeyFromDate, isBusinessOpenOnDay } from "@/lib/business-hours";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { useBusinesses } from "@/hooks/use-businesses";
import { DAY_KEYS, DayKey } from "@/lib/types";
import { titleCase } from "@/lib/utils";

export function DirectoryPage() {
  const { businesses, loading, error } = useBusinesses();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDay, setSelectedDay] = useState<DayKey | "all">(
    getDayKeyFromDate()
  );
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [mapEnabled, setMapEnabled] = useState(false);

  const categories = Array.from(
    new Set([...BUSINESS_CATEGORIES, ...businesses.map((business) => business.category)])
  );

  const filteredBusinesses = businesses.filter((business) => {
    const matchesSearch =
      !searchTerm.trim() ||
      [business.name, business.category, business.address, business.description]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.trim().toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || business.category === selectedCategory;

    const matchesDay =
      selectedDay === "all" || isBusinessOpenOnDay(business.hours, selectedDay);

    return matchesSearch && matchesCategory && matchesDay;
  });

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
                {mapEnabled ? "On" : "Off"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-[2rem] border border-line bg-canvas/40 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_1fr_auto_auto]">
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
                Map
              </label>
              <button
                type="button"
                onClick={() => setMapEnabled((current) => !current)}
                className={`w-full rounded-full px-4 py-3 text-sm transition ${
                  mapEnabled
                    ? "bg-accent text-canvas"
                    : "border border-line bg-panelAlt/70 text-stone-200 hover:border-accent/35"
                }`}
              >
                {mapEnabled ? "Hide map" : "Show map"}
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                  setSelectedDay(getDayKeyFromDate());
                }}
                className="w-full rounded-full border border-line bg-panelAlt/70 px-4 py-3 text-sm text-stone-200 transition hover:border-accent/35"
              >
                Reset
              </button>
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
      ) : mapEnabled ? (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
          <div
            className={
              layout === "grid"
                ? "grid gap-5 md:grid-cols-2"
                : "flex flex-col gap-5"
            }
          >
            {filteredBusinesses.map((business) => (
              <BusinessCard
                key={business.id}
                business={business}
                layout={layout}
                selectedDay={selectedDay}
              />
            ))}
          </div>
          <div className="xl:sticky xl:top-28">
            <BusinessMap businesses={filteredBusinesses} heightClassName="h-[560px]" />
          </div>
        </div>
      ) : (
        <div
          className={`mt-8 ${
            layout === "grid"
              ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-5"
          }`}
        >
          {filteredBusinesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              layout={layout}
              selectedDay={selectedDay}
            />
          ))}
        </div>
      )}
    </section>
  );
}
