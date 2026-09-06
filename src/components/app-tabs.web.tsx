import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Equivalente web de las tabs nativas. Misma estructura de rutas
 * (Descubrir / Matches / Perfil) con una barra propia en la parte superior.
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="discover" href="/discover" asChild>
            <TabButton>Descubrir</TabButton>
          </TabTrigger>
          <TabTrigger name="matches" href="/matches" asChild>
            <TabButton>Matches</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>Perfil</TabButton>
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();

  return (
    <Pressable
      {...props}
      // La pastilla mide 28 px de alto: el hitSlop la lleva a los 44 mínimos sin
      // engordar la barra superior.
      hitSlop={{ top: 8, bottom: 8 }}
      style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButton,
          { backgroundColor: isFocused ? theme.backgroundSelected : 'transparent' },
        ]}>
        <ThemedText type="smallBold" themeColor={isFocused ? 'brass' : 'textSecondary'}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function TabBar(props: TabListProps) {
  const theme = useTheme();

  return (
    <View {...props} style={[styles.bar, { backgroundColor: theme.background }]}>
      <View style={[styles.barInner, { borderColor: theme.border }]}>
        <ThemedText type="subtitle" themeColor="brass" style={styles.brand}>
          LockIn
        </ThemedText>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  bar: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brand: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
  },
});
