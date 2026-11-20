import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { LocationFields } from './location-fields';
import { zoneLabel } from './locations';

it('descarta un país al cambiar la búsqueda y acepta una sugerencia con varias zonas horarias', async () => {
  const changeZone = jest.fn();
  function Form() {
    const [country, setCountry] = useState('ES');
    const [city, setCity] = useState('');
    const [timezone, setTimezone] = useState('Europe/Madrid');
    return (
      <LocationFields
        value={{ country, city, timezone }}
        errors={country ? {} : { timezone: 'Elige primero un país' }}
        onCountryChange={setCountry}
        onCityChange={setCity}
        onTimezoneChange={(value) => {
          changeZone(value);
          setTimezone(value);
        }}
      />
    );
  }
  await render(<Form />);
  const search = screen.getByLabelText('País');
  await fireEvent.changeText(search, 'zzzx');
  expect(screen.getByText('Ningún país coincide.')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Ciudad')).toBeNull();
  expect(screen.getByText('Elige primero un país')).toBeOnTheScreen();
  await fireEvent.changeText(search, 'espa');
  await fireEvent.press(screen.getByRole('button', { name: 'España' }));
  const city = screen.getByLabelText('Ciudad');
  await fireEvent.changeText(city, 'La Laguna');
  expect(city).toHaveDisplayValue('La Laguna');
  const island = screen.getByRole('radio', { name: zoneLabel('Atlantic/Canary') });
  await fireEvent.press(island);
  expect(changeZone).toHaveBeenCalledWith('Atlantic/Canary');
  expect(island).toBeSelected();
});
