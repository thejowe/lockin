# TODO — datos

## Antes de nada
- [ ] Comprobar si existen credenciales de Supabase (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Si no existen: avisar al usuario y limitarse al diseño de esquema — no inventar ni hardcodear credenciales.

## Esquema (se puede hacer sin credenciales)
- [ ] Tabla `profiles` (campos de `docs/plan/CONCEPTO.md`)
- [ ] Tabla `matches`
- [ ] Tabla `messages`
- [ ] Políticas de Row Level Security (cada usuario ve solo sus propios matches/mensajes)
- [ ] Migraciones en `supabase/migrations/`

## Integración (necesita credenciales)
- [ ] Cliente de Supabase (`@supabase/supabase-js`)
- [ ] Autenticación (email o magic link)
- [ ] Implementación real de la interfaz de repositorio de `arquitecto` en `src/data/supabase/`
- [ ] Variable de entorno/config para elegir mock vs. real, sin tocar las pantallas que ya consumen la interfaz
