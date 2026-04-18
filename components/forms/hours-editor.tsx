import { BusinessHours, DAY_KEYS, DayKey } from "@/lib/types";
import { titleCase } from "@/lib/utils";

type HoursEditorProps = {
  hours: BusinessHours;
  onChange: (
    day: DayKey,
    field: "open" | "close" | "closed",
    value: string | boolean
  ) => void;
};

export function HoursEditor({ hours, onChange }: HoursEditorProps) {
  return (
    <div className="space-y-3">
      {DAY_KEYS.map((day) => {
        const dailyHours = hours[day];

        return (
          <div
            key={day}
            className="rounded-3xl border border-line bg-panelAlt/70 p-4"
          >
            <div className="grid gap-4 lg:grid-cols-[160px_1fr_1fr_100px] lg:items-center">
              <p className="font-medium text-stone-100">{titleCase(day)}</p>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Open
                </label>
                <input
                  type="time"
                  value={dailyHours.open}
                  disabled={dailyHours.closed}
                  onChange={(event) => onChange(day, "open", event.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                  Close
                </label>
                <input
                  type="time"
                  value={dailyHours.close}
                  disabled={dailyHours.closed}
                  onChange={(event) => onChange(day, "close", event.target.value)}
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-line bg-canvas/40 px-4 py-3 text-sm text-stone-200">
                <input
                  type="checkbox"
                  checked={dailyHours.closed}
                  onChange={(event) => onChange(day, "closed", event.target.checked)}
                  className="h-4 w-4 rounded border-line bg-panelAlt text-accent focus:ring-accent/30"
                />
                Closed
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
