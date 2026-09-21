/**
 * Guardia de la variante `registro`: lo que el emulador toca tiene que existir
 * en el código, el enlace del correo tiene que volver por el mismo camino que
 * espera la app, y la lectura del correo de Mailpit se prueba aquí, en
 * segundos, en vez de media hora después en Actions.
 *
 * Corre con `node --test` (`npm run test:e2e`). En Windows este script arrastra
 * los mismos problemas de CRLF que el resto de `e2e/`; la referencia es CI.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { AUTH_CALLBACK, callbackFrom, mailpitUrl, verifyLinkFrom } from './mail.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(join(here, path), 'utf8');

const first = read('register.yaml');
const second = read('register-confirm.yaml');
const runner = read('run.mjs');
const workflow = read('../.github/workflows/e2e.yml');
const form = read('../src/features/profile/register-form.tsx');
const auth = read('../src/data/supabase/auth.ts');
const callbackRoute = read('../src/app/auth/callback.tsx');
const app = JSON.parse(read('../app.json'));

describe('register.yaml y register-confirm.yaml', () => {
  it('tocan etiquetas que existen en el formulario de registro', () => {
    assert.match(first, /visible: 'Crea tu cuenta'/);
    assert.match(form, /<ThemedText type="title">Crea tu cuenta<\/ThemedText>/);
    assert.match(first, /tapOn: 'Email de tu cuenta\|tu@email\.com'/);
    assert.match(form, /accessibilityLabel="Email de tu cuenta"/);
    assert.match(form, /placeholder="tu@email\.com"/);
    assert.match(first, /tapOn: 'Crear cuenta'/);
    assert.match(form, /: 'Crear cuenta'\}/);
    assert.match(first, /visible: 'Confirma tu email'/);
    assert.match(form, /<ThemedText type="title">Confirma tu email<\/ThemedText>/);

    assert.match(second, /visible: 'Elige tu contraseña'/);
    assert.match(form, /<ThemedText type="title">Elige tu contraseña<\/ThemedText>/);
    assert.match(second, /assertVisible: 'Email confirmado: \$\{EMAIL\}'/);
    assert.match(form, /accessibilityLabel=\{`Email confirmado: \$\{account\.email/);
    assert.match(second, /tapOn: 'Contraseña de tu cuenta\|Tu contraseña'/);
    assert.match(form, /accessibilityLabel="Contraseña de tu cuenta"/);
    assert.match(form, /placeholder="Tu contraseña"/);
    assert.match(second, /tapOn: 'Guardar y continuar'/);
    assert.match(form, /: 'Guardar y continuar'\}/);
  });

  it('la primera mitad parte de cero y la segunda no relanza la app antes del canje', () => {
    assert.match(first, /clearState: true/);
    const beforeStop = second.split('- stopApp')[0];
    assert.doesNotMatch(beforeStop, /^- launchApp/m, 'Relanzar mataría el canje del código');
    assert.match(second, /- stopApp\r?\n- launchApp:\r?\n\s+clearState: false/);
  });

  it('el callback sin perfil vuelve a /register, que es donde se pide la contraseña', () => {
    assert.match(callbackRoute, /router\.replace\(onboarded \? '\/profile' : '\/register'\)/);
  });
});

describe('el enlace del correo vuelve a la app', () => {
  it('por el esquema de app.json, el mismo que usa auth.ts', () => {
    assert.equal(app.expo.scheme, 'lockin');
    assert.equal(AUTH_CALLBACK, app.expo.scheme + '://auth/callback');
    // Sin barra inicial: `createURL('/auth/callback')` da `lockin:///auth/callback`
    // en release y GoTrue lo manda a `site_url` (run 35656515945).
    assert.match(auth, /Linking\.createURL\('auth\/callback'\)/);
    assert.doesNotMatch(auth, /Linking\.createURL\('\//);
  });

  it('prepare lo permite en GoTrue y enciende la confirmación, como en el dashboard', () => {
    assert.match(runner, /"lockin:\/\/auth\/callback"\]/);
    assert.match(runner, /'\$1enable_confirmations = true'/);
    assert.match(runner, /'double_confirm_changes = false'/);
  });
});

describe('la variante en el runner y en el workflow', () => {
  it('registro compila con la puerta encendida y supabase la sigue apagando', () => {
    const buildEnv = runner.slice(
      runner.indexOf('function buildEnv('),
      runner.indexOf('function deviceState(')
    );
    const registroEnv = buildEnv.slice(
      buildEnv.indexOf('if (registration)'),
      buildEnv.lastIndexOf('return {')
    );
    assert.doesNotMatch(registroEnv, /EXPO_PUBLIC_REQUIRE_ACCOUNT/);
    assert.match(registroEnv, /EXPO_PUBLIC_SUPABASE_URL/);
    assert.match(buildEnv.slice(buildEnv.lastIndexOf('return {')), /REQUIRE_ACCOUNT: 'false'/);
  });

  it('el workflow la lanza sin cambiar las entradas de supabase y mock', () => {
    assert.match(workflow, /- variant: registro\r?\n\s+negative: '0'\r?\n\s+registration: '1'/);
    assert.match(workflow, /- variant: supabase\r?\n\s+negative: '0'\r?\n\s+- variant: mock/);
    assert.match(workflow, /E2E_REGISTRATION: \$\{\{ matrix\.registration \|\| '0' \}\}/);
  });
});

describe('mail.mjs', () => {
  const link =
    'http://127.0.0.1:54321/auth/v1/verify?token=pkce_abc&type=email_change&redirect_to=lockin://auth/callback';

  it('prefiere MAILPIT_URL y cae en INBUCKET_URL, sin barra final', () => {
    assert.equal(mailpitUrl({ MAILPIT_URL: 'http://127.0.0.1:54324/' }), 'http://127.0.0.1:54324');
    assert.equal(mailpitUrl({ INBUCKET_URL: 'http://127.0.0.1:54324' }), 'http://127.0.0.1:54324');
    assert.throws(() => mailpitUrl({}), /MAILPIT_URL/);
  });

  it('saca el enlace del HTML deshaciendo los &amp;', () => {
    const html = '<p><a href="' + link.replace(/&/g, '&amp;') + '">Change Email</a></p>';
    assert.equal(verifyLinkFrom({ HTML: html, Text: '' }), link);
  });

  it('cae en el texto si el HTML no lo trae, y da null si no hay enlace', () => {
    assert.equal(verifyLinkFrom({ HTML: '', Text: 'Confirma: ' + link + '\n' }), link);
    assert.equal(verifyLinkFrom({ HTML: '<p>hola</p>', Text: 'hola' }), null);
  });

  it('acepta solo el callback de la app con un code de PKCE', () => {
    const ok = 'lockin://auth/callback?code=0b3c';
    assert.equal(callbackFrom(ok), ok);
    assert.throws(
      () => callbackFrom('http://127.0.0.1:3000?code=0b3c'),
      /additional_redirect_urls/
    );
    assert.throws(() => callbackFrom('lockin://auth/callback#access_token=x'), /sin `\?code=`/);
    assert.throws(
      () => callbackFrom('lockin://auth/callback?error=access_denied&error_description=expired'),
      /rechazó el enlace del correo: expired/
    );
    assert.throws(() => callbackFrom(null), /Location/);
  });
});
