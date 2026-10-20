// The SnapTune mark: a cent sign drawn as a tuner, an arc with the needle through it. SnapTune
// measures how far you sang from the note in cents, and costs none. Drawn on a 48-unit grid with
// square ends, like the Rokkitt capitals of the wordmark. Source/ui/SnapLookAndFeel.cpp draws the same
// shape in the plugin.

export const CENT_ARC = "M33.54 15.17A13 13 0 1 0 33.54 32.83";

/** The mark on its gold tile, for the plugin's header, the favicon and other small places. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="6" fill="#f4d96c" />
      <path d={CENT_ARC} fill="none" stroke="#133621" strokeWidth="5.5" />
      <rect x="21.25" y="6" width="5.5" height="36" fill="#133621" />
    </svg>
  );
}

/** The mark alone, in the current text colour, for printing on a sheet. */
export function Cent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d={CENT_ARC} fill="none" stroke="currentColor" strokeWidth="5.5" />
      <rect x="21.25" y="6" width="5.5" height="36" fill="currentColor" />
    </svg>
  );
}
