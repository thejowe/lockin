import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useThemeName } from '@/hooks/use-theme';

/**
 * Tabs nativas: Descubrir / Matches / Perfil.
 *
 * Los iconos usan SF Symbols en iOS (`sf`) y Material Symbols en Android (`md`),
 * así que no dependen de ningún asset del proyecto. La versión web vive en
 * `app-tabs.web.tsx`.
 */
export default function AppTabs() {
  const palette = Colors[useThemeName()];

  return (
    <NativeTabs
      backgroundColor={palette.background}
      indicatorColor={palette.backgroundSelected}
      iconColor={palette.textSecondary}
      labelStyle={{ color: palette.textSecondary, selected: { color: palette.brass } }}>
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Label>Descubrir</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }}
          md="style"
          selectedColor={palette.brass}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="matches">
        <NativeTabs.Trigger.Label>Matches</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="forum"
          selectedColor={palette.brass}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="account_circle"
          selectedColor={palette.brass}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
