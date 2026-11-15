/**
 * El selector de Descubrir: la pestaña del grupo que administras cuelga de
 * «Grupos» — en Cofundador no está, y se despliega al entrar en Grupos.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { SectionSwitch } from './groups-section';

describe('SectionSwitch', () => {
  it('oculta tu grupo mientras miras Cofundador', async () => {
    await render(<SectionSwitch value="cofounder" onChange={jest.fn()} myGroupName="Nébula" />);
    expect(screen.getByRole('tab', { name: 'Grupos' })).toBeTruthy();
    expect(screen.queryByText('Nébula')).toBeNull();
  });

  it('despliega tu grupo al estar en Grupos', async () => {
    const onChange = jest.fn();
    await render(<SectionSwitch value="groups" onChange={onChange} myGroupName="Nébula" />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Reclutar para Nébula' }));
    expect(onChange).toHaveBeenCalledWith('my-group');
  });

  it('sin grupo propio, en Grupos no aparece una tercera pestaña', async () => {
    await render(<SectionSwitch value="groups" onChange={jest.fn()} myGroupName={null} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });
});
