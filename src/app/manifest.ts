import type { MetadataRoute } from "next";

/** Installable on phones; on Android the app then shows up in the Share menu and sends links to My research. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KNDL — A New Thing Media product",
    short_name: "KNDL",
    start_url: "/studio",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ff5a5f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
    share_target: { action: "/inbox", method: "GET", params: { title: "title", text: "text", url: "url" } },
  } as MetadataRoute.Manifest;
}
