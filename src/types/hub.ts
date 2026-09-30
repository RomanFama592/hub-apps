export interface Service {
  id: string;
  name: string;
  description?: string;
  url: string;
  image?: string;
  imageUrlOriginal?: string | null;
}

export interface Config {
  maxPerPage: number;
  services: Service[];
}

export interface BentoLayoutItem {
  colSpan: number;
  rowSpan: number;
}

export interface SearchImageResponse {
  images: string[];
}

export interface PingResponse {
  active: boolean;
}

export interface BentoLeaf {
  x: number; // columna inicial (0-index)
  y: number; // fila inicial (0-index)
  w: number; // ancho en celdas (1 o 2)
  h: number; // alto en celdas (1 o 2)
}

export interface BentoLayoutResult {
  leaves: BentoLeaf[];
  cols: number;
  rows: number;
}

export interface MutableLeaf extends BentoLeaf {}