/**
 * Instrumentación del «fetch failed» de los oráculos contra el Supabase local.
 *
 * El síntoma (ver `docs/plan/todo/verificacion.md` y `visual.md`): tras el
 * último flujo de Maestro, la primera llamada de administración a GoTrue falla
 * con «fetch failed» y la petición no llega a Kong. auth-js tira la causa al
 * crear `AuthRetryableFetchError`, así que el mensaje no dice nada.
 *
 * Esto envuelve `globalThis.fetch` del proceso de `run.mjs`. Cuando un fetch
 * falla, antes de devolver el error, deja en la consola y en
 * `$E2E_ARTIFACTS/fetch-failures.log`:
 * - la cadena de `cause`, con code, errno, syscall, address y port;
 * - un `curl` a Kong en ese mismo momento (si Kong responde, el problema es la
 *   conexión de Node, no el backend);
 * - los sockets TCP hacia el puerto 54321 (`ss`), para ver si había conexiones
 *   en CLOSE-WAIT esperando a que alguien las reutilizara;
 * - cómo resuelven `localhost` y `127.0.0.1`;
 * - si es GET, el resultado de repetirla una vez, solo como dato: el error
 *   original se relanza igual, para no tapar el fallo.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { join } from 'node:path';

/** La cadena de causas, de fuera hacia dentro, con los campos de red. */
export function describeCause(error) {
  const chain = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current) && chain.length < 8) {
    seen.add(current);
    const entry = { name: current.name, message: current.message };
    for (const key of [
      'code',
      'errno',
      'syscall',
      'address',
      'port',
      'localAddress',
      'localPort',
    ]) {
      if (current[key] !== undefined) entry[key] = current[key];
    }
    if (Array.isArray(current.errors))
      entry.errors = current.errors.map((inner) => describeCause(inner));
    chain.push(entry);
    current = current.cause;
  }
  return chain;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10000 });
  if (result.error) return 'no se pudo lanzar: ' + result.error.message;
  return ((result.stdout ?? '') + (result.stderr ?? '')).trim();
}

async function resolveBoth() {
  const out = {};
  for (const host of ['localhost', '127.0.0.1']) {
    try {
      out[host] = await lookup(host, { all: true });
    } catch (error) {
      out[host] = 'falla: ' + error.message;
    }
  }
  return out;
}

export function installFetchDiagnostics({ artifacts = process.env.E2E_ARTIFACTS } = {}) {
  const original = globalThis.fetch;
  if (original.__lockinDiagnostics) return;

  async function diagnosedFetch(input, init) {
    const startedAt = new Date();
    try {
      return await original(input, init);
    } catch (error) {
      const url = typeof input === 'string' ? input : (input?.url ?? String(input));
      const report = {
        at: startedAt.toISOString(),
        failedAfterMs: Date.now() - startedAt.getTime(),
        method: init?.method ?? input?.method ?? 'GET',
        url: url.replace(/apikey=[^&]+/, 'apikey=…'),
        cause: describeCause(error),
        curlKong: run('curl', [
          '-sS',
          '-m',
          '5',
          '-o',
          '/dev/null',
          '-w',
          'http=%{http_code} connect=%{time_connect}s total=%{time_total}s',
          'http://127.0.0.1:54321/auth/v1/health',
        ]),
        sockets: run('ss', ['-tanp', '( dport = :54321 or sport = :54321 )']),
        dns: await resolveBoth(),
      };
      // Solo lo idempotente: repetir un POST que sí llegó crearía filas dobles.
      if (report.method === 'GET' || report.method === 'HEAD') {
        try {
          const retry = await original(input, init);
          report.retry = 'responde ' + retry.status;
        } catch (retryError) {
          report.retry = { falla: describeCause(retryError) };
        }
      }
      const text = 'fetch failed — diagnóstico:\n' + JSON.stringify(report, null, 2) + '\n';
      console.error(text);
      if (artifacts) {
        try {
          mkdirSync(artifacts, { recursive: true });
          appendFileSync(join(artifacts, 'fetch-failures.log'), text);
        } catch {
          // La evidencia es un extra: sin carpeta, queda la consola.
        }
      }
      throw error;
    }
  }
  diagnosedFetch.__lockinDiagnostics = true;
  globalThis.fetch = diagnosedFetch;
}
