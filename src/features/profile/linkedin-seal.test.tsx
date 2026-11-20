import { render, screen } from '@testing-library/react-native';
import { LinkedinSeal } from './linkedin-seal';

it('mantiene el nombre verificado accesible en el sello compacto de la tarjeta y en el perfil', async () => {
  const view = await render(<LinkedinSeal name="Ana" compact />);
  expect(screen.getByLabelText('LinkedIn verificado: Ana')).toHaveTextContent('✓ LinkedIn');
  await view.rerender(<LinkedinSeal name="Ana" />);
  expect(screen.getByLabelText('LinkedIn verificado: Ana')).toHaveTextContent('✓ LinkedIn · Ana');
});
