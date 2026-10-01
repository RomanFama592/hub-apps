import path from "node:path";

const isProd = process.env.NODE_ENV === "production";

export const CONFIG_PATH = isProd
  ? path.join(process.cwd(), "dist", "server", "data", "config.json")
  : path.join(process.cwd(), "data", "config.json");

export const ASSETS_DIR = isProd
  ? path.join(process.cwd(), "dist", "client", "assets")
  : path.join(process.cwd(), "public", "assets");