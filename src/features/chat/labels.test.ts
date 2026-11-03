import {
  AMBITION_LABELS,
  MODE_LABELS,
  SPECIALTY_LABELS,
  STARTING_POINT_LABELS,
  TIME_BAND_LABELS,
  joinNaturally,
} from './labels';

describe('etiquetas de dominio', () => {
  it.each([
    ['especialidades', SPECIALTY_LABELS],
    ['franjas', TIME_BAND_LABELS],
    ['ambición', AMBITION_LABELS],
    ['punto de partida', STARTING_POINT_LABELS],
    ['modo', MODE_LABELS],
  ])('%s: cada clave tiene una etiqueta legible', (_name, labels) => {
    const entries = Object.entries(labels);

    expect(entries.length).toBeGreaterThan(0);
    for (const [, label] of entries) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('traduce las especialidades al castellano', () => {
    expect(SPECIALTY_LABELS.diseno).toBe('diseño');
    expect(SPECIALTY_LABELS.dev).toBe('desarrollo');
  });

  it('enumera con «y» y sin coma de Oxford', () => {
    expect(joinNaturally(['diseño', 'producto', 'datos'])).toBe('diseño, producto y datos');
  });
});
