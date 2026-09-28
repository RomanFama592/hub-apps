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