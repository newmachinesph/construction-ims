import { cn } from "./cn";

type Tone = "solid" | "outline" | "muted" | "alert";

/** Terminal / positive states read as filled ink; danger states as the one accent. */
const TONE_BY_STATUS: Record<string, Tone> = {
  // success / complete
  APPROVED: "solid",
  RECEIVED: "solid",
  POSTED: "solid",
  ISSUED: "solid",
  ACTIVE: "solid",
  COMPLETED: "solid",
  // in-progress / neutral
  PENDING_APPROVAL: "outline",
  SUBMITTED: "outline",
  IN_TRANSIT: "outline",
  PARTIALLY_RECEIVED: "outline",
  PARTIALLY_ISSUED: "outline",
  // draft / planning
  DRAFT: "muted",
  PLANNING: "muted",
  // danger
  CANCELLED: "alert",
  REJECTED: "alert",
  ON_HOLD: "alert",
};

const TONE_CLASS: Record<Tone, string> = {
  solid: "bg-ink text-paper border-transparent",
  outline: "border-line-strong text-ink",
  muted: "border-line text-muted",
  alert: "border-alert text-alert",
};

interface StatusBadgeProps {
  value: string;
  tone?: Tone;
  label?: string;
  className?: string;
}

export function StatusBadge({ value, tone, label, className }: StatusBadgeProps) {
  const resolved = tone ?? TONE_BY_STATUS[value] ?? "outline";
  const text = label ?? value.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase",
        TONE_CLASS[resolved],
        className,
      )}
    >
      {text}
    </span>
  );
}
