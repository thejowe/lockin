/**
 * La especificación ejecutable del contrato de `src/data/repositories.ts`.
 *
 * Antes vivía dentro de `src/data/mock/index.test.ts` y solo se ejecutaba
 * contra el mock, así que "el backend de Supabase cumple el contrato" era una
 * afirmación de papel: `src/data/supabase/README.md` mapeaba test a test qué
 * pieza cumplía cada caso, pero nadie corría esos casos contra Supabase.
 *
 * Aquí los tests se escriben UNA vez y se ejecutan contra cualquier
 * implementación que sepa dar un `ContractFixture`:
 *
 * - `src/data/mock/index.test.ts`        → el mock en memoria (siempre).
 * - `src/data/supabase/contract.test.ts` → Supabase real (opt-in, ver ahí).
 *
 * ## Lo que el fixture tiene que abstraer
 *
 * El contrato habla de comportamiento de producto; los tests originales
 * hablaban además de mecánica del mock. Tres cosas no son portables y por eso
 * las provee el backend en vez de estar escritas a fuego:
 *
 * - **Quién soy.** En el mock es la constante `'me'`; en Supabase es el
 *   `auth.uid()`, un UUID que no se conoce hasta abrir sesión → `currentUserId`.
 * - **Estado limpio.** En el mock es `resetState()`, que reconstruye un objeto;
 *   en Supabase el estado está en Postgres y las políticas RLS no dan DELETE a
 *   nadie, así que hace falta una función de desarrollo o, en su defecto, un
 *   usuario nuevo → `reset()`.
 * - **Quién es quién en el catálogo.** Los ids `seed-*` son del mock; en
 *   Supabase son los UUID de `supabase/seed.sql` → los campos `*Id`.
 *
 * Y una cuarta, que es la razón de `prepareSwiper()`: en el mock los likes
 * entrantes son un `Set` sembrado de fábrica y se puede swipear sin tener
 * perfil propio. En Supabase alguien tiene que dar esos likes de verdad, y
 * `record_decision()` exige que el actor tenga perfil (`23503`). Las dos cosas
 * son la misma precondición de producto — "ya estoy dentro y hay gente que me
 * ha dado like" —, así que la pide el fixture y no cada test.
 */

import { buildProfileInput } from './test-fixtures';

import type { Repositories } from './repositories';

/** Un backend listo para que un test lo interrogue, con su reparto ya resuelto. */
export interface ContractFixture {
  repositories: Repositories;
  /** El id del usuario de esta ejecución. `CURRENT_USER_ID` en el mock. */
  currentUserId: string;
  /**
   * Deja al usuario en condiciones de swipear: con perfil propio creado y con
   * los perfiles recíprocos habiéndole dado like ya.
   */
  prepareSwiper(): Promise<void>;
  /** Perfil recíproco. Darle like cierra match. */
  reciprocalAId: string;
  /** Otro perfil recíproco, distinto del anterior. */
  reciprocalBId: string;
  /** Perfil recíproco que declara `ambos`: el match nace en el modo de la sesión. */
  openToBothReciprocalId: string;
  /** Perfil que nunca ha dado like: darle like no cierra match. Declara `par`. */
  nonReciprocalId: string;
  /** Un perfil cualquiera del catálogo, para probar `excludeIds`. */
  excludableId: string;
  /** Un id con forma válida para este backend, pero que no existe. */
  unknownProfileId: string;
}

/** Lo que implementa cada backend para poder ser interrogado por el contrato. */
export interface ContractBackend {
  /** Nombre para el `describe`, p. ej. `'mock'` o `'supabase'`. */
  name: string;
  /** Estado limpio para el test que viene. Se llama en cada `beforeEach`. */
  reset(): Promise<ContractFixture>;
  /** Cierre de lo que quede abierto (sesiones, canales de realtime). */
  teardown?(): Promise<void>;
}

/**
 * Declara la suite completa del contrato contra `backend`.
 *
 * Llámala desde un `*.test.ts`: declara sus propios `describe`/`it`.
 */
export function describeRepositoryContract(backend: ContractBackend): void {
  describe(`contrato de Repositories — ${backend.name}`, () => {
    let fixture: ContractFixture;
    let repositories: Repositories;

    beforeEach(async () => {
      fixture = await backend.reset();
      repositories = fixture.repositories;
    });

    afterAll(async () => {
      await backend.teardown?.();
    });

    describe('discovery.getDeck', () => {
      beforeEach(async () => {
        await fixture.prepareSwiper();
      });

      it('nunca incluye el perfil propio', async () => {
        const deck = await repositories.discovery.getDeck({ mode: 'ambos' });

        expect(deck.map((profile) => profile.id)).not.toContain(fixture.currentUserId);
      });

      it('en modo Par solo devuelve perfiles de Par o abiertos a ambos', async () => {
        const deck = await repositories.discovery.getDeck({ mode: 'par' });

        expect(deck.length).toBeGreaterThan(0);
        expect(deck.every((profile) => profile.lookingFor !== 'lockin')).toBe(true);
      });

      it('en modo Lock-In solo devuelve perfiles de Lock-In o abiertos a ambos', async () => {
        const deck = await repositories.discovery.getDeck({ mode: 'lockin' });

        expect(deck.length).toBeGreaterThan(0);
        expect(deck.every((profile) => profile.lookingFor !== 'par')).toBe(true);
      });

      it('sin modo concreto devuelve el catálogo entero', async () => {
        const todos = await repositories.discovery.getDeck({ mode: 'ambos' });
        const par = await repositories.discovery.getDeck({ mode: 'par' });

        expect(todos.length).toBeGreaterThan(par.length);
      });

      it('usa el modo activo de la sesión cuando la llamada no lo especifica', async () => {
        await repositories.session.setActiveMode('lockin');

        const deck = await repositories.discovery.getDeck();

        expect(deck.length).toBeGreaterThan(0);
        expect(deck.every((profile) => profile.lookingFor !== 'par')).toBe(true);
      });

      it('cae al modo declarado en el perfil si la sesión no tiene uno activo', async () => {
        await repositories.profiles.saveCurrent(buildProfileInput({ lookingFor: 'lockin' }));

        const deck = await repositories.discovery.getDeck();

        expect(deck.length).toBeGreaterThan(0);
        expect(deck.every((profile) => profile.lookingFor !== 'par')).toBe(true);
      });

      it('no vuelve a mostrar un perfil ya decidido', async () => {
        await repositories.discovery.recordDecision(fixture.nonReciprocalId, 'pass');

        const deck = await repositories.discovery.getDeck({ mode: 'ambos' });

        expect(deck.map((profile) => profile.id)).not.toContain(fixture.nonReciprocalId);
      });

      it('respeta excludeIds además de lo ya decidido', async () => {
        const deck = await repositories.discovery.getDeck({
          mode: 'ambos',
          excludeIds: [fixture.excludableId],
        });

        expect(deck.map((profile) => profile.id)).not.toContain(fixture.excludableId);
      });

      it('filtra por especialidad cuando se pide', async () => {
        const [reference] = await repositories.discovery.getDeck({ mode: 'ambos' });
        const specialty = reference.specialties[0];

        const deck = await repositories.discovery.getDeck({
          mode: 'ambos',
          specialties: [specialty],
        });

        expect(deck.length).toBeGreaterThan(0);
        expect(deck.every((profile) => profile.specialties.includes(specialty))).toBe(true);
      });
    });

    describe('discovery.recordDecision', () => {
      beforeEach(async () => {
        await fixture.prepareSwiper();
      });

      it('un like recíproco crea el match', async () => {
        const result = await repositories.discovery.recordDecision(fixture.reciprocalAId, 'like');

        expect(result.decision).toBe('like');
        expect(result.match?.profileIds).toEqual([fixture.currentUserId, fixture.reciprocalAId]);
      });

      it('un like sin reciprocidad no crea match', async () => {
        const result = await repositories.discovery.recordDecision(fixture.nonReciprocalId, 'like');

        expect(result.match).toBeNull();
      });

      it('un pass nunca crea match, aunque el otro nos hubiera dado like', async () => {
        const result = await repositories.discovery.recordDecision(fixture.reciprocalAId, 'pass');

        expect(result.match).toBeNull();
        expect(await repositories.matches.list()).toHaveLength(0);
      });

      it('un perfil inexistente no crea match ni revienta', async () => {
        const result = await repositories.discovery.recordDecision(
          fixture.unknownProfileId,
          'like'
        );

        expect(result.match).toBeNull();
      });

      it('el match nace en el modo concreto cuando el otro está abierto a ambos', async () => {
        await repositories.session.setActiveMode('lockin');

        const result = await repositories.discovery.recordDecision(
          fixture.openToBothReciprocalId,
          'like'
        );

        expect(result.match?.mode).toBe('lockin');
      });

      it('registra la decisión en listDecided', async () => {
        await repositories.discovery.recordDecision(fixture.nonReciprocalId, 'pass');

        expect(await repositories.discovery.listDecided()).toContain(fixture.nonReciprocalId);
      });

      it('avisa a los suscriptores de matches y deja de hacerlo al desuscribirse', async () => {
        const listener = jest.fn();
        const unsubscribe = repositories.matches.subscribe(listener);

        await repositories.discovery.recordDecision(fixture.reciprocalAId, 'like');
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        await repositories.discovery.recordDecision(fixture.reciprocalBId, 'like');
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('matches', () => {
      beforeEach(async () => {
        await fixture.prepareSwiper();
      });

      it('resuelve el perfil del otro lado', async () => {
        await repositories.discovery.recordDecision(fixture.reciprocalAId, 'like');

        const [match] = await repositories.matches.list();

        expect(match.counterpart.id).toBe(fixture.reciprocalAId);
        expect(match.lastMessage).toBeNull();
      });

      it('ordena por actividad reciente: el último mensaje sube el match', async () => {
        const first = await repositories.discovery.recordDecision(fixture.reciprocalAId, 'like');
        const second = await repositories.discovery.recordDecision(fixture.reciprocalBId, 'like');
        const firstId = first.match!.id;
        const secondId = second.match!.id;

        await repositories.messages.send({ matchId: firstId, body: 'hola' });

        const list = await repositories.matches.list();

        expect(list.map((match) => match.id)).toEqual([firstId, secondId]);
      });

      it('getById devuelve null para un id desconocido', async () => {
        expect(await repositories.matches.getById(fixture.unknownProfileId)).toBeNull();
      });
    });

    describe('messages', () => {
      beforeEach(async () => {
        await fixture.prepareSwiper();
      });

      it('el mensaje enviado queda en el hilo y actualiza el match', async () => {
        const { match } = await repositories.discovery.recordDecision(
          fixture.reciprocalAId,
          'like'
        );
        const matchId = match!.id;

        const sent = await repositories.messages.send({ matchId, body: '¿Arrancamos?' });
        const thread = await repositories.messages.listByMatch(matchId);
        const updated = await repositories.matches.getById(matchId);

        expect(thread).toEqual([sent]);
        expect(sent.senderId).toBe(fixture.currentUserId);
        expect(updated?.lastMessageAt).toBe(sent.sentAt);
        expect(updated?.lastMessage?.id).toBe(sent.id);
      });

      it('el hilo de un match no se cuela en el de otro', async () => {
        const a = await repositories.discovery.recordDecision(fixture.reciprocalAId, 'like');
        const b = await repositories.discovery.recordDecision(fixture.reciprocalBId, 'like');

        await repositories.messages.send({ matchId: a.match!.id, body: 'para A' });

        expect(await repositories.messages.listByMatch(b.match!.id)).toHaveLength(0);
      });

      it('avisa solo a los suscriptores de ese hilo', async () => {
        const a = await repositories.discovery.recordDecision(fixture.reciprocalAId, 'like');
        const b = await repositories.discovery.recordDecision(fixture.reciprocalBId, 'like');

        const listenerA = jest.fn();
        const listenerB = jest.fn();
        const unsubscribeA = repositories.messages.subscribe(a.match!.id, listenerA);
        const unsubscribeB = repositories.messages.subscribe(b.match!.id, listenerB);

        await repositories.messages.send({ matchId: a.match!.id, body: 'hola' });

        expect(listenerA).toHaveBeenCalledTimes(1);
        expect(listenerB).not.toHaveBeenCalled();

        unsubscribeA();
        unsubscribeB();
      });
    });

    describe('profiles.saveCurrent', () => {
      /**
       * `seekingSpecialties` es lo que el perfil quiere que domine la otra
       * persona. Se guarda tal cual: el repositorio no lo deduce de
       * `specialties` ni lo vacía por su cuenta cuando `lookingFor` es
       * `'lockin'` — esa invariante la mantiene quien escribe el perfil, y así
       * queda escrito en `types.ts`.
       *
       * **Contra Supabase este test falla hoy**, y es a propósito: la columna
       * `seeking_specialties` todavía no existe en `supabase/migrations/`, que
       * es territorio del bloque `datos`. `src/data/supabase/mappers.ts`
       * devuelve `[]` mientras tanto. Este caso es el que avisa de que el dato
       * se pierde; cuando `datos` añada la columna y el mapeo, pasa solo.
       */
      it('guarda seekingSpecialties tal y como se envía', async () => {
        const saved = await repositories.profiles.saveCurrent(
          buildProfileInput({ lookingFor: 'par', seekingSpecialties: ['diseno', 'ventas'] })
        );

        expect(saved.seekingSpecialties).toEqual(['diseno', 'ventas']);
        expect((await repositories.profiles.getCurrent())?.seekingSpecialties).toEqual([
          'diseno',
          'ventas',
        ]);
      });

      it('acepta seekingSpecialties vacío, que es lo que declara un perfil de lock-in', async () => {
        const saved = await repositories.profiles.saveCurrent(
          buildProfileInput({ lookingFor: 'lockin', seekingSpecialties: [] })
        );

        expect(saved.seekingSpecialties).toEqual([]);
      });

      it('deriva las iniciales del nombre si no se envía avatar', async () => {
        const profile = await repositories.profiles.saveCurrent(
          buildProfileInput({ name: 'Núria Bosch', avatar: undefined })
        );

        expect(profile.avatar.initials).toBe('NB');
        expect(profile.id).toBe(fixture.currentUserId);
      });

      it('conserva createdAt al editar y mueve updatedAt', async () => {
        const created = await repositories.profiles.saveCurrent(buildProfileInput());
        const edited = await repositories.profiles.saveCurrent(
          buildProfileInput({ name: 'Otro nombre' })
        );

        expect(edited.createdAt).toBe(created.createdAt);
        expect(edited.name).toBe('Otro nombre');
        expect(await repositories.profiles.getCurrent()).toEqual(edited);
      });
    });

    describe('session', () => {
      /**
       * El test original cerraba el onboarding con `session.setProfileId()`. Eso
       * es mecánica del mock: en Supabase `profileId` es derivado — hay perfil
       * si existe la fila en `profiles` — y `setProfileId` es un no-op
       * deliberado. Lo portable, y lo que de verdad promete el contrato, es que
       * el onboarding se cierra creando el perfil.
       */
      it('no está onboarded hasta tener perfil y modo', async () => {
        expect(await repositories.session.isOnboarded()).toBe(false);

        await repositories.session.setActiveMode('par');
        expect(await repositories.session.isOnboarded()).toBe(false);

        await repositories.profiles.saveCurrent(buildProfileInput());
        expect(await repositories.session.isOnboarded()).toBe(true);
      });
    });
  });
}
