const GRADIENTS = [
  "bg-gradient-to-br from-brand-500 to-brand-700",
  "bg-gradient-to-br from-purple-500 to-purple-700",
  "bg-gradient-to-br from-blue-500 to-blue-700",
  "bg-gradient-to-br from-emerald-500 to-teal-700",
  "bg-gradient-to-br from-amber-500 to-orange-700",
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function Avatar({
  name,
  seed,
  size = "md",
}: {
  name: string;
  seed?: string;
  size?: "sm" | "md" | "lg";
}) {
  const gradient = GRADIENTS[hashSeed(seed ?? name) % GRADIENTS.length];
  const sizeClass =
    size === "sm"
      ? "w-7 h-7 text-xs"
      : size === "lg"
        ? "w-10 h-10 text-sm"
        : "w-8 h-8 text-xs";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 ${sizeClass} ${gradient}`}
    >
      {getInitials(name)}
    </span>
  );
}
