#!/usr/bin/env node
/**
 * Rick punch-list — direct fixes for items #1 and #7 (and removes the
 * now-duplicate bottom flag button).
 * Run: node scripts/patch-rick-punchlist.js
 */
const fs = require("fs");
const path = require("path");

let changes = 0;

// ── FIX #1: Move "Flag info as outdated" next to Claim/Edit buttons ──────────
const profilePath = path.join(
  __dirname,
  "../components/business/business-profile-page.tsx"
);
let profile = fs.readFileSync(profilePath, "utf-8");

// 1a. Add the flag button into the header action row (after "Edit as admin")
const headerAnchor = `              {hasAdminAccess ? (
                <Link
                  href={\`/admin/businesses/\${business.id}\`}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
                >
                  Edit as admin
                </Link>
              ) : null}
            </div>
          </div>`;

const headerReplacement = `              {hasAdminAccess ? (
                <Link
                  href={\`/admin/businesses/\${business.id}\`}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-stone-300 transition hover:border-accent/35 hover:text-accentSoft"
                >
                  Edit as admin
                </Link>
              ) : null}
              <button
                type="button"
                disabled={flagSubmitting || !!flagFeedback}
                onClick={() => void handleFlagForUpdate()}
                className="rounded-full border border-amber-500/35 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-60"
              >
                {flagSubmitting ? "Flagging\u2026" : "Flag info as outdated"}
              </button>
            </div>
            {flagFeedback ? (
              <p className="mt-3 text-sm text-stone-400">{flagFeedback}</p>
            ) : null}
          </div>`;

if (profile.includes(headerAnchor)) {
  profile = profile.replace(headerAnchor, headerReplacement);
  changes++;
  console.log("\u2705 #1a: Added flag button to header action row");
} else {
  console.log("\u26A0\uFE0F  #1a: header anchor not found (may already be patched)");
}

// 1b. Remove the old flag button block from the bottom report section
const bottomFlagBlock = `            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={flagSubmitting || !!flagFeedback}
                onClick={() => void handleFlagForUpdate()}
                className="rounded-full border border-amber-500/35 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-60"
              >
                {flagSubmitting ? "Flagging\u2026" : "Flag info as outdated"}
              </button>
              {flagFeedback ? (
                <p className="text-sm text-stone-400">{flagFeedback}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setReportOpen((current) => !current);
                setReportFeedback(null);
              }}
              className="mt-4 text-sm font-semibold text-stone-500 underline underline-offset-4 transition hover:text-accentSoft"
            >
              Report an issue
            </button>`;

const bottomFlagReplacement = `            <button
              type="button"
              onClick={() => {
                setReportOpen((current) => !current);
                setReportFeedback(null);
              }}
              className="text-sm font-semibold text-stone-500 underline underline-offset-4 transition hover:text-accentSoft"
            >
              Report an issue
            </button>`;

if (profile.includes(bottomFlagBlock)) {
  profile = profile.replace(bottomFlagBlock, bottomFlagReplacement);
  changes++;
  console.log("\u2705 #1b: Removed duplicate flag button from bottom section");
} else {
  console.log("\u26A0\uFE0F  #1b: bottom flag block not found (may already be patched)");
}

fs.writeFileSync(profilePath, profile, "utf-8");

// ── FIX #7: Stop the map auto-zooming out when a business is selected ─────────
const mapPath = path.join(
  __dirname,
  "../components/map/business-map.tsx"
);
let map = fs.readFileSync(mapPath, "utf-8");

// The data-update effect re-fits bounds on every businesses change. When a
// business is actively selected we must NOT re-fit (that's what zooms out).
// Guard the fitBounds branch with selectedBusinessId.
const fitAnchor = `    } else if (coordinates.length > 1 && !selectedNeighborhoodFeature) {
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...coordinates.map((point) => point[0])), Math.min(...coordinates.map((point) => point[1]))],
        [Math.max(...coordinates.map((point) => point[0])), Math.max(...coordinates.map((point) => point[1]))]
      ];
      map.fitBounds(bounds, { padding: 64, maxZoom: 13 });
    }
  }, [businessData, businesses, loaded, selectedNeighborhoodFeature]);`;

const fitReplacement = `    } else if (
      coordinates.length > 1 &&
      !selectedNeighborhoodFeature &&
      !selectedBusinessId
    ) {
      // Only auto-fit when no single business is actively selected — otherwise
      // selecting a pin would re-frame the whole set and zoom the user out.
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...coordinates.map((point) => point[0])), Math.min(...coordinates.map((point) => point[1]))],
        [Math.max(...coordinates.map((point) => point[0])), Math.max(...coordinates.map((point) => point[1]))]
      ];
      map.fitBounds(bounds, { padding: 64, maxZoom: 13 });
    }
  }, [businessData, businesses, loaded, selectedNeighborhoodFeature, selectedBusinessId]);`;

if (map.includes(fitAnchor)) {
  map = map.replace(fitAnchor, fitReplacement);
  changes++;
  console.log("\u2705 #7: Map no longer auto-zooms out when a business is selected");
} else {
  console.log("\u26A0\uFE0F  #7: fitBounds anchor not found (may already be patched)");
}

// Also: when flying to a selected business, don't force zoom 14 if the user is
// already zoomed in closer — preserve their zoom so nearby businesses stay visible.
const flyAnchor = `    map.flyTo({
      center: [business.location.lng, business.location.lat],
      zoom: 14,
      essential: true
    });
    popupRef.current
      ?.setLngLat([business.location.lng, business.location.lat])
      .setHTML(popupHtml(business, userLocation))
      .addTo(map);
  }, [businesses, loaded, selectedBusinessId, userLocation]);`;

const flyReplacement = `    // Pan to the selected business without forcing a zoom level — this keeps
    // nearby businesses in view instead of snapping to a fixed zoom.
    map.flyTo({
      center: [business.location.lng, business.location.lat],
      essential: true
    });
    popupRef.current
      ?.setLngLat([business.location.lng, business.location.lat])
      .setHTML(popupHtml(business, userLocation))
      .addTo(map);
  }, [businesses, loaded, selectedBusinessId, userLocation]);`;

if (map.includes(flyAnchor)) {
  map = map.replace(flyAnchor, flyReplacement);
  changes++;
  console.log("\u2705 #7b: Selecting a business pans without forcing zoom level");
} else {
  console.log("\u26A0\uFE0F  #7b: flyTo anchor not found (may already be patched)");
}

fs.writeFileSync(mapPath, map, "utf-8");

console.log(`\n${changes} change(s) applied. Run: npx tsc --noEmit to verify.\n`);
