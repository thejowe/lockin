# E2E Android — Maestro + Supabase local

Caso: `full-journey.yaml`. Runner: `node e2e/run.mjs <fase>`.
Estado: primer CI revisado; falló el bundle Android antes del emulador. **Recorrido verde pendiente**.
No se declara un E2E verde por validar YAML, ni por pasar Jest.

## Qué demuestra

Alta anónima automática (el MVP no tiene pantalla de registro/login) → selección
de modo → formulario completo → deck → like → modal de match → chat → envío →
**parada del proceso y relanzamiento sin borrar almacenamiento** → perfil y
conversación recuperados desde la UI.

**Si corre contra el mock no demuestra nada sobre Supabase.** El deck tiene los
mismos ocho nombres con ambos backends. `src/data/active.ts` selecciona por
presencia de credenciales. El mock solo guarda estado de módulo: tras
`stopApp` pierde perfil, decisiones, matches y mensajes. La sesión de Auth sí
se guarda en AsyncStorage; los datos de producto se recuperan de Postgres.
No sustituir la parada por background/foreground ni quitar las aserciones posteriores.

El runner verifica además, mediante lecturas administrativas locales, que hay
usuario anónimo, perfil con los valores escritos, modo, decisión propia, match
con su contraparte y mensaje exacto enlazados. La clave administrativa nunca se
pasa al build ni a Maestro. No se precrea el perfil/match/mensaje bajo prueba.

## Fixture e aislamiento

`prepare` genera un proyecto Supabase con id `lockin-e2e` en
`e2e/.runtime/supabase`, copia las migraciones y seed del repo y añade
`incoming-likes.sql`. El trigger de fixture solo da likes **entrantes** desde
los ocho perfiles seed al nuevo perfil E2E. Cualquiera que salga primero en el
deck puede corresponder; no dependemos del orden SQL cuando coinciden fechas.
El like propio entra por la UI y la RPC real crea el match con las políticas
y triggers de producto. No se prueba aquí la UI de un segundo dispositivo.

Cada ejecución usa un nombre y mensaje con UUID. La base completa es desechable;
`stop` descarta sus contenedores/volúmenes sin tocar el proyecto compartido.
No usar las credenciales de staging ni ejecutar la fixture allí. Se rechaza toda
URL diferente de `http://127.0.0.1:54321`.

`build` copia la app a `<temporal del sistema>/lockin-e2e-<hash del checkout>`, instala su lockfile y genera allí el
proyecto Android. Así `expo prebuild` no reescribe package.json ni archivos
nativos del checkout. El release APK incluye JS y las dos variables públicas
del backend local, sin Metro ni Expo Go. La copia nativa admite HTTP local;
`adb reverse tcp:54321 tcp:54321` conecta Android con Supabase y Realtime.
La app de producto no recibe cambios ni un bypass E2E.

## Ejecutar en local

Runner soportado: Linux o macOS (en Windows, Linux/WSL con ADB y Docker
configurados en el mismo entorno). Requisitos:

- Node 22.13 o posterior en la rama 22; `npm ci` en el checkout.
- Java 17, Android SDK 36, herramientas de build y un emulador API 36 iniciado.
- Docker operativo y puertos locales de Supabase libres (54321 y adyacentes).
- Supabase CLI **2.116.0** y Maestro **2.10.0** en PATH.
- Un único Android dedicado visible en `adb devices`. Se instala
  `app.lockin.mobile` y se borran sus datos al inicio; no usar tu instalación personal.

Desde la raíz:

```sh
npm ci
node e2e/run.mjs prepare
node e2e/run.mjs build
node e2e/run.mjs test
node e2e/run.mjs stop
```

Ejecutar `stop` también si falla build/test. Para repetir desde cero, después
de detener el backend, retirar **solo** `e2e/.runtime` y `e2e/artifacts`.
El runner rechaza reutilizar un directorio de preparación/build para evitar
mezclar migraciones o APK antiguos. Por defecto compila x86_64; con emulador
ARM64 en macOS usar `E2E_ANDROID_ARCH=arm64-v8a node e2e/run.mjs build`.

Evidencia en `e2e/artifacts`: JUnit, diagnóstico/capturas de Maestro, logcat
y `postgres.json` solo si todas las verificaciones pasan. Ningún archivo con
las claves del backend forma parte del artefacto que sube CI.

## GitHub Actions: viable y activo

`.github/workflows/e2e.yml` corre en push, PR y manualmente. Ubuntu 24.04
ofrece KVM para un AVD x86_64; no hace falta EAS, una cuenta Maestro Cloud ni
secretos Supabase. Construye el release, ejecuta el mismo runner, conserva
evidencia incluso al fallar y detiene Supabase con `if: always()`.
Tiene límite de 60 minutos y cancela ejecuciones anteriores de la rama.
Jest/contrato remoto permanecen separados y el suelo de cobertura no cambia.

La viabilidad está apoyada en el soporte documentado de KVM y builds locales,
**no en una ejecución remota realizada en esta sesión**. Falta ejecutar este
workflow al subir/integrar la rama y revisar el primer resultado. Esta máquina
no tiene Android SDK, Java, Maestro ni Docker disponibles; no se ha podido
compilar el APK ni verificar los selectores sobre un árbol Android real.
Si el primer run revela un problema de UI o build, conservar sus artefactos y
corregirlo; no convertir el fallo en skip ni retirar la prueba de persistencia.
Conviene también ejecutar una vez un APK sin credenciales para comprobar que
el caso falla después del reinicio (control negativo aún pendiente).

## Decisión y fuentes consultadas

Maestro usa la interfaz/accesibilidad real de React Native sin instrumentación
de producto. Es suficiente para este recorrido y mantiene el alcance del
bloque; no hace falta introducir Detox ni modificar componentes/hooks.
Se usa el botón accesible Like; la mecánica del gesto tiene sus tests propios.

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
- [Builds locales de Expo](https://docs.expo.dev/guides/local-app-development/).
- [Android emulator runner y KVM](https://github.com/ReactiveCircus/android-emulator-runner).
- [Maestro launchApp y clearState](https://docs.maestro.dev/api-reference/commands/launchapp).
- [Selectores Maestro](https://docs.maestro.dev/api-reference/selectors).
- [Configuración Auth local Supabase](https://supabase.com/docs/guides/local-development/cli/config).
## Diagnóstico de la primera ejecución (2026-09-07 UTC)

[Run 34069732039](https://github.com/thejowe/lockin/actions/runs/34069732039),
commit 89a8fb2: Supabase pasó; falló `:app:createBundleReleaseJsAndAssets`:
`Unable to resolve module @/components/themed-text`. No llegó a KVM/Maestro.
La API confirma cero artefactos: upload-artifact avisó `No files were found`.

La copia estaba bajo `node_modules`. El resolver de TypeScript de Expo 57
(`createTypescriptResolver` en el CLI instalado) descarta los alias para cualquier
origen que contenga ese segmento. Ahora la copia vive en el temporal del sistema,
fuera del checkout y de `node_modules`, y `stop` la retira. Se conservan las
configuraciones de producto y todos los pasos del caso.

CI guarda `build.log`, `phases.json` (resultados de backend/build/journey) y
`disk.txt` aunque no se alcance Maestro. El pipe del build usa `shell: bash`,
que activa `pipefail`: `tee` no convierte un build fallido en verde.
Los logs completos de preparación siguen en Actions; no se copian al artefacto
porque Supabase imprime sus claves locales.