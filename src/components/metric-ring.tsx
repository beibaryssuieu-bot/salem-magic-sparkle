type Props = {
  value: number;
  label: string;
  color?: string;
  size?: number;
};

export function MetricRing({ value, label, color = "var(--color-chart-1)", size = 104 }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-border"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: "stroke-dasharray 700ms ease" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold">
          {clamped}%
        </span>
      </div>
      <span className="text-center text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
