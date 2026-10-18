export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4bf0c0" />
          <stop offset="1" stopColor="#1fb98c" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-bg)" />
      <path
        d="M6 18.5c2.2 0 2.6-5 4.8-5s2.4 5 4.6 5h1.6c2.2 0 2.6-5 4.8-5h4.2"
        fill="none"
        stroke="#0b1418"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="text-lg font-semibold tracking-tight">
      Snap<span className="text-teal">Tune</span>
    </span>
  );
}
