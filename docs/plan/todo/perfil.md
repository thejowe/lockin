# TODO — perfil

## Onboarding
- [x] Pantalla de selección de modo (Par / Lock-In / ambos)
- [x] Guardar el modo elegido (a través de la capa de datos de `arquitecto`)

## Formulario de perfil
- [x] Campos: nombre, edad, ubicación/zona horaria
- [x] Especialidades (selección múltiple de tags)
- [x] Qué busco (Cofundador / Compañero de lock-in / Ambos)
- [x] Qué debe dominar quien busco (mismos tags; solo en Cofundador / Ambos)
- [x] Punto de partida (las 3 opciones de `docs/plan/CONCEPTO.md`)
- [x] Disponibilidad (horas/semana + franja horaria)
- [x] Ambición/compromiso (escala o selección)
- [x] Enlaces opcionales (GitHub / portfolio / LinkedIn)
- [x] 1-2 prompts de texto libre corto
- [x] Validación básica (campos obligatorios mínimos)

## Perfil propio
- [x] Pantalla de ver/editar perfil en la tab Perfil
- [x] Reutilizar el formulario de creación para la edición
- [x] Distinguir de un vistazo "lo que domina" de "lo que busca" en la ficha

## Datos de ejemplo
- [x] Al menos 6-8 perfiles mock variados (distintos modos, especialidades, puntos de partida) para que `descubrir` tenga un deck creíble
- [x] Al menos 2 de esos perfiles "sembrados" para dar match recíproco en el mock de `descubrir`

## Dónde ha quedado

- `src/features/profile/` — `catalog.ts` (opciones y etiquetas), `controls.tsx` (primitivas de formulario), `profile-form.tsx` (formulario único de alta y edición), `profile-details.tsx` (ficha en lectura), `profile-avatar.tsx`.
- `seekingSpecialties` (contrato de `arquitecto`): el formulario lo pregunta solo cuando `lookingFor` es `par` o `ambos` —`catalog.ts:seeksComplement`— y lo envía vacío en cualquier otro caso, aunque se hubieran marcado chips antes de cambiar de modo. La ficha lo pinta en latón, debajo de lo que domina (verde) y separado por una línea; vacío se lee como "Abierto a cualquier especialidad", que es lo que significa en el dominio. Los chips de este grupo llevan `accessibilityLabel` "Busco X" para no compartir nombre accesible con los de lo que domina.
- Rutas: `src/app/(onboarding)/mode.tsx`, `src/app/(onboarding)/profile-form.tsx`, `src/app/(tabs)/profile.tsx` — ya no usan `ScreenPlaceholder`.
- Catálogo mock: `src/data/mock/seed.ts`, 8 perfiles y 3 recíprocos (uno por modo, para que cualquier filtro de `descubrir` tenga match posible).

## Recuerda
Nadie contrata a nadie: no metas campos de "salario" o "equity que ofrezco" — eso es Modo Talento, Fase 4, fuera de este MVP.
