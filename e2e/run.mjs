// Linux/macOS runner. Backend state stays in e2e/.runtime; the app uses OS temp.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { classifyFailure, parseAnrDialog, parseMaestroFailure, shouldRetry } from './triage.mjs';
import { verifyAbsence, verifyPersistence } from './verify.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = join(root, 'e2e/.runtime');
const journeyFile = join(root, 'e2e/full-journey.yaml');
// Nombre con el que Android llama a la app en sus propios diálogos. Se lee de
// `app.json` para que no se quede atrás si el bloque `arquitecto` lo cambia: de
// él depende poder decir si el "X no responde" de un ANR habla de nosotros.
const appLabel = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo?.name;
assert(appLabel, 'app.json no declara expo.name: sin él no se puede leer un ANR');
// Control negativo: mismo caso, mismo backend levantado y mismo `adb reverse`.
// Lo único que cambia es que el APK se compila SIN credenciales, así que
// active.ts elige el mock en memoria y el recorrido debe romperse al reiniciar.
// Si algún día pasara en verde, el caso positivo no estaría probando Supabase.
const negative = process.env.E2E_NEGATIVE_CONTROL === '1';
// Sonda de diagnóstico, temporal: mismo APK que el caso positivo (credenciales
// reales incluidas), pero corre `keyboard-probe.yaml` en vez del recorrido
// completo: el camino más corto hasta "¿el compositor está por encima del
// teclado?". Se retira junto con el .yaml en cuanto eso esté verificado.
const probe = process.env.E2E_KEYBOARD_PROBE === '1';
assert(!(negative && probe), 'La sonda de teclado y el control negativo se excluyen');
const variant = negative ? 'mock' : probe ? 'probe' : 'supabase';
// Expo ignores tsconfig aliases for any source path containing /node_modules/.
// Keep the disposable app outside that path AND outside the checkout's TS glob.
const appParent = resolve(tmpdir());
const app = join(
  appParent,
  'lockin-e2e-' + variant + '-' + createHash('sha256').update(root).digest('hex').slice(0, 16)
);
assert(!app.split(/[\\/]/).includes('node_modules'), 'TEMP no puede estar dentro de node_modules');
// Cada variante guarda su evidencia aparte: ninguna pisa las capturas de la otra.
const artifacts = join(root, 'e2e/artifacts', variant);
// Reintentos de Maestro DENTRO del mismo emulador. Cubren la muerte del driver
// gRPC, que deja el AVD vivo y responde en menos de un segundo. Cuando el que se
// cae es el emulador entero hace falta arrancar otro, y eso lo decide el
// workflow con `triage`.
const maestroAttempts = Number(process.env.E2E_MAESTRO_ATTEMPTS ?? '2');
assert(
  Number.isInteger(maestroAttempts) && maestroAttempts >= 1 && maestroAttempts <= 4,
  'E2E_MAESTRO_ATTEMPTS debe ser un entero entre 1 y 4'
);
const command = process.argv[2];
assert(
  ['prepare', 'build', 'test', 'triage', 'gate', 'stop'].includes(command),
  'Uso: node e2e/run.mjs prepare|build|test|triage|gate|stop'
);

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: root,
    stdio: 'inherit',
    ...options,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, binary + ' falló; revisar su salida');
  return result.stdout?.trim();
}
function supabase(args, options) {
  return run('supabase', ['--workdir', runtime, ...args], options);
}
function localBackend() {
  const status = JSON.parse(
    supabase(['status', '-o', 'json'], { stdio: ['ignore', 'pipe', 'inherit'] })
  );
  // Never accept a linked/remote project or keys supplied from the caller.
  assert.equal(status.API_URL, 'http://127.0.0.1:54321', 'Solo Supabase local desechable');
  assert(status.ANON_KEY && status.SERVICE_ROLE_KEY, 'Faltan claves locales; no usar el mock');
  return status;
}
function buildEnv(status) {
  const env = { ...process.env };
  // Do not forward production credentials or service_role into Metro/Gradle.
  for (const key of Object.keys(env)) {
    if (/SUPABASE|^EXPO_PUBLIC_/.test(key)) delete env[key];
  }
  const base = { ...env, CI: '1', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1' };
  // El control negativo se queda aquí: sin estas dos variables el bundle no
  // lleva credenciales y `hasSupabaseCredentials` es falso dentro del APK.
  if (negative) return base;
  return {
    ...base,
    EXPO_PUBLIC_SUPABASE_URL: status.API_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  };
}

/** Estado real del dispositivo según adb. Nunca lanza: solo sirve para diagnosticar. */
function deviceState() {
  const result = spawnSync('adb', ['get-state'], { encoding: 'utf8', timeout: 10000 });
  if (result.error) return 'adb no responde (' + (result.error.code ?? result.error.message) + ')';
  return (result.stdout ?? '').trim() || (result.stderr ?? '').trim() || 'sin estado';
}

/** Volcados de comandos de Maestro de UN intento: en su raíz o en su subcarpeta. */
function commandDumps(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  if (existsSync(join(dir, 'commands.json'))) found.push(join(dir, 'commands.json'));
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, 'commands.json');
    if (existsSync(file)) found.push(file);
  }
  return found;
}

/**
 * Jerarquía de pantalla del ÚLTIMO paso volcado por Maestro, que es el que
 * falló. Se lee durante la ejecución, no después: `collectEvidence` corre en el
 * `finally` y para entonces el diagnóstico ya está tomado.
 *
 * Nunca lanza: es evidencia opcional. Si no está, se decide sin ella.
 */
function lastScreenHierarchy(dir) {
  const roots = [dir];
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) roots.push(join(dir, entry.name));
    }
  }
  for (const base of roots) {
    const folder = join(base, 'screen-hierarchy');
    if (!existsSync(folder)) continue;
    const steps = readdirSync(folder)
      .filter((name) => name.endsWith('.json'))
      .sort();
    if (steps.length === 0) continue;
    try {
      return JSON.parse(readFileSync(join(folder, steps[steps.length - 1]), 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

/** Cada intento escribe en su propia carpeta: ningún reintento pisa la evidencia. */
function nextAttemptDir() {
  const previous = existsSync(artifacts)
    ? readdirSync(artifacts, { withFileTypes: true }).filter(
        (entry) => entry.isDirectory() && /^attempt-\d+$/.test(entry.name)
      ).length
    : 0;
  const dir = join(artifacts, 'attempt-' + String(previous + 1).padStart(2, '0'));
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Primer comando fallido del recorrido, leído del volcado de Maestro.
 * `maestro.xml` solo trae un mensaje; commands.json trae el orden y el estado
 * de cada paso, que es lo que permite decir DÓNDE se rompió.
 *
 * Si Maestro no llegó a ejecutar ningún comando no hay volcado, y eso NO es un
 * resultado del control negativo: la diferencia entre "el mock se rompió antes
 * de tiempo" y "el driver de Maestro se cayó" hay que decirla, no adivinarla.
 */
function firstFailure(dir) {
  const dumps = commandDumps(dir);
  if (dumps.length === 0) {
    const report = join(dir, 'maestro.xml');
    const cause = existsSync(report)
      ? parseMaestroFailure(readFileSync(report, 'utf8')) || 'sin mensaje en maestro.xml'
      : 'no se escribió maestro.xml';
    assert.fail(
      'Maestro no ejecutó ningún comando, así que el control negativo no concluye ' +
        'nada sobre la persistencia. Causa según Maestro: ' +
        cause +
        '. Un DeviceServerDiedException aquí es un fallo del emulador, no del caso: ' +
        'relanzar el job.'
    );
  }
  assert.equal(dumps.length, 1, 'Se esperaba un único volcado de comandos de Maestro');
  const commands = JSON.parse(readFileSync(dumps[0], 'utf8'));
  // Maestro no es uniforme al nombrar las claves (`launchAppCommand`, pero
  // `tapOnElement`), así que se busca por prefijo en vez de por nombre exacto.
  const stopApp = commands.findIndex((entry) =>
    Object.keys(entry.command).some((key) => /^stopApp/i.test(key))
  );
  const failed = commands.findIndex((entry) => entry.metadata?.status === 'FAILED');
  // Maestro solo vuelca los comandos que llegó a EJECUTAR. Que el reinicio no
  // aparezca tiene por tanto dos causas muy distintas, y confundirlas costó una
  // pasada entera: o el `.yaml` lo ha perdido —regresión del caso, que es lo
  // que este control existe para impedir— o el recorrido murió antes de llegar.
  // Solo lo primero se puede afirmar leyendo el `.yaml`; lo segundo se dice
  // como lo que es: el control negativo no concluye nada.
  if (stopApp < 0) {
    assert(
      /^\s*-\s*stopApp\b/m.test(readFileSync(journeyFile, 'utf8')),
      'El caso ya no reinicia la app: el control negativo perdería su sentido'
    );
    assert.fail(
      'El recorrido no llegó al reinicio: Maestro ejecutó ' +
        commands.length +
        ' comando(s) y falló en el ' +
        failed +
        '. `full-journey.yaml` sí declara el `stopApp`, así que esto no dice nada ' +
        'sobre la persistencia: el control negativo solo vale si lo que rompe es ella.'
    );
  }
  assert(stopApp > 0, 'El caso ya no reinicia la app: el control negativo perdería su sentido');
  return { stopApp, failed, commands };
}

/** Lee la evidencia de un intento y decide si falló el caso o se cayó el runner. */
function diagnose(dir) {
  const report = join(dir, 'maestro.xml');
  return classifyFailure({
    failureText: existsSync(report) ? parseMaestroFailure(readFileSync(report, 'utf8')) : '',
    commandDumps: commandDumps(dir).length,
    deviceState: deviceState(),
    anrDialog: parseAnrDialog(lastScreenHierarchy(dir)),
    appLabel,
  });
}

/** Evidencia independiente del escritor de artefactos de Maestro, por intento. */
function collectEvidence(dir) {
  const logs = spawnSync('adb', ['logcat', '-d'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(join(dir, 'logcat.txt'), logs.stdout ?? '');
  const screen = spawnSync('adb', ['exec-out', 'screencap', '-p'], { timeout: 10000 });
  if (screen.status === 0) writeFileSync(join(dir, 'screen.png'), screen.stdout);
  spawnSync('adb', ['shell', 'uiautomator', 'dump', '/sdcard/lockin-window.xml'], {
    timeout: 10000,
  });
  const hierarchy = spawnSync('adb', ['exec-out', 'cat', '/sdcard/lockin-window.xml'], {
    timeout: 10000,
  });
  if (hierarchy.status === 0) writeFileSync(join(dir, 'window.xml'), hierarchy.stdout);
}

/**
 * Veredicto acumulado de la variante. Se anexa, no se pisa: si el workflow
 * arranca un segundo emulador, el historial de los dos queda en el artefacto y
 * `outcome` es siempre el del último intento.
 */
function recordVerdict(entry) {
  mkdirSync(artifacts, { recursive: true });
  const file = join(artifacts, 'verdict.json');
  const verdict = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { variant, runs: [] };
  verdict.runs.push(entry);
  verdict.outcome = entry.outcome;
  writeFileSync(file, JSON.stringify(verdict, null, 2));
  return verdict;
}

function readVerdict() {
  const file = join(artifacts, 'verdict.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
}

if (command === 'prepare') {
  run('docker', ['info'], { stdio: 'ignore' });
  assert(
    !existsSync(runtime),
    'Ya existe e2e/.runtime: detener y retirar esa carpeta antes de otra ejecución'
  );
  mkdirSync(runtime, { recursive: true });
  supabase(['init']);
  const configPath = join(runtime, 'supabase/config.toml');
  let config = readFileSync(configPath, 'utf8');
  assert(
    config.includes('enable_anonymous_sign_ins = false'),
    'Cambió el formato de config de Supabase'
  );
  config = config
    .replace(/^project_id = .*$/m, 'project_id = "lockin-e2e"')
    .replace('enable_anonymous_sign_ins = false', 'enable_anonymous_sign_ins = true');
  writeFileSync(configPath, config);
  cpSync(join(root, 'supabase/migrations'), join(runtime, 'supabase/migrations'), {
    recursive: true,
  });
  writeFileSync(
    join(runtime, 'supabase/seed.sql'),
    readFileSync(join(root, 'supabase/seed.sql'), 'utf8') +
      '\n' +
      readFileSync(join(root, 'e2e/incoming-likes.sql'), 'utf8')
  );
  // Auth, Postgres, REST and Realtime remain real. Omit unrelated services.
  supabase(['start', '-x', 'studio,imgproxy,edge-runtime,logflare,vector,supavisor']);
  supabase(['db', 'reset', '--local']);
  localBackend();
}

if (command === 'build') {
  const status = localBackend();
  assert(!existsSync(app), 'Ya existe el build: usar una ejecución nueva');
  mkdirSync(app, { recursive: true });
  for (const entry of [
    'src',
    'assets',
    'package.json',
    'package-lock.json',
    'app.json',
    'tsconfig.json',
  ]) {
    cpSync(join(root, entry), join(app, entry), { recursive: true });
  }
  // Copy optional bundler configuration if introduced later.
  for (const entry of ['babel.config.js', 'metro.config.js']) {
    if (existsSync(join(root, entry))) cpSync(join(root, entry), join(app, entry));
  }
  const env = buildEnv(status);
  assert.equal(
    negative,
    !('EXPO_PUBLIC_SUPABASE_URL' in env) && !('EXPO_PUBLIC_SUPABASE_ANON_KEY' in env),
    'La variante y las credenciales del build no concuerdan'
  );
  run('npm', ['ci'], { cwd: app, env });
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], { cwd: app, env });
  // Release APK with embedded JS; allow HTTP ONLY in this disposable native build.
  // adb reverse routes device loopback to the local Supabase, including WebSockets.
  const manifest = join(app, 'android/app/src/main/AndroidManifest.xml');
  const xml = readFileSync(manifest, 'utf8');
  writeFileSync(
    manifest,
    xml.includes('android:usesCleartextTraffic=')
      ? xml.replace(/android:usesCleartextTraffic="[^"]*"/, 'android:usesCleartextTraffic="true"')
      : xml.replace('<application ', '<application android:usesCleartextTraffic="true" ')
  );
  const arch = process.env.E2E_ANDROID_ARCH ?? 'x86_64';
  assert(['x86_64', 'arm64-v8a'].includes(arch), 'Arquitectura E2E no soportada');
  run(
    './gradlew',
    ['app:assembleRelease', '-PreactNativeArchitectures=' + arch, '--max-workers=2'],
    { cwd: join(app, 'android'), env }
  );
  writeFileSync(
    join(runtime, 'build-backend-' + variant + '.json'),
    JSON.stringify(
      negative ? { variant } : { variant, url: status.API_URL, anonKey: status.ANON_KEY }
    )
  );
}

if (command === 'test') {
  let status;
  // Lo previo a Maestro va en su propio bloque: si esto revienta no es un fallo
  // del recorrido, y el veredicto tiene que decirlo para que nadie lo reintente
  // creyéndolo flake — salvo que adb confirme que el dispositivo se ha caído.
  try {
    status = localBackend();
    assert.deepEqual(
      JSON.parse(readFileSync(join(runtime, 'build-backend-' + variant + '.json'), 'utf8')),
      negative ? { variant } : { variant, url: status.API_URL, anonKey: status.ANON_KEY },
      'Reconstruir APK: backend distinto'
    );
    mkdirSync(artifacts, { recursive: true });
    // El `adb reverse` se mantiene también en el control negativo: la única
    // variable que cambia entre las dos ejecuciones son las credenciales del APK.
    run('adb', ['reverse', 'tcp:54321', 'tcp:54321']);
    run('adb', [
      'install',
      '-r',
      join(app, 'android/app/build/outputs/apk/release/app-release.apk'),
    ]);
  } catch (error) {
    const state = deviceState();
    const crashed = state !== 'device';
    recordVerdict({
      phase: 'preparación',
      outcome: crashed ? 'runner' : 'desconocido',
      why: (crashed ? 'adb ve el dispositivo como "' + state + '": ' : '') + error.message,
    });
    throw error;
  }

  /**
   * Un intento completo del recorrido, con su carpeta de evidencia y su propio
   * identificador: si el intento anterior llegó a escribir un perfil a medias,
   * el siguiente no comparte nombre con él y el oráculo sigue siendo inequívoco.
   */
  async function attempt(dir) {
    const runId = randomUUID();
    const profileName = 'E2E-' + runId;
    const message = 'Mensaje E2E ' + runId;
    const maestro = [
      'test',
      '--format',
      'junit',
      '--output',
      join(dir, 'maestro.xml'),
      '--debug-output',
      dir,
      '--test-output-dir',
      dir,
      '--flatten-debug-output',
      '-e',
      'PROFILE_NAME=' + profileName,
      '-e',
      'MESSAGE=' + message,
      // Qué fija el orden del deck en esta variante. Con `postgres` corren las
      // aserciones que nombran a la persona que `incoming-likes.sql` pone
      // arriba; con `memoria` no, porque esa fila no existe. El `.yaml` rechaza
      // cualquier otro valor en su primer `assertTrue`, así que dejar de pasar
      // esto rompe el recorrido en vez de saltarse las aserciones en silencio.
      '-e',
      'DECK_FIXTURE=' + (negative ? 'memoria' : 'postgres'),
      probe ? join(root, 'e2e/keyboard-probe.yaml') : journeyFile,
    ];
    writeFileSync(join(dir, 'run.json'), JSON.stringify({ runId, variant }, null, 2));
    // El buffer es del dispositivo, no del intento: sin vaciarlo, el logcat del
    // reintento arrastra el del anterior y no se sabe cuál es cuál.
    spawnSync('adb', ['logcat', '-c'], { timeout: 10000 });
    try {
      const result = spawnSync('maestro', maestro, { cwd: root, stdio: 'inherit' });
      if (result.error) throw result.error;
      // La caída del runner se descarta ANTES de interpretar el resultado, y vale
      // igual para el caso positivo y para el negativo (que espera fallar): un
      // driver muerto no prueba ni que la persistencia esté ni que falte.
      if (result.status !== 0) {
        const diagnosis = diagnose(dir);
        if (diagnosis.kind === 'runner') return { outcome: 'runner', why: diagnosis.why };
        if (!negative) return { outcome: diagnosis.kind, why: diagnosis.why };
      }
      if (negative) {
        assert.notEqual(
          result.status,
          0,
          'El recorrido pasó con el mock: el caso positivo no prueba Supabase'
        );
        const { stopApp, failed, commands } = firstFailure(dir);
        assert(failed >= 0, 'Maestro devolvió error sin marcar ningún comando como fallido');
        assert(
          failed > stopApp,
          'El mock falló ANTES del reinicio (paso ' +
            failed +
            ' de ' +
            commands.length +
            '); el control solo vale si lo que rompe es la persistencia'
        );
        await verifyAbsence(status, profileName, message);
        writeFileSync(
          join(dir, 'postgres.json'),
          JSON.stringify(
            {
              runId,
              variant,
              control: 'negativo',
              failedCommand: failed,
              stopAppCommand: stopApp,
              persistence: 'ausente, como se esperaba',
            },
            null,
            2
          )
        );
        return { outcome: 'pass', why: 'el mock falló después del reinicio y no escribió nada' };
      }
      if (probe) {
        // La sonda se afirma a sí misma dentro del .yaml: si el `assertVisible`
        // de "Enviar mensaje" pasa con el teclado abierto, el compositor está por
        // encima. No se comprueba persistencia — no es lo que se pregunta, y la
        // sonda ya no reinicia la app.
        return { outcome: 'pass', why: 'la sonda del teclado pasó' };
      }
      await verifyPersistence(status, profileName, message);
      writeFileSync(
        join(dir, 'postgres.json'),
        JSON.stringify({ runId, variant, persistence: 'verified' }, null, 2)
      );
      return { outcome: 'pass', why: 'recorrido completo y persistencia verificados' };
    } catch (error) {
      // Un oráculo que falla es un fallo del caso, no del runner: no se reintenta.
      const setup = Boolean(error?.syscall) || error?.code === 'ENOENT';
      return { outcome: setup ? 'desconocido' : 'caso', why: error.message };
    } finally {
      collectEvidence(dir);
    }
  }

  let last;
  for (let index = 1; index <= maestroAttempts; index += 1) {
    const dir = nextAttemptDir();
    console.log('\n=== Recorrido ' + variant + ', ' + basename(dir) + ' ===');
    last = { ...(await attempt(dir)), attempt: basename(dir) };
    recordVerdict(last);
    console.log('Veredicto de ' + basename(dir) + ': ' + last.outcome + ' — ' + last.why);
    if (last.outcome !== 'runner') break;
    if (index === maestroAttempts) break;
    const state = deviceState();
    if (state !== 'device') {
      console.log(
        'El dispositivo está "' + state + '": repetir aquí no arregla nada, hace falta otro AVD.'
      );
      break;
    }
    console.log('Se cayó el runner con el AVD todavía vivo. Se repite el recorrido.');
    // El `reverse` se pierde si el puente reinició; reponerlo es barato y no
    // puede tumbar el intento siguiente, así que va sin `run()`.
    spawnSync('adb', ['reverse', 'tcp:54321', 'tcp:54321'], { stdio: 'inherit' });
  }
  spawnSync('adb', ['reverse', '--remove', 'tcp:54321'], { stdio: 'inherit' });

  assert.equal(
    last.outcome,
    'pass',
    last.outcome === 'runner'
      ? 'El runner se cayó en los ' +
          maestroAttempts +
          ' intentos de este emulador (' +
          last.why +
          '). Eso no dice nada sobre el caso: hace falta otro emulador.'
      : 'Fallo real del recorrido (' + last.outcome + '): ' + last.why
  );
  console.log('Recorrido ' + variant + ' verde en ' + last.attempt + '.');
}

// Lo lee el workflow entre el paso del emulador y su reintento. Nunca falla:
// solo dice si lo que tumbó el paso fue el runner, y por qué lo cree.
if (command === 'triage') {
  const verdict = readVerdict();
  const decision = shouldRetry(verdict);
  console.log(
    'Variante ' +
      variant +
      ': ' +
      (verdict
        ? 'veredicto ' + verdict.outcome + ' tras ' + verdict.runs.length + ' intento(s)'
        : 'sin veredicto') +
      '. Reintentar el emulador: ' +
      decision.retry +
      ' — ' +
      decision.why
  );
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, 'retry=' + decision.retry + '\n');
  }
}

// Resultado real del trabajo, después de todos los emuladores que hayan corrido.
// Los pasos del emulador llevan `continue-on-error`: este es el que falla.
if (command === 'gate') {
  const verdict = readVerdict();
  assert(
    verdict,
    'La variante ' +
      variant +
      ' no dejó veredicto en ninguna pasada del emulador: mirar los logs del paso, no el caso.'
  );
  const runs = verdict.runs.length;
  const why = verdict.runs[runs - 1].why;
  assert.equal(
    verdict.outcome,
    'pass',
    verdict.outcome === 'runner'
      ? 'Emulador inestable en los ' + runs + ' intentos: ' + why + '. No hay veredicto del caso.'
      : 'Recorrido ' + variant + ' en rojo (' + verdict.outcome + '): ' + why
  );
  console.log('Recorrido ' + variant + ' verde tras ' + runs + ' intento(s).');
}

if (command === 'stop') {
  try {
    if (existsSync(join(runtime, 'supabase/config.toml'))) supabase(['stop', '--no-backup']);
  } finally {
    assert.equal(dirname(resolve(app)), appParent, 'Solo retirar la copia temporal de esta app');
    rmSync(app, { recursive: true, force: true });
  }
}
