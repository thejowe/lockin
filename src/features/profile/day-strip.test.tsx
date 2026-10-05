/**
 * Tests de la jornada: la coincidencia se dice en texto y solo se promete
 * cuando las dos personas comparten zona horaria.
 *
 * Ojo: en RNTL 14 `render` es asíncrono.
 */

import { render, screen } from '@testing-library/react-native';

import { DayStrip } from './day-strip';

describe('DayStrip', () => {
  it('nombra la zona y las horas por semana', async () => {
    await render(<DayStrip hoursPerWeek={30} bands={['manana']} timezone="America/Bogota" />);

    expect(screen.getByText('Jornada · hora de Bogota')).toBeTruthy();
    expect(screen.getByText('30 h/sem')).toBeTruthy();
  });

  it('dice en qué franjas coincidís si compartís zona horaria', async () => {
    await render(
      <DayStrip
        hoursPerWeek={20}
        bands={['manana', 'tarde', 'noche']}
        timezone="Europe/Madrid"
        viewer={{ bands: ['tarde', 'noche'], timezone: 'Europe/Madrid' }}
      />
    );

    expect(screen.getByText('Coincidís por la tarde y por la noche')).toBeTruthy();
  });

  it('con zonas distintas no promete un solape que no existe', async () => {
    await render(
      <DayStrip
        hoursPerWeek={20}
        bands={['manana']}
        timezone="Europe/Madrid"
        viewer={{ bands: ['manana'], timezone: 'America/Bogota' }}
      />
    );

    expect(screen.queryByText(/Coincidís/)).toBeNull();
  });

  it('se lee entera para un lector de pantalla', async () => {
    await render(
      <DayStrip
        hoursPerWeek={12}
        bands={['madrugada']}
        timezone="America/Mexico_City"
        viewer={{ bands: ['madrugada'], timezone: 'America/Mexico_City' }}
      />
    );

    expect(
      screen.getByLabelText(
        'Jornada, hora de Mexico City: 12 horas por semana, madrugada. Coincidís de madrugada.'
      )
    ).toBeTruthy();
  });
});
