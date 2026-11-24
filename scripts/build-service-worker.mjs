import { generateSW } from "workbox-build";

const { count, warnings } = await generateSW({
  globDirectory: "dist",
  globPatterns: ["**/*.{html,js,css,webmanifest,png,jpg,jpeg,webp,avif,svg,woff,woff2,ttf}"],
  swDest: "dist/sw.js",
  navigateFallback: "index.html",
  cacheId: "ei-ni-kan",
  cleanupOutdatedCaches: true,
  inlineWorkboxRuntime: true,
  clientsClaim: true,
  skipWaiting: false,
  sourcemap: false,
});

if (warnings.length) throw new Error(warnings.join("\n"));
console.log(`Service worker precaches ${count} files.`);
