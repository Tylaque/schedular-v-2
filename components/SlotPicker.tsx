"use client";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

type TimeSlotListProps = {
  times: string[];
  selectedTime: string | null;
  onSelectTime: (time: string | null) => void;
  currentTime?: string;
};

export function TimeSlotList({ times, selectedTime, onSelectTime, currentTime }: TimeSlotListProps) {
  return (
    <div className="flex flex-col gap-1">
      {times.map((t) => {
        const isCurrent = t === currentTime;
        return (
          <button
            key={t}
            onClick={() => { if (!isCurrent) onSelectTime(t); }}
            disabled={isCurrent}
            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
              selectedTime === t
                ? "bg-brand-500 text-white font-semibold"
                : isCurrent
                ? "text-gray-300 cursor-not-allowed"
                : "border border-gray-200 text-gray-700 hover:border-brand-100 hover:bg-brand-50"
            }`}
          >
            {formatTime(t)}
            {isCurrent && " (current)"}
          </button>
        );
      })}
    </div>
  );
}

type SlotPickerProps = {
  availability: Record<string, string[]>;
  selectedDateKey: string | null;
  selectedTime: string | null;
  onSelectDate: (dateKey: string) => void;
  onSelectTime: (time: string | null) => void;
  currentDateKey?: string;
  currentTime?: string;
};

export default function SlotPicker({
  availability,
  selectedDateKey,
  selectedTime,
  onSelectDate,
  onSelectTime,
  currentDateKey,
  currentTime,
}: SlotPickerProps) {
  const sortedDates = Object.keys(availability).sort();
  const timesForSelected = selectedDateKey ? availability[selectedDateKey] || [] : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {sortedDates.map((dk) => {
          const isCurrent = dk === currentDateKey;
          return (
            <button
              key={dk}
              onClick={() => { onSelectDate(dk); onSelectTime(null); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedDateKey === dk
                  ? "bg-brand-50 border border-brand-300 text-brand-700"
                  : "hover:bg-gray-50 border border-transparent text-gray-700"
              }`}
            >
              <span className="font-medium">{formatDate(dk)}</span>
              {isCurrent && <span className="ml-2 text-xs text-gray-400">(current)</span>}
              <span className="ml-2 text-xs text-gray-400">{availability[dk].length} slots</span>
            </button>
          );
        })}
      </div>

      <div>
        {selectedDateKey ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 mb-1">
              {formatDate(selectedDateKey)}
            </p>
            {timesForSelected.length > 0 ? (
              <TimeSlotList
                times={timesForSelected}
                selectedTime={selectedTime}
                onSelectTime={onSelectTime}
                currentTime={selectedDateKey === currentDateKey ? currentTime : undefined}
              />
            ) : (
              <p className="text-xs text-gray-400">No slots available</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Select a date</p>
        )}
      </div>
    </div>
  );
}
