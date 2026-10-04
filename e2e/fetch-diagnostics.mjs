/**
 * El `fetch` de los oráculos de `run.mjs` contra el Supabase local.
 *
 * El síntoma (ver `docs/plan/todo/verificacion.md` y `visual.md`): tras un
 * flujo de Maestro largo, la primera llamada del oráculo fallaba con «fetch
 * failed» sin llegar a Kong. auth-js descarta la causa al crear
 * `AuthRetryableFetchError`, así que primero se instrumentó (`03e4556`), y el
 * run 37236214636 la dio: `UND_ERR_SOCKET` «other side closed», con Kong
 * respondiendo a un `curl` en ese mismo instante y la repetición en 200. Era
 * la conexión keep-alive que Node guardaba de antes del flujo, que Kong ya
 * había cerrado por inactividad.
 *
 * Ante cualquier fallo deja en la consola y en
 * `$E2E_ARTIFACTS/fetch-failures.log` la cadena de `cause` (code, errno,
 * syscall, address, port), un `curl` a Kong, los sockets hacia :54321 (`ss`) y
 * cómo resuelven `localhost` y `127.0.0.1`. Solo ese fallo concreto, y solo en
 * GET/HEAD, se repite una vez; el resto sube tal cual. Guardia en
 * `fetch-diagnostics.test.mjs`.
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

/** Lo que hay alrededor del fallo, en el mismo instante. */
async function probeBackend() {
  return {
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
}

/**
 * La conexión keep-alive del pool que el servidor ya había cerrado: undici
 * escribe en ella y recibe el cierre. La petición no llegó a procesarse, así
 * que repetirla en una conexión nueva es seguro si además no tiene efectos.
 */
function isStaleSocket(error) {
  return error?.cause?.code === 'UND_ERR_SOCKET';
}

const REPEATABLE = new Set(['GET', 'HEAD']);

/**
 * Envuelve un `fetch`: ante un fallo deja el diagnóstico con `log`, y si es una
 * conexión keep-alive caducada en un GET/HEAD lo repite una sola vez.
 */
export function wrapFetch(original, { log = console.error, probe = probeBackend } = {}) {
  return async function oracleFetch(input, init) {
    const startedAt = new Date();
    try {
      return await original(input, init);
    } catch (error) {
      const url = typeof input === 'string' ? input : (input?.url ?? String(input));
      const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
      const report = {
        at: startedAt.toISOString(),
        failedAfterMs: Date.now() - startedAt.getTime(),
        method,
        url: url.replace(/apikey=[^&]+/, 'apikey=…'),
        cause: describeCause(error),
        ...(await probe()),
      };
      const dump = (title) =>
        log(title + ' — diagnóstico:\n' + JSON.stringify(report, null, 2) + '\n');
      if (!isStaleSocket(error) || !REPEATABLE.has(method)) {
        dump('fetch failed');
        throw error;
      }
      try {
        const response = await original(input, init);
        report.retry = 'responde ' + response.status;
        dump('fetch failed y repetido');
        return response;
      } catch (retryError) {
        report.retry = { falla: describeCause(retryError) };
        dump('fetch failed');
        throw retryError;
      }
    }
  };
}

/** Sustituye el `fetch` global del proceso de `run.mjs` por `wrapFetch`. */
export function installFetchDiagnostics({ artifacts = process.env.E2E_ARTIFACTS } = {}) {
  if (globalThis.fetch.__lockinDiagnostics) return;
  const log = (text) => {
    console.error(text);
    if (!artifacts) return;
    try {
      mkdirSync(artifacts, { recursive: true });
      appendFileSync(join(artifacts, 'fetch-failures.log'), text);
    } catch {
      // La evidencia es un extra: sin carpeta, queda la consola.
    }
  };
  const wrapped = wrapFetch(globalThis.fetch, { log });
  wrapped.__lockinDiagnostics = true;
  globalThis.fetch = wrapped;
}
