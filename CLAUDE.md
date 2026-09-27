# CLAUDE.md

Guía técnica de este repo: **[AGENTS.md](./AGENTS.md)**.

Todo lo que necesitás saber sobre arquitectura, comandos, el algoritmo del Bento Grid, las API routes, la estructura de datos y las convenciones del proyecto vive ahí. Se mantiene un solo archivo canónico a propósito para no tener que sincronizar dos documentos cada vez que algo cambia — leé `AGENTS.md` completo antes de tocar código, especialmente si vas a trabajar en `src/lib/bentoLayout.ts`, `src/components/BentoGrid.astro` o `src/components/BentoCard.astro` (esa parte tiene varios bugs ya corregidos que documenta explícitamente para que no se reintroduzcan).

## Notas específicas para Claude Code en este repo

- **No hay red disponible por defecto en algunos entornos sandbox.** Si `pnpm install` falla por falta de red, avisá al usuario en vez de asumir que el código está roto — no hay forma de correr `astro build`/`astro check` sin dependencias instaladas.
- **Antes de tocar `BentoGrid.astro`, `BentoCard.astro` o `bentoLayout.ts`**, releé la sección "Arquitectura del Bento Grid" de `AGENTS.md`: el diseño (cero scroll, 4 tipos de bloque, layout separado desktop/mobile, container queries) es intencional y varias decisiones que parecen "simplificables" en realidad corrigen bugs visuales concretos que ya se dieron en este proyecto.
- **`data/config.json` y `public/assets/` están gitignoreados.** Si estás en un checkout limpio y no existen, es esperado — no es un bug del repo, el código maneja esa ausencia con un estado por defecto.
- **Preferí ediciones quirúrgicas.** Este es un dashboard personal chico; evitá reescribir archivos completos cuando un `str_replace` puntual alcanza, sobre todo en los `.astro` que mezclan frontmatter, template y estilos scoped.
