import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Read-only oracle AFTER the UI flow. The privileged client never enters the APK.
export async function verifyPersistence(status, profileName, message) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  async function rows(query) {
    const { data, error } = await query;
    assert.ifError(error);
    return data;
  }
  const profile = await rows(client.from('profiles').select('*').eq('name', profileName).single());
  assert.equal(profile.age, 28);
  assert.equal(profile.location, 'Barcelona');
  assert.equal(profile.looking_for, 'ambos');
  assert.deepEqual(profile.specialties, ['dev', 'marketing']);
  // Lo que la UI declaró en "Lo que debe dominar quien busco". Que llegue a
  // Postgres es lo único que distingue la feature de un estado local: los tests
  // unitarios hablan con el mock y los de contrato no pasan por la pantalla.
  assert.deepEqual(profile.seeking_specialties, ['diseno']);
  assert.equal(profile.starting_point, 'solo-ganas');
  assert.equal(profile.ambition, 'equilibrado');
  assert.deepEqual(profile.availability_bands, ['tarde']);
  assert.equal(profile.prompts[0].answer, 'Una herramienta para construir en equipo');
  const { data: auth, error } = await client.auth.admin.getUserById(profile.id);
  assert.ifError(error);
  assert.equal(auth.user.is_anonymous, true, 'El alta debe crear la sesión anónima real');
  const settings = await rows(
    client.from('user_settings').select('*').eq('user_id', profile.id).single()
  );
  assert.equal(settings.active_mode, 'ambos');
  const sent = await rows(
    client.from('messages').select('*').eq('sender_id', profile.id).eq('body', message).single()
  );
  const match = await rows(client.from('matches').select('*').eq('id', sent.match_id).single());
  assert([match.profile_a, match.profile_b].includes(profile.id));
  const other = match.profile_a === profile.id ? match.profile_b : match.profile_a;
  // La tarjeta de arriba, fijada por el `update` de `created_at` de
  // `incoming-likes.sql`. Es lo que hace comprobables las aserciones del deck:
  // sin esto, "Busca" y el ✓ podrían ser de una tarjeta y el like de otra.
  assert.equal(
    other,
    '11111111-1111-4111-8111-000000000001',
    'El like no cayó sobre la primera tarjeta del deck (Núria Bosch)'
  );
  const decision = await rows(
    client.from('decisions').select('*').eq('actor_id', profile.id).eq('target_id', other).single()
  );
  assert.equal(decision.decision, 'like');
  assert(match.last_message_at, 'El trigger debe actualizar la actividad del match');
  console.log('Postgres: alta, perfil, lo que busca, modo, like, match y mensaje verificados.');
}

/**
 * Oráculo del control negativo: el APK sin credenciales no debe haber escrito
 * NADA en Postgres.
 *
 * Comprueba primero que la base sí responde y sí tiene el seed. Sin eso, una
 * base caída o vacía daría "ausencia" y el control pasaría por el motivo
 * equivocado — que es justo el fallo que este control existe para detectar.
 */
export async function verifyAbsence(status, profileName, message) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  async function count(table, column, value) {
    let query = client.from(table).select('*', { count: 'exact', head: true });
    if (column) query = query.eq(column, value);
    const { count: total, error } = await query;
    assert.ifError(error);
    return total;
  }
  const seeded = await count('profiles');
  assert(seeded > 0, 'La base no responde o no tiene seed: la ausencia no probaría nada');
  assert.equal(await count('profiles', 'name', profileName), 0, 'El mock no debe crear el perfil');
  assert.equal(await count('messages', 'body', message), 0, 'El mock no debe crear el mensaje');
  console.log('Postgres: el APK sin credenciales no ha escrito perfil ni mensaje.');
}
