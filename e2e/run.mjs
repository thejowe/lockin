// Linux/macOS runner. Backend state stays in e2e/.runtime; the app uses OS temp.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { verifyAbsence, verifyPersistence } from './verify.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = join(root, 'e2e/.runtime');
// Control negativo: mismo caso, mismo backend levantado y mismo `adb reverse`.
// Lo único que cambia es que el APK se compila SIN credenciales, así que
// active.ts elige el mock en memoria y el recorrido debe romperse al reiniciar.
// Si algún día pasara en verde, el caso positivo no estaría probando Supabase.
const negative = process.env.E2E_NEGATIVE_CONTROL === '1';
// Sonda de diagnóstico, temporal: mismo APK que el caso positivo (credenciales
// reales incluidas), pero corre `keyboard-modal-probe.yaml` en vez del recorrido
// completo, para responder si el Modal de match es lo que rompe el teclado.
// Se retira junto con el .yaml en cuanto la pregunta esté cerrada.
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
const command = process.argv[2];
assert(
  ['prepare', 'build', 'test', 'stop'].includes(command),
  'Uso: node e2e/run.mjs prepare|build|test|stop'
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

/**
 * Primer comando fallido del recorrido, leído del volcado de Maestro.
 * `maestro.xml` solo trae un mensaje; commands.json trae el orden y el estado
 * de cada paso, que es lo que permite decir DÓNDE se rompió.
 *
 * Si Maestro no llegó a ejecutar ningún comando no hay volcado, y eso NO es un
 * resultado del control negativo: la diferencia entre "el mock se rompió antes
 * de tiempo" y "el driver de Maestro se cayó" hay que decirla, no adivinarla.
 */
function firstFailure() {
  const dumps = [];
  for (const entry of readdirSync(artifacts, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(artifacts, entry.name, 'commands.json');
    if (existsSync(file)) dumps.push(file);
  }
  if (dumps.length === 0) {
    const report = join(artifacts, 'maestro.xml');
    const cause = existsSync(report)
      ? (/<failure>([^\n<]*)/.exec(readFileSync(report, 'utf8'))?.[1]?.trim() ??
        'sin mensaje en maestro.xml')
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
  assert(stopApp > 0, 'El caso ya no reinicia la app: el control negativo perdería su sentido');
  const failed = commands.findIndex((entry) => entry.metadata?.status === 'FAILED');
  return { stopApp, failed, commands };
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
  const status = localBackend();
  assert.deepEqual(
    JSON.parse(readFileSync(join(runtime, 'build-backend-' + variant + '.json'), 'utf8')),
    negative ? { variant } : { variant, url: status.API_URL, anonKey: status.ANON_KEY },
    'Reconstruir APK: backend distinto'
  );
  mkdirSync(artifacts, { recursive: true });
  const runId = randomUUID();
  const profileName = 'E2E-' + runId;
  const message = 'Mensaje E2E ' + runId;
  // El `adb reverse` se mantiene también en el control negativo: la única
  // variable que cambia entre las dos ejecuciones son las credenciales del APK.
  run('adb', ['reverse', 'tcp:54321', 'tcp:54321']);
  run('adb', ['install', '-r', join(app, 'android/app/build/outputs/apk/release/app-release.apk')]);
  const maestro = [
    'test',
    '--format',
    'junit',
    '--output',
    join(artifacts, 'maestro.xml'),
    '--debug-output',
    artifacts,
    '--test-output-dir',
    artifacts,
    '--flatten-debug-output',
    '-e',
    'PROFILE_NAME=' + profileName,
    '-e',
    'MESSAGE=' + message,
    join(root, probe ? 'e2e/keyboard-modal-probe.yaml' : 'e2e/full-journey.yaml'),
  ];
  try {
    if (negative) {
      const result = spawnSync('maestro', maestro, { cwd: root, stdio: 'inherit' });
      if (result.error) throw result.error;
      assert.notEqual(
        result.status,
        0,
        'El recorrido pasó con el mock: el caso positivo no prueba Supabase'
      );
      const { stopApp, failed, commands } = firstFailure();
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
        join(artifacts, 'postgres.json'),
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
    } else if (probe) {
      // La sonda se afirma a sí misma dentro del .yaml: si el `assertVisible` de
      // "Enviar mensaje" pasa con el teclado abierto, el Modal es la causa. No
      // se comprueba persistencia — no es lo que se está preguntando.
      run('maestro', maestro);
    } else {
      run('maestro', maestro);
      await verifyPersistence(status, profileName, message);
      writeFileSync(
        join(artifacts, 'postgres.json'),
        JSON.stringify({ runId, variant, persistence: 'verified' }, null, 2)
      );
    }
  } finally {
    const logs = spawnSync('adb', ['logcat', '-d'], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    writeFileSync(join(artifacts, 'logcat.txt'), logs.stdout ?? '');
    // Independent evidence even if Maestro's own artifact writer fails.
    const screen = spawnSync('adb', ['exec-out', 'screencap', '-p'], { timeout: 10000 });
    if (screen.status === 0) writeFileSync(join(artifacts, 'screen.png'), screen.stdout);
    spawnSync('adb', ['shell', 'uiautomator', 'dump', '/sdcard/lockin-window.xml'], {
      timeout: 10000,
    });
    const hierarchy = spawnSync('adb', ['exec-out', 'cat', '/sdcard/lockin-window.xml'], {
      timeout: 10000,
    });
    if (hierarchy.status === 0) writeFileSync(join(artifacts, 'window.xml'), hierarchy.stdout);
    run('adb', ['reverse', '--remove', 'tcp:54321']);
  }
}
if (command === 'stop') {
  try {
    if (existsSync(join(runtime, 'supabase/config.toml'))) supabase(['stop', '--no-backup']);
  } finally {
    assert.equal(dirname(resolve(app)), appParent, 'Solo retirar la copia temporal de esta app');
    rmSync(app, { recursive: true, force: true });
  }
}
