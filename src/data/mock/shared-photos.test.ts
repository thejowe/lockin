import { createMockRepositories, createMockStore } from '@/data/mock';

// Espejo del interruptor `app_config.shared_project_photos` de
// 20261120100000_shared_projects_followups.sql: con él apagado, una ficha
// compartida con fotos funciona en privado pero no se publica.
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
    await a.projects.save(draft, undefined, undefined, match!.id);
    return { store, a, b, matchId: match!.id };
  }

  it('apagado: la ficha con portada existe en privado y proponer publicarla se rechaza', async () => {
    const { a, b, matchId } = await setup();
    const workspace = (await b.projects.workspace(matchId))!;
    expect(workspace.project.cover).toBeTruthy();
    await expect(a.projects.publication(workspace.project, 'propose')).rejects.toThrow(
      'Por ahora los proyectos compartidos con fotos no se pueden publicar.'
    );
  });

  it('encendido: se propone y se acepta como siempre', async () => {
    const { store, a, b, matchId } = await setup();
    store.state.appConfig.sharedProjectPhotos = true;
    await a.projects.publication((await a.projects.workspace(matchId))!.project, 'propose');
    await b.projects.publication((await b.projects.workspace(matchId))!.project, 'accept');
    expect((await b.projects.workspace(matchId))!.published).toBe(true);
  });
});
