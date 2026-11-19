import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { projectRanges } from './day-schedule';
import { DayStrip } from './day-strip';
import * as locations from './locations';

const period = (startMin: number, endMin: number) => ({ startMin, endMin });

describe('DayStrip', () => {
  afterEach(() => jest.restoreAllMocks());

  it('pinta el rango exacto, las cinco marcas y las horas semanales', async () => {
    jest.spyOn(locations, 'deviceTimezone').mockReturnValue('America/Bogota');
    await render(
      <DayStrip hoursPerWeek={30} ranges={[period(540, 810)]} timezone="America/Bogota" />
    );

    expect(screen.getByText('Jornada · hora de Bogota')).toBeTruthy();
    expect(screen.getByText('30 h/sem')).toBeTruthy();
    expect(screen.getByText('De 09:00 a 13:30')).toBeTruthy();
    for (const tick of ['00', '06', '12', '20', '24']) {
      expect(screen.getByText(tick, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(StyleSheet.flatten(screen.getByTestId('workday-period').props.style)).toMatchObject({
      left: '37.5%',
      width: '18.75%',
    });
    expect(screen.queryByText(/Coincidís/)).toBeNull();
  });

  it('convierte ambos horarios al huso actual del móvil y anuncia el solape', async () => {
    jest.spyOn(locations, 'deviceTimezone').mockReturnValue('UTC');
    await render(
      <DayStrip
        hoursPerWeek={12}
        ranges={[period(540, 840)]}
        timezone="Asia/Kathmandu"
        viewer={{ ranges: [period(600, 810)], timezone: 'Asia/Kolkata' }}
      />
    );
    expect(screen.getByText('Jornada · hora de UTC')).toBeTruthy();
    expect(screen.getByText('De 03:15 a 08:15')).toBeTruthy();
    expect(screen.getByText('Coincidís de 04:30 a 08:00')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Jornada, hora de UTC: 12 horas por semana, de 03:15 a 08:15. Coincidís de 04:30 a 08:00.'
      )
    ).toBeTruthy();
    expect(screen.getByTestId('workday-overlap')).toBeTruthy();
  });

  it('dibuja ambos extremos del día si cruza medianoche y los lee como un rango', async () => {
    jest.spyOn(locations, 'deviceTimezone').mockReturnValue('UTC');
    await render(
      <DayStrip
        hoursPerWeek={10}
        ranges={[period(240, 480), period(720, 810)]}
        timezone="Asia/Kolkata"
        viewer={{ ranges: [period(0, 120)], timezone: 'UTC' }}
      />
    );
    expect(screen.getAllByTestId('workday-period')).toHaveLength(3);
    expect(screen.getByText('De 06:30 a 08:00 y de 22:30 a 02:30')).toBeTruthy();
    expect(screen.getByText('Coincidís de 00:00 a 02:00')).toBeTruthy();
  });

  it('conserva dos tramos distintos situados antes y después de medianoche en origen', async () => {
    jest.spyOn(locations, 'deviceTimezone').mockReturnValue('UTC');
    const ranges = [period(0, 360), period(1200, 1440)];
    await render(
      <DayStrip
        hoursPerWeek={10}
        ranges={ranges}
        timezone="UTC"
        viewer={{ ranges, timezone: 'UTC' }}
      />
    );
    expect(screen.getByText('De 00:00 a 06:00 y de 20:00 a 24:00')).toBeTruthy();
    expect(screen.getByText('Coincidís de 00:00 a 06:00 y de 20:00 a 24:00')).toBeTruthy();
    expect(screen.getAllByTestId('workday-period')).toHaveLength(2);
    expect(screen.getAllByTestId('workday-overlap')).toHaveLength(2);
  });

  it('anuncia una sola coincidencia al cruzar ambas jornadas la medianoche local', async () => {
    jest.spyOn(locations, 'deviceTimezone').mockReturnValue('UTC');
    await render(
      <DayStrip
        hoursPerWeek={10}
        ranges={[period(240, 480)]}
        timezone="Asia/Kolkata"
        viewer={{ ranges: [period(300, 420)], timezone: 'Asia/Kolkata' }}
      />
    );
    expect(screen.getByText('Coincidís de 23:30 a 01:30')).toBeTruthy();
    expect(screen.getAllByTestId('workday-overlap')).toHaveLength(2);
  });

  it('dos jornadas que solo se tocan no coinciden', async () => {
    jest.spyOn(locations, 'deviceTimezone').mockReturnValue(undefined);
    await render(
      <DayStrip
        hoursPerWeek={16}
        ranges={[period(540, 840)]}
        timezone="UTC"
        viewer={{ ranges: [period(840, 1020)], timezone: 'UTC' }}
      />
    );
    expect(screen.queryByText(/Coincidís/)).toBeNull();
    expect(screen.queryByTestId('workday-overlap')).toBeNull();
  });

  it('con un huso histórico ilegible conserva la zona original y evita inventar solape', async () => {
    jest.spyOn(locations, 'deviceTimezone').mockReturnValue('Europe/Madrid');
    await render(
      <DayStrip
        hoursPerWeek={15}
        ranges={[period(540, 840)]}
        timezone="Zona antigua"
        viewer={{ ranges: [period(540, 840)], timezone: 'Europe/Madrid' }}
      />
    );
    expect(screen.getByText('Jornada · hora de Zona antigua')).toBeTruthy();
    expect(screen.getByText('De 09:00 a 14:00')).toBeTruthy();
    expect(screen.queryByText(/Coincidís/)).toBeNull();
  });
});

describe('projectRanges', () => {
  it.each([
    ['2026-01-15T12:00:00Z', 480],
    ['2026-07-15T12:00:00Z', 420],
  ] as const)('usa el desfase estacional de Madrid a UTC el %s', (instant, start) => {
    expect(projectRanges([period(540, 840)], 'Europe/Madrid', 'UTC', new Date(instant))).toEqual([
      [period(start, start + 300)],
    ]);
  });

  it('mantiene un día completo incluso si cambia la fecha al convertir', () => {
    expect(
      projectRanges(
        [period(0, 1440)],
        'Pacific/Kiritimati',
        'Pacific/Honolulu',
        new Date('2026-08-15T11:00:00Z')
      )
    ).toEqual([[period(0, 1440)]]);
  });
});
