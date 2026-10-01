// src/lib/regenerateImages.ts
import fs from "fs/promises";
import path from "path";
import type { Config } from "../types/hub.ts";
import { generateInitialsSVG } from "./avatar.ts";
import { ASSETS_DIR } from "./contants.ts";
import { getConfig, saveConfig } from "./config.ts";

// Valida si una imagen local existe y tiene un formato de imagen válido
export const isLocalImageValid = async (imagePath: string): Promise<boolean> => {
  try {
    const relativePath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
    const fullPath = path.join(process.cwd(), ASSETS_DIR, relativePath);

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

// Determina la extensión correcta a partir del Content-Type o la URL
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

// Procesa, descarga o genera la imagen/SVG para un servicio de forma estandarizada
export const processServiceImage = async (
  serviceId: string,
  name: string,
  imageUrlOriginal?: string | null
): Promise<{ imagePath: string; downloaded: boolean }> => {
  try {
    await fs.mkdir(ASSETS_DIR, { recursive: true });
  } catch (e) {}

  if (imageUrlOriginal) {
    try {
      const response = await fetch(imageUrlOriginal);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = getExtension(imageUrlOriginal, response.headers.get("content-type"));
        const filename = `${serviceId}${ext}`;
        const filepath = path.join(ASSETS_DIR, filename);

        await fs.writeFile(filepath, buffer);
        return { imagePath: `/assets/${filename}`, downloaded: true };
      }
    } catch (e) {
      console.error(`Error descargando imagen para "${name}". Generando avatar por defecto...`);
    }
  }

  // Generar SVG de iniciales si no hay URL o si la descarga falló
  const svgContent = generateInitialsSVG(name);
  const filename = `${serviceId}-initials.svg`;
  const filepath = path.join(ASSETS_DIR, filename);

  await fs.writeFile(filepath, svgContent, "utf-8");
  return { imagePath: `/assets/${filename}`, downloaded: false };
};

// Elimina imágenes en public/assets que no pertenecen a ningún servicio activo
export const cleanupOrphanedImages = async (services: Config["services"]): Promise<number> => {
  let cleanedCount = 0;

  try {
    const activeFilenames = new Set(
      services
        .map((service) => service.image)
        .filter((image): image is string => Boolean(image))
        .map((image) => path.basename(image))
    );

    const files = await fs.readdir(ASSETS_DIR);

    for (const file of files) {
      if (!activeFilenames.has(file)) {
        const filePath = path.join(ASSETS_DIR, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }
    }
  } catch (e) {
    // Si la carpeta no existe u ocurre un error, se ignora
  }

  return cleanedCount;
};

// Regenera todas las imágenes/SVGs de la configuración si están rotas o faltantes
export const regenerateImages = async () => {
  const { config } = await getConfig();

  let regenerated = 0;
  const failed: string[] = [];

  for (const service of config.services) {
    const isValidImage = service.image ? await isLocalImageValid(service.image) : false;
    const isInitialsSvg = service.image?.endsWith("-initials.svg") ?? false;

    if (isValidImage && !isInitialsSvg) {
      continue;
    }

    try {
      const { imagePath } = await processServiceImage(service.id, service.name, service.imageUrlOriginal);
      service.image = imagePath;
      regenerated++;
    } catch (e) {
      failed.push(service.name);
    }
  }

  if (regenerated > 0) {
    try {
      await saveConfig(config);
    } catch (e) {
      return { success: false, error: "No se pudo actualizar data/config.json" };
    }
  }

  const cleaned = await cleanupOrphanedImages(config.services);

  return { success: true, regenerated, cleaned, failed };
};