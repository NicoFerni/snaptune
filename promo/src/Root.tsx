import { Composition } from "remotion";
import { Loop, Promo } from "./Promo";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "./timeline";

export const Root = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={DURATION_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    {/* The website's cover plate: ten muted seconds of the window, from the drop on. */}
    <Composition id="Loop" component={Loop} durationInFrames={10 * FPS} fps={FPS} width={1280} height={800} />
  </>
);
