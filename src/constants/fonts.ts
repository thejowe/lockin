/**
 * Mapa de fuentes que carga `src/app/_layout.tsx` con `expo-font`.
 *
 * Las claves son los nombres de familia que usan los estilos de
 * `Typography` en `src/constants/theme.ts` — si añades un peso aquí,
 * expón también su alias en `FontFamily`.
 */

import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';

export const BrandFonts = {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
};
