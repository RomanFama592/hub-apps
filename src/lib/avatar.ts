/**
 * avatar.ts
 * ------------------------------------------------------------------
 * Generación de avatares de iniciales (fallback cuando un servicio no
 * tiene imagen propia). Vive en un módulo compartido para que tanto
 * la creación/edición de servicios como la regeneración masiva usen
 * exactamente la misma lógica.
 */

const GRADIENTS = [
  { start: "#3b82f6", end: "#1d4ed8" },
  { start: "#6366f1", end: "#4338ca" },
  { start: "#8b5cf6", end: "#6d28d9" },
  { start: "#06b6d4", end: "#0e7490" },
  { start: "#10b981", end: "#047857" },
  { start: "#f59e0b", end: "#b45309" },
  { start: "#64748b", end: "#334155" }
];

/** Extrae las iniciales del nombre (hasta 2 letras). */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Genera un SVG dinámico con las iniciales y gradiente.
 *
 * IMPORTANTE: el rectángulo de fondo NO lleva esquinas redondeadas
 * (rx). Las tarjetas del Bento Grid tienen relaciones de aspecto
 * variables (1x1, 2x1, 1x2, 2x2) y esta imagen se muestra con
 * `object-fit: cover`, así que un `rx` grande dejaba las 4 esquinas
 * del propio SVG transparentes — y en tarjetas cuadradas esas
 * esquinas transparentes quedaban visibles, pareciendo una imagen
 * rota. El redondeo visual ya lo aporta la tarjeta contenedora
 * (`.bento-block`, que tiene su propio border-radius + overflow:
 * hidden), así que aquí el fondo debe ser un rectángulo sólido
 * completo, sin transparencia.
 */
export function generateInitialsSVG(name: string): string {
  const initials = getInitials(name);

  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = GRADIENTS[hash % GRADIENTS.length];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color.start}" />
      <stop offset="100%" stop-color="${color.end}" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg-grad)" />
  <text x="50%" y="54%" 
        dominant-baseline="middle" 
        text-anchor="middle" 
        fill="#FFFFFF" 
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="200" 
        font-weight="700" 
        letter-spacing="4">
    ${initials}
  </text>
</svg>`.trim();
}
