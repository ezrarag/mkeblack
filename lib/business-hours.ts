import { DAY_KEYS, BusinessHours, DayKey } from "@/lib/types";
import { titleCase } from "@/lib/utils";

const JS_DAY_TO_KEY: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

export function getDayKeyFromDate(date = new Date()): DayKey {
  return JS_DAY_TO_KEY[date.getDay()];
}

export function formatTime(value: string) {
  if (!value) {
    return "Closed";
  }

  const [hours, minutes] = value.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatHoursRange(hours: BusinessHours, day: DayKey) {
  const dayHours = hours[day];

  if (!dayHours || dayHours.closed) {
    return "Closed";
  }

  return `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}`;
}

export function isBusinessOpenOnDay(hours: BusinessHours, day: DayKey) {
  const dayHours = hours[day];
  return Boolean(dayHours && !dayHours.closed && dayHours.open && dayHours.close);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isBusinessOpenNow(hours: BusinessHours, now = new Date()) {
  const day = getDayKeyFromDate(now);
  const dayHours = hours[day];

  if (!dayHours || dayHours.closed || !dayHours.open || !dayHours.close) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = timeToMinutes(dayHours.open);
  const closeMinutes = timeToMinutes(dayHours.close);

  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

export function getHoursSummary(hours: BusinessHours, day = getDayKeyFromDate()) {
  return `${titleCase(day)}: ${formatHoursRange(hours, day)}`;
}

export function getWeeklyHours(hours: BusinessHours) {
  return DAY_KEYS.map((day) => ({
    day,
    label: titleCase(day),
    summary: formatHoursRange(hours, day)
  }));
}
