# TODO — arquitecto

## Proyecto base
- [x] Scaffold Expo + TypeScript + Expo Router (SDK 57)
- [ ] Eliminar el contenido de demo de Expo (pantalla "Welcome to Expo", `animated-icon`, `web-badge`, `hint-row`) una vez sustituido por el shell real

## Sistema de diseño
- [ ] Sustituir `src/constants/theme.ts`: colores de marca (latón / grafito-salvia / verde-azulado, claro y oscuro — ver `docs/plan/CONCEPTO.md`)
- [ ] Cargar tipografías Fraunces / IBM Plex Sans / IBM Plex Mono (`expo-font` + `@expo-google-fonts/*` o Google Fonts)
- [ ] Escala tipográfica y espaciado consistente (reusar `Spacing` existente o redefinir)

## Navegación
- [ ] Grupo de rutas `(onboarding)`: selección de modo → formulario de perfil
- [ ] Shell de tabs: Descubrir / Matches / Perfil (sustituir Home/Explore actuales)
- [ ] Ruta `chat/[matchId]` fuera de las tabs

## Capa de datos
- [ ] Definir tipos: `Profile`, `Mode` (`par` | `lockin`), `Match`, `Message`
- [ ] Definir interfaz de repositorio (p. ej. `ProfileRepository`, `MatchRepository`, `MessageRepository`)
- [ ] Implementación mock en memoria con datos de ejemplo mínimos
- [ ] Punto único de acceso (p. ej. `src/data/index.ts`) que expone la implementación activa — para que `datos` pueda sustituirla por Supabase sin tocar pantallas

## Entrega
- [ ] Confirmar que `npx expo start --web` levanta sin errores
- [ ] Dejar constancia (en este archivo y avisando en el chat) de cuándo el contrato de `src/data/` queda congelado — los demás bloques dependen de que no cambie sin avisar
