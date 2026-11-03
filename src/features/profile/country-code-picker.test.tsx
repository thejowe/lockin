/**
 * La caja del prefijo («+34»): abre una hoja con un buscador numérico, filtra los
 * prefijos que empiezan por lo escrito, y elegir uno cierra la hoja y avisa.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { CountryCodePicker } from './country-code-picker';
import { DEFAULT_COUNTRY, filterCountries } from './countries';

const FRANCE = filterCountries('33')[0];

async function open(onChange = jest.fn(), disabled = false) {
  await render(
    <CountryCodePicker country={DEFAULT_COUNTRY} onChange={onChange} disabled={disabled} />
  );
  await fireEvent.press(screen.getByRole('button', { name: /^Prefijo del país:/ }));
  return onChange;
}

describe('CountryCodePicker', () => {
  it('enseña el prefijo actual y no abre la hoja hasta pulsarlo', async () => {
    await render(<CountryCodePicker country={DEFAULT_COUNTRY} onChange={jest.fn()} />);

    expect(screen.getByText(`+${DEFAULT_COUNTRY.dial}`)).toBeTruthy();
    expect(screen.queryByLabelText('Buscar prefijo por número')).toBeNull();
  });

  it('el buscador solo admite dígitos y filtra por prefijo', async () => {
    await open();

    await fireEvent.changeText(screen.getByLabelText('Buscar prefijo por número'), 'a3b3');

    expect(screen.getByLabelText('Buscar prefijo por número').props.value).toBe('33');
    expect(screen.getByRole('button', { name: `${FRANCE.name}, +${FRANCE.dial}` })).toBeTruthy();
  });

  it('un prefijo que no existe lo dice', async () => {
    await open();

    await fireEvent.changeText(screen.getByLabelText('Buscar prefijo por número'), '9999');

    expect(screen.getByText('Ningún país tiene ese prefijo.')).toBeTruthy();
  });

  it('elegir un país avisa y cierra la hoja', async () => {
    const onChange = await open();
    await fireEvent.changeText(screen.getByLabelText('Buscar prefijo por número'), '33');

    await fireEvent.press(screen.getByRole('button', { name: `${FRANCE.name}, +${FRANCE.dial}` }));

    expect(onChange).toHaveBeenCalledWith(FRANCE);
    expect(screen.queryByLabelText('Buscar prefijo por número')).toBeNull();
  });

  it('«Cerrar» deja la hoja sin elegir nada', async () => {
    const onChange = await open();

    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Buscar prefijo por número')).toBeNull();
  });
});
