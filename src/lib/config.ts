import fs from "fs/promises";
import { CONFIG_PATH } from "./contants.ts";
import type { Config } from "../types/hub.ts";


// Helper centralizado para leer la configuración
export const getConfig = async (): Promise<{ config: Config; configPath: string }> => {
  let config: Config = { maxPerPage: 10, services: [] };
  try {
    const content = await fs.readFile(CONFIG_PATH, "utf-8");
    config = JSON.parse(content) as Config;
  } catch (e) {
    // Si no existe, se retorna estructura base por defecto
  }
  return { config, configPath: CONFIG_PATH };
};

// Helper centralizado para guardar la configuración
export const saveConfig = async (config: Config): Promise<void> => {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
};