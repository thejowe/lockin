---
name: build-ios
description: Build de iOS con EAS para LockIn (cofounder). Úsala cuando el usuario diga `/build-ios`, «build ios falla», «arregla el build», «lanza el build de iOS» o «sube a TestFlight/App Store». Descarga el log del último build fallido, diagnostica la causa real (pods, firma, Xcode, JS), la corrige con el cambio mínimo, hace commit y, si se pide, relanza el build con auto-submit.
---

# build-ios — diagnosticar, arreglar y relanzar el build de iOS

Responde en español y de forma breve. Argumentos opcionales:

- *(sin argumentos)* → diagnostica el último build iOS y arréglalo; **no** relances.
- `lanza` → diagnostica + arregla + relanza.
- `solo lanza` → relanza sin diagnosticar.
- `sin preguntar` → relanza sin pedir confirmación (si no, confirma antes: `--auto-submit` publica en App Store Connect).

Comando canónico de build (perfil `production` de `eas.json`):

```
npx eas-cli build -p ios --profile production --auto-submit --non-interactive --no-wait
```

## 1. Último build y su log

```bash
npx eas-cli build:list -p ios --limit 1 --json --non-interactive
```

Mira `status`, `error.errorCode`, `error.message`, `gitCommitHash` y `logFiles[0]`. Si el último está `FINISHED`, dilo y para (salvo `lanza`).

Descarga el log. **Viene comprimido con brotli** aunque se llame `.txt`:

```bash
curl -s "<logFiles[0]>" -o "$TMP/eas.br" && brotli -d -c "$TMP/eas.br" > "$TMP/eas.log"
grep -o '"msg":"[^"]*' "$TMP/eas.log" | sed 's/"msg":"//' > "$TMP/eas.txt"
grep -n -i -B5 -A30 '\[!\]\|error:\|❌\|Build failed' "$TMP/eas.txt" | head -120
```

Si no hay `brotli`, prueba `gunzip`; si nada, usa `node -e` con `zlib.brotliDecompressSync`. La URL caduca en 15 min: si da 403, vuelve a pedir `build:list`. Usa el scratchpad de la sesión como `$TMP`.

## 2. Diagnóstico por tipo de error

| errorCode / síntoma | Causa típica | Arreglo |
|---|---|---|
| `EAS_BUILD_INCOMPATIBLE_PODS_ERROR` + «None of your spec sources contain a spec satisfying `X (= v)`» | Un paquete npm pide un pod aún no publicado en CocoaPods | Bajar el paquete npm a la última versión cuyo pod sí exista (ver §3) |
| Pods incompatibles entre dos libs | Dos libs piden versiones distintas del mismo pod | `npx expo install --check` / alinear con las versiones de Expo SDK |
| Podfile.lock cacheado | `cache` en `eas.json` | Relanzar con `--clear-cache` |
| Errores de firma / provisioning | Credenciales | `npx eas-cli credentials -p ios` — **pide al usuario que lo haga él** (interactivo, `! npx eas-cli credentials -p ios`) |
| Falla en `Bundle JavaScript` | Error de JS/TS/import | Reproducir local: `npx expo export -p ios` y `npm run typecheck` |
| Falla en Xcode (`xcodebuild`) | Lib nativa incompatible con RN/Expo actual | Buscar la línea `error:` real; `npx expo install --check`; mirar issues de la lib |

Antes de cambiar versiones, lee las docs de Expo SDK 58 (AGENTS.md) si el arreglo toca config nativa.

## 3. Comprobar que un pod existe en CocoaPods

```bash
# versión de pod que pide un paquete npm (mira su .podspec)
grep -i dependency node_modules/<paquete>/*.podspec
# versiones publicadas del pod: shard = 3 primeros hex del md5 del nombre
h=$(printf <NombrePod> | md5sum | cut -c1-3)
curl -s "https://cdn.cocoapods.org/all_pods_versions_${h:0:1}_${h:1:1}_${h:2:1}.txt" | grep '^<NombrePod>/' | tr '/' '\n' | sort -V | tail
```

Para versiones antiguas del podspec de un paquete sin instalarlo: `https://raw.githubusercontent.com/<org>/<repo>/<tag>/<archivo>.podspec`.

Caso conocido (2026-11-03): `react-native-purchases@11.0.0` pedía `PurchasesHybridCommon 20.1.0`, inexistente en CocoaPods → fijado a `10.16.0` (pide `19.17.0`). No subir RevenueCat sin comprobar esto.

## 4. Arreglar y verificar

- Cambio mínimo. Versiones fijadas exactas (`--save-exact`) cuando bajes una lib por un pod.
- Verifica: `npm run typecheck` y los tests afectados (`npx jest <ruta>`).
- Commit en la rama actual (nunca en la principal; si estás en ella, crea rama), mensaje `fix(ios): …` explicando la causa.
- Push a `origin` para que el build de EAS y los otros equipos tengan el cambio.

## 5. Relanzar (solo con `lanza` / `solo lanza`)

- Sin `sin preguntar`: confirma antes de lanzar (publica en App Store Connect).
- Lanza con el comando canónico (`--no-wait`) y devuelve el enlace del build.
- No esperes en bucle; si el usuario quiere seguimiento, usa `npx eas-cli build:view <id> --json` cuando lo pida.

## 6. Informe

Tres líneas: causa (con la línea del log citada), cambio + commit, siguiente paso (comando a lanzar o enlace del build).

## Adaptar a otro equipo

Si el usuario pide «adapta la skill» en otro equipo: comprueba qué hay (`brotli`, `curl`, `md5sum`, shell Bash/PowerShell, `npx eas-cli whoami`) y ajusta los comandos de §1 y §3 a lo disponible, sin cambiar el flujo. Si EAS no tiene sesión, pide `! npx eas-cli login`.
