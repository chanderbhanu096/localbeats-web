import type { MetadataRoute } from "next";

// Required by `output: "export"` — emitted once at build time.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LocalBeats",
    short_name: "LocalBeats",
    description: "Your offline music library",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#08080b",
    theme_color: "#08080b",
    orientation: "portrait",
    icons: [
      { src: "./apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
