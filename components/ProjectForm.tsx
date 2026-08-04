"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createProjectAction, updateProjectAction, inviteAssociateAction, setProjectCertificationRequirementsAction } from "@/lib/actions";
import type { Project } from "@/lib/slotHelpers";
import { OwnerGraphStatus } from "@/components/OwnerGraphStatus";
import AdminCertificationsEditor from "@/components/AdminCertificationsEditor";

const STATUS_OPTIONS: {
  value: "draft" | "active" | "paused" | "closed" | "archived";
  label: string;
  badge: string;
}[] = [
  { value: "draft", label: "Draft", badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  { value: "active", label: "Active", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { value: "paused", label: "Paused", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "closed", label: "Closed", badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  { value: "archived", label: "Archived", badge: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" },
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
  autoCompleteBookings: boolean;
  status: "draft" | "active" | "paused" | "closed" | "archived";
  logoInitial: string;
  primaryColor: string;
  senderName: string;
  availabilityPeriodDays: number;
  availabilityLockDate: string;
  meetingPlatformPreference: "zoom" | "teams" | "auto";
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
  currentUserRole,
  certifications = [],
  initialRequirements = [],
  certificationsByAdmin = {},
}: {
  mode: "create" | "edit";
  initialProject?: Project;
  currentUserRole?: string;
  certifications?: { id: string; name: string; description: string }[];
  initialRequirements?: string[];
  certificationsByAdmin?: Record<string, string[]>;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [allAdmins, setAllAdmins] = useState<AdminOption[]>([]);
  const [superAdmins, setSuperAdmins] = useState<SuperAdminOption[]>([]);
  const [requiredCertIds, setRequiredCertIds] = useState<string[]>(initialRequirements);

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
        autoCompleteBookings: initialProject.autoCompleteBookings,
        admins: initialProject.admins.map((a) => a.id),
        ownerId: initialProject.ownerId ?? "",
        status: initialProject.status,
        logoInitial: initialProject.branding.logoInitial,
        primaryColor: initialProject.branding.primaryColor,
        senderName: initialProject.branding.senderName,
        availabilityPeriodDays: initialProject.availabilityPeriodDays,
        availabilityLockDate: `${initialProject.availabilityLockDate.getFullYear()}-${String(initialProject.availabilityLockDate.getMonth() + 1).padStart(2, "0")}-${String(initialProject.availabilityLockDate.getDate()).padStart(2, "0")}`,
        meetingPlatformPreference: initialProject.meetingPlatformPreference ?? "auto",
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
      autoCompleteBookings: false,
      status: "draft",
      logoInitial: "",
      primaryColor: COLOR_SWATCHES[0],
      senderName: "",
      availabilityPeriodDays: 14,
      availabilityLockDate: futureDateString(30),
      meetingPlatformPreference: "auto",
    };
  }

  const [data, setData] = useState<FormData>(buildInitialData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saveError, setSaveError] = useState("");
  const [offboardingSummary, setOffboardingSummary] = useState<{
    reassigned: number;
    flagged: number;
    flaggedBookings: { bookingId: string; reason: string }[];
  } | null>(null);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSaveError("");
    setOffboardingSummary(null);
  }

  function toggleAdmin(adminId: string, checked: boolean) {
    if (checked) {
      update("admins", [...data.admins, adminId]);
    } else {
      update("admins", data.admins.filter((id) => id !== adminId));
    }
  }

  function renderAdminCheckbox(admin: AdminOption, deEmphasized: boolean) {
    return (
      <label
        key={admin.id}
        className={
          "flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 " +
          (deEmphasized
            ? "text-gray-400 hover:bg-gray-50 dark:text-gray-500 dark:hover:bg-gray-800"
            : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800")
        }
      >
        <input
          type="checkbox"
          checked={data.admins.includes(admin.id)}
          onChange={(e) => toggleAdmin(admin.id, e.target.checked)}
          className="rounded border-gray-300 text-brand-500 dark:border-gray-600"
        />
        {admin.name}
      </label>
    );
  }

  function validate(): ValidationErrors {
    const errs: ValidationErrors = {};
    if (!data.name.trim()) errs.name = "Name is required.";
    if (!data.company.trim()) errs.company = "Company is required.";
    if (!data.timezone.trim()) errs.timezone = "Timezone is required.";
    if (data.dailyEnd <= data.dailyStart) errs.dailyEnd = "End time must be after start time.";
    if (data.durationMinutes < 5 || data.durationMinutes > 480) errs.durationMinutes = "Must be 5–480 minutes.";
    if (data.minNoticeHours < 0) errs.minNoticeHours = "Cannot be negative.";
    if (data.bookingDeadlineDays < 0) errs.bookingDeadlineDays = "Cannot be negative.";
    if (data.bufferMinutes < 0) errs.bufferMinutes = "Cannot be negative.";
    if (data.maxSessionsPerAdminPerDay <= 0) errs.maxSessionsPerAdminPerDay = "Must be at least 1.";
    if (data.sessionCapacity <= 0) errs.sessionCapacity = "Must be at least 1.";
    if (data.availabilityPeriodDays < 1 || data.availabilityPeriodDays > 365) errs.availabilityPeriodDays = "Must be 1–365 days.";
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
      autoCompleteBookings: data.autoCompleteBookings,
      availabilityLockDate: new Date(data.availabilityLockDate + "T00:00:00"),
      branding,
      availabilityPeriodDays: data.availabilityPeriodDays,
      adminIds: data.admins,
      ownerId: data.ownerId || undefined,
      certificationIds: requiredCertIds,
      meetingPlatformPreference: data.meetingPlatformPreference,
    };

    try {
      if (isEdit && initialProject) {
        const result = await updateProjectAction(initialProject.slug, { ...formPayload, status: data.status });
        if (result.ok) {
          const reqResult = await setProjectCertificationRequirementsAction(initialProject.id, requiredCertIds);
          if (!reqResult.ok) {
            setSaveError(reqResult.reason === "unauthorized" ? "You do not have permission to set certification requirements." : "Project saved, but failed to save required certifications.");
            return;
          }
          if (result.reassigned > 0 || result.flagged > 0) {
            setOffboardingSummary({
              reassigned: result.reassigned,
              flagged: result.flagged,
              flaggedBookings: result.flaggedBookings,
            });
          } else {
            router.push("/admin/projects");
          }
        } else {
          setSaveError(result.reason === "unauthorized" ? "You do not have permission to edit this project." : "Failed to save project.");
        }
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
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 mb-4 dark:text-gray-50">Basics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Name *</label>
            <input
              value={data.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
              placeholder="e.g. Senior PM Interview"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.name}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Company</label>
            <input
              value={data.company}
              onChange={(e) => update("company", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
              placeholder="e.g. Northwind Labs"
            />
            {errors.company && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.company}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</label>
            <textarea
              value={data.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none dark:border-gray-600"
              placeholder="Describe the project for participants and admins."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Logo initial</label>
            <input
              value={data.logoInitial}
              onChange={(e) => update("logoInitial", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
              placeholder="NL"
              maxLength={2}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Brand color</label>
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
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Sender name</label>
            <input
              value={data.senderName}
              onChange={(e) => update("senderName", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
              placeholder="e.g. Northwind Labs"
            />
          </div>
        </div>
      </div>

      {/* Scheduling rules */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 mb-4 dark:text-gray-50">Scheduling rules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Session duration <span className="text-gray-400 dark:text-gray-500">(5–480 min)</span>
            </label>
            <input
              type="number"
              min={5}
              max={480}
              value={data.durationMinutes}
              onChange={(e) => update("durationMinutes", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
            {errors.durationMinutes && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.durationMinutes}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Availability period <span className="text-gray-400 dark:text-gray-500">(1–365 days)</span>
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={data.availabilityPeriodDays}
              onChange={(e) => update("availabilityPeriodDays", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
            {errors.availabilityPeriodDays && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.availabilityPeriodDays}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Daily start time</label>
            <input
              type="time"
              value={data.dailyStart}
              onChange={(e) => update("dailyStart", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Daily end time</label>
            <input
              type="time"
              value={data.dailyEnd}
              onChange={(e) => update("dailyEnd", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
            {errors.dailyEnd && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.dailyEnd}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Include weekends</label>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => update("includeWeekends", !data.includeWeekends)}
                className={
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
                  (data.includeWeekends ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700")
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
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Auto-complete sessions</label>
            <div className="mt-2 flex items-start gap-3">
              <button
                type="button"
                onClick={() => update("autoCompleteBookings", !data.autoCompleteBookings)}
                className={
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors " +
                  (data.autoCompleteBookings ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700")
                }
                role="switch"
                aria-checked={data.autoCompleteBookings}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                  style={{ transform: data.autoCompleteBookings ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
              <p className="text-xs text-gray-500 leading-snug dark:text-gray-400">
                {data.autoCompleteBookings
                  ? "Automatically mark sessions as completed once their scheduled time passes."
                  : "Require the assigned associate to manually mark sessions complete."}
              </p>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Timezone</label>
            <input
              value={data.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
              placeholder="Africa/Nairobi"
            />
            {errors.timezone && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.timezone}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Booking deadline (days before end)</label>
            <input
              type="number"
              min={0}
              value={data.bookingDeadlineDays}
              onChange={(e) => update("bookingDeadlineDays", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
            {errors.bookingDeadlineDays && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.bookingDeadlineDays}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Minimum notice (hours)</label>
            <input
              type="number"
              min={0}
              value={data.minNoticeHours}
              onChange={(e) => update("minNoticeHours", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
            {errors.minNoticeHours && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.minNoticeHours}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Buffer (minutes)</label>
            <input
              type="number"
              min={0}
              value={data.bufferMinutes}
              onChange={(e) => update("bufferMinutes", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
            {errors.bufferMinutes && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.bufferMinutes}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Max sessions / admin / day</label>
            <input
              type="number"
              min={1}
              value={data.maxSessionsPerAdminPerDay}
              onChange={(e) => update("maxSessionsPerAdminPerDay", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
            {errors.maxSessionsPerAdminPerDay && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.maxSessionsPerAdminPerDay}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Session capacity</label>
            <input
              type="number"
              min={1}
              value={data.sessionCapacity}
              onChange={(e) => update("sessionCapacity", Number(e.target.value))}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
            {errors.sessionCapacity && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.sessionCapacity}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Availability lock date</label>
            <input
              type="date"
              value={data.availabilityLockDate}
              onChange={(e) => update("availabilityLockDate", e.target.value)}
              className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
            />
            {errors.availabilityLockDate && <p className="text-xs text-red-600 mt-1 dark:text-red-300">{errors.availabilityLockDate}</p>}
          </div>
        </div>
      </div>

      {/* Meeting platform */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 mb-1 dark:text-gray-50">Meeting platform</h2>
        <p className="text-xs text-gray-500 mb-4 dark:text-gray-400">
          How sessions are hosted. Automatic tries Zoom first, falling back to Microsoft Teams if the Zoom pool is
          unavailable. Zoom-only never falls back. Teams-only skips Zoom entirely.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              { value: "auto", title: "Automatic", desc: "Zoom first, Teams fallback." },
              { value: "zoom", title: "Zoom only", desc: "Never falls back to Teams." },
              { value: "teams", title: "Teams only", desc: "Microsoft Teams meetings." },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update("meetingPlatformPreference", opt.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                data.meetingPlatformPreference === opt.value
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              }`}
            >
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-50">{opt.title}</span>
              <span className="block text-xs text-gray-500 mt-1 dark:text-gray-400">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Required certifications */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 mb-1 dark:text-gray-50">Required certifications</h2>
        <p className="text-xs text-gray-500 mb-4 dark:text-gray-400">
          Associates must hold all selected certifications to be eligible for booking on this project. Leave empty for no certification requirement.
        </p>
        {certifications.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No certifications in the catalog yet. The organisation owner can add them under Certifications.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {certifications.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-2 py-1.5 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  checked={requiredCertIds.includes(c.id)}
                  onChange={() =>
                    setRequiredCertIds((prev) =>
                      prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                    )
                  }
                  className="rounded border-gray-300 text-brand-500 dark:border-gray-600"
                />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Admin assignment */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 mb-1 dark:text-gray-50">Admin assignment</h2>
        {requiredCertIds.length > 0 && (
          <p className="text-xs text-gray-500 mb-4 dark:text-gray-400">
            Associates shown first hold all selected required certifications. Others remain selectable below.
          </p>
        )}
        {allAdmins.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading admins...</p>
        )}
        {allAdmins.length > 0 &&
          (requiredCertIds.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {allAdmins.map((admin) => renderAdminCheckbox(admin, false))}
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const certified = allAdmins.filter((a) =>
                  requiredCertIds.every((id) => (certificationsByAdmin[a.id] ?? []).includes(id))
                );
                const others = allAdmins.filter((a) => !certified.includes(a));
                return (
                  <>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">
                        Certified for selected requirements ({certified.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {certified.map((admin) => renderAdminCheckbox(admin, false))}
                      </div>
                    </div>
                    {others.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">
                          Others ({others.length})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                          {others.map((admin) => renderAdminCheckbox(admin, true))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ))}

        <InviteAssociateForm
          projectId={initialProject?.id}
          currentUserRole={currentUserRole}
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

        {allAdmins.filter((a) => data.admins.includes(a.id)).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 dark:text-gray-400">Associate certifications</h3>
            {allAdmins
              .filter((a) => data.admins.includes(a.id))
              .map((admin) => {
                const held = certificationsByAdmin[admin.id] ?? [];
                const missing = requiredCertIds.filter((id) => !held.includes(id));
                return (
                  <div key={admin.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-gray-800 truncate dark:text-gray-200">{admin.name}</span>
                      {requiredCertIds.length > 0 &&
                        (missing.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium dark:bg-amber-900/40 dark:text-amber-300">
                            <AlertTriangle className="w-3 h-3" /> Missing {missing.length} required cert
                            {missing.length === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium dark:bg-emerald-900/40 dark:text-emerald-300">
                            Certified
                          </span>
                        ))}
                    </div>
                    <AdminCertificationsEditor adminId={admin.id} catalog={certifications} selected={held} />
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Owner assignment */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 mb-4 dark:text-gray-50">Project owner</h2>
        {superAdmins.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading owners...</p>
        )}
        <select
          value={data.ownerId}
          onChange={(e) => update("ownerId", e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="">Unassigned</option>
          {superAdmins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.role})
            </option>
          ))}
        </select>
        <div className="mt-2">
          <OwnerGraphStatus ownerId={data.ownerId} />
        </div>
      </div>

      {/* Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm dark:bg-gray-900 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-900 mb-4 dark:text-gray-50">Status</h2>
        <select
          value={data.status}
          onChange={(e) => update("status", e.target.value as typeof data.status)}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
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

      {/* Offboarding summary */}
      {offboardingSummary && (
        <div className={`rounded-lg border p-4 ${
          offboardingSummary.flagged > 0
            ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-300"
            : "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/40 dark:border-green-800 dark:text-green-300"
        }`}>
          <p className="text-sm font-semibold mb-1">
            {offboardingSummary.reassigned > 0 && `${offboardingSummary.reassigned} session(s) automatically reassigned to other associates.`}
            {offboardingSummary.reassigned > 0 && offboardingSummary.flagged > 0 && " "}
            {offboardingSummary.flagged > 0 && (
              <>
                {offboardingSummary.flagged} session(s) need manual attention —{" "}
                <a href="/admin/needs-attention" className="underline font-bold">view them here</a>
              </>
            )}
          </p>
          <button
            onClick={() => router.push("/admin/projects")}
            className="mt-2 text-sm font-medium underline"
          >
            Back to projects
          </button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="bg-red-100 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 dark:bg-red-900/40 dark:border-red-800 dark:text-red-300">{saveError}</div>
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
          className="border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium px-6 py-2.5 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function InviteAssociateForm({
  projectId,
  currentUserRole,
  onInvited,
}: {
  projectId?: string;
  currentUserRole?: string;
  onInvited: (admin: { id: string; name: string; initials: string; email: string; accountType: string | null; role: string }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const canInviteSuperAdmin = currentUserRole === "org_owner";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSending(true);
    try {
      const admin = await inviteAssociateAction({ name, email, projectId, role });
      onInvited(admin);
      setName("");
      setEmail("");
      setRole("admin");
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to invite. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 dark:text-gray-400">Invite a new associate</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
          />
          <input
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-600"
          />
          {canInviteSuperAdmin && (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "super_admin")}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white dark:border-gray-600 dark:bg-gray-800"
              title="Role"
            >
              <option value="admin">Associate</option>
              <option value="super_admin">Super Admin</option>
            </select>
          )}
          <button
            type="submit"
            disabled={sending}
            className="bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white text-sm font-semibold rounded-lg px-4 py-2 shrink-0"
          >
            {sending ? "Sending..." : "Invite"}
          </button>
        </div>
        {canInviteSuperAdmin && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {role === "super_admin"
              ? "Super Admins are invited via Microsoft sign-in with this email — no password setup is sent."
              : "Associates can activate with an email/password setup link or Microsoft sign-in."}
          </p>
        )}
        {err && <p className="text-xs text-red-600 dark:text-red-300">{err}</p>}
        {done && <p className="text-xs text-green-600 dark:text-green-300">Invitation sent! The associate has been added to this project.</p>}
      </form>
    </div>
  );
}
