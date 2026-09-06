# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Antes de tocar código de producto

Este repo es LockIn. Lee `docs/plan/CONCEPTO.md` (qué es el producto) y `docs/plan/PLAN.md` (cómo se reparte el trabajo en bloques) antes de escribir nada. El estado de cada bloque vive en `docs/plan/TODO.md` y `docs/plan/todo/<bloque>.md` — actualízalo según avances.

Este archivo lo lee cualquier agente de código que siga la convención AGENTS.md (Codex incluido), no solo Claude Code — es la fuente de verdad compartida entre herramientas. Lo que sí es específico de Claude Code son `.claude/agents/*.md` (subagentes) y la skill `pilar`; si trabajas con otra herramienta, dale directamente el archivo de bloque correspondiente (p. ej. `.claude/agents/calidad.md` + `docs/plan/todo/calidad.md`) como instrucción explícita.
