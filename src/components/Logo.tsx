export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" className="fill-brand" />
      <path d="M20 44a9 9 0 0 1-1.4-17.9A12 12 0 0 1 41.4 22 10 10 0 1 1 44 44Z" fill="#fff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-base font-semibold tracking-tight text-ink">Cumulus CRM</span>
    </span>
  );
}
