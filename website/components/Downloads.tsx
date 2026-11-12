import type { Release } from "@/lib/release";
import { links } from "@/lib/site";

// Installers go through /download/<os>, which counts each visitor once before sending them on to
// GitHub; the fallback (the releases page) is linked as is.
const through = (href: string | null, os: string) => (href?.includes("/releases/download/") ? `/download/${os}` : href);

/** The reply card's buttons: one per installer the published release has, then every file. */
export function Downloads({ release, lang = "en" }: { release: Release; lang?: "en" | "es" }) {
  const systems = [
    { name: "Mac", href: through(release.mac, "mac") },
    { name: "Windows", href: through(release.windows, "windows") },
    { name: "Linux", href: through(release.linux, "linux") },
  ];

  return (
    <>
      {systems.map(
        (s) =>
          s.href && (
            <a key={s.name} href={s.href} className="bar">
              {lang === "es" ? `Descargar para ${s.name}` : `Download for ${s.name}`}
            </a>
          ),
      )}
      <a href={links.releases} className="reply-link">
        {lang === "es" ? "O todos los archivos, para instalar a mano" : "Or every file, to install by hand"}
      </a>
    </>
  );
}
