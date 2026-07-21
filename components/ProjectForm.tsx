"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction, updateProjectAction, inviteAssociateAction } from "@/lib/actions";
import type { Project } from "@/lib/slotHelpers";

const STATUS_OPTIONS: {
  value: "draft" | "active" | "paused" | "closed" | "archived";
  label: string;
  badge: string;
}[] = [
  { value: "draft", label: "Draft", badge: "bg-gray-100 text-gray-600" },
  { value: "active", label: "Active", badge: "bg-emerald-100 text-emerald-700" },
  { value: "paused", label: "Paused", badge: "bg-amber-100 text-amber-700" },
  { value: "closed", label: "Closed", badge: "bg-red-100 text-red-700" },
  { value: "archived", label: "Archived", badge: "bg-gray-100 text-gray-400" },
];

const COLOR_SWATCHES = ["#4338CA", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2"];

type FormData = {
  name: string;
  company: string;
  description: string;
  durationMinutes: number;
  dailyStart: string;
  dailyEnd: string;
  includeWeekends: boolean;
  minNoticeHours: number;
  timezone: string;
  bookingDeadlineDays: number;
  bufferMinutes: number;
  maxSessionsPerAdminPerDay: number;
  sessionCapacity: number;
  admins: string[];
  ownerId: string;
  status: "draft" | "active" | "paused" | "closed" | "archived";
  logoInitial: string;
  primaryColor: string;
  senderName: string;
  availabilityPeriodDays: number;
  availabilityLockDate: string;
};

type ValidationErrors = Partial<Record<keyof FormData, string>>;

type AdminOption = { id: string; name: string; initials: string; email: string; accountType: string | null; role: string };

type SuperAdminOption = { id: string; name: string; email: string; role: string };

function futureDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ProjectForm({
  mode,
  initialProject,
}: {
  mode: "create" | "edit";
  initialProject?: Project;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [allAdmins, setAllAdmins] = useState<AdminOption[]>([]);
  const [superAdmins, setSuperAdmins] = useState<SuperAdminOption[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [adminsRes, superRes] = await Promise.all([
          fetch("/api/admins"),
          fetch("/api/super-admins"),
        ]);
        if (adminsRes.ok) setAllAdmins(await adminsRes.json());
        if (superRes.ok) setSuperAdmins(await superRes.json());
      } catch {
        // lists are empty
      }
    }
    load();
  }, []);

  function buildInitialData(): FormData {
    if (isEdit && initialProject) {
      return {
        name: initialProject.name,
        company: initialProject.company,
        description: initialProject.description,
        durationMinutes: initialProject.durationMinutes,
        dailyStart: initialProject.dailyStart,
        dailyEnd: initialProject.dailyEnd,
        includeWeekends: initialProject.includeWeekends,
        minNoticeHours: initialProject.minNoticeHours,
        timezone: initialProject.timezone,
        bookingDeadlineDays: initialProject.bookingDeadlineDays,
        bufferMinutes: initialProject.bufferMinutes,
        maxSessionsPerAdminPerDay: initialProject.maxSessionsPerAdminPerDay,
        sessionCapacity: initialProject.sessionCapacity,
        admins: initialProject.admins.map((a) => a.id),
        ownerId: initialProject.ownerId ?? "",
        status: initialProject.status,
        logoInitial: initialProject.branding.logoInitial,
        primaryColor: initialProject.branding.primaryColor,
        senderName: initialProject.branding.senderName,
        availabilityPeriodDays: initialProject.availabilityPeriodDays,
        availabilityLockDate: `${initialProject.availabilityLockDate.getFullYear()}-${String(initialProject.availabilityLockDate.getMonth() + 1).padStart(2, "0")}-${String(initialProject.availabilityLockDate.getDate()).padStart(2, "0")}`,
      };
    }
    return {
      name: "",
      company: "",
      description: "",
      durationMinutes: 60,
      dailyStart: "09:00",
      dailyEnd: "17:00",
      includeWeekends: false,
      minNoticeHours: 2,
      timezone: "Africa/Nairobi",
      bookingDeadlineDays: 7,
      bufferMinutes: 15,
      maxSessionsPerAdminPerDay: 3,
      sessionCapacity: 1,
      admins: [],
      ownerId: "",
      status: "draft",
      logoInitial: "",
      primaryColor: COLOR_SWATCHES[0],
      senderName: "",
      availabilityPeriodDays: 14,
      availabilityLockDate: futureDateString(30),
    };
  }

  const [data, setData] = useState<FormData>(buildInitialData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saveError, setSaveError] = useState("");

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSaveError("");
  }

  function validate(): ValidationErrors {
    const errs: ValidationErrors = {};
    if (!data.name.trim()) errs.name = "Name is required.";
    if (!data.company.trim()) errs.company = "Company is required.";
    if (!data.timezone.trim()) errs.timezone = "Timezone is required.";
    if (data.dailyEnd <= data.dailyStart) errs.dailyEnd = "End time must be after start time.";
    if (data.durationMinutes <= 0) errs.durationMinutes = "Must be positive.";
    if (data.minNoticeHours < 0) errs.minNoticeHours = "Cannot be negative.";
    if (data.bookingDeadlineDays < 0) errs.bookingDeadlineDays = "Cannot be negative.";
    if (data.bufferMinutes < 0) errs.bufferMinutes = "Cannot be negative.";
    if (data.maxSessionsPerAdminPerDay <= 0) errs.maxSessionsPerAdminPerDay = "Must be at least 1.";
    if (data.sessionCapacity <= 0) errs.sessionCapacity = "Must be at least 1.";
    if (data.availabilityPeriodDays <= 0) errs.availabilityPeriodDays = "Must be positive.";
    if (!data.availabilityLockDate) errs.availabilityLockDate = "Required.";
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const branding = {
      logoInitial: data.logoInitial || data.company.slice(0, 2).toUpperCase(),
      primaryColor: data.primaryColor,
      senderName: data.senderName || data.company,
    };

    const formPayload = {
      name: data.name,
      company: data.company,
      description: data.description,
      durationMinutes: data.durationMinutes,
      dailyStart: data.dailyStart,
      dailyEnd: data.dailyEnd,
      includeWeekends: data.includeWeekends,
      minNoticeHours: data.minNoticeHours,
      timezone: data.timezone,
      bookingDeadlineDays: data.bookingDeadlineDays,
      bufferMinutes: data.bufferMinutes,
      maxSessionsPerAdminPerDay: data.maxSessionsPerAdminPerDay,
      sessionCapacity: data.sessionCapacity,
      availabilityLockDate: new Date(data.availabilityLockDate + "T00:00:00"),
      branding,
      availabilityPeriodDays: data.availabilityPeriodDays,
      adminIds: data.admins,
      ownerId: data.ownerId || undefined,
    };

    try {
      if (isEdit && initialProject) {
        await updateProjectAction(initialProject.slug, { ...formPayload, status: data.status });
      } else {
        await createProjectAction(formPayload);
      }
    } catch {
      setSaveError("Failed to save project. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Basics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Basics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500">Name *</label>
            <input
              value={data.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
              placeholder="e.g. Senior PM Interview"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500">Company</label>
            <input
              value={data.company}
              onChange={(e) => update("company", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
              placeholder="e.g. Northwind Labs"
            />
            {errors.company && <p className="text-xs text-red-600 mt-1">{errors.company}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500">Description</label>
            <textarea
              value={data.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none"
              placeholder="Describe the project for participants and admins."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Logo initial</label>
            <input
              value={data.logoInitial}
              onChange={(e) => update("logoInitial", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
              placeholder="NL"
              maxLength={2}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Brand color</label>
            <div className="flex gap-2 mt-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update("primaryColor", c)}
                  className="w-7 h-7 rounded-full border-2 transition-colors"
                  style={{
                    backgroundColor: c,
                    borderColor: data.primaryColor === c ? "#14161a" : "transparent",
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500">Sender name</label>
            <input
              value={data.senderName}
              onChange={(e) => update("senderName", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
              placeholder="e.g. Northwind Labs"
            />
          </div>
        </div>
      </div>

      {/* Scheduling rules */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Scheduling rules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Session duration</label>
            <select
              value={data.durationMinutes}
              onChange={(e) => update("durationMinutes", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={120}>120 min</option>
            </select>
            {errors.durationMinutes && <p className="text-xs text-red-600 mt-1">{errors.durationMinutes}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Availability period</label>
            <select
              value={data.availabilityPeriodDays}
              onChange={(e) => update("availabilityPeriodDays", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value={7}>1 week</option>
              <option value={14}>2 weeks</option>
              <option value={30}>1 month</option>
            </select>
            {errors.availabilityPeriodDays && <p className="text-xs text-red-600 mt-1">{errors.availabilityPeriodDays}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Daily start time</label>
            <input
              type="time"
              value={data.dailyStart}
              onChange={(e) => update("dailyStart", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Daily end time</label>
            <input
              type="time"
              value={data.dailyEnd}
              onChange={(e) => update("dailyEnd", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
            {errors.dailyEnd && <p className="text-xs text-red-600 mt-1">{errors.dailyEnd}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Include weekends</label>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => update("includeWeekends", !data.includeWeekends)}
                className={
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
                  (data.includeWeekends ? "bg-brand-500" : "bg-gray-300")
                }
                role="switch"
                aria-checked={data.includeWeekends}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                  style={{ transform: data.includeWeekends ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Timezone</label>
            <input
              value={data.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Africa/Nairobi"
            />
            {errors.timezone && <p className="text-xs text-red-600 mt-1">{errors.timezone}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Booking deadline (days before end)</label>
            <input
              type="number"
              min={0}
              value={data.bookingDeadlineDays}
              onChange={(e) => update("bookingDeadlineDays", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
            {errors.bookingDeadlineDays && <p className="text-xs text-red-600 mt-1">{errors.bookingDeadlineDays}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Minimum notice (hours)</label>
            <input
              type="number"
              min={0}
              value={data.minNoticeHours}
              onChange={(e) => update("minNoticeHours", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
            {errors.minNoticeHours && <p className="text-xs text-red-600 mt-1">{errors.minNoticeHours}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Buffer (minutes)</label>
            <input
              type="number"
              min={0}
              value={data.bufferMinutes}
              onChange={(e) => update("bufferMinutes", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
            {errors.bufferMinutes && <p className="text-xs text-red-600 mt-1">{errors.bufferMinutes}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Max sessions / admin / day</label>
            <input
              type="number"
              min={1}
              value={data.maxSessionsPerAdminPerDay}
              onChange={(e) => update("maxSessionsPerAdminPerDay", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
            {errors.maxSessionsPerAdminPerDay && <p className="text-xs text-red-600 mt-1">{errors.maxSessionsPerAdminPerDay}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Session capacity</label>
            <input
              type="number"
              min={1}
              value={data.sessionCapacity}
              onChange={(e) => update("sessionCapacity", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
            {errors.sessionCapacity && <p className="text-xs text-red-600 mt-1">{errors.sessionCapacity}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500">Availability lock date</label>
            <input
              type="date"
              value={data.availabilityLockDate}
              onChange={(e) => update("availabilityLockDate", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            />
            {errors.availabilityLockDate && <p className="text-xs text-red-600 mt-1">{errors.availabilityLockDate}</p>}
          </div>
        </div>
      </div>

      {/* Admin assignment */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Admin assignment</h2>
        {allAdmins.length === 0 && (
          <p className="text-sm text-gray-400">Loading admins...</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {allAdmins.map((admin) => (
            <label
              key={admin.id}
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5"
            >
              <input
                type="checkbox"
                checked={data.admins.includes(admin.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    update("admins", [...data.admins, admin.id]);
                  } else {
                    update("admins", data.admins.filter((id) => id !== admin.id));
                  }
                }}
                className="rounded border-gray-300 text-brand-500"
              />
              {admin.name}

            </label>
          ))}
        </div>

        <InviteAssociateForm
          projectId={initialProject?.id}
          onInvited={(newAdmin) => {
            if (!data.admins.includes(newAdmin.id)) {
              update("admins", [...data.admins, newAdmin.id]);
            }
            setAllAdmins((prev) => {
              if (prev.find((a) => a.id === newAdmin.id)) return prev;
              return [...prev, newAdmin];
            });
          }}
        />
      </div>

      {/* Owner assignment */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Project owner</h2>
        {superAdmins.length === 0 && (
          <p className="text-sm text-gray-400">Loading owners...</p>
        )}
        <select
          value={data.ownerId}
          onChange={(e) => update("ownerId", e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">Unassigned</option>
          {superAdmins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.role})
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Status</h2>
        <select
          value={data.status}
          onChange={(e) => update("status", e.target.value as typeof data.status)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2 mt-3">
          {STATUS_OPTIONS.map((opt) => (
            <span
              key={opt.value}
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${opt.badge} ${
                data.status === opt.value ? "ring-2 ring-offset-1 ring-brand-500" : ""
              }`}
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="bg-red-100 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{saveError}</div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg px-6 py-2.5"
        >
          {isEdit ? "Save project" : "Create project"}
        </button>
        <button
          onClick={() => router.push("/admin/projects")}
          className="border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium px-6 py-2.5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function InviteAssociateForm({
  projectId,
  onInvited,
}: {
  projectId?: string;
  onInvited: (admin: { id: string; name: string; initials: string; email: string; accountType: string | null; role: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSending(true);
    try {
      const admin = await inviteAssociateAction({ name, email, projectId });
      onInvited(admin);
      setName("");
      setEmail("");
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to invite. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Invite a new associate</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <input
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            disabled={sending}
            className="bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white text-sm font-semibold rounded-lg px-4 py-2 shrink-0"
          >
            {sending ? "Sending..." : "Invite"}
          </button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        {done && <p className="text-xs text-green-600">Invitation sent! The associate has been added to this project.</p>}
      </form>
    </div>
  );
}
