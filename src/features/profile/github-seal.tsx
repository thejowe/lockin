/**
 * El sello de GitHub verificado, en su única forma.
 *
 * Lo pintan tres sitios —el perfil propio, la ficha ajena y la tarjeta del
 * deck— y vive aquí para que digan exactamente lo mismo: un sello que en una
 * pantalla promete más que en otra es un sello que miente en una de las dos.
 *
 * Dos reglas que no son cosméticas:
 *
 * - **No puede ser solo un icono.** Sin `accessibilityLabel` explícito, quien
 *   navega con lector de pantalla no oye nada, y lo que no se oye no informa.
 * - **El copy nombra GitHub.** Certifica que ese enlace es suyo y nada más: ni
 *   que la persona sea buena, ni que exista, ni que se llame como dice. Un
 *   check a secas junto al nombre se lee como «perfil verificado», que es
 *   justo lo que este sello NO dice (ver la spec).
 *
 * Y no hay contrario: sin sello no se pinta nada. Marcar lo no verificado
 * castigaría a las nueve especialidades que no tienen GitHub, y eso es filtrar
 * por profesión por la puerta del copy.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function GithubSeal({
  handle,
  /** Versión pequeña, para ir junto al nombre en la tarjeta del deck. */
  compact = false,
}: {
  handle: string;
  compact?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`GitHub verificado: ${handle}`}
      style={[
        styles.seal,
        compact ? styles.compact : styles.full,
        { backgroundColor: theme.brassSoft },
      ]}>
      <ThemedText type={compact ? 'smallBold' : 'bodyStrong'} themeColor="brass">
        {compact ? `✓ GitHub @${handle}` : `✓ @${handle} · verificado`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  seal: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
  },
  full: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  compact: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
});
