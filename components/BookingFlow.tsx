"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Globe,
  Video,
  ArrowLeft,
  Check,
  Users,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { Project, TIMEZONES } from "@/lib/slotHelpers";
import { confirmBookingAction, joinWaitlistAction } from "@/lib/actions";

type Step = "calendar" | "details" | "confirmed";
type BookingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; reason: "slot_full" | "no_admin_available" };

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function BookingFlow({
  project,
  availability,
}: {
  project: Project & { id: string };
  availability: Record<string, string[]>;
}) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("calendar");
  const [tz, setTz] = useState(TIMEZONES[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bookingState, setBookingState] = useState<BookingState>({ status: "idle" });
  const [confirmedAdminName, setConfirmedAdminName] = useState<string | null>(null);
  const [wlName, setWlName] = useState("");
  const [wlEmail, setWlEmail] = useState("");
  const [wlSubmitted, setWlSubmitted] = useState(false);
  const [wlLoading, setWlLoading] = useState(false);

  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  const firstDow = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d));

  const selectedSlots = selectedDateKey ? availability[selectedDateKey] || [] : [];
  const selectedDateObj = selectedDateKey ? new Date(selectedDateKey) : null;

  function isPast(d: Date) {
    const cutoff = new Date(today);
    cutoff.setHours(cutoff.getHours() + project.minNoticeHours);
    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay < cutoff;
  }

  const handleConfirm = useCallback(async () => {
    if (!selectedDateKey || !selectedTime || !name || !email) return;
    setBookingState({ status: "loading" });
    const result = await confirmBookingAction({
      projectId: project.id,
      dateKey: selectedDateKey,
      time: selectedTime,
      participantName: name,
      participantEmail: email,
    });
    if (result.ok) {
      setConfirmedAdminName(result.adminName);
      setStep("confirmed");
      setBookingState({ status: "idle" });
    } else {
      setBookingState({ status: "error", reason: result.reason });
      setTimeout(() => {
        router.refresh();
        setStep("calendar");
        setSelectedDateKey(null);
        setSelectedTime(null);
        setName("");
        setEmail("");
        setBookingState({ status: "idle" });
      }, 2500);
    }
  }, [selectedDateKey, selectedTime, name, email, project.id, router]);

  function resetAll() {
    setStep("calendar");
    setSelectedDateKey(null);
    setSelectedTime(null);
    setName("");
    setEmail("");
    setConfirmedAdminName(null);
    setBookingState({ status: "idle" });
  }

  const errorMessage =
    bookingState.status === "error"
      ? bookingState.reason === "slot_full"
        ? "That slot was just booked by someone else — please pick another time."
        : "No interviewer is available for that exact time — please pick another slot."
      : null;

  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {bookingState.status === "error" && errorMessage && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {errorMessage}
          </div>
        )}
        {step !== "confirmed" ? (
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
            <div className="border-b md:border-b-0 md:border-r border-gray-200 p-6 flex flex-col gap-4">
              <div className="text-xs font-semibold tracking-wide text-brand-500 uppercase">{project.company}</div>
              <h2 className="text-lg font-bold text-gray-900 leading-snug">{project.name}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{project.description}</p>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Clock className="w-4 h-4 text-gray-400" />
                {project.durationMinutes} min
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Video className="w-4 h-4 text-gray-400" />
                Microsoft Teams
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Users className="w-4 h-4 text-gray-400" />
                {project.admins.length} interviewers rotating
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                  <Globe className="w-3.5 h-3.5" /> Time zone
                </label>
                <select
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700"
                >
                  {TIMEZONES.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6">
              {step === "calendar" && (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-brand-500" />
                        {MONTH_NAMES[monthCursor.getMonth()]} {monthCursor.getFullYear()}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500"
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                          className="p-1 rounded hover:bg-gray-100 text-gray-500"
                          aria-label="Next month"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
                      {DOW.map((d) => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {cells.map((d, i) => {
                        if (!d) return <div key={i} />;
                        const key = dateKey(d);
                        const slots = availability[key] || [];
                        const hasAvailRow = key in availability;
                        const disabled = !hasAvailRow || isPast(d);
                        const selected = key === selectedDateKey;
                        return (
                          <button
                            key={i}
                            disabled={disabled}
                            onClick={() => { setSelectedDateKey(key); setSelectedTime(null); }}
                            className={
                              "aspect-square rounded-lg text-sm flex items-center justify-center transition-colors " +
                              (selected
                                ? "bg-brand-500 text-white font-semibold"
                                : disabled
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-700 hover:bg-brand-50 font-medium")
                            }
                          >
                            {d.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-3">
                      {selectedDateObj
                        ? selectedDateObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                        : "Pick a date"}
                    </div>
                    {!selectedDateObj && (
                      <p className="text-sm text-gray-400">Select a highlighted day to see open times.</p>
                    )}
                    {selectedDateObj && selectedSlots.length === 0 && (
                      <div>
                        {wlSubmitted ? (
                          <p className="text-sm text-green-600 font-medium">You're on the waitlist! We'll email you if a slot opens up.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-400">No open times this day. Join the waitlist:</p>
                            <input
                              value={wlName}
                              onChange={(e) => setWlName(e.target.value)}
                              placeholder="Your name"
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                            />
                            <input
                              value={wlEmail}
                              onChange={(e) => setWlEmail(e.target.value)}
                              placeholder="Your email"
                              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                            />
                            <button
                              disabled={!wlName || !wlEmail || wlLoading}
                              onClick={async () => {
                                setWlLoading(true);
                                await joinWaitlistAction({ projectId: project.id, name: wlName, email: wlEmail, dateKey: selectedDateKey! });
                                setWlLoading(false);
                                setWlSubmitted(true);
                              }}
                              className="w-full text-sm bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white font-semibold rounded-lg py-2"
                            >
                              {wlLoading ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Joining...</> : "Join waitlist"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                      {selectedSlots.map((t) => (
                        <button
                          key={t}
                          onClick={() => setSelectedTime(t)}
                          className={
                            "text-sm rounded-lg border px-3 py-2 text-left transition-colors " +
                            (selectedTime === t
                              ? "border-brand-500 bg-brand-500 text-white font-semibold"
                              : "border-gray-200 text-gray-700 hover:border-brand-100 hover:bg-brand-50")
                          }
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    {selectedTime && (
                      <button
                        onClick={() => setStep("details")}
                        className="mt-4 w-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg py-2.5"
                      >
                        Continue
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === "details" && (
                <div className="max-w-sm mx-auto">
                  <button
                    onClick={() => setStep("calendar")}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <div className="text-sm text-gray-500 mb-1">
                    {selectedDateObj?.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · {selectedTime}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-4">Enter your details</h3>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Email</label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@email.com"
                        className="w-full mt-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <button
                      disabled={!name || !email || bookingState.status === "loading"}
                      onClick={handleConfirm}
                      className="mt-2 w-full bg-brand-500 disabled:bg-gray-300 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2"
                    >
                      {bookingState.status === "loading" ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</>
                      ) : (
                        "Confirm booking"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">You're booked, {name.split(" ")[0]}</h3>
            <p className="text-sm text-gray-500 mb-6">A calendar invite and Teams link are on their way to {email}.</p>

            <div className="w-full max-w-sm rounded-xl border-2 border-dashed border-brand-100 bg-brand-50/50 relative">
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-50 border-2 border-dashed border-brand-100" />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-50 border-2 border-dashed border-brand-100" />
              <div className="p-5 text-left">
                <div className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-1">{project.company}</div>
                <div className="font-bold text-gray-900 mb-3">{project.name}</div>
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-1.5">
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                  {selectedDateObj?.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-1.5">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {selectedTime} · {project.durationMinutes} min · {tz}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 mb-1.5">
                  <Users className="w-4 h-4 text-gray-400" />
                  with {confirmedAdminName}
                </div>
                <div className="flex items-center gap-2 text-sm text-brand-600 font-medium mt-3 pt-3 border-t border-brand-100">
                  <Video className="w-4 h-4" />
                  Join Microsoft Teams meeting
                </div>
              </div>
            </div>

            <button onClick={resetAll} className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline">
              Book another session
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
