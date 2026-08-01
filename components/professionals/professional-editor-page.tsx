"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/components/providers/auth-provider";
import { useProfessional } from "@/hooks/use-professionals";
import { useAllBusinesses } from "@/hooks/use-all-businesses";
import { saveProfessionalProfile, uploadProfessionalPhoto } from "@/lib/firebase/professionals";
import { createEmptyAffiliation, parseLinkedInPositionsCsv, PROFESSIONAL_INDUSTRIES } from "@/lib/professionals";
import { ProfessionalAffiliation } from "@/lib/types";

const inputClass = "w-full rounded-2xl border border-line bg-panelAlt px-4 py-3 text-ink outline-none focus:border-accent";

export function ProfessionalEditorPage() {
  const { user } = useAuth();
  const { professional, loading } = useProfessional(user?.uid ?? "");
  const { businesses } = useAllBusinesses();
  const router = useRouter();
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [location, setLocation] = useState("Milwaukee, WI");
  const [industries, setIndustries] = useState<string[]>([]);
  const [skillsText, setSkillsText] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [showContactEmail, setShowContactEmail] = useState(false);
  const [openToWork, setOpenToWork] = useState(false);
  const [openToCollaboration, setOpenToCollaboration] = useState(false);
  const [affiliations, setAffiliations] = useState<ProfessionalAffiliation[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (loading || initialized) return;
    if (professional) {
      setName(professional.name); setHeadline(professional.headline); setBio(professional.bio); setPhotoUrl(professional.photoUrl);
      setLocation(professional.location); setIndustries(professional.industries); setSkillsText(professional.skills.join(", "));
      setLinkedinUrl(professional.linkedinUrl); setWebsiteUrl(professional.websiteUrl); setInstagramUrl(professional.instagramUrl);
      setContactEmail(professional.contactEmail); setShowContactEmail(professional.showContactEmail); setOpenToWork(professional.openToWork);
      setOpenToCollaboration(professional.openToCollaboration); setAffiliations(professional.affiliations);
    } else if (user) { setName(user.displayName ?? ""); setContactEmail(user.email ?? ""); setPhotoUrl(user.photoURL ?? ""); }
    setInitialized(true);
  }, [initialized, loading, professional, user]);

  function updateAffiliation(id: string, patch: Partial<ProfessionalAffiliation>) {
    setAffiliations((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function importLinkedIn(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const imported = parseLinkedInPositionsCsv(await file.text());
    if (!imported.length) { setMessage("No positions were found. Choose the Positions.csv file from your LinkedIn data export."); return; }
    setAffiliations((items) => [...items, ...imported]);
    setMessage(`${imported.length} LinkedIn affiliation${imported.length === 1 ? "" : "s"} imported. Review and connect them to directory businesses before saving.`);
    event.target.value = "";
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    try { setMessage("Uploading photo…"); setPhotoUrl(await uploadProfessionalPhoto(user.uid, file)); setMessage("Photo uploaded."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Photo upload failed."); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || !name.trim() || !headline.trim()) { setMessage("Name and headline are required."); return; }
    setSaving(true); setMessage(null);
    try {
      await saveProfessionalProfile(user.uid, {
        uid: user.uid, name: name.trim(), headline: headline.trim(), bio: bio.trim(), photoUrl, location: location.trim(), industries,
        skills: skillsText.split(",").map((item) => item.trim()).filter(Boolean), linkedinUrl: linkedinUrl.trim(), websiteUrl: websiteUrl.trim(), instagramUrl: instagramUrl.trim(),
        contactEmail: contactEmail.trim(), showContactEmail, openToWork, openToCollaboration, beamParticipant: professional?.beamParticipant ?? false,
        affiliations: affiliations.filter((item) => item.organizationName.trim()), active: professional?.active ?? true
      });
      router.push(`/professionals/${user.uid}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save profile."); setSaving(false); }
  }

  return <ProtectedRoute><section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><form onSubmit={submit} className="space-y-8">
    <div className="rounded-[2rem] border border-line bg-panel p-7 shadow-glow sm:p-10"><p className="text-sm uppercase tracking-[0.3em] text-accentSoft">Your professional presence</p><h1 className="mt-3 font-display text-4xl font-black text-ink">{professional ? "Edit professional profile" : "Create professional profile"}</h1><p className="mt-4 leading-7 text-stone-300">Profiles are free. New and updated profiles may be reviewed before receiving a verified badge.</p></div>
    {message ? <div className="rounded-2xl border border-accent/25 bg-accent/10 p-4 text-sm text-stone-200">{message}</div> : null}
    <fieldset className="grid gap-5 rounded-[2rem] border border-line bg-panel p-7 sm:grid-cols-2"><legend className="px-2 font-display text-xl font-bold">Profile</legend><label className="space-y-2 text-sm">Name<input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></label><label className="space-y-2 text-sm">Professional headline<input className={inputClass} value={headline} onChange={(e) => setHeadline(e.target.value)} required /></label><label className="space-y-2 text-sm sm:col-span-2">Biography<textarea className={`${inputClass} min-h-36`} value={bio} onChange={(e) => setBio(e.target.value)} /></label><label className="space-y-2 text-sm">Location<input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} /></label><label className="space-y-2 text-sm">Skills <span className="text-muted">(comma-separated)</span><input className={inputClass} value={skillsText} onChange={(e) => setSkillsText(e.target.value)} /></label><label className="space-y-2 text-sm sm:col-span-2">Profile photo<input type="file" accept="image/*" onChange={uploadPhoto} className={inputClass} /></label><div className="sm:col-span-2"><p className="mb-3 text-sm">Industries</p><div className="flex flex-wrap gap-2">{PROFESSIONAL_INDUSTRIES.map((item) => <label key={item} className={`cursor-pointer rounded-full border px-3 py-2 text-xs ${industries.includes(item) ? "border-accent bg-accent/15 text-accentSoft" : "border-line text-stone-300"}`}><input type="checkbox" className="sr-only" checked={industries.includes(item)} onChange={() => setIndustries((values) => values.includes(item) ? values.filter((value) => value !== item) : [...values, item])} />{item}</label>)}</div></div></fieldset>
    <fieldset className="grid gap-5 rounded-[2rem] border border-line bg-panel p-7 sm:grid-cols-2"><legend className="px-2 font-display text-xl font-bold">Links and availability</legend><label className="space-y-2 text-sm">LinkedIn URL<input type="url" className={inputClass} value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} /></label><label className="space-y-2 text-sm">Website URL<input type="url" className={inputClass} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} /></label><label className="space-y-2 text-sm">Instagram URL<input type="url" className={inputClass} value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} /></label><label className="space-y-2 text-sm">Contact email<input type="email" className={inputClass} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></label>{[[showContactEmail, setShowContactEmail, "Show my contact email"], [openToCollaboration, setOpenToCollaboration, "Open to collaboration"], [openToWork, setOpenToWork, "Open to opportunities"]].map(([checked, setter, label]) => <label key={label as string} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={checked as boolean} onChange={(e) => (setter as (value: boolean) => void)(e.target.checked)} />{label as string}</label>)}</fieldset>
    <fieldset className="rounded-[2rem] border border-line bg-panel p-7"><legend className="px-2 font-display text-xl font-bold">Business affiliations</legend><div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-2xl text-sm leading-6 text-stone-300">Add current or past organizations. Connect one to a business already in the MKE Black directory, or leave it as an external organization.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setAffiliations((items) => [...items, createEmptyAffiliation()])} className="rounded-full border border-line px-4 py-2 text-sm">Add affiliation</button><label className="cursor-pointer rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-sm text-accentSoft">Import LinkedIn Positions.csv<input type="file" accept=".csv,text/csv" onChange={importLinkedIn} className="sr-only" /></label></div></div><p className="mt-3 text-xs leading-5 text-muted">In LinkedIn, request your data archive and select Positions. Import only your own export; nothing is fetched from LinkedIn without your action.</p><div className="mt-6 space-y-5">{affiliations.map((item) => <div key={item.id} className="grid gap-3 rounded-2xl border border-line bg-panelAlt/60 p-5 sm:grid-cols-2"><input aria-label="Organization name" placeholder="Organization name" className={inputClass} value={item.organizationName} onChange={(e) => updateAffiliation(item.id, { organizationName: e.target.value })} /><input aria-label="Title or role" placeholder="Title or role" className={inputClass} value={item.title} onChange={(e) => updateAffiliation(item.id, { title: e.target.value })} /><select aria-label="Connect to directory business" className={inputClass} value={item.businessId ?? ""} onChange={(e) => updateAffiliation(item.id, { businessId: e.target.value || null })}><option value="">External organization / not listed</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select><input aria-label="Organization website" type="url" placeholder="Organization website" className={inputClass} value={item.organizationUrl} onChange={(e) => updateAffiliation(item.id, { organizationUrl: e.target.value })} /><input aria-label="Start date" placeholder="Start date" className={inputClass} value={item.startDate} onChange={(e) => updateAffiliation(item.id, { startDate: e.target.value })} /><input aria-label="End date" placeholder="End date" disabled={item.current} className={inputClass} value={item.endDate} onChange={(e) => updateAffiliation(item.id, { endDate: e.target.value })} /><textarea aria-label="Affiliation description" placeholder="What did you do here?" className={`${inputClass} min-h-24 sm:col-span-2`} value={item.description} onChange={(e) => updateAffiliation(item.id, { description: e.target.value })} /><div className="flex items-center justify-between sm:col-span-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.current} onChange={(e) => updateAffiliation(item.id, { current: e.target.checked, endDate: e.target.checked ? "" : item.endDate })} />Current affiliation</label><button type="button" onClick={() => setAffiliations((items) => items.filter((value) => value.id !== item.id))} className="text-sm text-rose-300">Remove</button></div></div>)}</div></fieldset>
    <button disabled={saving} className="rounded-full bg-accent px-7 py-3 font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save professional profile"}</button>
  </form></section></ProtectedRoute>;
}
