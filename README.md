# Local Hub — Bento Dashboard

Un dashboard/hub personal de servicios (al estilo Homepage, Homarr o Heimdall) con estética **Bento Box** + **Glassmorphism**. Cada servicio de tu red (Pi-hole, WireGuard, tu NAS, lo que sea) es una tarjeta en una cuadrícula tipo bento, generada de forma **procedural** en cada carga para que nunca se sienta un diseño repetitivo, sin scroll vertical y adaptada a móvil o escritorio.

![status](https://img.shields.io/badge/estado-uso%20personal-blue)

## ✨ Características

- **Grid Bento procedural** — cada tarjeta ocupa un bloque de 1×1, 2×1, 1×2 o 2×2 celdas, calculado en servidor con un algoritmo de particionado recursivo que garantiza cero huecos en la cuadrícula.
- **Cero scroll vertical** — el dashboard ocupa exactamente el 100% de la pantalla (`100dvh`), en escritorio y en móvil.
- **Layouts independientes para desktop y mobile** — no es el mismo grid encogido: en móvil usa 3 columnas con bloques asimétricos, en escritorio 4 a 6 columnas según cuántos servicios tengas.
- **Escalado interno fluido** — tipografías, paddings e íconos de cada tarjeta se ajustan automáticamente según el tamaño real del bloque que le tocó (vía CSS Container Queries), sin romperse ni desbordar.
- **Paginación horizontal** — si tenés más servicios que los que caben en una página (`maxPerPage`), se navegan con swipe/scroll horizontal, cada página con su propio bento grid completo.
- **Glassmorphism + tema claro/oscuro automático** según las preferencias del sistema.
- **Alta/edición/borrado de servicios** desde la UI, sin reiniciar el servidor.
- **Búsqueda automática de íconos** al agregar un servicio (repositorio de dashboard-icons, luego Bing Images, con fallback a un avatar de iniciales).
- **Chequeo de estado en vivo** (punto verde/rojo) por servicio.
- **Regeneración de avatares** — un botón para regenerar en bloque todos los avatares de iniciales auto-generados (útil si actualizás la plantilla del avatar y querés que tus servicios viejos también la usen).

## 🧱 Stack técnico

- [Astro](https://astro.build) 7, en modo `output: 'server'` (SSR real) con el adaptador [`@astrojs/node`](https://docs.astro.build/en/guides/integrations-guide/node/).
- TypeScript (estricto) para el frontmatter de los componentes y las API routes.
- Sin framework de UI en cliente — HTML/CSS/JS vanilla dentro de cada `.astro`.
- Persistencia en un archivo JSON plano (`data/config.json`), sin base de datos.
- Imágenes servidas como archivos estáticos en `public/assets/`.

## 🚀 Empezar

### Requisitos

- Node.js **≥ 22.12.0**
- [pnpm](https://pnpm.io/) (el repo usa `pnpm-lock.yaml`; no mezcles con `npm`/`yarn`)

### Instalación

```bash
pnpm install
pnpm dev
```

Abrí `http://localhost:4321`.

### Otros comandos

```bash
pnpm build     # build de producción -> dist/
pnpm preview   # sirve el build localmente
```

## ⚙️ Configuración

Los datos viven en `data/config.json` (se crea vacío automáticamente si no existe):

```json
{
  "maxPerPage": 10,
  "services": [
    {
      "id": "1790537197012",
      "name": "WireGuard",
      "description": "",
      "url": "http://localhost:4321/",
      "image": "/assets/1790537196971-wireguard-initials.svg"
    }
  ]
}
```

- **`maxPerPage`** — cuántos servicios se muestran por "página" horizontal antes de pasar a la siguiente (swipe/scroll horizontal). No afecta cuántas columnas tiene el grid; eso se calcula solo según cuántos servicios entran en cada página.
- **`services`** — se administra normalmente desde la UI (botón **+**), no hace falta editar el JSON a mano salvo para migraciones o backups.

> `data/config.json` y `public/assets/` están en `.gitignore` — son tus datos personales, no se versionan.

## 🐳 Docker

```bash
docker compose up -d --build
```

El `docker-compose.yml` incluido monta dos carpetas locales para persistencia:

```yaml
volumes:
  - ./config:/app/data          # tu config.json vive en ./config/config.json en el host
  - ./assets:/app/public/assets # tus imágenes viven en ./assets/ en el host
```

Creá esas carpetas (`config/` y `assets/`) junto al `docker-compose.yml` antes del primer arranque si querés persistencia entre reconstrucciones del contenedor.

La app queda expuesta en el puerto **4321**.

## 📁 Estructura del proyecto

```
src/
├── components/
│   ├── BentoGrid.astro        # orquesta el layout procedural (desktop + mobile)
│   ├── BentoCard.astro        # tarjeta individual: posición en grid + escalado fluido + menú de opciones
│   └── AddServiceModal.astro  # modal de alta/edición + botón de regenerar avatares
├── layouts/
│   └── Layout.astro           # tema claro/oscuro + viewport lock (100dvh)
├── lib/
│   ├── bentoLayout.ts         # algoritmo de particionado procedural del grid
│   └── avatar.ts              # generación del SVG de avatar por iniciales
├── pages/
│   ├── index.astro            # página principal: carga config.json, pagina, renderiza BentoGrid
│   └── api/
│       ├── services.ts        # CRUD de servicios
│       ├── regenerate-images.ts  # regenera en bloque los avatares auto-generados
│       ├── ping.js            # chequeo de estado (HEAD request) por servicio
│       └── search.js          # búsqueda de íconos para el modal de alta
└── types/
    └── hub.ts                 # tipos compartidos (Service, Config, BentoLeaf, etc.)
data/
└── config.json                # tus datos (gitignored)
public/
└── assets/                    # tus imágenes/avatares (gitignored)
```

Para el detalle de decisiones de diseño (por qué el grid es procedural, por qué el `overflow` va donde va, bugs ya corregidos que no hay que reintroducir, etc.), ver [`AGENTS.md`](./AGENTS.md) — pensado para quien vaya a modificar el código, humano o agente de IA.

## ⚠️ Limitaciones conocidas

- La búsqueda de íconos (`api/search.js`) depende de scrapear Bing Images, lo cual es inherentemente frágil (puede dejar de funcionar si Bing cambia su HTML). El repositorio de [dashboard-icons](https://github.com/walkxcode/dashboard-icons) y el avatar de iniciales sirven de respaldo.
- `ping.js` y `search.js` importan `node-fetch`, que no está declarado como dependencia en `package.json`. Si ves un error de módulo no encontrado en esos endpoints, es la causa más probable.
- No hay autenticación: pensado para uso en una red local/privada, no para exponerlo a internet sin una capa adicional (reverse proxy con auth, VPN, etc.).

## 📄 Licencia

No especificada — proyecto de uso personal.
