// Superficie pública del sistema «cristal» que se sincroniza a Claude Design.
// Solo componentes de presentación + tokens + helpers de movimiento: lo que
// depende del router, push o pager de la app (AppTabs, ExternalLink,
// PushBridge, SwipeBetweenTabs, AppIntro, WelcomeSplash, LocaleSwitchVeil)
// queda fuera a propósito.

export { AmbientBackground, Screen } from '@/components/ambient-background';
export type { AmbientVariant } from '@/components/ambient-background';
export { BackArrow } from '@/components/back-arrow';
export { Button } from '@/components/button';
export type { ButtonVariant } from '@/components/button';
export { CofounderLogo, ThinkingLogo } from '@/components/cofounder-logo';
export { Glass, Frosted, glassStyle, hasNativeGlass } from '@/components/glass';
export { GlassButton } from '@/components/glass-button';
export type { GlassTint } from '@/components/glass-button';
export { Icon } from '@/components/icon';
export type { IconName } from '@/components/icon';
export { RevealStack } from '@/components/reveal-stack';
export { ScalePressable } from '@/components/scale-pressable';
export { LoadingState, MessageState } from '@/components/state-view';
export { ThemedText } from '@/components/themed-text';
export type { ThemedTextProps } from '@/components/themed-text';
export { UnreadBadge, unreadLabel } from '@/components/unread-badge';

export { enterUp, enterRise, enterFade, layoutShift, appear, disappear } from '@/components/motion';
export { ThemeOverride, useTheme } from '@/hooks/use-theme';

export {
  Colors,
  PremiumTones,
  OnPremium,
  FontFamily,
  Typography,
  Spacing,
  Radii,
  Stroke,
  Control,
  HitSlop,
  Opacity,
  Elevation,
  ScrimAlpha,
  BlurIntensity,
  Duration,
  Stagger,
  Curves,
  Springs,
  PressScale,
  MaxContentWidth,
} from '@/constants/theme';
export type { ThemeColor, ThemePalette, TypographyRole } from '@/constants/theme';
