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
  assert.deepEqual(profile.specialties, ['dev']);
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
  assert(other.startsWith('11111111-1111-4111-8111-'));
  const decision = await rows(
    client.from('decisions').select('*').eq('actor_id', profile.id).eq('target_id', other).single()
  );
  assert.equal(decision.decision, 'like');
  assert(match.last_message_at, 'El trigger debe actualizar la actividad del match');
  console.log('Postgres: alta, perfil, modo, like, match y mensaje verificados.');
}
