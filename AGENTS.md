# AGENTS.md

Guía técnica para cualquier agente de IA (Claude Code, Cursor, Aider, Copilot Workspace, etc.) que trabaje en este repositorio. Léelo completo antes de tocar código: varias decisiones de diseño no son obvias mirando un solo archivo.

## Qué es este proyecto

**Local Hub** — un dashboard/hub personal de servicios (estilo Homepage/Homarr/Heimdall) con estética *Bento Box* + *Glassmorphism*. Cada servicio (Pi-hole, WireGuard, etc.) es una tarjeta en un grid tipo bento que se abre en una pestaña nueva. No hay base de datos: todo vive en un JSON plano y las imágenes en disco.

- **Framework:** Astro 7, `output: 'server'` (SSR real, no estático) con adaptador `@astrojs/node` en modo `standalone`.
- **Sin framework de UI en cliente.** Todo es `.astro` + `<script>` vanilla con `document.querySelector`. No introduzcas React/Vue/Svelte sin que te lo pidan explícitamente.
- **Persistencia:** `data/config.json` (leído/escrito con `fs/promises` directamente desde las rutas de API). No hay ORM ni SQL.
- **Imágenes:** se guardan como archivos físicos en `public/assets/`, referenciadas por ruta relativa (`/assets/xxx.svg`) desde `config.json`.
- **Tanto `data/config.json` como `public/assets/` están en `.gitignore`** — son datos de runtime del usuario, no del repositorio. Un clone fresco no los trae; `src/pages/index.astro` maneja la ausencia de `config.json` con un try/catch y un estado por defecto (`{ maxPerPage: 10, services: [] }`).

## Comandos

```bash
pnpm install          # instalar dependencias (usa pnpm, no npm/yarn — ver packageManager/lockfile)
pnpm dev              # servidor de desarrollo (astro dev)
pnpm build            # build de producción (astro build) -> dist/
pnpm preview          # sirve el build de dist/ localmente
```

No hay scripts de `lint` ni `test` definidos en `package.json`. Si agregás tooling de lint/test, actualizá esta guía y el README.

Node requerido: **>= 22.12.0** (ver `engines` en `package.json`).

## Arquitectura del Bento Grid (la parte más delicada del repo)

Esta sección documenta un refactor específico — leela antes de tocar cualquier cosa relacionada al grid, layout o tarjetas.

### Objetivo de diseño (no negociable salvo que el usuario lo pida)

1. **Cero scroll vertical, siempre.** El viewport está bloqueado a `100dvh` (con fallback `100vh`) en cascada: `html,body` (`Layout.astro`) → `.slider` → `.page` (`index.astro`) → `.bento-grid` (`BentoGrid.astro`). Si tocás cualquiera de estos niveles, verificá que la cadena de `height: 100%` / `overflow: hidden` siga intacta.
2. **`overflow: hidden` va en `.slider`, `.page` y `html,body` — NO en `.bento-grid`.** Ya hubo un bug real por esto: poner `overflow: hidden` en `.bento-grid` (parecía una capa extra de seguridad razonable) recortaba el efecto `hover` (`translateY(-4px) scale(1.01)`) de las tarjetas en los bordes del grid, generando un "corte" visible. El grid en sí nunca puede desbordar porque sus filas están en `1fr` (siempre reparten el 100% de la altura disponible), así que ese `overflow:hidden` era redundante y solo rompía el hover. No lo reintroduzcas.
3. **El layout de las tarjetas es procedural, no manual ni con `grid-auto-flow: dense`.** `src/lib/bentoLayout.ts` particiona recursivamente un rectángulo (técnica *guillotine cut* / treemap) en exactamente N piezas, garantizando matemáticamente cero huecos (cada corte reemplaza 1 rectángulo por 2 que ocupan la misma área). Los bloques finales están acotados a 4 tipos: 1×1, 2×1, 1×2, 2×2 — no agregues tamaños mayores sin ajustar todo el algoritmo de "peel" de leaves sobredimensionados.
4. **Hay un layout independiente para desktop y para mobile** (`generateBentoLayout` se llama dos veces en `BentoGrid.astro`, una por breakpoint), calculado en servidor en cada request (SSR), no en cliente. El cambio de uno a otro es puramente CSS (`@media (max-width: 768px)` sobrescribe las custom properties `--dcs/--dce/--drs/--dre` por `--mcs/--mce/--mrs/--mre` en `BentoCard.astro`). **No reintroduzcas randomización en cliente** (hubo una versión vieja que usaba `sessionStorage` + `Math.random()` en un `<script>` de `index.astro` — fue eliminada a propósito porque causaba desajustes SSR/cliente y perdía la estética bento en mobile).
5. **Escalado interno fluido vía Container Queries**, no clases de tamaño. `.bento-block` usa `container-type: size` y el contenido interno usa `clamp(min, Ncqw/cqb, max)`. Esto requiere que el contenedor tenga un tamaño resuelto por el grid (heredado de las filas `1fr`) — si cambiás `BentoCard.astro` para que ya no sea un hijo directo de un grid con tamaño explícito, el container query deja de funcionar y hay que revisar toda la cadena.

### Archivos involucrados y su responsabilidad

| Archivo | Responsabilidad |
|---|---|
| `src/lib/bentoLayout.ts` | Algoritmo puro (sin dependencias de Astro/DOM) que genera las coordenadas `{x,y,w,h}` de cada tarjeta. Testeable de forma aislada. |
| `src/lib/avatar.ts` | Generación del SVG de iniciales (avatar por defecto). **El `<rect>` de fondo NO debe llevar `rx` (esquinas redondeadas)** — ver "Bugs ya corregidos" abajo. |
| `src/components/BentoGrid.astro` | Orquesta: decide columnas (4-6 desktop / 3 mobile), llama al algoritmo dos veces (seeds distintas para desktop/mobile), expone `--cols-*`/`--rows-*` como CSS vars en el contenedor. |
| `src/components/BentoCard.astro` | Recibe las coordenadas ya calculadas, las aplica como `grid-column`/`grid-row` (con el switch por `@media`), y contiene todo el CSS de fluid scaling + la lógica del menú de 3 puntos (editar/eliminar). |
| `src/pages/index.astro` | Paginación horizontal (`chunkArray` por `maxPerPage`), viewport lock, y el script de *ping* de estado (sin lógica de layout — eso vive 100% en los dos archivos de arriba). |
| `src/layouts/Layout.astro` | Variables CSS de tema (claro/oscuro automático vía `prefers-color-scheme`) y el bloqueo de `html,body` a `100dvh`. |

### Bugs ya corregidos (no los reintroduzcas)

- **Recorte del hover:** `overflow: hidden` en `.bento-grid` — eliminado, ver punto 2 arriba.
- **Avatares con "esquina rota":** el SVG de iniciales generaba `<rect rx="100">` sobre un canvas de 512×512. Con `object-fit: cover` en tarjetas de distinta relación de aspecto (especialmente cuadradas), las 4 esquinas transparentes del `rect` redondeado quedaban visibles dentro de la tarjeta, pareciendo una imagen rota/mal cargada. Corregido en `src/lib/avatar.ts` usando un `<rect>` sin `rx` (sólido completo) — el redondeo visual ya lo aporta `.bento-block` (que tiene su propio `border-radius` + `overflow: hidden`).
- **Randomización de layout duplicada:** existía tanto en servidor (implícita) como en un `<script>` cliente con `sessionStorage`. Se eliminó la parte de cliente; el layout es 100% SSR ahora.

## API routes (`src/pages/api/`)

Todas son *file-based routing* de Astro (`export const POST/PUT/DELETE = ...`).

- **`services.ts`** (TS): `POST` crea, `PUT` edita, `DELETE` borra un servicio en `data/config.json`. Al crear/editar sin imagen propia, descarga la URL dada o genera un avatar de iniciales vía `src/lib/avatar.ts`. Al borrar, intenta eliminar el archivo físico en `public/assets/` si la imagen vivía ahí.
- **`regenerate-images.ts`** (TS): `POST` — regenera **en el mismo archivo** (mismo nombre, mismo path en `config.json`) todos los avatares cuyo `image` termine en `-initials.svg`. No toca imágenes reales subidas/descargadas. Se agregó específicamente para poder corregir en masa avatares generados antes del fix de `rx`.
- **`ping.js`** (JS, no TS): `POST` — hace un `HEAD` request con timeout de 3s a la URL de un servicio para el punto de estado (verde/rojo) de cada tarjeta.
- **`search.js`** (JS, no TS): `POST` — busca un ícono para un nombre de servicio: primero contra el repo `walkxcode/dashboard-icons` en GitHub, luego con un scraper de Bing Images, y como último fallback usa `ui-avatars.com`.

⚠️ **`ping.js` y `search.js` importan `node-fetch`, pero `node-fetch` NO está declarado en las `dependencies` de `package.json`.** Con Node ≥ 18 existe `fetch` global, así que lo más probable es que funcione igual porque algo en el árbol de dependencias lo resuelve o porque nunca se limpió tras migrar a fetch nativo — pero es una inconsistencia real del repo. Si tocás estos archivos y ves errores de módulo no encontrado, la solución más simple es reemplazar `import fetch from 'node-fetch'` por el `fetch` global (no hace falta importar nada) en vez de agregar la dependencia.

## Estructura de datos (`src/types/hub.ts`)

```ts
interface Service {
  id: string;          // Date.now().toString(), no UUID
  name: string;
  description?: string;
  url: string;
  image?: string;       // ruta relativa, ej "/assets/xxxx.svg"
}

interface Config {
  maxPerPage: number;    // cuántos servicios por "página" horizontal
  services: Service[];
}
```

`maxPerPage` controla la paginación horizontal (scroll-snap por `.page`) en `index.astro` — no tiene relación con las columnas del grid (eso lo decide `BentoGrid.astro` dinámicamente según `services.length` de cada página).

## Convenciones a respetar

- **Terminadores de línea:** varios archivos del repo (especialmente los que ya existían antes del refactor del bento grid: `services.ts`, `hub.ts`, `AddServiceModal.astro`) usan **CRLF**. Los archivos nuevos que agregué (`bentoLayout.ts`, `avatar.ts`, `regenerate-images.ts`, `BentoGrid.astro`) están en LF. No es crítico, pero si editás un archivo CRLF con una herramienta que normaliza a LF, vas a generar un diff gigante de solo whitespace — evitalo si podés.
- **TypeScript strict** (`astro/tsconfigs/strict`). Los `.astro` con frontmatter TS y los `.ts` deben tipar explícitamente; los dos endpoints en JS puro (`ping.js`, `search.js`) quedaron así del proyecto original, no los migres a TS a menos que te lo pidan.
- **No agregues framework de UI en cliente** (React/Vue/etc.) sin pedido explícito — el proyecto es intencionalmente vanilla + Astro islands.
- **No self-host CDNs no gratuitos.** El proyecto es para self-hosting personal (ver Docker); evitá dependencias que requieran API keys pagas salvo que el usuario las pida.

## Docker

`Dockerfile` es multi-stage (pnpm + Node 22-alpine build, Node 20-alpine runtime — sí, versiones distintas entre build y runtime, es intencional/preexistente, no lo "corrijas" sin preguntar). `dockercompose.yml` monta:

```yaml
volumes:
  - ./config:/app/data          # carpeta local "config/" -> /app/data (contiene config.json)
  - ./assets:/app/public/assets # carpeta local "assets/" -> imágenes servidas
```

Nota el nombre distinto entre la carpeta local (`./config`) y la interna (`/app/data`) — es así en el compose original, documentalo si alguna vez lo tocás para que no genere confusión.
