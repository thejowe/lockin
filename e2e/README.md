# E2E Android — Maestro + Supabase local

Caso: `full-journey.yaml`. Runner: `node e2e/run.mjs <fase>`.
Estado: build, emulador y 38 de los 48 pasos del recorrido verificados en
Actions contra Supabase real. **Bloqueado por un defecto de producto en `chat`**
(el compositor queda bajo el teclado en Android 15+); detalle al final.
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

`build` copia la app a `<temporal del sistema>/lockin-e2e-<variante>-<hash del checkout>`, instala su lockfile y genera allí el
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

Ejecutar `stop` también si falla build/test: retira también la copia temporal de la app. Para repetir desde cero, después
de detener el backend, retirar **solo** `e2e/.runtime` y `e2e/artifacts`.
El runner rechaza reutilizar un directorio de preparación/build para evitar
mezclar migraciones o APK antiguos. Por defecto compila x86_64; con emulador
ARM64 en macOS usar `E2E_ANDROID_ARCH=arm64-v8a node e2e/run.mjs build`.

Evidencia en `e2e/artifacts/<variante>/attempt-NN/`: JUnit, diagnóstico/capturas
de Maestro, logcat, `screen.png`/`window.xml` tomados por `adb` y `postgres.json`
solo si todas las verificaciones pasan. Cada intento tiene su carpeta y su
`run.json`; el veredicto acumulado de la variante está en `verdict.json`, en la
raíz. Ningún archivo con las claves del backend forma parte del artefacto que
sube CI.

## El reintento: qué se repite y qué no

El emulador de Actions se cae solo. `device offline`,
`StatusRuntimeException: UNAVAILABLE` y `DeviceServerDiedException` tumbaron 3 de
los 7 trabajos del 2026-09-07 sin relación con el código: cada pasada devolvía
menos de la mitad de la señal. Pero un reintento a ciegas es peor que no tenerlo,
porque repetiría un bug real hasta verlo verde. La regla es de lista cerrada:

> se reintenta **solo** si el fallo coincide con una firma conocida de caída de
> infraestructura. Todo lo demás —incluido lo que no se sabe clasificar— tumba el
> trabajo tal cual.

Las firmas están en `e2e/triage.mjs`, con sus casos en `e2e/triage.test.mjs`
(`npm run test:e2e`, que corre en CI). Dos detalles que sostienen la garantía:

- Las firmas de fallo **del caso** (`Element not found`, `Assertion is false`) se
  comprueban **antes** que las de infraestructura. Si el driver muere después de
  que el recorrido ya haya fallado, el mensaje trae las dos cosas y manda la
  aserción.
- El estado de `adb` solo decide cuando Maestro no dejó ningún mensaje. Y no
  saber en qué estado está el dispositivo no cuenta como caída.

Hay dos niveles, porque hay dos formas de caerse:

| Nivel | Qué cubre | Dónde |
|---|---|---|
| `E2E_MAESTRO_ATTEMPTS` (2 por defecto) | El driver gRPC muere con el AVD vivo — falla en menos de un segundo | Bucle dentro de `run.mjs test` |
| Segundo paso del emulador en el workflow | El AVD entero se cae o no arranca | `triage` decide, `journey_retry` ejecuta |

Los pasos del emulador llevan `continue-on-error`; quien decide el color del
trabajo es `node e2e/run.mjs gate`, al final y con todos los intentos a la vista.
Sin veredicto escrito (`verdict.json`) se reintenta: eso significa que el proceso
no sobrevivió al emulador, nunca que el caso fallara — un fallo del caso siempre
deja veredicto.

## Control negativo: el mismo caso con un APK sin credenciales

`E2E_NEGATIVE_CONTROL=1` compila el APK **sin** `EXPO_PUBLIC_SUPABASE_*`, así que
`src/data/active.ts` elige el mock en memoria. Todo lo demás es idéntico: el
mismo Supabase levantado, el mismo `adb reverse` y el mismo `full-journey.yaml`.
La única variable que cambia son las credenciales del bundle.

En esa variante el runner invierte el criterio y exige tres cosas:

1. Maestro termina con error.
2. El primer comando fallido está **después** del `stopApp`, leído de
   `commands.json`. Si el mock se rompiera antes, el control no probaría que lo
   que falta es la persistencia, y el runner lo rechaza diciéndolo.
3. Postgres no tiene ni el perfil ni el mensaje de esa ejecución — comprobando
   primero que la base responde y tiene seed, para que una base caída no se
   confunda con una ausencia legítima.

Las dos variantes corren como una matriz en el mismo workflow, con
`fail-fast: false` y artefactos separados (`e2e-android-supabase` y
`e2e-android-mock`). El control negativo corre en cada push, no solo a mano: si
algún día pasara en verde, el caso positivo habría dejado de probar Supabase y
hay que enterarse ese día.

```sh
# En local, secuencialmente: cada variante necesita su propio prepare/stop.
E2E_NEGATIVE_CONTROL=1 node e2e/run.mjs prepare
E2E_NEGATIVE_CONTROL=1 node e2e/run.mjs build
E2E_NEGATIVE_CONTROL=1 node e2e/run.mjs test
E2E_NEGATIVE_CONTROL=1 node e2e/run.mjs stop
```

## GitHub Actions: viable y activo

`.github/workflows/e2e.yml` corre en push, PR y manualmente. Ubuntu 24.04
ofrece KVM para un AVD x86_64; no hace falta EAS, una cuenta Maestro Cloud ni
secretos Supabase. Construye el release, ejecuta el mismo runner, conserva
evidencia incluso al fallar y detiene Supabase con `if: always()`.
Tiene límite de 90 minutos —caben dos emuladores— y cancela ejecuciones
anteriores de la rama.
Jest/contrato remoto permanecen separados y el suelo de cobertura no cambia.

El soporte de KVM se ha confirmado ejecutando: el AVD API 36 arranca en ~77 s y
Maestro conduce la app real. Esta máquina no dispone de Android SDK, Java,
Maestro ni Docker, así que toda corrección se valida en Actions.

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
## Diagnóstico de la segunda y tercera ejecución (2026-09-07 UTC)

[Run 34070646301](https://github.com/thejowe/lockin/actions/runs/34070646301),
commit 0f9be5b: el bundle ya resuelve los alias. `BUILD SUCCESSFUL in 8m 44s`,
KVM levanta el AVD (`Boot completed in 77441 ms`) y Maestro arranca la app.
Falló en el primer paso, `extendedWaitUntil "Cofundador"` (60 s), con la app
viva y sin excepción en logcat: arranque en frío del emulador. El artefacto de
ese run no traía capturas — `--debug-output` no las escribió — y por eso
b77b9d7 añadió `--test-output-dir`, `--flatten-debug-output` y una captura
propia por `adb`.

[Run 34115169719](https://github.com/thejowe/lockin/actions/runs/34115169719),
commit b77b9d7: el mismo paso pasa sin cambios en el caso, lo que confirma que
aquello fue arranque en frío y no un selector equivocado. El recorrido llega a
**38 de 48 comandos**, todos COMPLETED: alta anónima, modo, formulario entero
con sus scrolls, `Crear perfil`, deck, `Like`, `¡Match!`, `Abrir chat` y el
texto escrito en el compositor, contra Supabase local real.

Falla en `tapOn "Enviar mensaje"`: `Element not found`. La captura y el volcado
de jerarquía del paso 038 muestran por qué — con el teclado abierto, la ventana
**no se redimensiona** y el compositor entero (`EditText "Mensaje"` y el botón
`Enviar mensaje`) desaparece del árbol de accesibilidad. Es un defecto de
producto del bloque `chat` en Android 15+ con edge-to-edge, no del caso E2E;
está reportado en `docs/plan/todo/chat.md` con esa evidencia. No se corrige
aquí ni se esquiva metiendo un `hideKeyboard` antes del envío: eso dejaría el
E2E en verde sobre una pantalla que un usuario real no puede usar.
