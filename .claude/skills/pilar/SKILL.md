---
name: pilar
description: Skill de orientación para el proyecto LockIn. Invócala cuando quieras retomar el trabajo tras una pausa, o para saber qué hacer a continuación en el MVP. Lee el estado real del repo y de los TODO, resume dónde está el proyecto, decide qué bloque(s) tocan ahora según las dependencias de docs/plan/PLAN.md, y genera las órdenes exactas (prompts cortos) para pegar en las siguientes sesiones. Si hay tareas etiquetadas `[Codex]` junto a tareas `[Claude]`, genera una orden para cada herramienta (formato subagente para Claude Code, instrucción explícita autocontenida para Codex).
---

# Pilar — orientación del proyecto LockIn

Cuando te invoquen con esta skill, sigue estos pasos en orden y responde en español, de forma concisa — esto es para saber qué hacer ahora, no para releer todo el histórico.

## 1. Reconstruye el estado real

- Lee `docs/plan/PLAN.md` y `docs/plan/TODO.md`.
- Revisa `docs/plan/todo/*.md` y cuenta cuántas casillas están marcadas por bloque. Para cada casilla sin marcar, mira si lleva etiqueta de herramienta al principio del texto: `[Codex]`, `[Claude]`, o ninguna (bloqueada o sin decidir todavía — ver "Criterio de reparto de tareas" en `PLAN.md`).
- Una casilla sin marcar no siempre es trabajo pendiente: puede estar hecha y sin registrar. Antes de proponerla, comprueba si la evidencia que pide ya existe (un run verde, un archivo, un test). Y al revés — una casilla marcada sin código detrás es la señal de alerta más cara del tablero.
- Cruza esto con el estado real del repo: `git log --oneline -20`, `git status`, y comprueba si los archivos que cada bloque dice que entrega (sección "Alcance de archivos" de `PLAN.md`) existen de verdad y no son solo el placeholder del scaffold de Expo. Una casilla marcada que no se corresponde con código real es una señal de alerta — dilo.
- Si hay ramas locales o remotas de trabajo de algún bloque (`git branch -a`), comprueba si están fusionadas o pendientes.

## 2. Resume el estado en 4-6 líneas

Qué bloques están terminados, cuál está a medias (y en qué punto exacto), y cuáles no han empezado. Si hay tareas abiertas con etiqueta `[Codex]` o `[Claude]`, dilo aquí explícitamente (por ejemplo: "quedan 3 tareas [Codex] en calidad y 2 [Claude] en arquitecto"). No repitas todo el plan, solo lo que ha cambiado desde la última vez.

## 3. Decide qué toca ahora

Aplica las dependencias de `docs/plan/PLAN.md`: `arquitecto` bloquea al resto; `perfil`, `descubrir` y `chat` pueden ir en paralelo una vez `arquitecto` está listo; `datos` necesita credenciales de Supabase para su parte de integración (sin ellas, solo el esquema); `calidad` va incremental. Nunca recomiendes lanzar dos bloques que toquen los mismos archivos a la vez sin avisar del riesgo de conflicto.

## 4. Genera las órdenes para lanzar

Separa lo que toca lanzar según la etiqueta de cada tarea: `[Claude]` —o sin etiquetar porque cruza bloques— va al paso 4a; `[Codex]`, al 4b. Si hay de las dos listas a la vez, dilo, y recuerda el aviso de `git worktree` de `PLAN.md` si el usuario va a correr ambas herramientas en paralelo en la misma máquina.

### 4a. Para Claude Code

Para cada bloque o tarea `[Claude]` que se pueda lanzar ya, escribe un bloque de texto listo para copiar y pegar en una sesión nueva de Claude Code sobre este mismo repositorio/rama:

```
Actúa como el agente `<nombre>` definido en .claude/agents/<nombre>.md.
Contexto: <1-2 frases del estado actual específico de este bloque, ej. "arquitecto ya dejó src/data/repository.ts y el shell de tabs; falta el formulario de perfil.">
Continúa docs/plan/todo/<nombre>.md desde donde está y marca las casillas según avances.
```

Ajusta el "Contexto" a lo que de verdad encontraste en el paso 1 — no lo dejes genérico ni copiado de una vez anterior.

### 4b. Para Codex

Para cada tarea `[Codex]` que se pueda lanzar ya, escribe una instrucción completa y autocontenida. Codex no tiene subagentes ni `/pilar`, así que no puede rellenar huecos leyendo `.claude/agents/`: **nunca uses con él el formato "actúa como el agente X"**. Usa este:

```
Contexto del producto: LockIn es una app de swipe para encontrar cofundador o
compañero de lock-in. Lee docs/plan/CONCEPTO.md antes de nada si no lo tienes ya
en contexto.

Tarea: <descripción concreta, adaptada de docs/plan/todo/<bloque>.md>

Alcance de archivos — toca solo esto: <lista explícita de archivos o carpetas>.
Si para completar la tarea necesitas tocar algo fuera de esta lista, para y dilo
en vez de improvisar.

Hazlo así: <pasos concretos y verificables — qué comando correr, qué patrón seguir
de qué archivo existente, cuál es el criterio de "terminado">

Cuando termines: marca la casilla en docs/plan/todo/<bloque>.md (quitando su
etiqueta [Codex]) y anota brevemente qué hiciste, igual que las demás entradas.
```

Rellena "Hazlo así" con el detalle real que encontraste en el paso 1 — qué archivos existen ya como referencia, qué patrón siguen los tests o el código vecino. Una instrucción vaga es el error más caro con Codex, porque no hay enrutado automático que la reinterprete.

## 5. Si algo no cuadra, dilo primero

Si detectas que un bloque se saltó su alcance de archivos (tocó algo de otro bloque), que hay conflictos de merge pendientes, que `datos` no puede avanzar por falta de credenciales, o que una tarea abierta no está bloqueada pero tampoco tiene etiqueta de herramienta (hay que decidir `[Codex]`/`[Claude]` antes de lanzarla), dilo antes de proponer las órdenes — es más útil que una lista de tareas ciega al problema real.

Lo mismo con las ramas del paso 1. Antes de dar una por superada, compruébalo con `git cherry -v HEAD <rama>` en vez de por el título del commit; y antes de proponer borrar nada, mira si su worktree tiene trabajo sin commitear (`git -C <worktree> status --short`), que es lo que un `git branch --merged` no te va a decir.

## Notas

Esta skill es de solo lectura + orientación, no escribe código ni marca el TODO por sí misma. Si el usuario pide seguir trabajando ya mismo en el bloque que toca, en vez de generar una orden para otra sesión, hazlo tú directamente aquí (las órdenes son para cuando el usuario quiere paralelizar en sesiones separadas).
