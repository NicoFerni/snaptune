import { GuidePage, guideMetadata } from "@/components/GuidePage";
import { guideBySlug } from "@/lib/guides";

const guide = guideBySlug("autotune-fl-studio");

export const metadata = guideMetadata(guide);

export default function Page() {
  return <GuidePage guide={guide} />;
}
