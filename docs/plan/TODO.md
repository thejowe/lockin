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
- [x] Esquema SQL (perfiles, matches, mensajes) — escrito, pero **nunca ejecutado** (no hay psql/CLI/docker en la máquina)
- [ ] Integración de auth
- [ ] Sustituir mock por Supabase real (bloqueado por credenciales)

## Calidad
- [ ] ESLint/Prettier/TS estricto
- [ ] Tests base (Jest + RNTL)
- [ ] CI en GitHub Actions
- [ ] Accesibilidad básica
