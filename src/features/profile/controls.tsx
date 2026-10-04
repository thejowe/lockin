/**
 * Primitivas de formulario del bloque `perfil`.
 *
 * Son deliberadamente tontas: pintan estado, no lo guardan. Toda la lógica vive
 * en `profile-form.tsx`. Ningún color literal — todo sale de `@/constants/theme`.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import {
  Control,
  Duration,
  HitSlop,
  Opacity,
  Radii,
  Spacing,
  Stroke,
  Typography,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Option } from './catalog';

/** Bloque etiquetado de un campo, con pista y error opcionales. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  /** Mensaje de validación. Si existe, se pinta en lugar de la pista. */
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>

      {error ? (
        <ThemedText type="caption" themeColor="danger">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" themeColor="textMuted">
          {hint}
        </ThemedText>
      ) : null}

      {children}
    </View>
  );
}

/**
 * Fila seleccionable grande: para elecciones únicas que necesitan explicación.
 *
 * Cristal; la elegida sube un nivel de vidrio, gana un canto de brasa y su
 * marca redonda se rellena con un pequeño salto. Con `icon`, el icono va en su
 * baldosa a la izquierda, como los ajustes de la referencia.
 */
export function OptionCard<T extends string>({
  option,
  selected,
  onPress,
  icon,
}: {
  option: Option<T>;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}
      accessibilityHint={option.description}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        {
          backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: selected ? theme.brass : theme.border,
          borderWidth: Stroke.hairline,
          boxShadow: selected
            ? `inset 0px 1px 0px ${theme.glassHighlight}, inset 0 0 0 1px ${theme.brass}`
            : `inset 0px 1px 0px ${theme.glassHighlight}`,
          opacity: pressed ? Opacity.pressed : 1,
        },
      ]}>
      {icon ? (
        <View style={[styles.optionIcon, { backgroundColor: theme.backgroundSelected }]}>
          <Icon name={icon} size={22} color={selected ? theme.brass : theme.textSecondary} />
        </View>
      ) : null}

      <View style={styles.optionText}>
        <ThemedText type="heading">{option.label}</ThemedText>
        {option.description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {option.description}
          </ThemedText>
        ) : null}
      </View>

      <View style={[styles.radio, { borderColor: selected ? theme.brass : theme.textMuted }]}>
        {selected ? (
          <Animated.View
            entering={ZoomIn.springify().damping(14).stiffness(260)}
            exiting={ZoomOut.duration(Duration.fast)}
            style={[styles.radioDot, { backgroundColor: theme.brass }]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Chip compacto. Para selección múltiple y para elecciones de una sola palabra. */
export function Chip({
  label,
  selected,
  onPress,
  multiple = false,
  accessibilityLabel = label,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `true` cuando forma parte de una selección múltiple: cambia el rol de a11y. */
  multiple?: boolean;
  /**
   * Cómo se anuncia el chip, si la etiqueta visible no basta. Hace falta cuando
   * dos grupos comparten opciones —«Desarrollo» como algo que dominas y como
   * algo que buscas—: sin esto, quien navega a ciegas oye dos veces lo mismo.
   */
  accessibilityLabel?: string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={accessibilityLabel}
      // El chip mide 36 px de alto: el hitSlop lo lleva a los 44 mínimos sin
      // engordarlo visualmente ni descuadrar la rejilla.
      hitSlop={HitSlop.chip}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.teal : theme.backgroundElement,
          borderColor: selected ? theme.teal : theme.border,
          boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
          opacity: pressed ? Opacity.pressed : 1,
        },
      ]}>
      <ThemedText type="smallBold" themeColor={selected ? 'onAccent' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Contenedor que reparte chips en varias líneas. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

/** Campo de texto de una o varias líneas, con contador opcional. */
export function TextField({
  value,
  onChangeText,
  multiline,
  maxLength,
  showCount = false,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & {
  value: string;
  onChangeText: (next: string) => void;
  /** Muestra el contador "23/140" bajo el campo. Solo tiene efecto con `maxLength`. */
  showCount?: boolean;
}) {
  const theme = useTheme();
  // El foco se ve: el canto del cristal pasa a brasa mientras se escribe.
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        maxLength={maxLength}
        placeholderTextColor={theme.textMuted}
        selectionColor={theme.brass}
        cursorColor={theme.brass}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          {
            backgroundColor: focused ? theme.backgroundSelected : theme.backgroundElement,
            borderColor: focused ? theme.brass : theme.border,
            boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
            color: theme.text,
          },
        ]}
        {...rest}
      />

      {showCount && maxLength ? (
        <ThemedText type="caption" themeColor="textMuted" style={styles.count}>
          {value.length}/{maxLength}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Control de cantidad con dos botones. Evita abrir el teclado para un solo número. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  formatValue,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Cómo se lee el número, p. ej. "12 h/semana". */
  formatValue: (value: number) => string;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const theme = useTheme();

  return (
    <View
      style={[
        styles.stepper,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <StepperButton
        label="−"
        accessibilityLabel="Restar"
        disabled={value <= min}
        onPress={() => onChange(clamp(value - step))}
      />

      <ThemedText type="bodyStrong" style={styles.stepperValue}>
        {formatValue(value)}
      </ThemedText>

      <StepperButton
        label="+"
        accessibilityLabel="Sumar"
        disabled={value >= max}
        onPress={() => onChange(clamp(value + step))}
      />
    </View>
  );
}

function StepperButton({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepperButton,
        {
          backgroundColor: theme.backgroundSelected,
          opacity: disabled ? Opacity.disabled : pressed ? Opacity.pressed : 1,
        },
      ]}>
      <ThemedText type="heading" themeColor="brass">
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Botón de acción principal. Latón sólido. Es el `Button` compartido. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return <Button label={label} onPress={onPress} disabled={disabled} />;
}

/** Botón secundario: mismo tamaño, sin peso visual. */
export function SecondaryButton({
  label,
  onPress,
  tone = 'text',
}: {
  label: string;
  onPress: () => void;
  /** `danger` para acciones que descartan cambios. */
  tone?: 'text' | 'danger';
}) {
  return (
    <Button label={label} onPress={onPress} variant={tone === 'danger' ? 'danger' : 'secondary'} />
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.large,
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: Radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: Spacing.half,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: Radii.pill,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
  input: {
    minHeight: Control.field,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
    fontFamily: Typography.body.fontFamily,
    fontSize: Typography.body.fontSize,
  },
  inputMultiline: {
    minHeight: Control.textArea,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
  count: {
    marginTop: Spacing.one,
    textAlign: 'right',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.one,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
  stepperButton: {
    width: Control.minTouch,
    height: Control.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.pill,
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
  },
});
