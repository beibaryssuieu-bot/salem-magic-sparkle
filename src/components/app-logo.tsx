/** «tarbie+» эмблемасы: стильденген «t» әрпі және «+» акценті. */
export function AppLogo({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[62%]" aria-hidden="true">
        <path
          d="M5 5.5h11M9.5 5.5V16a2.5 2.5 0 0 0 2.5 2.5h1"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18.5 13v5.5M15.75 15.75h5.5"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
