# cofounder — contexto completo de la app

> Documento para dar contexto a un asistente (Claude chat) sobre la app. Estado a 17 de noviembre de 2026.
> Resume el producto, todas sus funciones, cómo está construida y en qué punto está.

---

## 1. Qué es

**cofounder** (nombre en tiendas: «cofounder – Startup Match», subtítulo «Find a business partner») es una app móvil estilo Tinder para **encontrar cofundador**. Está pensada para gente que **todavía no tiene nada construido** —ni proyecto, ni equipo, ni socio— y quiere encontrar con quién construir algo.

- Pasas perfiles uno a uno (swipe). Si los dos os dais like → **match** → se abre un **chat privado**.
- Además puedes crear o unirte a **Grupos** de hasta 6 personas para un proyecto.
- Web: `getcofounder.app` (landing + textos legales). Soporte: soporte@getcofounder.app.
- Idiomas: español, inglés y catalán.
- Plataformas: iOS (en TestFlight / App Store, versión 1.0.1) y Android (alpha cerrada en Google Play). Hay versión web técnica (Expo web) usada para pruebas, no como producto.
- Edad mínima: 16 años (autodeclarada).

### Principio innegociable del producto

**«Nadie contrata a nadie.»** Los dos lados de un match son pares, en igualdad. Nada de flujos tipo «founder busca empleado». Única excepción acotada: los **Grupos** tienen admin y «puestos» con plazas, pero para entrar hace falta like de los dos lados y el admin solo administra (no contrata).

### Historia corta (para entender restos en el código)

- El proyecto nació como **LockIn** (el repo y el slug de Expo aún se llaman `lockin`): tenía dos modos, **Par** (cofundador) y **Lock-In** (compañero de concentración / co-working: sesiones programadas, salas, videollamada, rachas, valoración post-sesión, «acuerdo de socios a ciegas»).
- **Pivote del 12-oct-2026:** el producto se centra **solo en cofundador**. Todo lo de Lock-In (sesiones, salas, vídeo, rachas, acuerdo) sigue en el código y en la base de datos, pero **oculto de la UI**, por si vuelve.
- El deck pasó a ser a pantalla completa estilo Tinder, con foto de perfil.

---

## 2. Funciones de la app (lo que ve el usuario)

### 2.1 Alta y acceso

- **Registro / inicio de sesión:** email + contraseña, **Continuar con Google** y **Continuar con Apple** (Apple solo en iOS). Recuperación de contraseña por email (deep link `cofounder://auth/callback`, pantalla `reset-password`).
- **Verificación de email** obligatoria para usar la app (puerta de correo).
- **Aceptación de Términos y Normas de la comunidad**, versionada (`TERMS_VERSION`); si cambian, todo el mundo vuelve a aceptar.
- **Cuentas bloqueadas:** si un email está bloqueado hay pantalla para solicitar desbloqueo (`unblock`).

### 2.2 Perfil (onboarding con asistente paso a paso)

Campos:
- Nombre, **fecha de nacimiento** (edad), **país + ciudad** y zona horaria.
- **Foto de perfil obligatoria** en el alta. Se modera en servidor antes de publicarse (ver §4); si falla la moderación, no se publica (falla cerrado).
- **Especialidades** (lo que domino), multi-selección: diseño, desarrollo, producto, marketing, ventas, datos, contenido, finanzas, operaciones, legal, IA, hardware, growth, comunidad, personas/RRHH, investigación, audiovisual, seguridad, e-commerce, inversión.
- **Qué busco que domine la otra persona** (mismas etiquetas). Vacío = «abierto a cualquier especialidad».
- **Idiomas que hablo** (es, en, ca, eu, gl, pt, fr, de, it, nl, ro, ar, zh, ru).
- **Punto de partida:** «Solo tengo ganas, sin idea» / «Tengo una idea sin empezar» / «Ya toqué algo pequeño».
- **Disponibilidad:** horas por semana + franjas (madrugada, mañana, tarde, noche).
- **Ambición:** lifestyle / equilibrado / todo o nada.
- **Enlaces opcionales:** GitHub, portfolio, LinkedIn.
- **1–2 prompts de texto libre** estilo Hinge (respuestas cortas).
- **Tablón personal:** muro de fotos (su trabajo, más fotos suyas) con pie corto (máx. 280 caracteres). Cada foto se modera en servidor antes de mostrarse. En la tarjeta del deck aparecen «clavadas con chinchetas», algo torcidas, como en un corcho.
- **Sellos de verificación:** «Verificado en GitHub» y «Verificado en LinkedIn». Solo prometen que esa cuenta pertenece a quien controla el perfil (OAuth real + comprobación en servidor), nada más.
- **Teléfono** opcional en Ajustes (se puede quitar).

Tras crear el perfil hay un **mini tutorial** de 4 páginas (Descubrir, chat, Grupos, perfil) con capturas reales de la app en el idioma del usuario.

### 2.3 Navegación principal

Barra de pestañas flotante (cristal con desenfoque) con 3 pestañas: **Descubrir**, **Matches**, **Perfil**. Se puede cambiar de pestaña deslizando.

### 2.4 Descubrir (el deck)

- Tarjeta de perfil **a pantalla completa** con la foto de fondo; varias «páginas» por tarjeta (tocar izquierda/derecha para pasar) con especialidades, qué busca, prompts, disponibilidad, tablón…
- **Swipe** derecha = like, izquierda = pass; también hay **botones** (accesibilidad).
- Resalta el **encaje complementario**: si lo que tú dominas es lo que la otra persona busca (señal visual, no filtro).
- **Super Like** (la otra persona lo ve destacado; los Super Likes salen primero en su deck).
- **Pantalla de match** animada cuando el like es mutuo → ir al chat.
- **Filtros:** gratis por especialidad y diferencia de zona horaria; **con Premium**: edad, horas mínimas, franjas, ambición, punto de partida y exigir GitHub/LinkedIn verificado (en gratis se ven con candado y abren el paywall).
- **Límite gratuito:** 25 likes cada 24 h (hoja «sin likes» con cuenta atrás y oferta de Premium).
- El deck excluye bloqueados, perfiles ya decididos, etc.
- Selector de sección arriba: **Cofundador** / **Grupos** (y, si administras un grupo, una tercera con su nombre para reclutar).

### 2.5 Grupos

- Un grupo = proyecto con **admin**, nombre, descripción del proyecto y **perfiles que buscamos** (especialidad + nº de plazas), hasta **6 personas**.
- Quien no tiene grupo ve un **deck de grupos** que buscan lo que él domina («Encajas como…»).
- El admin tiene un **deck para reclutar** gente.
- Entrar exige **like de los dos lados** (persona ↔ admin).
- Admin puede **editar** (sin quitar puestos ocupados ni bajar plazas por debajo de los que hay), **expulsar**; si el admin se va o borra la cuenta, otro miembro **hereda** la administración.
- **Chat de grupo** con notificaciones push.
- Se puede estar en varios grupos.
- Grupos se pueden **bloquear y reportar** (el reporte va contra el admin).

### 2.6 Matches y chat

- Lista de **matches** + filas de chats de grupo, con último mensaje y **globo rojo de no leídos** (también en la pestaña).
- **Chat 1:1** tras match mutuo, en tiempo real (Supabase Realtime).
- **Icebreakers sugeridos** al abrir un chat nuevo, generados por reglas a partir de ambos perfiles (sin IA).
- Cada chat (1:1 y grupo) tiene dos pestañas: **Mensajes** y **Plan compartido**:
  - **Tareas** compartidas: cualquiera añade, marca como hecha o reabre.
  - **Reuniones** con tema, fecha, hora y lugar o enlace; se ven en la hora local de cada uno; se pueden cancelar y restablecer.
- Opciones de seguridad dentro del chat: **reportar mensaje**, **bloquear** y **reportar perfil**.
- **Ver perfil completo** de la otra persona (`/person/[id]`).

### 2.7 Premium (suscripción)

Un solo nivel de pago, sin anuncios. Precios: **4,99 €/mes** o **39,99 €/año**, con prueba gratis (3 días en mensual, 7 en anual). Cobro vía App Store / Google Play gestionado con **RevenueCat**.

Beneficios:
- Likes sin límite (tope antiabuso 300/24 h).
- Deshacer el último swipe (ventana de 10 min).
- **Ver quién te ha dado like** (pantalla `likes`; en gratis se ve un contador anónimo).
- 5 Super Likes a la semana (gratis: 1).
- **Boost:** 30 minutos arriba del deck, uno cada 30 días.
- Filtros avanzados (edad, disponibilidad, ambición, punto de partida, zona horaria, exigir cuentas verificadas).
- Insignia Premium.

Paywall con «Gestionar suscripción», restaurar compras y textos legales de renovación.

### 2.8 Notificaciones push

- Resumen diario de likes no vistos (anónimo en gratis), nuevo match, mensajes 1:1 y de grupo, actividad de grupos, reenganche opcional, aviso de fin de Premium.
- **7 preferencias** en Ajustes para activar/desactivar cada tipo.
- Permiso pedido en contexto (no al arrancar); se silencia el aviso si ya estás en ese chat; el token se borra si retiras el permiso.

### 2.9 Ajustes y cuenta

- Idioma (es/en/ca; por defecto detecta el del móvil, si no inglés).
- Notificaciones, teléfono, cuentas conectadas (GitHub/LinkedIn, Google/Apple), cambiar contraseña.
- Enlaces a Privacidad, Términos, Normas, etc. (los legales se leen dentro de la app en los 3 idiomas).
- **Eliminar mi cuenta** desde la app (borra datos; exigencia de Apple 5.1.1(v)).
- Cerrar sesión.

### 2.10 Seguridad y moderación

- Bloquear (mutuo e inmediato) y reportar perfiles, mensajes y grupos. Los reportes van a una tabla privada que revisa el operador (objetivo: 24 h contenido grave, 72 h resto).
- **Filtro de contenido** básico en textos del perfil (es/en/ca). Desde el 17-nov los mensajes, tareas y reuniones del chat **no** se filtran (texto libre); se pueden reportar.
- **Moderación de fotos** (avatar y tablón) con IA en servidor antes de publicarse.
- Fotos en bucket privado, servidas con URLs firmadas que caducan.

---

## 3. Stack técnico

- **App:** Expo SDK 58 + React Native 0.88 + React 19, TypeScript estricto.
- **Navegación:** `expo-router` (rutas por archivos en `src/app/`).
- **Animación y gestos:** `react-native-reanimated` 4 + `react-native-gesture-handler` (swipe propio, sin librerías de swipe externas), `expo-haptics`.
- **UI:** `expo-blur` / `expo-glass-effect` (cristal), `expo-image`, fuentes Instrument Serif + Instrument Sans.
- **Backend:** **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions en Deno + `pg_cron` + `pg_net`).
- **Pagos:** RevenueCat (`react-native-purchases`) + webhook a Supabase.
- **Auth:** Supabase Auth (email/contraseña, Google con `@react-native-google-signin`, Apple con `expo-apple-authentication`, OAuth GitHub/LinkedIn para los sellos). Sesión guardada en `expo-secure-store`.
- **Push:** `expo-notifications` + Expo Push Service.
- **i18n:** módulo propio en `src/i18n` (la clave es la frase en español; `en.json` y `ca.json` traducen), `expo-localization`.
- **Builds y tiendas:** EAS Build / EAS Submit. Bundle iOS `app.cofounder.mobile`, paquete Android `app.cofounder.android`.
- **Web pública:** HTML/CSS estático generado con `scripts/build-web.mjs` → `_site/`, publicado en GitHub Pages (repo `cofounder-web`) con el dominio `getcofounder.app`.
- **Calidad:** Jest + React Native Testing Library (~2.260 tests), tests de esquema SQL con Postgres embebido (PGlite, ~270), tests de Edge Functions (~114), suite de contrato que corre la misma batería contra el mock y contra Supabase real, E2E con **Maestro** en emulador Android (en GitHub Actions), ESLint, Prettier, `tsc`. CI en GitHub Actions.

---

## 4. Arquitectura y estructura del código

```
src/
  app/                 Rutas (expo-router)
    (onboarding)/      mode, register, sign-in, profile-form, tour, unblock
    (tabs)/            discover, matches, profile
    chat/[matchId]     chat 1:1
    group/             new, edit, info, [groupId] (chat de grupo)
    person/[id]        perfil completo de otra persona
    likes, premium, settings, notifications, legal/[doc], reset-password, auth/callback
    agreement/[matchId] (acuerdo de socios; oculto tras el pivote)
  features/            Lógica + UI por funcionalidad
    discover/          deck, tarjeta, swipe, filtros, match modal, tablón en tarjeta, encaje
    chat/              lista de matches, conversación, icebreakers, plan compartido
    groups/            decks de grupos/reclutar, crear/editar, chat de grupo, push
    profile/           asistente de alta, formulario, catálogos, foto, tablón, sellos, cuenta, ajustes
    premium/           paywall, likes recibidos, insignia, CTA
    safety/            reportar/bloquear, filtro de contenido
    notifications/     permiso contextual
    legal/             visor de textos legales (generados desde docs/tiendas)
    tour/              tutorial tras el alta
    agreement/         acuerdo de socios (oculto)
  data/                Capa de datos abstracta
    repositories.ts    Interfaces (ProfileRepository, MatchRepository, GroupRepository…)
    repositories.contract.ts  Batería de contrato común a todos los backends
    types.ts           Tipos de dominio
    mock/              Backend en memoria con datos semilla (para desarrollo y tests)
    supabase/          Backend real (cliente, auth, realtime, mapeadores, tipos generados)
    provider.tsx       Elige mock o Supabase según variables EXPO_PUBLIC_*
  components/          Componentes compartidos (Glass, botones, pestañas, fondo ambiental, iconos…)
  constants/theme.ts   Tokens de diseño (fuente de verdad), con test de contraste AA
  i18n/                Traducciones
  lib/                 Puente con RevenueCat (purchases) y push
supabase/
  migrations/          ~60 migraciones SQL (esquema, RLS, RPCs, cron)
  functions/           Edge Functions (ver abajo)
  seed.sql, templates/ (correos en 3 idiomas), tests de esquema
docs/
  plan/                CONCEPTO.md, PLAN.md, TODO.md y todo/<bloque>.md (estado del trabajo)
  tiendas/             Fichas App Store / Google Play, legales (es; en/ y ca/ traducidos)
web/                   Fuente de la web pública
e2e/                   Flujos Maestro y artefactos de comprobación
```

### Patrón clave: repositorios intercambiables

Las pantallas nunca llaman a Supabase directamente: usan `useRepositories()`, que devuelve el backend **mock** o **Supabase** con la misma interfaz. Una batería de contrato (`repositories.contract.ts`) garantiza que los dos se comportan igual. Así la app funciona entera sin servidor (desarrollo, tests, demos).

### Base de datos (Supabase / Postgres)

Tablas principales: `profiles`, `user_settings`, `decisions` (likes/pass/super), `matches`, `messages`, `chat_reads` (no leídos), tablas de plan compartido (tareas y reuniones), `groups` y miembros/puestos/decisiones de grupo, `board_posts` (tablón), `blocks`, `reports`, `terms_acceptances`, `blocked_account_emails`, `push_tokens`, preferencias de notificación, `entitlements` (Premium), `like_events`, `boosts`, `revenuecat_events`. Ocultas por el pivote: sesiones Lock-In, valoraciones, rachas, salas, acuerdo.

- Seguridad por **RLS** en todas las tablas y permisos por columna (p. ej. nadie puede escribir a mano su `avatar_url` ni sus sellos de verificación).
- Lógica de negocio en **RPCs** de Postgres: `discovery_deck` (deck con filtros, orden Super Like → Boost → resto), `record_decision` (likes con cupos y códigos de error `LQ00x`), `undo_last_decision`, `activate_boost`, `incoming_likes`, `premium_quotas`, `is_premium()`, borrado de cuenta, etc.
- `pg_cron` para purgas, resumen diario de likes y otros avisos programados.

### Edge Functions (Deno)

| Función | Qué hace |
|---|---|
| `moderate-avatar` | Recibe la foto de perfil, la modera con la API de moderación de OpenAI y solo entonces la publica |
| `moderate-board` | Igual para las fotos + pie del tablón |
| `verify-identity` | Comprueba con la API de GitHub/LinkedIn que la cuenta enlazada es del usuario y pone el sello |
| `apple-token` | Gestiona el refresh token de Sign in with Apple (necesario para revocar al borrar cuenta) |
| `revenuecat-webhook` | Recibe eventos de suscripción de RevenueCat y actualiza `entitlements` |
| `sync-entitlement` | Sincroniza el estado Premium bajo demanda |
| `notify-group-message` | Envía las notificaciones push (mensajes, matches, resumen, grupos, Premium…) |

---

## 5. Diseño visual («cristal»)

- **Solo modo oscuro.** Fondo grafito `#0A0A0B` con una luz ambiental tenue que entra por arriba (imágenes de fondo).
- Superficies de **vidrio translúcido** (`#FFFFFF14` / `#FFFFFF29`) con canto fino; lo que flota (barra de pestañas, modales) lleva desenfoque real.
- Tinta `#F5F5F7` / `#BEBEC4` / `#A8A8AE`. **Acento brasa `#FF8645`** solo para la acción principal de cada pantalla. Verde-azulado `#7FC3B0` para lo que domina / presencia. Alerta `#FF9A80`.
- Tipografía: **Instrument Serif** para titulares (cursiva para énfasis) + **Instrument Sans** para la interfaz.
- Contención: nada de halos, degradados multicolor ni iconos decorativos (evitar «aspecto de plantilla hecha por IA»). Contraste AA verificado por tests.
- Microinteracciones con Reanimated, respeta «reducir movimiento».

---

## 6. Estado actual (17-nov-2026)

- **iOS:** build 65 (versión 1.0.1) en TestFlight y seleccionada para la ficha 1.0.1 de App Store. Incluye plan compartido, texto libre en chats y no leídos.
- **Android:** en alpha cerrada de Google Play; falta reunir testers (12 × 14 días) y configurar la clave de servicio para el auto-envío.
- **Backend:** Supabase en producción con todas las migraciones aplicadas (grupos, Premium, notificaciones, plan compartido).
- **Ficha de App Store en inglés** rediseñada: 7 capturas nuevas, textos orientados a búsqueda.
- **Web** `getcofounder.app` con legales en 3 idiomas; landing con móvil animado en construcción; botones de tienda en «Próximamente» hasta tener URL pública.
- **Pendientes destacados:** comprobar push reales en móviles físicos, recorrido completo en dispositivo de algunas funciones nuevas, revisión nativa de traducciones en/ca y de textos legales, plantillas de correo en 3 idiomas sin aplicar en producción, cuenta demo para revisión de Apple.

---

## 7. Fuera de alcance / futuro

- Lock-In (sesiones de co-working, vídeo, salas, rachas, valoración) — construido pero oculto.
- Acuerdo de socios a ciegas — construido pero oculto.
- **Modo Talento** (proyectos que buscan cubrir un rol con equity/sueldo) — Fase 4, no construir.
- Partnerships B2B, gamificación avanzada.

---

## 8. Cómo se trabaja en el repo (por si pides ayuda técnica)

- El trabajo está dividido en **bloques** (arquitecto, perfil, descubrir, chat, datos, calidad, visual, premium, grupos, notificaciones, tiendas-cumplimiento, web…). Cada bloque tiene su checklist en `docs/plan/todo/<bloque>.md` y el estado global en `docs/plan/TODO.md`.
- Se desarrolla con **Claude Code** (con subagentes por bloque) y **Codex**; todo código pasa por revisión de Codex. Las comprobaciones en dispositivo las hace un agente sobre un emulador Android local.
- Para cambiar entre mock y Supabase se usan variables `EXPO_PUBLIC_*`.
