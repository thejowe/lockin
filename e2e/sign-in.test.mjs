import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const signIn = read('sign-in.yaml');
const reset = read('password-reset.yaml');
const form = read('../src/features/profile/sign-in-form.tsx');
const account = read('../src/features/profile/account-section.tsx');
const register = read('../src/features/profile/register-form.tsx');
const tabs = read('../src/components/app-tabs.tsx');
const details = read('../src/features/profile/profile-details.tsx');
const runner = read('run.mjs');

describe('entrada y recuperación desde instalación limpia', () => {
  for (const [name, flow] of [
    ['sign-in', signIn],
    ['password-reset', reset],
  ]) {
    it(`${name}: etiquetas de entrada fijadas contra producto`, () => {
      for (const text of [
        'Ya tengo cuenta',
        'Vuelve a tu cuenta',
        'Email de tu cuenta',
        'tu@email.com',
      ]) {
        assert(flow.includes(text), text);
        assert(form.includes(text), text);
      }
      assert(register.includes('Ya tengo cuenta'));
      assert.match(flow, /launchApp:\r?\n\s+clearState: true/);
      assert.match(
        flow,
        /extendedWaitUntil:\r?\n\s+visible: 'Crea tu cuenta'\r?\n\s+timeout: 60000/
      );
      assert(flow.includes("assertNotVisible: 'Crea tu cuenta'"));
      assert(flow.includes('visible: ${PROFILE_NAME}'));
      assert(details.includes('{profile.name}'));
      assert(flow.includes("assertVisible: 'Email de tu cuenta: ${EMAIL}'"));
      assert(account.includes('accessibilityLabel={`Email de tu cuenta: ${account.email}`}'));
      assert(flow.includes("'Matches'"));
      assert(tabs.includes('>Matches</NativeTabs.Trigger.Label>'));
    });

    it(`${name}: hideKeyboard solo tras teclear`, () => {
      const commands = flow
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('- '));
      commands.forEach((line, index) => {
        if (line === '- hideKeyboard') assert.match(commands[index - 1], /^- inputText: /);
      });
      assert(commands.includes('- hideKeyboard'));
    });
  }

  it('entrar usa contraseña y comprueba las tabs antes de abrir la ficha', () => {
    assert.match(signIn, /inputText: \$\{PASSWORD\}/);
    assert(signIn.includes("tapOn: 'Entrar'"));
    assert(form.includes(": 'Entrar'}"));
    assert(signIn.indexOf("visible: 'Matches'") < signIn.indexOf("tapOn: 'Perfil'"));
    assert(tabs.includes('>Perfil</NativeTabs.Trigger.Label>'));
  });

  it('recuperación fija petición, campo, botón y éxito contra los formularios', () => {
    for (const [source, labels] of [
      [
        form,
        [
          'He olvidado mi contraseña',
          'Si ese email tiene una cuenta, te hemos mandado un correo para cambiar la contraseña.',
        ],
      ],
      [
        account,
        [
          'Contraseña de tu cuenta',
          'Tu contraseña',
          'Guardar contraseña',
          'Contraseña guardada. Ya puedes entrar con ella desde otro teléfono.',
        ],
      ],
    ]) {
      for (const label of labels) {
        assert(reset.includes(label), label);
        assert(source.includes(label), label);
      }
    }
    assert.match(reset, /inputText: \$\{NEW_PASSWORD\}/);
    assert.match(reset, /PHASE == 'request' \|\| PHASE == 'confirm'/);
    const confirm = reset.slice(reset.lastIndexOf("true: ${PHASE == 'confirm'}"));
    assert.doesNotMatch(confirm, /launchApp|clearState/);
    assert.match(confirm, /timeout: 60000/);
  });

  it('encadena correo recovery, mismo uid y rechazo específico de la contraseña vieja', () => {
    const attempt = runner.slice(runner.indexOf('async function registrationAttempt('));
    const order = [
      'await verifyRegistration(status, email, password, userId)',
      "admin.from('profiles').insert(",
      'maestroFlow(signInDir, signInFile, vars)',
      'await verifyRecoveredProfile(password)',
      "method: 'DELETE'",
      "PHASE: 'request'",
      'await waitForVerifyLink(status, email)',
      "searchParams.get('type'), 'recovery'",
      'await resolveVerifyLink(recoveryLink)',
      '"am start -W -a android.intent.action.VIEW -d \'" + recoveryCallback',
      "PHASE: 'confirm'",
      'await verifyRecoveredProfile(newPassword)',
      'oldLogin.error?.code',
      "'invalid_credentials'",
      'oldLogin.data.session, null',
      'maestroFlow(newSignInDir, signInFile',
      "signIn: 'verified'",
      "passwordReset: 'verified'",
    ];
    let cursor = 0;
    for (const text of order) {
      const next = attempt.indexOf(text, cursor);
      assert(next >= cursor, 'Falta o está fuera de orden: ' + text);
      cursor = next + text.length;
    }
    assert.match(attempt, /assert.equal\(data.id, userId/);
    assert.match(attempt, /assert.equal\(messages.length, 1/);
    assert.match(attempt, /IDs: messages.map/);
  });
});
