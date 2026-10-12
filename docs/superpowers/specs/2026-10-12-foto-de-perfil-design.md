# Foto de perfil con fondo de tarjeta estilo Tinder — diseño

Fecha: 2026-10-12. Aprobado por el usuario en conversación el mismo día.

## Intención

Cada persona puede subir **una** foto de perfil. Si la tiene, la tarjeta del deck
(Descubrir) la muestra a pantalla completa de fondo, como Tinder, con nombre e
información encima. Sin foto, todo sigue como hoy: color de acento + iniciales.

Revoca la decisión del 2026-10-12 «sin fotos de perfil» (ver memoria
`pivote-solo-cofundador`). El tipo `Avatar`, la migración `profiles_and_settings`
y `CONCEPTO.md` decían «el MVP no sube imágenes»: hay que actualizarlos.

Decisiones del usuario: **una sola foto** (no carrusel), **bucket público** de lectura y **moderación automática en servidor con OpenAI** (2026-10-12): no se pueden publicar imágenes explícitas.

## Fuera de alcance (YAGNI)

- Varias fotos, reordenar, carrusel con toques laterales.
- Moderación humana propia (cola de revisión): la red de seguridad posterior es reportar y bloquear, que ya existen.
- URLs firmadas para servir la foto (la lectura es pública; el bucket de subidas pendientes sí es privado, ver §1).

## 1. Datos

- `Avatar` gana `imageUrl?: string`. Sin él, iniciales + acento como hasta ahora.
- Migración nueva: `profiles.avatar_url text null`, con check de longitud (≤ 500) y de forma:
  URL pública del bucket `avatars` **dentro de la carpeta del propio `id`**.
  **Ningún `grant` de escritura al cliente**: `avatar_url` solo lo escribe la Edge
  Function (service role), igual que el sello de GitHub.
- Todo sitio que enumera columnas de `profiles` añade `avatar_url` (tipos de fila,
  mappers, fixtures). La guardia de `schema-embedded.test.mjs` pasa a esperar tres columnas
  cerradas al cliente: el sello y `avatar_url`.
- Dos buckets de Storage:
  - `avatar-uploads`: **privado**, `<uid>/<uuid>.jpg`; el dueño solo puede insertar y borrar
    en su carpeta; nadie lee por API de cliente; solo `image/jpeg`, ≤ 5 MB.
  - `avatars`: **público** para lectura; **ninguna política de escritura para clientes**.
    Solo la Edge Function publica aquí.

## 2. Capa de datos

- Contrato (`repositories.contract.ts`): `setAvatarPhoto(localUri)` y
  `removeAvatarPhoto()`. Los errores de moderación llegan traducidos.
- Supabase: sube a `avatar-uploads` y llama a la Edge Function `moderate-avatar`
  (`{ action: 'set', path }`). Quitar la foto es `{ action: 'remove' }`: el cliente no
  puede tocar `avatars` ni `avatar_url` por sí mismo.
- Mock: guarda el URI local en memoria y acepta todo (no hay servidor).
- `ProfileInput` **no** cambia: la foto va por métodos propios.

## 3. UI

- Dependencias: `expo-image-picker` y `expo-image-manipulator`, en versión
  compatible con SDK 57 (verificar contra https://docs.expo.dev/versions/v57.0.0/).
  Recorte 4:5, lado largo ≤ 1080 px, JPEG ~0,8 antes de subir.
- `ProfileAvatar`: con `imageUrl` muestra `expo-image` circular (chat, matches,
  perfil); sin él, iniciales.
- Perfil: bloque «Foto» con avatar grande y **Elegir de galería / Hacer foto /
  Quitar**. Estados: subiendo, error con reintento.
- `discover/profile-card.tsx`: con foto, `expo-image` a pantalla completa de
  fondo + degradado oscuro abajo para que el texto siga leyéndose (contraste
  ≥ 4,5:1); sin foto, igual que ahora.
- `app.json`: textos de permiso de galería y cámara. Permiso denegado → mensaje
  claro, sin romper nada.

## 4. Seguridad y moderación

Principio: **nada se publica sin que el servidor lo haya revisado, y si no puede revisarlo, no se publica**.

- **Edge Function `moderate-avatar`** (`verify_jwt`, service role). Con `set`: comprueba que
  `path` es de la carpeta del propio usuario; descarga el archivo; verifica que es JPEG de
  verdad (magic bytes) y ≤ 5 MB; lo envía a la API de moderación de OpenAI
  (`omni-moderation-latest`, entrada de imagen); si pasa, lo copia a
  `avatars/<uid>/<uuid>.jpg`, apunta `avatar_url`, y borra la subida y la foto anterior.
- **Qué se rechaza:** `flagged` del proveedor, o `sexual` ≥ 0,4, o `sexual/minors` > 0, o
  `violence/graphic` ≥ 0,5. Siempre se borra la subida pendiente.
- **Falla cerrado:** si el proveedor no responde, da error o devuelve algo inesperado —o
  una respuesta sin las tres categorías (`sexual`, `sexual/minors`, `violence/graphic`)
  con número—, la foto se rechaza con «inténtalo más tarde». Nunca se publica sin escanear.
- **Carreras y huérfanos (revisión de Codex, 2026-10-12):** `avatar_url` se actualiza de
  forma condicional (solo si sigue siendo la foto que se leyó); quien pierde la carrera
  retira su publicación y recibe `409 conflict`. Si apuntar `avatar_url` falla, lo
  publicado se retira. `remove` borra primero el archivo y solo si Storage lo confirma
  pone `avatar_url` a `null`; además barre las subidas pendientes del usuario. Un error
  al leer la foto actual aborta la petición, nunca se interpreta como «sin foto».
- **Web:** la función responde al preflight CORS y lleva las cabeceras en todas las respuestas.
- **Clave:** `OPENAI_API_KEY` como secreto de la función, nunca en el repo ni en el cliente.
- **Privacidad:** la foto se envía a OpenAI solo para revisarla; hay que decirlo en `privacidad.md`.
- Segunda red, ya existente: reportar un perfil cubre la foto; bloquear a alguien lo saca del deck.
- Borrar la cuenta: el cliente llama a `remove` (borra la foto pública) y vacía su carpeta de
  `avatar-uploads` antes del RPC. El SQL solo toca metadatos, no archivos.
- Límite: la moderación automática reduce, no elimina; queda la revisión humana de reportes.
  Es una decisión consciente.

## 5. Pruebas y reparto

- Jest: mappers, `ProfileAvatar` con/sin foto, tarjeta con/sin foto, repo mock.
- `node --test` de la decisión de moderación (`logic.mjs`) con el proveedor simulado:
  marcada, proveedor caído, no-JPEG, > 5 MB, path ajeno, set y remove.
- Contrato Supabase: A no escribe en la carpeta de B ni en `avatars`, y no puede tocar `avatar_url`.
- Trabajo cruzado (`datos` + `perfil` + `descubrir` + `visual`): se hace
  secuencial en un solo hilo, luego `comprobador` en el emulador.
- Al cerrar: actualizar `CONCEPTO.md`, TODOs y la memoria del pivote.
