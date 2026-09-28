import fs from "fs/promises";
import path from "path";
import type { Config } from "../../types/hub";
import { generateInitialsSVG } from "../../lib/avatar";

/**
 * Verifica si el archivo existe en el sistema local y no está corrupto.
 */
const isLocalImageValid = async (imagePath: string): Promise<boolean> => {
  try {
    // Normalizar la ruta ignorando el slash inicial para compilar dentro de /public
    const relativePath = imagePath.startsWith("/") ? imagePath.slice(1) : imagePath;
    const fullPath = path.join(process.cwd(), "public", relativePath);

    // 1. Verificar existencia y tamaño (no vacía)
    const stats = await fs.stat(fullPath);
    if (stats.size === 0) {
      return false;
    }

    // 2. Leer los primeros bytes para validar la cabecera del archivo (Magic Numbers)
    const buffer = await fs.readFile(fullPath);
    if (buffer.length < 4) {
      return false;
    }

    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isGif = buffer.toString("utf8", 0, 3) === "GIF";
    const isWebp = buffer.toString("utf8", 8, 12) === "WEBP";
    const isSvg = buffer.toString("utf8").includes("<svg");

    return isPng || isJpg || isGif || isWebp || isSvg;
  } catch (e) {
    // Si fs.stat o fs.readFile arroja error (ej. ENOENT: archivo no existe), es inválida
    return false;
  }
};

/**
 * Determina la extensión del archivo a partir del header Content-Type o la URL
 */
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

/**
 * Elimina todos los archivos en public/assets que no estén asociados a ningún servicio
 */
const cleanupOrphanedImages = async (services: Config["services"]): Promise<number> => {
  const assetsDir = path.join(process.cwd(), "public/assets");
  let cleanedCount = 0;

  try {
    // 1. Crear un Set con los nombres de archivo actualmente vinculados a los servicios
    const activeFilenames = new Set(
      services
        .map((service) => service.image)
        .filter((image): image is string => Boolean(image))
        .map((image) => path.basename(image))
    );

    // 2. Leer el directorio public/assets
    const files = await fs.readdir(assetsDir);

    // 3. Borrar los archivos que no están en la lista de activos
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
    // Si la carpeta no existe u ocurre un error de lectura, se captura limpiamente
  }

  return cleanedCount;
};

/**
 * POST /api/regenerate-images
 */
export const POST = async () => {
  const configPath = path.join(process.cwd(), "data/config.json");

  let config: Config;
  try {
    const content = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(content) as Config;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "No se pudo leer data/config.json" }),
      { status: 500 }
    );
  }

  let regenerated = 0;
  const failed: string[] = [];

  for (const service of config.services) {
    // 1. Validar presencia, existencia en disco e integridad de la imagen actual
    const isValidImage = service.image ? await isLocalImageValid(service.image) : false;
    const isInitialsSvg = service.image?.endsWith("-initials.svg") ?? false;

    // Procesar si: no existe en el JSON, no existe en el disco, está corrupta, o es un SVG de iniciales previo
    if (isValidImage && !isInitialsSvg) {
      continue;
    }

    let processedSuccessfully = false;

    // Forma 1: Intentar descargar desde imageUrlOriginal si está disponible
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
      } catch (e) {
        // Falló la descarga -> pasa al fallback SVG
      }
    }

    // Forma 2 (Fallback): Generar SVG con iniciales
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

  // Guardar la configuración actualizada si hubo cambios
  if (regenerated > 0) {
    try {
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "No se pudo actualizar data/config.json" }),
        { status: 500 }
      );
    }
  }

  // Limpieza de archivos huérfanos en public/assets
  const cleaned = await cleanupOrphanedImages(config.services);

  return new Response(
    JSON.stringify({ success: true, regenerated, cleaned, failed }),
    { status: 200 }
  );
};