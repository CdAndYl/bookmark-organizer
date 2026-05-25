import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "Bookmark Organizer",
  description:
    "Rule-configurable Chrome bookmark organizer framework with optional AI classification.",
  version: pkg.version,
  permissions: ["bookmarks", "storage"],
  host_permissions: ["https://*/*", "http://*/*"],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  action: {
    default_title: "Bookmark Organizer",
  },
  options_page: "src/options/index.html",
});
