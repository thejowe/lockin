/**
 * Cada icono del juego se dibuja: un nombre sin rama en el `switch` pintaría un
 * SVG vacío sin que nada se quejara.
 */

import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';

const NAMES: IconName[] = [
  'discover',
  'chat',
  'person',
  'pair',
  'focus',
  'both',
  'heart',
  'close',
  'expand',
  'check',
  'flame',
  'lock',
  'sparkle',
  'send',
  'document',
  'chevrons',
  'back',
];

describe('Icon', () => {
  it.each(NAMES)('dibuja «%s» con trazo', async (name) => {
    await render(
      <View testID="host">
        <Icon name={name} color="#FFFFFF" size={20} />
      </View>
    );

    const host = screen.getByTestId('host');
    // El SVG raíz más al menos una figura dentro.
    expect(JSON.stringify(screen.toJSON())).toMatch(/#FFFFFF|ffffff|4294967295/i);
    expect(host.children.length).toBeGreaterThan(0);
  });
});
