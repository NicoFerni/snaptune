"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type Moment = { caption: string; text: string; gap: number; picture: { src: string; width: number; height: number; alt: string; note: string } };

// The method as a row of moments read left to right: a native scrolling row with snap points, two
// buttons that step it one moment at a time, and a bar that shows how far along it is. Without
// script it is still a row you can scroll.
export function HowRow({ moments }: { moments: Moment[] }) {
  const row = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => setProgress(el.scrollWidth > el.clientWidth ? el.scrollLeft / (el.scrollWidth - el.clientWidth) : 1);
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  function step(direction: number) {
    const el = row.current;
    const first = el?.querySelector("li");
    if (!el || !first) return;
    const pitch = first.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || "0");
    el.scrollBy({ left: direction * pitch, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  return (
    <>
      <div className="how-controls">
        <button type="button" className="how-step" aria-label="Back one step" onClick={() => step(-1)} disabled={progress <= 0.001}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          </svg>
        </button>
        <button type="button" className="how-step" aria-label="Forward one step" onClick={() => step(1)} disabled={progress >= 0.999}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" />
          </svg>
        </button>
      </div>
      <div className="how-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.max(0.08, progress)})` }} />
      </div>
      <ol ref={row} className="how-row" aria-label="What happens to your voice, in order">
        {moments.map((m) => (
          <li key={m.caption}>
            <h3>{m.caption}</h3>
            <p>{m.text}</p>
            <figure style={{ ["--gap" as string]: m.gap }}>
              <Image src={m.picture.src} width={m.picture.width} height={m.picture.height} alt={m.picture.alt} sizes="280px" />
              <figcaption>{m.picture.note}</figcaption>
            </figure>
          </li>
        ))}
      </ol>
    </>
  );
}
