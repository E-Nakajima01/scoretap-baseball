import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ScoreTap Baseball",
    short_name: "ScoreTap",
    description: "1球ごとに記録できる初心者向け野球スコアブック",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FBFAF6",
    theme_color: "#2F7D47",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
