// src/lib/regenerateImages.ts
import fs from "fs/promises";
import path from "path";
import type { Config } from "../types/hub.ts";
import { generateInitialsSVG } from "./avatar.ts";

const isLocalImageValid = async (imagePath: string): Promise<boolean> => {
  try {
    const relativePath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
    const fullPath = path.join(process.cwd(), "public", relativePath);

    const stats = await fs.stat(fullPath);
    if (stats.size === 0) return false;

    const buffer = await fs.readFile(fullPath);
    if (buffer.length < 4) return false;

    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isGif = buffer.toString("utf8", 0, 3) === "GIF";
    const isWebp = buffer.toString("utf8", 8, 12) === "WEBP";
    const isSvg = buffer.toString("utf8").includes("<svg");

    return isPng || isJpg || isGif || isWebp || isSvg;
  } catch (e) {
    return false;
  }
};

const getExtension = (url: string, contentType: string | null): string => {
  if (contentType) {
    if (contentType.includes("image/png")) return ".png";
    if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) return ".jpg";
    if (contentType.includes("image/webp")) return ".webp";
    if (contentType.includes("image/svg+xml")) return ".svg";
    if (contentType.includes("image/gif")) return ".gif";
  }
  const match = url.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
  return match ? `.${match[1]}` : ".png";
};

const cleanupOrphanedImages = async (services: Config["services"]): Promise<number> => {
  const assetsDir = path.join(process.cwd(), "public/assets");
  let cleanedCount = 0;

  try {
    const activeFilenames = new Set(
      services
        .map((service) => service.image)
        .filter((image): image is string => Boolean(image))
        .map((image) => path.basename(image))
    );

    const files = await fs.readdir(assetsDir);

    for (const file of files) {
      if (!activeFilenames.has(file)) {
        const filePath = path.join(assetsDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }
    }
  } catch (e) {
    // Si la carpeta no existe u ocurre un error de lectura, se ignora limpiamente
  }

  return cleanedCount;
};

export const regenerateImages = async () => {
  const configPath = path.join(process.cwd(), "data/config.json");

  let config: Config;
  try {
    const content = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(content) as Config;
  } catch (e) {
    return { success: false, error: "No se pudo leer data/config.json" };
  }

  let regenerated = 0;
  const failed: string[] = [];

  for (const service of config.services) {
    const isValidImage = service.image ? await isLocalImageValid(service.image) : false;
    const isInitialsSvg = service.image?.endsWith("-initials.svg") ?? false;

    if (isValidImage && !isInitialsSvg) {
      continue;
    }

    let processedSuccessfully = false;

    if (service.imageUrlOriginal) {
      try {
        const response = await fetch(service.imageUrlOriginal);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const ext = getExtension(
            service.imageUrlOriginal,
            response.headers.get("content-type")
          );
          const filename = `${service.id}${ext}`;
          const filepath = path.join(process.cwd(), "public/assets", filename);

          await fs.writeFile(filepath, buffer);
          service.image = `/assets/${filename}`;
          processedSuccessfully = true;
          regenerated++;
        }
      } catch (e) {}
    }

    if (!processedSuccessfully) {
      try {
        const svgContent = generateInitialsSVG(service.name);
        const filename = `${service.id}-initials.svg`;
        const filepath = path.join(process.cwd(), "public/assets", filename);

        await fs.writeFile(filepath, svgContent, "utf-8");
        service.image = `/assets/${filename}`;
        regenerated++;
      } catch (e) {
        failed.push(service.name);
      }
    }
  }

  if (regenerated > 0) {
    try {
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    } catch (e) {
      return { success: false, error: "No se pudo actualizar data/config.json" };
    }
  }

  const cleaned = await cleanupOrphanedImages(config.services);

  return { success: true, regenerated, cleaned, failed };
};