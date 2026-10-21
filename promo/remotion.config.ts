import path from "node:path";
import { Config } from "@remotion/cli/config";

// The plugin window comes from the website's demo (../website/components/demo). Those files import
// React from the website's node_modules; point that at ours so the page has a single React.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias as Record<string, string> | undefined),
      react: path.resolve(process.cwd(), "node_modules/react"),
      "react-dom": path.resolve(process.cwd(), "node_modules/react-dom"),
    },
  },
}));

// PNG frames into standard-range BT.709 H.264, the format X, YouTube and phones expect.
Config.setVideoImageFormat("png");
Config.setColorSpace("bt709");
Config.setCodec("h264");
Config.setCrf(16);
Config.setPixelFormat("yuv420p");
