import { introHandoff } from './intro-handoff';

describe('introHandoff', () => {
  it('nace inactivo: las pantallas sin intro se comportan como siempre', () => {
    expect(introHandoff.get().active).toBe(false);
  });

  it('begin enciende el relevo y finish lo apaga y suelta el destino del logo', () => {
    introHandoff.begin();
    introHandoff.setDestination('welcome');
    introHandoff.setTarget({ x: 10, y: 20, width: 100, settled: true });
    expect(introHandoff.get()).toMatchObject({ active: true, destination: 'welcome' });

    introHandoff.finish();
    expect(introHandoff.get()).toMatchObject({ active: false, target: null });
  });

  it('avisa a quien se suscribe y deja de avisar al darse de baja', () => {
    const listener = jest.fn();
    const off = introHandoff.subscribe(listener);
    introHandoff.setDestination('app');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    introHandoff.setDestination('unknown');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
