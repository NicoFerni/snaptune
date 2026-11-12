import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import "./landing.css";
import "./not-found.css";

// The 404: a page sung off every note. The tuner's needle can't settle and reads 404 cents; the pitch
// graph shows the voice wandering while the corrected line snaps, page by page, up to Home. Hovering
// "Snap to home" centres the needle. CSS only; with reduced motion it's drawn at rest.

export const metadata: Metadata = {
  title: "Page not found · SnapTune",
  description: "This page is out of tune. SnapTune would snap it back; here is the nearest note.",
};

// The meter: ticks from −50 to +50 cents across 120 degrees, around a pivot at the bottom.
const pivot = { x: 120, y: 128 };
const ticks = Array.from({ length: 11 }, (_, i) => {
  const angle = ((i - 5) * 12 * Math.PI) / 180;
  const long = i % 5 === 0;
  const [r1, r2] = [long ? 84 : 90, 100];
  const at = (r: number) => ({ x: pivot.x + r * Math.sin(angle), y: pivot.y - r * Math.cos(angle) });
  return { a: at(r1), b: at(r2), long, centre: i === 5 };
});

// Note rows on the graph are pages of the site; the voice starts below them all.
const rows = [
  { y: 32, label: "Home" },
  { y: 72, label: "Guides" },
  { y: 112, label: "Download" },
  { y: 152, label: "404", lost: true },
];

const sung =
  "M40,155.1 L46,156.9 L52,159.6 L58,162.4 L64,164.6 L70,165.4 L76,164.7 L82,162.3 L88,158.8 L94,155.0 L100,151.7 L106,149.5 L112,148.6 L118,149.0 L124,150.2 L130,151.4 L136,151.9 L142,151.2 L148,149.3 L154,146.3 L160,143.0 L166,140.1 L172,138.3 L178,137.5 L184,129.6 L190,117.2 L196,108.5 L202,109.0 L208,111.4 L214,112.4 L220,112.2 L226,111.2 L232,109.9 L238,109.3 L244,109.8 L250,111.6 L256,114.7 L262,118.4 L268,121.9 L274,124.5 L280,125.6 L286,125.1 L292,123.1 L298,120.2 L304,117.3 L310,112.4 L316,99.2 L322,84.2 L328,76.0 L334,76.7 L340,77.7 L346,77.5 L352,76.0 L358,73.0 L364,69.2 L370,65.3 L376,62.0 L382,60.0 L388,59.6 L394,60.8 L400,63.0 L406,65.4 L412,67.4 L418,68.4 L424,68.1 L430,64.2 L436,50.4 L442,33.8 L448,24.1 L454,24.4 L460,27.0 L466,30.7 L472,34.8 L478,38.6 L484,41.3 L490,42.4 L496,42.0 L502,40.5 L508,38.5 L514,36.8 L520,36.0 L526,36.0 L532,36.7 L538,37.6 L544,38.0 L550,37.5 L556,36.3 L562,34.6 L568,33.1 L574,32.1 L580,32.0";
const snapped = "M40,152 H190 V112 H316 V72 H436 V32 H580";

export default function NotFound() {
  return (
    <main className="manual lost">
      <header className="nav">
        <Link href="/" className="nav-mark" aria-label="SnapTune home">
          <LogoMark className="nav-logo" />
          <span className="nav-name">SnapTune</span>
        </Link>
      </header>

      <section className="lost-card field-gold" aria-labelledby="lost-title">
        <div className="lost-top">
          <figure className="lost-meter" aria-hidden="true">
            <svg viewBox="0 0 240 150">
              <path d="M33.4,78 A100,100 0 0 1 206.6,78" className="meter-arc" />
              {ticks.map((t, i) => (
                <line key={i} x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} className={t.centre ? "tick tick-centre" : t.long ? "tick tick-long" : "tick"} />
              ))}
              <text x="30" y="146" className="meter-label">
                −50
              </text>
              <text x="120" y="146" className="meter-label" textAnchor="middle">
                0
              </text>
              <text x="210" y="146" className="meter-label" textAnchor="end">
                +50
              </text>
              <g className="needle">
                <rect x="117.5" y="34" width="5" height="94" />
                <circle cx="120" cy="128" r="7" />
              </g>
            </svg>
            <figcaption className="lost-readout">
              <span className="readout-num" />
              <span className="readout-unit">¢ off</span>
            </figcaption>
          </figure>

          <div className="lost-text">
            <h1 id="lost-title" className="heading">
              This page is out of tune
            </h1>
            <p>
              Whatever was here is 404 cents away from any page we have. SnapTune would snap it back to the nearest note, so here it is:
            </p>
            <div className="lost-actions">
              <Link href="/" className="button button-ink snap">
                Snap to home
              </Link>
              <Link href="/guides" className="lost-link">
                Read the guides
              </Link>
              <Link href="/#install" className="lost-link">
                Download SnapTune
              </Link>
            </div>
          </div>
        </div>

        <figure className="lost-graph" aria-hidden="true">
          <svg viewBox="-70 0 670 180">
            <defs>
              <clipPath id="sing">
                <rect className="sweep" x="-70" y="0" width="670" height="180" />
              </clipPath>
            </defs>
            {rows.map((r) => (
              <g key={r.label} className={r.lost ? "row row-lost" : "row"}>
                <line x1="40" x2="590" y1={r.y} y2={r.y} />
                <text x="34" y={r.y + 4} textAnchor="end">
                  {r.label}
                </text>
              </g>
            ))}
            <g clipPath="url(#sing)">
              <path d={sung} className="line-sung" />
              <path d={snapped} className="line-out" />
            </g>
            <circle cx="580" cy="32" r="6" className="landing-dot" />
          </svg>
          <figcaption className="lost-legend">
            <span className="key-sung">Sung</span>
            <span className="key-out">Corrected</span>
          </figcaption>
        </figure>
      </section>
    </main>
  );
}
