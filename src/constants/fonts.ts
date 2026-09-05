/**
 * Mapa de fuentes de marca que carga `src/app/_layout.tsx` con `expo-font`.
 *
 * Las claves son los nombres de familia que usan los estilos de
 * `Typography` en `src/constants/theme.ts` — si añades un peso aquí,
 * expón también su alias en `FontFamily`.
 */

import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';

export const BrandFonts = {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
};
