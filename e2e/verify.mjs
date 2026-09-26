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

/**
 * Oráculo de `session.yaml`: la app registró la entrada y la salida confirmada
 * en Postgres. `left_at` no nulo es lo único que distingue "salió pulsando
 * Salir" de "cerró la pantalla", que la spec define como NULL.
 */
export async function verifySessionAttendance(status, profileName) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('name', profileName)
    .single();
  assert.ifError(profileError);
  const { data: rows, error } = await client
    .from('session_attendance')
    .select('*')
    .eq('profile_id', profile.id);
  assert.ifError(error);
  assert.equal(rows.length, 1, 'La app debe registrar una sola asistencia a la sesión');
  assert(rows[0].joined_at, 'Entrar debe guardar joined_at');
  assert(rows[0].left_at, 'Salir confirmando debe guardar left_at');
  console.log('Postgres: entrada y salida de la sesión Lock-In verificadas.');
}

/**
 * Prepara la repesca de la valoración envejeciendo la sesión que el recorrido
 * acaba de vivir, y añadiendo la asistencia de la otra persona.
 *
 * **Por qué no hay fixture de seed para esto.** `session-now.sql` deja una
 * sesión viva media hora; el recorrido entra y sale de ella, pero salir no la
 * termina. Un segundo fixture que creara otra ya terminada dejaría dos sesiones
 * en el mismo match, y la viva gana a la valorable (`cardView`), así que la
 * tarjeta nunca llegaría a preguntar y el caso fallaría sin que nada estuviera
 * roto. Por eso se reaprovecha la misma sesión.
 *
 * **Y por qué se mueve también `joined_at`.** Asistir es haber entrado antes de
 * que la sesión acabara. Si solo se moviera `starts_at` al pasado, la entrada
 * real —que ocurrió hace segundos— quedaría posterior al nuevo final y la
 * sesión dejaría de ser valorable justo por la regla que queremos probar.
 */
export async function prepareSessionRating(status, profileName) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('name', profileName)
    .single();
  assert.ifError(profileError);

  const { data: mine, error: mineError } = await client
    .from('session_attendance')
    .select('session_id')
    .eq('profile_id', profile.id)
    .single();
  assert.ifError(mineError);

  const { data: session, error: sessionError } = await client
    .from('lockin_sessions')
    .select('id, match_id, blocks')
    .eq('id', mine.session_id)
    .single();
  assert.ifError(sessionError);

  // Diez minutos más allá de su propio final: terminada, y con la ventana de
  // 24 h abierta de sobra.
  const startsAt = new Date(Date.now() - (session.blocks * 30 + 10) * 60_000);
  const joinedAt = new Date(startsAt.getTime() + 60_000);
  const leftAt = new Date(startsAt.getTime() + 2 * 60_000);

  const { error: ageError } = await client
    .from('lockin_sessions')
    .update({ starts_at: startsAt.toISOString() })
    .eq('id', session.id);
  assert.ifError(ageError);

  const { error: rowError } = await client
    .from('session_attendance')
    .update({ joined_at: joinedAt.toISOString(), left_at: leftAt.toISOString() })
    .eq('session_id', session.id)
    .eq('profile_id', profile.id);
  assert.ifError(rowError);

  const { data: match, error: matchError } = await client
    .from('matches')
    .select('profile_a, profile_b')
    .eq('id', session.match_id)
    .single();
  assert.ifError(matchError);
  const counterpartId = match.profile_a === profile.id ? match.profile_b : match.profile_a;

  const { error: counterpartError } = await client.from('session_attendance').upsert({
    session_id: session.id,
    profile_id: counterpartId,
    joined_at: joinedAt.toISOString(),
    left_at: null,
  });
  assert.ifError(counterpartError);

  console.log('Postgres: sesión terminada y con los dos dentro, lista para valorarse.');
}

/** Días hacia atrás de la sesión que siembra `prepareSessionStreak`. */
export const STREAK_SEED_DAYS_AGO = 3;

/**
 * Prepara la racha de `session-streak.yaml`: siembra, en el mismo match que la
 * sesión que acaba de envejecer `prepareSessionRating`, una sesión anterior
 * aceptada y con las dos asistencias. Con ella la pareja lleva dos seguidas.
 *
 * **Por qué tres días.** Fuera de la ventana de valoración de 24 h, para que no
 * compita con la que se acaba de valorar y la tarjeta vuelva a `agendar`, que es
 * donde se pinta la racha. Y a menos de 7 días del inicio de la envejecida, que
 * es la condición para que las dos sean seguidas.
 *
 * **Por qué aquí y no en un fixture de seed.** Una sesión así en el seed ya
 * estaría en el match cuando `session.yaml` entra, y `prepareSessionRating`
 * dejaría de encontrar una sola asistencia de la cuenta. No hay oráculo después:
 * la racha no se guarda, solo se ve.
 */
export async function prepareSessionStreak(status, profileName) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('name', profileName)
    .single();
  assert.ifError(profileError);

  const { data: mine, error: mineError } = await client
    .from('session_attendance')
    .select('session_id')
    .eq('profile_id', profile.id)
    .single();
  assert.ifError(mineError);

  const { data: aged, error: agedError } = await client
    .from('lockin_sessions')
    .select('id, match_id')
    .eq('id', mine.session_id)
    .single();
  assert.ifError(agedError);

  const { data: match, error: matchError } = await client
    .from('matches')
    .select('profile_a, profile_b')
    .eq('id', aged.match_id)
    .single();
  assert.ifError(matchError);
  const counterpartId = match.profile_a === profile.id ? match.profile_b : match.profile_a;

  const startsAt = new Date(Date.now() - STREAK_SEED_DAYS_AGO * 24 * 60 * 60_000);
  // Un minuto después del inicio: dentro de la sesión, que dura 30 min.
  const joinedAt = new Date(startsAt.getTime() + 60_000);

  const { data: earlier, error: earlierError } = await client
    .from('lockin_sessions')
    .insert({
      match_id: aged.match_id,
      proposed_by: profile.id,
      starts_at: startsAt.toISOString(),
      blocks: 1,
      status: 'aceptada',
      // `lockin_sessions_responded_iff_not_proposal`: aceptada exige respuesta.
      responded_at: startsAt.toISOString(),
    })
    .select('id')
    .single();
  assert.ifError(earlierError);

  const { error: attendanceError } = await client.from('session_attendance').insert([
    { session_id: earlier.id, profile_id: profile.id, joined_at: joinedAt.toISOString() },
    { session_id: earlier.id, profile_id: counterpartId, joined_at: joinedAt.toISOString() },
  ]);
  assert.ifError(attendanceError);

  console.log('Postgres: sesión anterior sembrada en el mismo match, racha de 2 lista.');
}

/**
 * Siembra la respuesta de la contraparte al tema `dedicacion` del acuerdo de
 * socios del match del recorrido, con `service_role` (se salta la RPC: aquí se
 * prepara el mundo, no se prueba la escritura). `agreement.yaml` responde lo
 * mismo y espera «Coincidís».
 *
 * El recorrido tiene un solo match —el like a Núria Bosch, que es `par`—, así
 * que `.single()` sobre `matches` basta. Si deja de ser `par`, el acuerdo no
 * existe en ese match y falla aquí con un motivo claro, no en el emulador.
 */
export async function prepareAgreement(status, profileName) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('name', profileName)
    .single();
  assert.ifError(profileError);

  const { data: match, error: matchError } = await client
    .from('matches')
    .select('id, profile_a, profile_b, mode')
    .or(`profile_a.eq.${profile.id},profile_b.eq.${profile.id}`)
    .single();
  assert.ifError(matchError);
  assert.equal(match.mode, 'par', 'el acuerdo solo existe en matches Par');
  const counterpartId = match.profile_a === profile.id ? match.profile_b : match.profile_a;

  const { error } = await client.from('agreement_answers').insert({
    match_id: match.id,
    profile_id: counterpartId,
    topic: 'dedicacion',
    option: 'completa',
    note: 'Lo dejo todo por esto.',
  });
  assert.ifError(error);

  console.log('Postgres: respuesta de la contraparte al acuerdo sembrada (dedicacion).');
}

/**
 * Oráculo de `agreement.yaml`: la respuesta del usuario llegó a Postgres.
 *
 * Solo una fila y solo la del tema tocado: la RPC no escribe nada más.
 */
export async function verifyAgreementAnswer(status, profileName) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('name', profileName)
    .single();
  assert.ifError(profileError);

  const { data, error } = await client
    .from('agreement_answers')
    .select('topic, option')
    .eq('profile_id', profile.id);
  assert.ifError(error);
  assert.deepEqual(data, [{ topic: 'dedicacion', option: 'completa' }]);

  console.log('Postgres: respuesta del acuerdo verificada.');
}

/**
 * Oráculo de `session-rate.yaml`: el toque en "Genial" llegó a Postgres.
 *
 * Solo debe haber una fila y solo la de quien valoró: la valoración es privada,
 * y la de la otra persona no existe porque nadie la escribió.
 */
export async function verifySessionRating(status, profileName) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('name', profileName)
    .single();
  assert.ifError(profileError);
  const { data: rows, error } = await client.from('session_ratings').select('*');
  assert.ifError(error);
  assert.equal(rows.length, 1, 'El toque debe escribir una sola valoración');
  assert.equal(rows[0].profile_id, profile.id, 'La valoración es de quien la tocó');
  assert.equal(rows[0].rating, 'genial', 'El toque fue en "Genial"');
  console.log('Postgres: valoración de la sesión Lock-In verificada.');
}

function adminClient(status) {
  assert.equal(status.API_URL, 'http://127.0.0.1:54321');
  return createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Oráculo de la primera mitad del registro (`register.yaml`): la cuenta que
 * espera el correo es la anónima que abrió la app, con el email pedido como
 * `new_email` y todavía sin él. Devuelve su id, que es lo que la segunda mitad
 * tiene que conservar: el ascenso no puede abrir otra cuenta.
 */
export async function verifyPendingRegistration(status, email) {
  const client = adminClient(status);
  const { data, error } = await client.auth.admin.listUsers({ perPage: 1000 });
  assert.ifError(error);
  const pending = data.users.filter((user) => user.new_email === email);
  assert.equal(pending.length, 1, 'Debe haber una sola cuenta esperando ' + email);
  const [user] = pending;
  assert.equal(user.is_anonymous, true, 'El registro asciende la sesión anónima, no abre otra');
  assert(!user.email, 'Hasta pinchar el enlace la cuenta no tiene email: ' + user.email);
  assert(!user.email_confirmed_at, 'Sin enlace pinchado no puede haber email confirmado');
  console.log('Postgres: cuenta anónima ' + user.id + ' esperando la confirmación de su email.');
  return user.id;
}

/**
 * Oráculo del registro completo (`register-confirm.yaml`): la MISMA cuenta
 * tiene ahora el email confirmado, ya no es anónima y entra con la contraseña
 * que se tecleó. Esto último se prueba entrando de verdad con la clave anónima,
 * como haría la app en otro teléfono: es lo que «recuperable» promete.
 */
export async function verifyRegistration(status, email, password, userId) {
  const client = adminClient(status);
  const { data, error } = await client.auth.admin.getUserById(userId);
  assert.ifError(error);
  assert.equal(data.user.email, email, 'El email confirmado es el que se tecleó');
  assert(data.user.email_confirmed_at, 'El enlace del correo debe dejar el email confirmado');
  assert.equal(data.user.is_anonymous, false, 'Tras confirmar, la cuenta deja de ser anónima');
  assert(!data.user.new_email, 'No debe quedar ningún cambio de email pendiente');

  const visitor = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await visitor.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  assert.equal(signedIn.data.user.id, userId, 'La contraseña abre la cuenta ascendida, no otra');
  console.log('Postgres: registro verificado — mismo uid, email confirmado y contraseña válida.');
}
