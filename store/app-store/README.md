# Imágenes de App Store

Siete capturas por idioma a **1320 × 2868** (iPhone 6,9″, el tamaño que App Store Connect pide
como principal; las escala solo para pantallas menores). Concepto, reglas y por qué cada
decisión: `docs/tiendas/DISENO-app-store.md`.

| # | Archivo | Pantalla real | Mensaje |
|---|---|---|---|
| 1 | `01-deck.png` | Descubrir | Encuentra con quién *fundar* |
| 2 | `02-prompt.png` | Tarjeta, página de respuesta | Perfiles que dicen cómo *piensas* |
| 3 | `03-match.png` | ¡Match! (la tarjeta sale del teléfono) | Si es *mutuo*, hay match |
| 4 | `04-icebreakers.png` | Chat vacío con preguntas para romper el hielo | El primer mensaje, *resuelto* |
| 5 | `05-groups.png` | Grupos | Equipos de hasta *seis* |
| 6 | `06-profile.png` | Perfil + sello de GitHub verificado | Tu GitHub, *verificado* |
| 7 | `07-closer.png` | Cierre de marca: el hilo forma el símbolo | Aquí nadie contrata a *nadie* |

Se suben en este orden: App Store enseña las tres primeras en los resultados de búsqueda, y el
hilo solo se lee seguido si el orden se respeta. Carpetas `es/`, `en/` y `ca/` para cada
localización de la ficha.

## Regenerarlas

Las pantallas son de la app de verdad, en web y con el mock, así que cualquier cambio de la
interfaz se arrastra solo al volver a lanzar esto:

```bash
git apply store/app-store/scripts/mock-capturas.patch   # sesión, matches y textos traducidos (NO se commitea)
CI=1 npx expo start --web --port 8081 --clear           # en otra terminal; con CI=1 no recarga
node store/app-store/scripts/capture.mjs                # → build/raw/<idioma>/*.png
node store/app-store/scripts/compose.mjs                # → es/, en/, ca/ y build/preview-*.jpg
git checkout src/data/mock/store.ts
```

- `capture.mjs` saca cada pantalla a 440 × 902 pt @3x (la del teléfono sin la barra de estado,
  que dibuja `compose.mjs`).
- `compose.mjs` lleva los textos de las imágenes (`COPY`), las zonas que salen del teléfono
  (`FRAMES[].pop`) y el recorrido del hilo (`LINE_A`, `LINE_B`). Pinta las siete en un lienzo
  panorámico y lo recorta: por eso el hilo cruza de una imagen a la siguiente sin cortes.
- `build/` no se versiona.

Los perfiles del mock no tienen foto (las de ejemplo vienen de Unsplash y el contenedor donde se
hicieron no llegaba a ese dominio): salen con iniciales, que es como los ve quien aún no ha
subido foto. Con fotos reales y con permiso, quitar `imageUrl: undefined` del parche y regenerar.
