"use client";

import { useEffect, useRef } from "react";

// A muted, looping demo that only starts on its own when the visitor hasn't asked for reduced motion.
export function DemoVideo({ src, className }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.play().catch(() => {
      // Autoplay can be blocked; the controls are still there.
    });
  }, []);

  return <video ref={ref} src={src} loop muted playsInline controls className={className} />;
}
