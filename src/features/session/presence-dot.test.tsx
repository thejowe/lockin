/**
 * El punto de presencia: verde-azulado con halo si la persona está, gris y
 * sin halo si no. Es decorativo: el texto de al lado es lo que se anuncia.
 */

import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { Colors } from '@/constants/theme';

import { PresenceDot } from './presence-dot';

describe('PresenceDot', () => {
  it('presente: punto verde-azulado y su halo', async () => {
    await render(
      <View testID="host">
        <PresenceDot present />
      </View>
    );

    expect(JSON.stringify(screen.toJSON())).toContain(Colors.dark.teal);
  });

  it('ausente: un solo punto gris, sin halo', async () => {
    const view = await render(
      <View testID="host">
        <PresenceDot present />
      </View>
    );
    await view.rerender(
      <View testID="host">
        <PresenceDot present={false} />
      </View>
    );

    expect(JSON.stringify(screen.toJSON())).not.toContain(Colors.dark.teal);
    expect(JSON.stringify(screen.toJSON())).toContain(Colors.dark.textMuted);
  });
});
