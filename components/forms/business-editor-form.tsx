"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { BUSINESS_CATEGORIES } from "@/lib/constants";
import { BusinessFormValues, DayKey } from "@/lib/types";
import { formatPhone } from "@/lib/utils";
import { HoursEditor } from "@/components/forms/hours-editor";

type BusinessEditorFormProps = {
  initialValues: BusinessFormValues;
  title: string;
  description: string;
  submitLabel: string;
  onSubmit: (values: BusinessFormValues) => Promise<void>;
  onUploadPhotos?: (files: File[]) => Promise<void>;
  onRemovePhoto?: (photoUrl: string) => Promise<void>;
  saving?: boolean;
  uploading?: boolean;
  showAdminFields?: boolean;
};

function cloneFormValues(values: BusinessFormValues): BusinessFormValues {
  return {
    ...values,
    photos: [...values.photos],
    location: { ...values.location },
    hours: {
      monday: { ...values.hours.monday },
      tuesday: { ...values.hours.tuesday },
      wednesday: { ...values.hours.wednesday },
      thursday: { ...values.hours.thursday },
      friday: { ...values.hours.friday },
      saturday: { ...values.hours.saturday },
      sunday: { ...values.hours.sunday }
    }
  };
}

export function BusinessEditorForm({
  initialValues,
  title,
  description,
  submitLabel,
  onSubmit,
  onUploadPhotos,
  onRemovePhoto,
  saving = false,
  uploading = false,
  showAdminFields = false
}: BusinessEditorFormProps) {
  const [values, setValues] = useState<BusinessFormValues>(
    cloneFormValues(initialValues)
  );

  useEffect(() => {
    setValues(cloneFormValues(initialValues));
  }, [initialValues]);

  function updateField<Key extends keyof BusinessFormValues>(
    field: Key,
    value: BusinessFormValues[Key]
  ) {
    setValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleHoursChange(
    day: DayKey,
    field: "open" | "close" | "closed",
    value: string | boolean
  ) {
    setValues((current) => ({
      ...current,
      hours: {
        ...current.hours,
        [day]: {
          ...current.hours[day],
          [field]: value
        }
      }
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(values);
  }

  async function handlePhotoInput(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length || !onUploadPhotos) {
      return;
    }

    const files = Array.from(event.target.files);
    await onUploadPhotos(files);
    event.target.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-7">
        <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
          {title}
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-300">
          {description}
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Business name
            </label>
            <input
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Business name"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Category
            </label>
            <select
              value={values.category}
              onChange={(event) => updateField("category", event.target.value)}
            >
              {BUSINESS_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Description
            </label>
            <textarea
              value={values.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Tell Milwaukee what makes this business special."
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Address
            </label>
            <input
              value={values.address}
              onChange={(event) => updateField("address", event.target.value)}
              placeholder="1234 W Example Ave, Milwaukee, WI"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Phone
            </label>
            <input
              value={values.phone}
              onChange={(event) => updateField("phone", formatPhone(event.target.value))}
              placeholder="(414) 555-0100"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
              Website
            </label>
            <input
              value={values.website}
              onChange={(event) => updateField("website", event.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>
      </div>

      <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-7">
        <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
          Weekly hours
        </p>
        <p className="mt-3 text-sm leading-7 text-stone-300">
          These hours drive the public day-open filter, so accuracy here matters
          more than anything else in the directory.
        </p>
        <div className="mt-6">
          <HoursEditor hours={values.hours} onChange={handleHoursChange} />
        </div>
      </div>

      <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
              Photos
            </p>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              Upload storefront, interior, menu, product, or service images to
              strengthen the public listing.
            </p>
          </div>

          {onUploadPhotos ? (
            <label className="inline-flex cursor-pointer items-center rounded-full bg-accent px-5 py-3 text-sm font-medium text-canvas transition hover:bg-accentSoft">
              {uploading ? "Uploading..." : "Upload photos"}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoInput}
                className="hidden"
              />
            </label>
          ) : null}
        </div>

        {values.photos.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {values.photos.map((photo) => (
              <div
                key={photo}
                className="overflow-hidden rounded-[1.6rem] border border-line bg-panelAlt/70"
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={photo}
                    alt="Business photo"
                    fill
                    sizes="(min-width: 1280px) 20vw, (min-width: 640px) 40vw, 100vw"
                    className="object-cover"
                  />
                </div>
                {onRemovePhoto ? (
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => onRemovePhoto(photo)}
                      className="w-full rounded-full border border-danger/35 bg-danger/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-danger/20"
                    >
                      Remove photo
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-line bg-canvas/40 p-8 text-center text-sm leading-7 text-stone-400">
            No photos uploaded yet.
          </div>
        )}
      </div>

      {showAdminFields ? (
        <div className="rounded-[2.2rem] border border-line bg-panel/85 p-6 sm:p-7">
          <p className="text-sm uppercase tracking-[0.28em] text-accentSoft">
            Admin controls
          </p>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Owner UID
              </label>
              <input
                value={values.ownerUid}
                onChange={(event) => updateField("ownerUid", event.target.value)}
                placeholder="Firebase Auth UID for the business owner"
              />
            </div>
            <div className="rounded-3xl border border-line bg-panelAlt/70 p-4">
              <label className="flex items-center gap-3 text-sm text-stone-200">
                <input
                  type="checkbox"
                  checked={values.active}
                  onChange={(event) => updateField("active", event.target.checked)}
                  className="h-4 w-4 rounded border-line bg-panelAlt text-accent focus:ring-accent/30"
                />
                Listing is active
              </label>
              <p className="mt-3 text-sm leading-7 text-stone-400">
                Deactivated listings disappear from the public directory but remain
                editable here.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={values.location.lat}
                onChange={(event) =>
                  updateField("location", {
                    ...values.location,
                    lat: Number(event.target.value)
                  })
                }
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={values.location.lng}
                onChange={(event) =>
                  updateField("location", {
                    ...values.location,
                    lng: Number(event.target.value)
                  })
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-canvas transition hover:bg-accentSoft"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
