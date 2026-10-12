import { routeIndex, settleIndex, tabIndex } from '@/components/swipe-between-tabs';

const W = 400;

describe('tabIndex', () => {
  it('reconoce las tres pestañas y nada más', () => {
    expect(tabIndex('/discover')).toBe(0);
    expect(tabIndex('/matches')).toBe(1);
    expect(tabIndex('/profile')).toBe(2);
    expect(tabIndex('/chat/abc')).toBeNull();
  });
});

describe('settleIndex', () => {
  it('un arrastre largo a la izquierda avanza; a la derecha retrocede', () => {
    expect(settleIndex(1, -150, 0, W)).toBe(2);
    expect(settleIndex(1, 150, 0, W)).toBe(0);
  });

  it('un latigazo corto también cuenta', () => {
    expect(settleIndex(1, -20, -900, W)).toBe(2);
  });

  it('sin distancia ni velocidad suficientes, vuelve a la misma', () => {
    expect(settleIndex(1, -40, -100, W)).toBe(1);
  });

  it('no sale de las pestañas de los extremos', () => {
    expect(settleIndex(2, -300, 0, W)).toBe(2);
    expect(settleIndex(0, 300, 0, W)).toBe(0);
  });

  it('si distancia y velocidad discrepan, manda la velocidad', () => {
    expect(settleIndex(1, -150, 900, W)).toBe(0);
  });
});

describe('routeIndex', () => {
  it('coloca por nombre de ruta, no por posición', () => {
    expect(routeIndex('discover')).toBe(0);
    expect(routeIndex('matches')).toBe(1);
    expect(routeIndex('(tabs)/profile')).toBe(2);
  });
});
