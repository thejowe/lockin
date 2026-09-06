# TODO — datos

## Antes de nada
- [x] Comprobar si existen credenciales de Supabase (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Si no existen: avisar al usuario y limitarse al diseño de esquema — no inventar ni hardcodear credenciales.
  - **No existen.** No hay `.env` en el repo ni variables en el entorno de la sesión. Nada se ha aplicado contra un proyecto Supabase real y no hay credenciales en el código. Todo el bloque de "Integración" queda bloqueado hasta que el usuario cree el proyecto y las entregue.

## Esquema (se puede hacer sin credenciales)
- [x] Tabla `profiles` (campos de `docs/plan/CONCEPTO.md`) — 1:1 con `auth.users`; `Availability` y `ProfileLinks` aplanados en columnas, `prompts` como `jsonb` (máx. 2)
- [x] Tabla `matches` — par ordenado canónicamente (`profile_a < profile_b`) + `unique`, para que no existan dos matches entre las mismas dos personas
- [x] Tabla `messages` — con trigger que mantiene `matches.last_message_at`
- [x] Políticas de Row Level Security (cada usuario ve solo sus propios matches/mensajes) — activas en las cinco tablas, `anon` revocado en todas
- [x] Migraciones en `supabase/migrations/` — cinco archivos, aplicables con `supabase db reset`

### Extra necesario para cumplir el contrato de `arquitecto`
- [x] Tabla `decisions` (swipes) — la exige `DiscoveryRepository`: `recordDecision` necesita la reciprocidad y `getDeck`/`listDecided` los ya vistos
- [x] Tabla `user_settings` (modo activo) — `Session.activeMode` se elige antes de que exista el perfil, así que no puede ser columna de `profiles`
- [x] `record_decision()` (`SECURITY DEFINER`) — única puerta para crear matches; es lo que permite que nadie pueda leer quién le ha dado like
- [x] `discovery_deck()` — filtra por modo y especialidad y excluye los ya swipeados, espejo de `matchesMode`/`effectiveMode` del mock
- [x] Realtime en `matches` y `messages` — sostiene los `subscribe()` del contrato
- [x] `supabase/README.md` con el mapeo tipo ↔ tabla y las decisiones de seguridad

### Pendiente de verificación
- [ ] Ejecutar las migraciones contra un Postgres real (`supabase db reset`). **Sin hacer**: no hay `psql`, `supabase` CLI ni `docker` en la máquina, así que el SQL está sin ejecutar ni una vez.

## Integración (necesita credenciales)
- [ ] Cliente de Supabase (`@supabase/supabase-js`)
- [ ] Autenticación (email o magic link)
- [ ] Implementación real de la interfaz de repositorio de `arquitecto` en `src/data/supabase/`
- [ ] Variable de entorno/config para elegir mock vs. real, sin tocar las pantallas que ya consumen la interfaz
- [ ] `supabase/seed.sql` con los perfiles de `src/data/mock/seed.ts` para desarrollo local
