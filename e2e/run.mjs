// Linux/macOS runner. Backend state stays in e2e/.runtime; the app uses OS temp.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
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
import {
  classifyFailure,
  mergeAppQueryErrors,
  parseAnrDialog,
  parseAppQueryErrors,
  parseCommandFailures,
  parseMaestroFailure,
  shouldRetry,
} from './triage.mjs';
import {
  prepareSessionRating,
  prepareSessionStreak,
  verifyAbsence,
  verifyPendingRegistration,
  verifyPersistence,
  verifyRegistration,
  verifySessionAttendance,
  verifySessionRating,
} from './verify.mjs';
import { mailpitUrl, resolveVerifyLink, waitForVerifyLink } from './mail.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = join(root, 'e2e/.runtime');
const journeyFile = join(root, 'e2e/full-journey.yaml');
// Segundo caso, solo con credenciales: entra y sale de la sesión que deja
// `e2e/session-now.sql` en el match del recorrido. Ver la cabecera de ese `.yaml`.
const sessionFile = join(root, 'e2e/session.yaml');
// Tercer caso, encadenado al anterior: valora de un toque esa misma sesión, ya
// terminada por `prepareSessionRating`. Ver la cabecera de ese `.yaml`.
const ratingFile = join(root, 'e2e/session-rate.yaml');
// Cuarto caso, encadenado al anterior: la racha de pareja en Matches y en el
// chat, con la sesión anterior que siembra `prepareSessionStreak`.
const streakFile = join(root, 'e2e/session-streak.yaml');
// El alta con email, en dos mitades con el correo en medio: solo en `registro`.
const registerFile = join(root, 'e2e/register.yaml');
const registerConfirmFile = join(root, 'e2e/register-confirm.yaml');
const signInFile = join(root, 'e2e/sign-in.yaml');
const passwordResetFile = join(root, 'e2e/password-reset.yaml');
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
// Aquí vivió `E2E_KEYBOARD_PROBE`, una tercera variante (`probe`) que corría
// `keyboard-probe.yaml` con el APK del caso positivo para preguntar por el
// camino corto si el compositor quedaba por encima del teclado. Se retiró el
// 2026-09-09: `full-journey.yaml` afirma ya eso mismo y más —pulsa "Enviar
// mensaje" con el teclado delante, y detrás afirma el compositor deshabilitado
// y la burbuja sin cerrarlo—, así que la sonda solo repetía una pregunta
// cerrada a cambio de un emulador entero por push.
// Tercera variante, `registro`: el APK lleva credenciales y la puerta de cuenta
// obligatoria ENCENDIDA —la de `supabase` la apaga, ver `buildEnv`—, y lo único
// que recorre es el alta y la recuperación con email: la pantalla «Crea tu cuenta», el correo que
// deja GoTrue en Mailpit, el enlace de vuelta por `lockin://auth/callback` y la
// contraseña. Va aparte y no delante de `full-journey.yaml` porque la puerta se
// decide al compilar: meterla en el APK de `supabase` obligaría a tocar el caso
// que comparte con el control negativo.
const registration = process.env.E2E_REGISTRATION === '1';
assert(!(negative && registration), 'El control negativo no tiene cuentas que registrar');
const variant = negative ? 'mock' : registration ? 'registro' : 'supabase';
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
  ['prepare', 'build', 'test', 'triage', 'containers', 'gate', 'stop'].includes(command),
  'Uso: node e2e/run.mjs prepare|build|test|triage|containers|gate|stop'
);
// PostgREST >= v16.3 trae el arreglo de PostgREST/postgrest#5196, la causa del
// `PGRST303` intermitente («JWT issued at future») que tumbó el E2E: tras un
// rato sin tráfico su primera petición valida contra un reloj viejo. La CLI
// 2.116.0 de CI levanta v16.1 y la 2.117.0 (la última estable) v16.2, así que
// `supabase/setup-cli` no la trae y se fija la imagen desde aquí. Cuando una CLI
// estable levante >= v16.3 por defecto, esta fijación sobra y se retira.
// Vacía, no se fija nada y el Supabase local usa lo que traiga la CLI.
const postgrestVersion = process.env.E2E_POSTGREST_VERSION ?? 'v16.3';
assert(
  postgrestVersion === '' || /^v\d+\.\d+(\.\d+)?$/.test(postgrestVersion),
  'E2E_POSTGREST_VERSION debe ser una etiqueta tipo v16.3, o vacía para no fijar nada'
);
// Nombres que la CLI da a los contenedores: `supabase_<servicio>_<project_id>`,
// con el `project_id` que `prepare` escribe en el config.
const restContainer = 'supabase_rest_lockin-e2e';

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
  const env = { ...process.env };
  // setup-cli fija GHCR en Actions. El run 35899273763 cayó tres veces por
  // throttling antes de compilar. Sin esa fijación, la CLI 2.116.0 ya prueba
  // ECR, GHCR y origen, con las mismas etiquetas: no duplicar sus reintentos.
  if (env.GITHUB_ACTIONS === 'true' && env.SUPABASE_INTERNAL_IMAGE_REGISTRY === 'ghcr.io') {
    delete env.SUPABASE_INTERNAL_IMAGE_REGISTRY;
  }
  return run('supabase', ['--workdir', runtime, ...args], { env, ...options });
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
  //
  // Pero desde A3 el APK es una release y la guarda de backend mata el arranque
  // antes de la primera pantalla (`FATAL EXCEPTION ... LockIn no puede arrancar
  // sin backend`, run 35362453233). El mock en release solo se permite si se
  // pide a mano, así que el control negativo pide permiso explícito: sigue sin
  // credenciales — que es lo que lo hace control — pero ahora arranca y llega al
  // `stopApp`, donde tiene que fallar.
  if (negative) return { ...base, EXPO_PUBLIC_LOCKIN_ALLOW_MOCK: '1' };
  // `registro` es una build de usuario en lo que importa aquí: sin
  // `EXPO_PUBLIC_REQUIRE_ACCOUNT`, la puerta queda encendida.
  if (registration) {
    return {
      ...base,
      EXPO_PUBLIC_SUPABASE_URL: status.API_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    };
  }
  return {
    ...base,
    EXPO_PUBLIC_SUPABASE_URL: status.API_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    // Apaga la puerta de cuenta obligatoria que `perfil` encendió el 2026-09-20
    // (`registrationRequired` en src/features/profile/account-gateway.ts). Con
    // ella encendida el APK arranca en «Crea tu cuenta» y `full-journey.yaml`
    // muere en su primera afirmación ("Cofundador" is visible, run 35476986324):
    // el recorrido entra anónimo y aquí no hay buzón en el que pinchar el enlace
    // de confirmación, así que la puerta no se abriría nunca.
    //
    // Va SOLO en esta build desechable: una build de usuario no lleva la
    // variable y el alta le sigue exigiendo cuenta. El precio es que el registro
    // —la pantalla, el ascenso de la sesión anónima y el enlace del correo— no
    // lo recorre nadie en un dispositivo; queda cubierto solo por los tests de
    // Jest con dobles. Lo recorre en un dispositivo la variante `registro`, con su
    // propio APK: la puerta es de compilación y no cabe en los dos a la vez.
    EXPO_PUBLIC_REQUIRE_ACCOUNT: 'false',
  };
}

/** Estado real del dispositivo según adb. Nunca lanza: solo sirve para diagnosticar. */
function deviceState() {
  const result = spawnSync('adb', ['get-state'], { encoding: 'utf8', timeout: 10000 });
  if (result.error) return 'adb no responde (' + (result.error.code ?? result.error.message) + ')';
  return (result.stdout ?? '').trim() || (result.stderr ?? '').trim() || 'sin estado';
}

/** `date -u +%s` del runner. Nunca lanza: es evidencia, no un requisito. */
function unixNow() {
  const result = spawnSync('date', ['-u', '+%s'], { encoding: 'utf8', timeout: 10000 });
  const epoch = Number((result.stdout ?? '').trim());
  return Number.isInteger(epoch) && epoch > 0 ? epoch : Math.floor(Date.now() / 1000);
}

/** `date +%s` del emulador, o `null` si adb no responde. Nunca lanza. */
function adbEpoch() {
  const result = spawnSync('adb', ['shell', 'date', '+%s'], { encoding: 'utf8', timeout: 10000 });
  const epoch = Number((result.stdout ?? '').trim());
  return Number.isInteger(epoch) && epoch > 0 ? epoch : null;
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
        (failed + 1) +
        '. `full-journey.yaml` sí declara el `stopApp`, así que esto no dice nada ' +
        'sobre la persistencia: el control negativo solo vale si lo que rompe es ella.'
    );
  }
  assert(stopApp > 0, 'El caso ya no reinicia la app: el control negativo perdería su sentido');
  return { stopApp, failed, commands };
}

/** Lee evidencia JSON opcional: un volcado ausente o truncado no frena el diagnóstico. */
function readCommandDump(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Lee la evidencia de un intento y decide si falló el caso o se cayó el runner. */
function diagnose(dir) {
  const report = join(dir, 'maestro.xml');
  const dumps = commandDumps(dir);
  const failureText = [
    ...dumps.map((file) => parseCommandFailures(readCommandDump(file))),
    existsSync(report) ? parseMaestroFailure(readFileSync(report, 'utf8')) : '',
  ]
    .filter(Boolean)
    .join('\n');
  return classifyFailure({
    failureText,
    commandDumps: dumps.length,
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
 * Errores de la app que dejó este intento en el logcat que acaba de volcar
 * `collectEvidence`. Se lee SIEMPRE, pase lo que pase con el diagnóstico: ver
 * la cabecera de `parseAppQueryErrors`.
 */
function appQueryErrors(dir) {
  const file = join(dir, 'logcat.txt');
  if (!existsSync(file)) return [];
  return parseAppQueryErrors(readFileSync(file, 'utf8'));
}

/**
 * Veredicto acumulado de la variante. Se anexa, no se pisa: si el workflow
 * arranca un segundo emulador, el historial de los dos queda en el artefacto y
 * `outcome` es siempre el del último intento.
 *
 * `appErrors` de la raíz es la unión de los de todos los intentos, incluidos
 * los que el reintento dejó atrás. Es deliberado que siga ahí cuando
 * `outcome` es `pass`: un error de la app tapado por un ANR y borrado por el
 * reintento es precisamente lo que esto viene a impedir.
 */
function recordVerdict(entry) {
  mkdirSync(artifacts, { recursive: true });
  const file = join(artifacts, 'verdict.json');
  const verdict = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { variant, runs: [] };
  verdict.runs.push(entry);
  verdict.outcome = entry.outcome;
  verdict.appErrors = mergeAppQueryErrors(verdict.runs);
  writeFileSync(file, JSON.stringify(verdict, null, 2));
  return verdict;
}

/** Los errores de app a una línea, para que el log del paso no obligue a abrir el artefacto. */
function reportAppErrors(errors, where) {
  for (const error of errors) {
    console.log(
      'Error de la app en el logcat de ' +
        where +
        ': la consulta "' +
        error.key +
        '" falló' +
        (error.code ? ' [' + error.code + ']' : '') +
        ' — ' +
        error.message
    );
  }
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
  // El Auth del proyecto real tal y como lo dejó el usuario el 2026-09-20
  // (`supabase/README.md` → «Configuración de Auth en el dashboard»), que es lo
  // que el registro necesita y los valores por defecto de la CLI contradicen.
  // Solo en `registro`: las otras dos variantes no tocan cuentas con email.
  if (registration) {
    const auth = [
      // «Confirm email» ACTIVADO: sin él GoTrue confirma el cambio de email en el
      // acto, no manda correo y la app nunca pasa por `pending-email`.
      [/(\[auth\.email\][^[]*?)enable_confirmations = false/, '$1enable_confirmations = true'],
      // «Secure email change» DESACTIVADO, como en el dashboard.
      ['double_confirm_changes = true', 'double_confirm_changes = false'],
      // `lockin://auth/callback` en Redirect URLs: sin él GoTrue cae en `site_url`.
      [
        'additional_redirect_urls = ["https://127.0.0.1:3000"]',
        'additional_redirect_urls = ["https://127.0.0.1:3000", "lockin://auth/callback"]',
      ],
      // 2 correos/hora de la CLI no aguantan un reintento de Maestro más otro
      // emulador: cada intento manda el suyo. No es algo que el caso pruebe.
      ['email_sent = 2', 'email_sent = 10'],
    ];
    for (const [from, to] of auth) {
      const patched = config.replace(from, to);
      // Un no-op aquí dejaría el registro probando otra configuración que la de
      // producción sin que nada lo dijera.
      assert.notEqual(patched, config, 'Cambió el formato de config de Supabase: ' + from);
      config = patched;
    }
  }
  writeFileSync(configPath, config);
  cpSync(join(root, 'supabase/migrations'), join(runtime, 'supabase/migrations'), {
    recursive: true,
  });
  writeFileSync(
    join(runtime, 'supabase/seed.sql'),
    readFileSync(join(root, 'supabase/seed.sql'), 'utf8') +
      '\n' +
      readFileSync(join(root, 'e2e/incoming-likes.sql'), 'utf8') +
      '\n' +
      readFileSync(join(root, 'e2e/session-now.sql'), 'utf8')
  );
  // La CLI lee `supabase/.temp/rest-version` —lo escribe `supabase link`— para
  // cambiar la etiqueta de la imagen de PostgREST. Aquí se usa sin proyecto
  // enlazado, y por eso se comprueba abajo qué imagen quedó corriendo.
  if (postgrestVersion !== '') {
    mkdirSync(join(runtime, 'supabase/.temp'), { recursive: true });
    writeFileSync(join(runtime, 'supabase/.temp/rest-version'), postgrestVersion);
  }
  // Auth, Postgres, REST and Realtime remain real. Omit unrelated services.
  supabase(['start', '-x', 'studio,imgproxy,edge-runtime,logflare,vector,supavisor']);
  const restImage = run('docker', ['inspect', '-f', '{{.Config.Image}}', restContainer], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  console.log('PostgREST del Supabase local: ' + restImage);
  // Sin esta guarda, que la CLI ignorase el archivo dejaría el E2E en la v16.1
  // de siempre y nadie se enteraría de que la causa del PGRST303 sigue puesta.
  if (postgrestVersion !== '') {
    assert(
      restImage.endsWith(':' + postgrestVersion),
      'La CLI no aplicó rest-version: PostgREST corre como ' +
        restImage +
        ' y se pidió ' +
        postgrestVersion
    );
  }
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
  // El enlace del correo vuelve por el esquema `lockin` de app.json, que
  // `prebuild` convierte en un intent-filter. Sin él `am start` no encuentra a
  // quién entregar el enlace; mejor saberlo aquí que tras 15 min de emulador.
  if (registration) {
    assert.match(xml, /android:scheme="lockin"/, 'El manifiesto no declara el esquema lockin://');
  }
  // El daemon de Gradle se queda sin Metaspace compilando este árbol nativo.
  // Lo destapó el bloque `video` al meter `react-native-webrtc`: el primer build
  // que llegó a Gradle desde entonces murió en
  // `:react-native-async-storage_async-storage:lintVitalAnalyzeRelease` con
  // `> Metaspace` (run 35116867137, `BUILD FAILED in 13m`), sin llegar a Maestro.
  //
  // El propio Gradle nombra el mando en ese log —«These settings can be adjusted
  // by setting 'org.gradle.jvmargs'»— y dice cuánto había: heap 2 GiB y
  // metaspace 512 MiB, que es el stock que planta `expo prebuild`. 512 MiB no le
  // llega a Android Lint con estos módulos. El runner tiene 16 GB, así que esto
  // va sobrado sin acercarse al límite.
  //
  // Se parchea aquí y no en un `android/gradle.properties` del repo porque
  // `android/` lo regenera `prebuild` en cada pasada y está en `.gitignore` —
  // mismo motivo por el que el manifiesto de arriba también se parchea después.
  //
  // Si vuelve a caerse por Metaspace pese a esto, la otra salida es sacar
  // `lintVitalRelease` del build de E2E (`-x lintVitalAnalyzeRelease`): lo que
  // comprueba ese lint no es lo que este workflow viene a comprobar. No se hace
  // ya porque excluir por nombre depende de que case en los módulos de librería
  // generados, y eso no se puede verificar sin gastar otro build de 13 min.
  const gradleProps = join(app, 'android/gradle.properties');
  const propsBefore = readFileSync(gradleProps, 'utf8');
  const propsAfter = propsBefore.replace(
    /^org\.gradle\.jvmargs=.*$/m,
    'org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g'
  );
  // Sin esta guarda, que Expo renombrase o comentara la línea dejaría el parche
  // en nada y el build volvería a morir igual 13 minutos después, sin que nada
  // dijera por qué. Un no-op silencioso aquí cuesta un run entero.
  assert.notEqual(
    propsAfter,
    propsBefore,
    'No se encontró `org.gradle.jvmargs` en el gradle.properties de prebuild: ' +
      'revisa la plantilla de Expo antes de fiarte de este build'
  );
  writeFileSync(gradleProps, propsAfter);
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
      journeyFile,
    ];
    writeFileSync(join(dir, 'run.json'), JSON.stringify({ runId, variant }, null, 2));
    // Ancla temporal para cruzar con `containers/*.log`, que llevan marcas de
    // tiempo de Docker (UTC). Sin ella, un PGRST303 del logcat no se puede
    // situar respecto a lo que hacían GoTrue y PostgREST en ese segundo.
    const clock = {
      recorridoEpoch: unixNow(),
      recorridoIso: new Date().toISOString(),
      // El reloj del emulador es otro que el del runner (donde corren los
      // contenedores): se guarda por si algún día el desfase estuviera de ese lado.
      dispositivoEpoch: adbEpoch(),
    };
    writeFileSync(join(dir, 'clock.json'), JSON.stringify(clock, null, 2));
    console.log('Recorrido ' + basename(dir) + ' arranca en epoch ' + clock.recorridoEpoch + '.');
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
            (failed + 1) +
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
      await verifyPersistence(status, profileName, message);

      // Su propia carpeta de evidencia dentro del intento: `diagnose` lee los
      // volcados de Maestro de la carpeta que se le pasa.
      const sessionDir = join(dir, 'session');
      mkdirSync(sessionDir, { recursive: true });
      const sessionRun = spawnSync(
        'maestro',
        [
          'test',
          '--format',
          'junit',
          '--output',
          join(sessionDir, 'maestro.xml'),
          '--debug-output',
          sessionDir,
          '--test-output-dir',
          sessionDir,
          '--flatten-debug-output',
          '-e',
          'MESSAGE=' + message,
          sessionFile,
        ],
        { cwd: root, stdio: 'inherit' }
      );
      if (sessionRun.error) throw sessionRun.error;
      if (sessionRun.status !== 0) {
        const diagnosis = diagnose(sessionDir);
        return { outcome: diagnosis.kind, why: 'session.yaml: ' + diagnosis.why };
      }
      await verifySessionAttendance(status, profileName);

      // La sesión que se acaba de vivir se envejece hasta dejarla terminada y
      // con los dos dentro: es la única forma de llegar a la repesca sin dejar
      // dos sesiones en el match, donde la viva taparía a la valorable.
      await prepareSessionRating(status, profileName);

      const ratingDir = join(dir, 'rating');
      mkdirSync(ratingDir, { recursive: true });
      const ratingRun = spawnSync(
        'maestro',
        [
          'test',
          '--format',
          'junit',
          '--output',
          join(ratingDir, 'maestro.xml'),
          '--debug-output',
          ratingDir,
          '--test-output-dir',
          ratingDir,
          '--flatten-debug-output',
          '-e',
          'MESSAGE=' + message,
          ratingFile,
        ],
        { cwd: root, stdio: 'inherit' }
      );
      if (ratingRun.error) throw ratingRun.error;
      if (ratingRun.status !== 0) {
        const diagnosis = diagnose(ratingDir);
        return { outcome: diagnosis.kind, why: 'session-rate.yaml: ' + diagnosis.why };
      }
      await verifySessionRating(status, profileName);

      // Después del oráculo de la valoración: la sesión sembrada queda fuera de
      // su ventana de 24 h y no toca `session_ratings`. Sin oráculo detrás: la
      // racha no se guarda, así que lo que se comprueba es lo que pinta la app.
      await prepareSessionStreak(status, profileName);

      const streakDir = join(dir, 'streak');
      mkdirSync(streakDir, { recursive: true });
      const streakRun = spawnSync(
        'maestro',
        [
          'test',
          '--format',
          'junit',
          '--output',
          join(streakDir, 'maestro.xml'),
          '--debug-output',
          streakDir,
          '--test-output-dir',
          streakDir,
          '--flatten-debug-output',
          streakFile,
        ],
        { cwd: root, stdio: 'inherit' }
      );
      if (streakRun.error) throw streakRun.error;
      if (streakRun.status !== 0) {
        const diagnosis = diagnose(streakDir);
        return { outcome: diagnosis.kind, why: 'session-streak.yaml: ' + diagnosis.why };
      }

      writeFileSync(
        join(dir, 'postgres.json'),
        JSON.stringify(
          {
            runId,
            variant,
            persistence: 'verified',
            session: 'verified',
            rating: 'verified',
            streak: 'verified',
          },
          null,
          2
        )
      );
      return { outcome: 'pass', why: 'recorrido, persistencia y sesión Lock-In verificados' };
    } catch (error) {
      // Un oráculo que falla es un fallo del caso, no del runner: no se reintenta.
      const setup = Boolean(error?.syscall) || error?.code === 'ENOENT';
      return { outcome: setup ? 'desconocido' : 'caso', why: error.message };
    } finally {
      collectEvidence(dir);
    }
  }

  /** Una pasada de Maestro con su propia carpeta de evidencia, que es la que lee `diagnose`. */
  function maestroFlow(dir, file, vars) {
    mkdirSync(dir, { recursive: true });
    const result = spawnSync(
      'maestro',
      [
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
        ...Object.entries(vars).flatMap(([key, value]) => ['-e', key + '=' + value]),
        file,
      ],
      { cwd: root, stdio: 'inherit' }
    );
    if (result.error) throw result.error;
    return result.status;
  }

  /**
   * Un intento de la variante `registro`: el alta con email de punta a punta.
   *
   *   register.yaml          → «Crea tu cuenta», email, «Confirma tu email»
   *   oráculo                → la cuenta anónima espera ese email (su uid)
   *   Mailpit → GoTrue       → el enlace del correo, resuelto a lockin://…?code=
   *   am start               → el enlace entra en la app por el esquema
   *   register-confirm.yaml  → contraseña, la puerta se abre y sigue abierta
   *   oráculo                → mismo uid, email confirmado, la contraseña entra
   *   perfil fixture         → ficha única en ese uid, antes de borrar el estado
   *   sign-in.yaml           → instalación limpia, entrar y recuperar esa ficha
   *   password-reset.yaml    → request, correo, am start, confirm
   *   sign-in.yaml           → instalación limpia con la contraseña nueva
   *   oráculo                → mismo uid y perfil; la contraseña vieja rechazada
   *
   * El email lleva el id del intento: un reintento no choca con la cuenta que el
   * anterior dejara a medias, ni lee su correo.
   */
  async function registrationAttempt(dir) {
    const runId = randomUUID();
    const email = 'e2e-' + runId + '@example.com';
    const password = 'E2e-' + randomUUID();
    writeFileSync(join(dir, 'run.json'), JSON.stringify({ runId, variant, email }, null, 2));
    const clock = {
      recorridoEpoch: unixNow(),
      recorridoIso: new Date().toISOString(),
      dispositivoEpoch: adbEpoch(),
    };
    writeFileSync(join(dir, 'clock.json'), JSON.stringify(clock, null, 2));
    spawnSync('adb', ['logcat', '-c'], { timeout: 10000 });
    try {
      if (maestroFlow(dir, registerFile, { EMAIL: email }) !== 0) {
        const diagnosis = diagnose(dir);
        return { outcome: diagnosis.kind, why: 'register.yaml: ' + diagnosis.why };
      }
      const userId = await verifyPendingRegistration(status, email);

      const link = await waitForVerifyLink(status, email);
      const callback = await resolveVerifyLink(link);
      // El `code` es de un solo uso y ya es una credencial: al artefacto va sin él.
      writeFileSync(
        join(dir, 'mail.json'),
        JSON.stringify(
          {
            email,
            userId,
            verifyLink: link.replace(/token=[^&]+/, 'token=…'),
            callback: callback.replace(/code=[^&]+/, 'code=…'),
          },
          null,
          2
        )
      );
      // `adb shell` pasa la orden a un shell del dispositivo: entre comillas, o
      // un `&` del enlace partiría la orden en dos.
      run('adb', [
        'shell',
        "am start -W -a android.intent.action.VIEW -d '" + callback + "' app.lockin.mobile",
      ]);

      const confirmDir = join(dir, 'confirm');
      if (
        maestroFlow(confirmDir, registerConfirmFile, { EMAIL: email, PASSWORD: password }) !== 0
      ) {
        const diagnosis = diagnose(confirmDir);
        return { outcome: diagnosis.kind, why: 'register-confirm.yaml: ' + diagnosis.why };
      }
      await verifyRegistration(status, email, password, userId);

      // El alta acaba en modo, sin ficha. Este fixture prepara la precondición
      // «ya tiene perfil», sin convertir este caso en otro full-journey.
      assert.equal(status.API_URL, 'http://127.0.0.1:54321');
      const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const profileName = 'E2E-' + runId;
      const { error: profileError } = await admin.from('profiles').insert({
        id: userId,
        name: profileName,
        age: 28,
        location: 'Barcelona',
        timezone: 'Europe/Madrid',
        avatar_initials: 'E2',
        avatar_accent: 'teal',
        specialties: ['dev'],
        seeking_specialties: ['diseno'],
        looking_for: 'ambos',
        starting_point: 'solo-ganas',
        availability_hours_per_week: 10,
        availability_bands: ['tarde'],
        ambition: 'equilibrado',
        prompts: [{ question: 'Busco a alguien que…', answer: 'Construya en equipo' }],
      });
      assert.ifError(profileError);
      // El nombre que Maestro ve en Perfil pertenece SOLO al uid del registro.
      // Leerlo de nuevo tras cada entrada ata la evidencia de UI a Postgres.
      async function verifyRecoveredProfile(currentPassword) {
        await verifyRegistration(status, email, currentPassword, userId);
        const { data, error } = await admin
          .from('profiles')
          .select('id')
          .eq('name', profileName)
          .single();
        assert.ifError(error);
        assert.equal(data.id, userId, 'La ficha recuperada pertenece al uid registrado');
      }
      const vars = { EMAIL: email, PASSWORD: password, PROFILE_NAME: profileName };
      const signInDir = join(dir, 'sign-in');
      if (maestroFlow(signInDir, signInFile, vars) !== 0) {
        const diagnosis = diagnose(signInDir);
        return { outcome: diagnosis.kind, why: 'sign-in.yaml: ' + diagnosis.why };
      }
      await verifyRecoveredProfile(password);

      // waitForVerifyLink exige un solo mensaje. Retirar únicamente el correo
      // ya consumido de ESTE intento antes de pedir el de recuperación.
      const mailbox = mailpitUrl(status);
      const search = await fetch(
        mailbox + '/api/v1/search?query=' + encodeURIComponent('to:"' + email + '"')
      );
      assert(search.ok, 'No se pudo localizar el correo de alta consumido');
      const { messages } = await search.json();
      assert.equal(messages.length, 1, 'Debe quedar exactamente el correo del alta');
      const removed = await fetch(mailbox + '/api/v1/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: messages.map((message) => message.ID) }),
      });
      assert(removed.ok, 'No se pudo retirar el correo de alta consumido');

      const newPassword = 'E2e-reset-' + randomUUID();
      const resetVars = { ...vars, NEW_PASSWORD: newPassword };
      const requestDir = join(dir, 'password-reset-request');
      if (maestroFlow(requestDir, passwordResetFile, { ...resetVars, PHASE: 'request' }) !== 0) {
        const diagnosis = diagnose(requestDir);
        return { outcome: diagnosis.kind, why: 'password-reset request: ' + diagnosis.why };
      }
      const recoveryLink = await waitForVerifyLink(status, email);
      assert.equal(new URL(recoveryLink).searchParams.get('type'), 'recovery');
      const recoveryCallback = await resolveVerifyLink(recoveryLink);
      writeFileSync(
        join(dir, 'recovery-mail.json'),
        JSON.stringify(
          {
            email,
            userId,
            verifyLink: recoveryLink.replace(/token=[^&]+/, 'token=…'),
            callback: recoveryCallback.replace(/code=[^&]+/, 'code=…'),
          },
          null,
          2
        )
      );
      run('adb', [
        'shell',
        "am start -W -a android.intent.action.VIEW -d '" + recoveryCallback + "' app.lockin.mobile",
      ]);
      const resetDir = join(dir, 'password-reset-confirm');
      if (maestroFlow(resetDir, passwordResetFile, { ...resetVars, PHASE: 'confirm' }) !== 0) {
        const diagnosis = diagnose(resetDir);
        return { outcome: diagnosis.kind, why: 'password-reset confirm: ' + diagnosis.why };
      }
      await verifyRecoveredProfile(newPassword);
      const visitor = createClient(status.API_URL, status.ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const oldLogin = await visitor.auth.signInWithPassword({ email, password });
      assert.equal(
        oldLogin.error?.code,
        'invalid_credentials',
        'La contraseña anterior debe fallar por credenciales, no por red ni servidor'
      );
      assert.equal(oldLogin.data.session, null);
      const newSignInDir = join(dir, 'sign-in-new-password');
      if (maestroFlow(newSignInDir, signInFile, { ...vars, PASSWORD: newPassword }) !== 0) {
        const diagnosis = diagnose(newSignInDir);
        return { outcome: diagnosis.kind, why: 'sign-in nueva contraseña: ' + diagnosis.why };
      }
      await verifyRecoveredProfile(newPassword);

      writeFileSync(
        join(dir, 'postgres.json'),
        JSON.stringify(
          {
            runId,
            variant,
            userId,
            profileName,
            registration: 'verified',
            signIn: 'verified',
            passwordReset: 'verified',
          },
          null,
          2
        )
      );
      return {
        outcome: 'pass',
        why: 'registro, entrada y recuperación verificados: mismo uid y contraseña anterior rechazada',
      };
    } catch (error) {
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
    // El logcat lo acaba de volcar el `finally` de `attempt`, así que se lee
    // aquí y entra en el veredicto con el intento, sea cual sea su desenlace.
    const outcome = registration ? await registrationAttempt(dir) : await attempt(dir);
    last = { ...outcome, attempt: basename(dir), appErrors: appQueryErrors(dir) };
    recordVerdict(last);
    console.log('Veredicto de ' + basename(dir) + ': ' + last.outcome + ' — ' + last.why);
    reportAppErrors(last.appErrors, basename(dir));
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

// Logs con marca de tiempo de PostgREST y GoTrue, y qué imagen y desde cuándo
// corría cada uno. Va ANTES de subir el artefacto y de `stop`, que se lleva los
// contenedores. Nunca falla: si Docker no responde, el artefacto lo dice y punto.
//
// Ojo con lo que NO va a haber: PostgREST loguea a nivel `error`, así que un
// 401 `PGRST303` no deja línea propia. Lo que sí sale es lo de GoTrue —cuándo
// firmó cada token— y el arranque de PostgREST; con `clock.json` de cada
// intento eso basta para medir cuánto llevaba PostgREST sin tráfico.
if (command === 'containers') {
  const dir = join(artifacts, 'containers');
  mkdirSync(dir, { recursive: true });
  const listed = spawnSync('docker', ['ps', '-a', '--format', '{{.Names}}'], { encoding: 'utf8' });
  const names = (listed.stdout ?? '')
    .split('\n')
    .map((name) => name.trim())
    .filter((name) => /^supabase_(rest|auth)_/.test(name));
  const summary = ['runner date -u +%s: ' + unixNow(), 'contenedores: ' + names.join(' ')];
  for (const name of names) {
    // `sh -c` para mezclar stdout y stderr en el orden en que salieron: con dos
    // tuberías separadas el orden entre ellas se pierde.
    const logs = spawnSync('sh', ['-c', 'docker logs --timestamps "$0" 2>&1', name], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    writeFileSync(join(dir, name + '.log'), logs.stdout ?? '');
    const inspect = spawnSync(
      'docker',
      [
        'inspect',
        '-f',
        '{{.Config.Image}} estado={{.State.Status}} arranque={{.State.StartedAt}}',
        name,
      ],
      { encoding: 'utf8' }
    );
    summary.push(name + ': ' + (inspect.stdout ?? '').trim());
  }
  if (names.length === 0)
    summary.push('no hay contenedores supabase_rest_/supabase_auth_ (¿cayó prepare?)');
  writeFileSync(join(dir, 'resumen.txt'), summary.join('\n') + '\n');
  console.log(summary.join('\n'));
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
  // ANTES del `assert`, y a propósito: en un rojo es cuando más falta hace
  // leerlos, y el `assert` corta la ejecución aquí mismo. Nunca tumba el
  // trabajo por sí solo — el veredicto lo decide el recorrido, no esto: romper
  // aquí convertiría un intermitente conocido en un rojo permanente.
  const errors = mergeAppQueryErrors(verdict.runs);
  if (errors.length > 0) {
    console.log(
      'Algún intento dejó ' +
        errors.length +
        ' error(es) de la app en el logcat, incluidos los intentos que el ' +
        'reintento dejó atrás. Están en verdict.json (`appErrors`).'
    );
    reportAppErrors(errors, 'la variante ' + variant);
  }
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
