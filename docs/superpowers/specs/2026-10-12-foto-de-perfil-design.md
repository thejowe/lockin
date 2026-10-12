# Foto de perfil con fondo de tarjeta estilo Tinder — diseño

Fecha: 2026-10-12. Aprobado por el usuario en conversación el mismo día.

## Intención

Cada persona puede subir **una** foto de perfil. Si la tiene, la tarjeta del deck
(Descubrir) la muestra a pantalla completa de fondo, como Tinder, con nombre e
información encima. Sin foto, todo sigue como hoy: color de acento + iniciales.

Revoca la decisión del 2026-10-12 «sin fotos de perfil» (ver memoria
`pivote-solo-cofundador`). El tipo `Avatar`, la migración `profiles_and_settings`
y `CONCEPTO.md` decían «el MVP no sube imágenes»: hay que actualizarlos.

Decisiones del usuario: **una sola foto** (no carrusel) y **bucket público**.

## Fuera de alcance (YAGNI)

- Varias fotos, reordenar, carrusel con toques laterales.
- Moderación automática de imágenes.
- URLs firmadas / bucket privado.

## 1. Datos

- `Avatar` gana `imageUrl?: string`. Sin él, iniciales + acento como hasta ahora.
- Migración nueva: `profiles.avatar_url text null`, con check de longitud
  (≤ 500) y de prefijo (URL pública del bucket `avatars` del proyecto).
- Todo sitio que enumera columnas de `profiles` añade `avatar_url`: la migración
  `20260916000100_github_verification.sql` enumera `avatar_initials` y
  `avatar_accent` (vistas/funciones), `database.types.ts` y `mappers.ts`
  (`rowToProfile`, `profileInputToRow`).
- Bucket de Storage `avatars`:
  - lectura pública;
  - escritura/borrado por RLS solo en la carpeta `<auth.uid()>/`;
  - solo `image/jpeg`, `image/png`, `image/webp`; máx. ~5 MB;
  - nombre de archivo = uuid aleatorio en cada subida (URL no adivinable, sin
    problemas de caché); al reemplazar, se borra la foto anterior.
- `delete_my_account` borra también `storage.objects` de la carpeta del usuario.

## 2. Capa de datos

- Contrato (`repositories.contract.ts`): `setAvatarPhoto(localUri)` y
  `removeAvatarPhoto()`.
- Supabase: sube a Storage, actualiza `avatar_url`, borra la anterior.
- Mock: guarda el URI local en memoria (deck y tests sin backend).
- `ProfileInput` **no** cambia: la foto va por métodos propios, no por el
  formulario (igual que `githubVerification`).

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

- Un reporte de perfil cubre la foto (sin cambios de flujo).
- Bloquear a alguien ya lo saca del deck; su foto deja de verse.
- Borrado de cuenta limpia la carpeta del bucket (ver §1).

## 5. Pruebas y reparto

- Jest: mappers, `ProfileAvatar` con/sin foto, tarjeta con/sin foto, repo mock.
- Contrato Supabase: la política de Storage impide que A escriba en la carpeta de B.
- Trabajo cruzado (`datos` + `perfil` + `descubrir` + `visual`): se hace
  secuencial en un solo hilo, luego `comprobador` en el emulador.
- Al cerrar: actualizar `CONCEPTO.md`, TODOs y la memoria del pivote.
