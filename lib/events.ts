import type { BusinessEvent } from "@/lib/types";

type EventTiming = Pick<BusinessEvent, "startsAt" | "endsAt">;

export function getEventEffectiveEnd(event: EventTiming) {
  return event.endsAt ?? event.startsAt;
}

export function isEventPast(event: EventTiming, now = new Date()) {
  const effectiveEnd = getEventEffectiveEnd(event);

  if (!effectiveEnd) {
    return false;
  }

  return effectiveEnd.getTime() < now.getTime();
}
