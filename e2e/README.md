# E2E Android — Maestro + Supabase local

Caso: `full-journey.yaml`. Runner: `node e2e/run.mjs <fase>`.
Estado: en la última ejecución con emulador
([run 34162107392](https://github.com/thejowe/lockin/actions/runs/34162107392),
commit 696408a) el **control negativo pasó** —el APK con mock llegó al reinicio,
falló allí y no dejó nada en Postgres— y la sonda del teclado también, así que el
compositor de `chat` ya no bloquea. La variante `supabase` sigue en rojo en
"Resultado del recorrido": **el recorrido completo contra Postgres todavía no
está verde**. Los pasos de `seekingSpecialties` son posteriores a esa ejecución y
no han visto un emulador. No se declara un E2E verde por validar YAML, ni por
pasar Jest.

## Qué demuestra

Alta anónima automática (el MVP no tiene pantalla de registro/login) → selección
de modo → formulario completo → deck → like → modal de match → chat → envío →
**parada del proceso y relanzamiento sin borrar almacenamiento** → perfil y
conversación recuperados desde la UI.

Incluye los dos lados de `seekingSpecialties`, que es lo único que la prueba de
punta a punta: se declara en el formulario ("Lo que debe dominar quien busco",
que solo existe con `par` o `ambos`), se lee en la tarjeta del deck la de otra
persona —fila "Busca" y el ✓ de lo que ella busca y yo domino— y se vuelve a
leer la propia en el Perfil **después** del reinicio. Los tests unitarios corren
contra el mock y los de contrato hablan con Postgres sin pasar por la pantalla:
el pegamento pantalla ↔ repositorio solo lo mira este recorrido.

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
los ocho perfiles seed al nuevo perfil E2E, así que cualquiera que salga primero
en el deck corresponde. El like propio entra por la UI y la RPC real crea el
match con las políticas y triggers de producto. No se prueba aquí la UI de un
segundo dispositivo.

El mismo archivo separa los `created_at` del catálogo. `discovery_deck` ordena
por `created_at desc` y el seed inserta los ocho perfiles en la misma
transacción: con las fechas iguales, la tarjeta de arriba la elige el
planificador. Desde que el recorrido afirma qué pone en esa tarjeta hace falta
saber de quién es, y el orden fijado —Núria Bosch primero— es el mismo que da
`src/data/mock/seed.ts`, para que el control negativo vea la tarjeta que ve el
caso positivo. `verify.mjs` comprueba en Postgres que el like cayó justo ahí.

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

## Diagnóstico de la ejecución del 696408a (2026-09-07 UTC)

[Run 34162107392](https://github.com/thejowe/lockin/actions/runs/34162107392),
tres trabajos:

| Variante | Resultado | Qué significa |
| --- | --- | --- |
| `probe` | pasa | el compositor está por encima del teclado |
| `mock` | pasa | el control negativo **falla después del reinicio** y no escribe |
| `supabase` | falla en "Resultado del recorrido" | el caso positivo sigue sin cerrar |

Que el control negativo pase es un resultado de por sí: el runner solo lo da por
bueno si el primer comando fallido está después del `stopApp` y si Postgres no
tiene ni perfil ni mensaje. Es decir, con el mock el recorrido **llegó entero
hasta el reinicio**, incluido el envío del mensaje que llevaba tres rondas
atascado. El compositor de `chat` deja de ser el bloqueo.

Lo que falla es la variante con credenciales, y en un punto que los conclusions
de la API no dicen. El log del trabajo y el artefacto `e2e-android-supabase`
necesitan permisos de administración del repositorio
(`403 Must have admin rights to Repository`) que esa sesión no tenía, así que
allí no se pudo nombrar la causa.

> **Ya no aplica (2026-09-08).** Con `gh` CLI autenticado (scopes `repo` +
> `workflow`), `gh run view --job <id> --log-failed` y `gh run download` leen
> tanto el log como los artefactos. La causa está nombrada en la sección
> siguiente.

## Diagnóstico del d28baa6 (2026-09-08 UTC)

[Run 34172803719](https://github.com/thejowe/lockin/actions/runs/34172803719).
Esta vez los logs sí se leen (`gh run view --job <id> --log-failed`), y los dos
trabajos rojos lo están **por motivos distintos**.

| Variante | Trabajo | Resultado | Dónde |
| --- | --- | --- | --- |
| `probe` | [101896233*](https://github.com/thejowe/lockin/actions/runs/34172803719) | pasa | — |
| `supabase` | [101896233448](https://github.com/thejowe/lockin/actions/runs/34172803719/job/101896233448) | Maestro **1/1 Flow Passed en 2m 59s**; rojo en el oráculo | `e2e/verify.mjs:27` |
| `mock` | [101896233240](https://github.com/thejowe/lockin/actions/runs/34172803719/job/101896233240) | falla en la primera espera, antes del reinicio | `full-journey.yaml:17` |

### `supabase`: el recorrido entero pasa; lo que no cuadra es una cadena

`[Passed] Alta, perfil, deck, match, mensaje y persistencia (2m 59s)`. Es decir:
compositor, envío, `stopApp`, `launchApp clearState: false` y la relectura del
perfil y del mensaje desde Postgres, todo verde en el emulador. Lo único rojo:

```
+ 'Una Herramienta para Construir en equipo'   ← lo que hay en Postgres
- 'Una herramienta para construir en equipo'   ← lo que escribió la UI
```

Algo capitaliza palabra por palabra entre el `inputText` de Maestro y la fila
guardada. **Es un bug de producto, y el caso no se hace inmune a él**: ese campo
es prosa libre y que el teclado la reescriba es corrupción silenciosa de un dato
del usuario. Ningún otro nivel del repo lo puede ver — Jest renderiza sin IME y
los tests de contrato escriben en Postgres sin pasar por la pantalla —, así que
esta comparación es el único sitio donde ese bug existe.

Para que la sensibilidad sea deliberada y no un accidente de la cadena elegida,
`e2e/full-journey.test.mjs` fija dos cosas: que el `.yaml` y `verify.mjs` esperan
la **misma** cadena byte a byte (cerrar el rojo copiando lo capitalizado al
oráculo se rompe aquí) y que la cadena conserva su forma de sonda — mayúscula
inicial, interiores en minúscula. La mayúscula inicial es a propósito:
`autoCapitalize="sentences"` en prosa es comportamiento deseado, no un bug, y el
E2E no debe forzar `none` desde fuera del bloque `perfil`.

### `mock`: un ANR del sistema tapando la pantalla

`[Failed] ... (1m 12s) (Assertion is false: "Cofundador" is visible)` en el
`extendedWaitUntil` de la línea 17, antes de tocar nada. Pero el logcat del
artefacto dice `Displayed app.lockin.mobile/.MainActivity for user 0: +3s934ms`:
la app **sí** arrancó y pintó. El volcado de jerarquía del paso que falla
(`screen-hierarchy/step-005-assertCondition-Cofundador.json`) explica el resto —
la pantalla la ocupaba un diálogo del sistema:

```
android:id/alertTitle  "System UI isn't responding"
android:id/aerr_close  "Close app"
android:id/aerr_wait   "Wait"
```

Con un diálogo modal del sistema delante, Android solo expone esa ventana: el
`assertVisible` estuvo preguntando por la pantalla de SystemUI, no por la app.
Eso no es una respuesta sobre el caso. Contexto: Maestro arranca justo después de
`Boot completed in 65487 ms`, con el sistema todavía instalando paquetes, y el
logcat va lleno de `Slow dispatch` / `Slow operation` de `system_server`.

`triage.mjs` lo clasifica ahora por evidencia, no por texto: si el paso fallido
trae un diálogo `android:id/aerr_*` y el título **no** nombra a la app
(`expo.name` de `app.json`), es caída del runner y se reintenta; si el que no
responde es la app, sigue siendo fallo del caso y no se reintenta nunca. Es la
única excepción a "manda la aserción", y existe porque aquí la aserción no llegó
a mirar la app.

### El mensaje que despistaba

Al fallar antes del `stopApp`, el volcado `commands.json` del control negativo
traía 5 comandos y ninguno era el reinicio — Maestro solo vuelca lo que llegó a
ejecutar. `run.mjs` respondía con *"El caso ya no reinicia la app"*, que era
falso: el `.yaml` sí lo declara. Ahora se distinguen los dos casos leyendo el
`.yaml`, y el segundo dice lo que de verdad pasó: el recorrido no llegó al
reinicio, así que el control negativo no concluye nada sobre la persistencia.

### El rerun: dos causas encadenadas, no una

`gh run rerun 34172803719 --job 101896233240` sobre el mismo commit
([job 102222194124](https://github.com/thejowe/lockin/actions/runs/34172803719/job/102222194124)):
el fallo del `"Cofundador"` **no se reproduce** —era el ANR y nada más— y el
recorrido llega hasta el comando 35 de 36, donde muere en
`Assertion is false: "Núria Bosch" is visible`. Sigue siendo **antes** del
`stopApp`, así que el control negativo sigue sin concluir.

La causa esta vez es estructural. El volcado de ese paso trae el deck cargado y
delante está **Lucía Pardo** —la de delante es la única tarjeta a tamaño
completo, así que el orden se lee en los `bounds`, no en el del volcado—. Las
cuatro aserciones del deck nombran a la persona que el
`update` de `created_at` de `incoming-likes.sql` pone en cabeza, y ese fixture es
de Postgres. Con el APK sin credenciales el orden lo pone `src/data/mock/seed.ts`
y esas líneas no se pueden cumplir por construcción.

Arreglo: esas cuatro —y solo esas— van dentro de un `runFlow` condicionado a
`${DECK_FIXTURE == 'postgres'}`, variable que `run.mjs` pone a `postgres` en la
variante con credenciales y a `memoria` en el control negativo. La variante que
decide el color las ejecuta todas, igual que antes; el `stopApp`, el
`launchApp clearState: false` y la verificación de persistencia siguen siendo
idénticos en las dos. `full-journey.test.mjs` guarda que el bloque contenga
exactamente esas cuatro líneas, que solo haya un `runFlow` en el recorrido, que
el `stopApp` quede fuera de él, y que el primer `assertTrue` rechace un
`DECK_FIXTURE` ausente o mal escrito — para que dejar de pasarlo rompa el
recorrido en vez de saltarse las aserciones en silencio.

### La causa raíz de los dos: el fixture llevaba dos commits sin fijar nada

Segundo run de la rama, tras `gh run rerun --failed`. `supabase` vuelve a pasar
el recorrido entero (`1/1 Flow Passed in 3m 33s`) y el oráculo falla en
`verify.mjs:44`: el like cayó sobre `…0002` (Marc Oller) en vez de sobre `…0001`
(Núria Bosch).

`20260907000200_discovery_mutual_complement` cambió el criterio de
`discovery_deck`: ordena por complementariedad mutua y desempata por `id asc`;
**`created_at` ya no interviene**. El perfil del recorrido domina `dev` y
`marketing` y busca `diseno`, así que Núria puntúa 1 (busca marketing) y Marc
puntúa 2 (busca dev, y domina diseño). Delante estaba Marc.

Es decir, el `update` de `created_at` de `incoming-likes.sql` dejó de fijar nada
en ese merge. La guarda que lo protegía comprobaba que la línea existiera, no que
sirviera, así que siguió en verde todo el tiempo.

Dos consecuencias para leer este directorio:

- **`assertVisible` no dice "delante", dice "en pantalla".** El deck apila tres
  tarjetas y Núria seguía visible detrás, por eso las aserciones del `.yaml`
  pasaban con la tarjeta equivocada delante. Quien cazó el bug fue `verify.mjs`,
  comparando el id sobre el que cayó la decisión.
- **El fixture fija ahora por el criterio que de verdad ordena**: le da a Núria
  la puntuación máxima y, con el id más bajo del seed, también los empates.

### La capitalización del prompt es intermitente

Los dos runs de `supabase` corrieron sobre el mismo commit sin el arreglo de
`perfil`, y solo uno falló en `verify.mjs:27`. Mismo APK, mismo emulador, mismo
texto. Un verde suelto de esa variante no demuestra que el auto-capitalizado esté
arreglado; lo que demuestra es que este es el único nivel donde llega a verse.

### Primer recorrido completo en verde (2026-09-08)

[Run 34281070607, trabajo `supabase`](https://github.com/thejowe/lockin/actions/runs/34281070607/job/102245686110),
commit 78c90b8, paso "Resultado del recorrido (supabase)" en verde:

```
[Passed] Alta, perfil, deck, match, mensaje y persistencia (2m 36s)
Postgres: alta, perfil, lo que busca, modo, like, match y mensaje verificados.
Recorrido supabase verde en attempt-01.
```

Al primer intento y sin reintentos. El workflow completo sigue rojo: el control
negativo se para en `¡Match!` porque la primera tarjeta del orden del mock no
está en `SEED_RECIPROCAL_IDS` (`src/data/mock/seed.ts`).
