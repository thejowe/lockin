import {
  availabilityForRanges,
  bandsForRanges,
  formatWorkMinute,
  rangesFromBands,
} from './work-range';

const range = (startMin: number, endMin: number) => ({ startMin, endMin });

describe('jornada y franjas', () => {
  it.each([
    [0, 360, ['madrugada']],
    [360, 720, ['manana']],
    [720, 1200, ['tarde']],
    [1200, 1440, ['noche']],
    [690, 750, ['manana', 'tarde']],
    [1170, 1230, ['tarde', 'noche']],
    [0, 1440, ['madrugada', 'manana', 'tarde', 'noche']],
  ] as const)('de %i a %i incluye solo las franjas con solape', (start, end, expected) => {
    expect(bandsForRanges([range(start, end)])).toEqual(expected);
  });

  it('reconstruye un tramo por cada grupo continuo, incluso con franjas en desorden', () => {
    expect(rangesFromBands(['noche', 'manana'])).toEqual([range(360, 720), range(1200, 1440)]);
    expect(rangesFromBands(['noche', 'madrugada'])).toEqual([range(0, 360), range(1200, 1440)]);
    expect(rangesFromBands(['tarde', 'madrugada', 'manana'])).toEqual([range(0, 1200)]);
    expect(rangesFromBands(['manana', 'noche', 'madrugada'])).toEqual([
      range(0, 720),
      range(1200, 1440),
    ]);
    expect(() => rangesFromBands([])).toThrow(RangeError);
  });

  it('devuelve la unión de franjas sin rellenar huecos, y conserva el orden de edición del borrador', () => {
    const draft = [range(1230, 1350), range(360, 510)];
    expect(availabilityForRanges(12, draft)).toEqual({
      hoursPerWeek: 12,
      ranges: [range(360, 510), range(1230, 1350)],
      bands: ['manana', 'noche'],
    });
    expect(draft).toEqual([range(1230, 1350), range(360, 510)]);
    expect(bandsForRanges([range(360, 420), range(480, 600)])).toEqual(['manana']);
  });

  it('admite que dos extremos coincidan y mantiene los dos tramos', () => {
    const ranges = [range(660, 720), range(720, 810)];
    expect(availabilityForRanges(8, ranges)).toEqual({
      hoursPerWeek: 8,
      ranges,
      bands: ['manana', 'tarde'],
    });
  });

  it('rechaza más de dos tramos, una lista vacía o cualquier solape', () => {
    for (const invalid of [
      [],
      [range(0, 60), range(60, 120), range(120, 180)],
      [range(540, 720), range(690, 810)],
      [range(690, 810), range(540, 720)],
      [range(540, 900), range(600, 720)],
      [range(60, 120), range(60, 120)],
    ]) {
      expect(() => bandsForRanges(invalid)).toThrow(RangeError);
    }
  });

  it.each([
    [-30, 60],
    [0, 30],
    [0, 1470],
    [580, 720],
    [600, 675],
    [900, 600],
    [NaN, 720],
  ])('rechaza los minutos inválidos %i y %i', (start, end) =>
    expect(() => bandsForRanges([range(start, end)])).toThrow(RangeError)
  );

  it('expresa medias horas y distingue medianoche al abrir y cerrar', () => {
    expect([0, 570, 1440].map(formatWorkMinute)).toEqual(['00:00', '09:30', '24:00']);
  });
});
