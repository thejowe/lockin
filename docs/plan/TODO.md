# TODO maestro — LockIn MVP

Solo hitos de alto nivel. El detalle accionable vive en `docs/plan/todo/<bloque>.md` — márcalo ahí, no aquí.

## Arquitectura
- [x] Scaffold inicial de Expo + TypeScript + Expo Router
- [x] Sistema de diseño con la paleta de marca
- [x] Shell de navegación (tabs + onboarding)
- [x] Capa de datos abstracta (interfaz + implementación mock)

## Onboarding y perfil
- [x] Selección de modo (Par / Lock-In)
- [x] Formulario de creación de perfil
- [x] Pantalla de perfil propio
- [x] Perfiles de ejemplo (seed)

## Descubrir (swipe y matching)
- [x] Deck de tarjetas con gesto
- [x] Lógica de match mock
- [x] Pantalla de match

## Chat
- [x] Lista de matches
- [x] Chat 1:1 mock
- [x] Icebreakers sugeridos
- [x] Hueco visible para "agendar sesión Lock-In"

## Datos y Supabase
- [x] Esquema SQL (perfiles, matches, mensajes) — escrito **y aplicado** contra el proyecto real por el SQL Editor del dashboard
- [x] Integración de auth — `src/data/supabase/auth.ts`, sesión automática sin tocar pantallas
- [x] Sustituir mock por Supabase real — `src/data/supabase/`; `active.ts` elige por presencia de credenciales
- [ ] Ejecutar `supabase/seed.sql` (los ocho perfiles de desarrollo). Sin él el deck sale vacío.
- [ ] Flujo real end-to-end (registro → perfil → deck → match → mensaje). **Bloqueado por la configuración de Auth del proyecto, no por el código**: `anonymous_users: false` y `mailer_autoconfirm: false` impiden abrir sesión.

## Calidad
- [x] ESLint/Prettier/TS estricto
- [x] Tests base (Jest + RNTL) — 154 tests en 9 suites, con suelo de cobertura en `jest.config.js`
- [x] CI en GitHub Actions — lint, formato, tipos, tests y export web
- [x] Accesibilidad básica — labels, tamaño táctil y test de contraste; 4 pares de tokens siguen por debajo de AA (ver `todo/arquitecto.md`)
