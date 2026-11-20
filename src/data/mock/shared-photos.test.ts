import { createMockRepositories, createMockStore } from '@/data/mock';

// Espejo del interruptor `app_config.shared_project_photos` de
// 20261120100000_shared_projects_followups.sql: con él apagado, un proyecto
// compartido no lleva fotos (ni en privado) ni se publica con las que ya tenía.
describe('interruptor de fotos compartidas — mock', () => {
  const draft = {
    name: 'Atlas',
    tagline: 'Rutas de barrio',
    description: '',
    link: '',
    cover: { uri: 'file:///atlas.jpg' },
    photos: [],
  };

  async function setup() {
    const store = createMockStore();
    const a = createMockRepositories(store, { actorId: 'seed-marc' });
    const b = createMockRepositories(store, { actorId: 'seed-nuria' });
    await b.discovery.recordDecision('seed-marc', 'like');
    const { match } = await a.discovery.recordDecision('seed-nuria', 'like');
    return { store, a, b, matchId: match!.id };
  }

  it('apagado: un proyecto conjunto con portada no se guarda; sin fotos, sí', async () => {
    const { a, matchId } = await setup();
    await expect(a.projects.save(draft, undefined, undefined, matchId)).rejects.toThrow(
      'Por ahora los proyectos compartidos no pueden llevar fotos.'
    );
    await a.projects.save({ ...draft, cover: null }, undefined, undefined, matchId);
    expect(await a.projects.workspace(matchId)).not.toBeNull();
  });

  it('las fotos de cuando estaba encendido no se publican si se apaga', async () => {
    const { store, a, b, matchId } = await setup();
    store.state.appConfig.sharedProjectPhotos = true;
    await a.projects.save(draft, undefined, undefined, matchId);
    store.state.appConfig.sharedProjectPhotos = false;
    await expect(
      a.projects.publication((await a.projects.workspace(matchId))!.project, 'propose')
    ).rejects.toThrow('Por ahora los proyectos compartidos con fotos no se pueden publicar.');
    store.state.appConfig.sharedProjectPhotos = true;
    await a.projects.publication((await a.projects.workspace(matchId))!.project, 'propose');
    await b.projects.publication((await b.projects.workspace(matchId))!.project, 'accept');
    expect((await b.projects.workspace(matchId))!.published).toBe(true);
  });
});
