import type { Release } from "@/lib/release";
import { links } from "@/lib/site";

/** The reply card's buttons: one per installer the published release has, then every file. */
export function Downloads({ release }: { release: Release }) {
  const systems = [
    { name: "Mac", href: release.mac },
    { name: "Windows", href: release.windows },
    { name: "Linux", href: release.linux },
  ];

  return (
    <>
      {systems.map(
        (s) =>
          s.href && (
            <a key={s.name} href={s.href} className="bar">
              {`Download for ${s.name}`}
            </a>
          ),
      )}
      <a href={links.releases} className="reply-link">
        Or every file, to install by hand
      </a>
    </>
  );
}
