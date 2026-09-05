---
name: pilar
description: Skill de orientación para el proyecto LockIn. Invócala cuando quieras retomar el trabajo tras una pausa, o para saber qué hacer a continuación en el MVP. Lee el estado real del repo y de los TODO, resume dónde está el proyecto, decide qué bloque(s) tocan ahora según las dependencias de docs/plan/PLAN.md, y genera las órdenes exactas (prompts cortos) para pegar en las siguientes sesiones/agentes que haya que lanzar.
---

# Pilar — orientación del proyecto LockIn

Cuando te invoquen con esta skill, sigue estos pasos en orden y responde en español, de forma concisa — esto es para saber qué hacer ahora, no para releer todo el histórico.

## 1. Reconstruye el estado real

- Lee `docs/plan/PLAN.md` y `docs/plan/TODO.md`.
- Revisa `docs/plan/todo/*.md` y cuenta cuántas casillas están marcadas por bloque.
- Cruza esto con el estado real del repo: `git log --oneline -20`, `git status`, y comprueba si los archivos que cada bloque dice que entrega (sección "Alcance de archivos" de `PLAN.md`) existen de verdad y no son solo el placeholder del scaffold de Expo. Una casilla marcada que no se corresponde con código real es una señal de alerta — dilo.
- Si hay ramas locales o remotas de trabajo de algún bloque (`git branch -a`), comprueba si están fusionadas o pendientes.

## 2. Resume el estado en 4-6 líneas

Qué bloques están terminados, cuál está a medias (y en qué punto exacto), y cuáles no han empezado. No repitas todo el plan, solo lo que ha cambiado desde la última vez.

## 3. Decide qué toca ahora

Aplica las dependencias de `docs/plan/PLAN.md`: `arquitecto` bloquea al resto; `perfil`, `descubrir` y `chat` pueden ir en paralelo una vez `arquitecto` está listo; `datos` necesita credenciales de Supabase para su parte de integración (sin ellas, solo el esquema); `calidad` va incremental. Nunca recomiendes lanzar dos bloques que toquen los mismos archivos a la vez sin avisar del riesgo de conflicto.

## 4. Genera las órdenes para lanzar

Para cada bloque que se pueda lanzar ya, escribe un bloque de texto listo para copiar y pegar en una sesión nueva de Claude Code sobre este mismo repositorio/rama, con este formato:

```
Actúa como el agente `<nombre>` definido en .claude/agents/<nombre>.md.
Contexto: <1-2 frases del estado actual específico de este bloque, ej. "arquitecto ya dejó src/data/repository.ts y el shell de tabs; falta el formulario de perfil.">
Continúa docs/plan/todo/<nombre>.md desde donde está y marca las casillas según avances.
```

Ajusta el "Contexto" a lo que de verdad encontraste en el paso 1 — no lo dejes genérico ni copiado de una vez anterior.

## 5. Si algo no cuadra, dilo primero

Si detectas que un bloque se saltó su alcance de archivos (tocó algo de otro bloque), que hay conflictos de merge pendientes, o que `datos` no puede avanzar por falta de credenciales, dilo antes de proponer las órdenes — es más útil que una lista de tareas ciega al problema real.

## Notas

Esta skill es de solo lectura + orientación, no escribe código ni marca el TODO por sí misma. Si el usuario pide seguir trabajando ya mismo en el bloque que toca, en vez de generar una orden para otra sesión, hazlo tú directamente aquí (las órdenes son para cuando el usuario quiere paralelizar en sesiones separadas).
