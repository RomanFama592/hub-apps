/**
 * bentoLayout.ts
 * ------------------------------------------------------------------
 * Generador procedural de layouts "Bento" mediante particionado
 * recursivo de un rectángulo (técnica tipo treemap / guillotine cut).
 *
 * Por qué esta técnica y no "grid-auto-flow: dense" con spans al azar:
 * dense NO garantiza cero huecos con combinaciones arbitrarias de
 * tamaños. Particionar recursivamente el rectángulo total SÍ lo
 * garantiza matemáticamente: cada corte reemplaza 1 rectángulo por 2
 * que juntos ocupan exactamente el mismo área, así que el rectángulo
 * raíz (todas las columnas x todas las filas) siempre queda 100%
 * cubierto sin importar cuántos cortes se hagan.
 *
 * Reglas de negocio:
 *  - Exactamente N piezas (una por servicio visible).
 *  - Solo 4 tipos de bloque: 1x1 (Pequeño), 2x1 (Ancho), 1x2 (Alto), 2x2 (Grande).
 *  - Resultado 100% determinista dada una seed (para SSR sin hidratación
 *    ni parpadeos), pero la seed combina un hash estable del dataset con
 *    entropía del servidor para que el patrón cambie entre cargas.
 */

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

/** PRNG determinista (mulberry32) — reproducible a partir de un entero semilla. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash simple (djb2) de una cadena a entero de 32 bits — usado sobre id/nombre del servicio. */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Construye una seed combinando el hash estable de los IDs de los
 * servicios (para que el "sabor" del layout tenga relación con el
 * propio dataset) con un componente aleatorio de servidor (para que
 * nunca se sienta igual entre cargas). `salt` permite derivar dos
 * seeds distintas para desktop/mobile a partir del mismo request.
 */
export function buildSeed(ids: string[], salt: number = 0): number {
  const datasetHash = hashString(ids.join("|"));
  const serverEntropy = Math.floor(Math.random() * 0xffffffff);
  return (datasetHash ^ serverEntropy ^ (salt * 0x9e3779b1)) >>> 0;
}

interface MutableLeaf extends BentoLeaf {}

function isOversized(leaf: MutableLeaf): boolean {
  return leaf.w > 2 || leaf.h > 2;
}

function isSplittable(leaf: MutableLeaf): boolean {
  return leaf.w > 1 || leaf.h > 1;
}

/**
 * Divide un leaf "sobredimensionado" (w>2 o h>2) recortando una
 * franja válida de 2 unidades y dejando el resto para seguir
 * reduciéndose en iteraciones siguientes.
 */
function peelOversized(leaf: MutableLeaf, rand: () => number): [MutableLeaf, MutableLeaf] {
  const peelFromStart = rand() > 0.5;

  if (leaf.w > 2) {
    const cut = 2;
    const a: MutableLeaf = peelFromStart
      ? { x: leaf.x, y: leaf.y, w: cut, h: leaf.h }
      : { x: leaf.x + (leaf.w - cut), y: leaf.y, w: cut, h: leaf.h };
    const b: MutableLeaf = peelFromStart
      ? { x: leaf.x + cut, y: leaf.y, w: leaf.w - cut, h: leaf.h }
      : { x: leaf.x, y: leaf.y, w: leaf.w - cut, h: leaf.h };
    return [a, b];
  }

  // h > 2
  const cut = 2;
  const a: MutableLeaf = peelFromStart
    ? { x: leaf.x, y: leaf.y, w: leaf.w, h: cut }
    : { x: leaf.x, y: leaf.y + (leaf.h - cut), w: leaf.w, h: cut };
  const b: MutableLeaf = peelFromStart
    ? { x: leaf.x, y: leaf.y + cut, w: leaf.w, h: leaf.h - cut }
    : { x: leaf.x, y: leaf.y, w: leaf.w, h: leaf.h - cut };
  return [a, b];
}

/**
 * Divide un leaf ya válido (<=2x2) en dos, preservando siempre los
 * 4 tipos permitidos: 2x2 -> dos 1x2 o dos 2x1; 2x1 -> dos 1x1;
 * 1x2 -> dos 1x1.
 */
function splitValid(leaf: MutableLeaf, rand: () => number): [MutableLeaf, MutableLeaf] {
  const canVertical = leaf.w === 2; // partir el ancho por la mitad
  const canHorizontal = leaf.h === 2; // partir el alto por la mitad

  const goVertical = canVertical && canHorizontal ? rand() > 0.5 : canVertical;

  if (goVertical) {
    const half = leaf.w / 2;
    return [
      { x: leaf.x, y: leaf.y, w: half, h: leaf.h },
      { x: leaf.x + half, y: leaf.y, w: half, h: leaf.h }
    ];
  }

  const half = leaf.h / 2;
  return [
    { x: leaf.x, y: leaf.y, w: leaf.w, h: half },
    { x: leaf.x, y: leaf.y + half, w: leaf.w, h: half }
  ];
}

/**
 * Genera exactamente `n` piezas que particionan por completo un
 * rectángulo de `cols` columnas. Las filas se calculan automáticamente
 * para dar suficiente "aire" a bloques grandes sin sobredimensionar.
 */
export function generateBentoLayout(n: number, cols: number, seed: number): BentoLayoutResult {
  const safeCols = Math.max(1, cols);

  if (n <= 0) {
    return { leaves: [], cols: safeCols, rows: 1 };
  }

  if (n === 1) {
    // Única tarjeta: ocupa todo el lienzo, no hay vecinos con quién
    // mantener el equilibrio de tipos.
    return { leaves: [{ x: 0, y: 0, w: safeCols, h: 1 }], cols: safeCols, rows: 1 };
  }

  const rand = mulberry32(seed);

  // Área objetivo: tamaño medio de bloque ~1.75 celdas (entre 1 y 4),
  // suficiente para que existan piezas grandes sin dejar el grid
  // gigantesco en pantallas con pocos elementos.
  const rows = Math.max(1, Math.round((n * 1.75) / safeCols));

  let leaves: MutableLeaf[] = [{ x: 0, y: 0, w: safeCols, h: rows }];

  // n-1 cortes siempre producen exactamente n piezas (invariante de
  // un árbol binario: hojas = cortes + 1).
  for (let i = 0; i < n - 1; i++) {
    const oversized = leaves.filter(isOversized);
    const pool = oversized.length > 0 ? oversized : leaves.filter(isSplittable);

    if (pool.length === 0) break; // no debería ocurrir: area >= n por construcción

    const target = pool[Math.floor(rand() * pool.length)];
    const idx = leaves.indexOf(target);

    const [a, b] = isOversized(target) ? peelOversized(target, rand) : splitValid(target, rand);

    leaves.splice(idx, 1, a, b);
  }

  return { leaves, cols: safeCols, rows };
}

/** Convierte un layout de N piezas + N servicios en pares alineados por índice. */
export function zipLayout<T>(items: T[], layout: BentoLayoutResult): Array<{ item: T; leaf: BentoLeaf }> {
  return items.map((item, i) => ({ item, leaf: layout.leaves[i] ?? { x: 0, y: 0, w: 1, h: 1 } }));
}
