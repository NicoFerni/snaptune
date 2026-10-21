import { GuidePage, guideMetadata } from "@/components/GuidePage";
import { guideBySlug } from "@/lib/guides";

const guide = guideBySlug("free-autotune");

export const metadata = guideMetadata(guide);

export default function Page() {
  return <GuidePage guide={guide} />;
}
