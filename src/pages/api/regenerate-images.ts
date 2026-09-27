import fs from "fs/promises";
import path from "path";
import type { Config } from "../../types/hub";
import { generateInitialsSVG } from "../../lib/avatar";

/**
 * POST /api/regenerate-images
 * ------------------------------------------------------------------
 * Regenera en el sitio (mismo nombre de archivo, misma ruta en
 * config.json) todos los avatares que fueron auto-generados como
 * iniciales (archivos que terminan en "-initials.svg"). No toca
 * imágenes reales subidas o descargadas desde una URL.
 *
 * Sirve para corregir en un solo paso avatares antiguos generados
 * antes de un cambio en la plantilla del SVG (p. ej. el fix del
 * recorte con esquinas transparentes), sin tener que editar servicio
 * por servicio.
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
    if (!service.image || !service.image.endsWith("-initials.svg")) {
      continue; // No es un avatar auto-generado: se deja intacto.
    }

    try {
      const svgContent = generateInitialsSVG(service.name);
      const filename = path.basename(service.image);
      const filepath = path.join(process.cwd(), "public/assets", filename);
      await fs.writeFile(filepath, svgContent, "utf-8");
      regenerated++;
    } catch (e) {
      failed.push(service.name);
    }
  }

  return new Response(
    JSON.stringify({ success: true, regenerated, failed }),
    { status: 200 }
  );
};
