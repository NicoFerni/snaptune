"use client";

import { useEffect } from "react";

// Reveals each [data-reveal] once, when it enters the viewport (the hidden state lives in
// app/landing.css, behind html.js and prefers-reduced-motion). Never replays, and a safety net shows
// anything still hidden in view a moment after load. Each [data-under="id"] waits under the element
// with that id, the reply card's field over the back of the card, and shows once it has lifted off.
export function Motion() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const show = (el: Element) => el.classList.add("is-in");

    const under = Array.from(document.querySelectorAll<HTMLElement>("[data-under]"));
    let frame = 0;
    const uncover = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const el of under) {
          const lid = document.getElementById(el.dataset.under ?? "");
          el.classList.toggle("is-in", !lid || lid.getBoundingClientRect().bottom <= el.getBoundingClientRect().top);
        }
      });
    };
    uncover();
    window.addEventListener("scroll", uncover, { passive: true });
    window.addEventListener("resize", uncover);

    if (!("IntersectionObserver" in window)) {
      targets.forEach(show);
      return () => {
        window.removeEventListener("scroll", uncover);
        window.removeEventListener("resize", uncover);
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.1 },
    );
    targets.forEach((el) => io.observe(el));

    const net = window.setTimeout(() => {
      for (const el of targets) {
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) show(el);
      }
    }, 2500);

    return () => {
      io.disconnect();
      window.clearTimeout(net);
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", uncover);
      window.removeEventListener("resize", uncover);
    };
  }, []);

  return null;
}
