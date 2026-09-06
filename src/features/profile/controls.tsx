/**
 * Primitivas de formulario del bloque `perfil`.
 *
 * Son deliberadamente tontas: pintan estado, no lo guardan. Toda la lógica vive
 * en `profile-form.tsx`. Ningún color literal — todo sale de `@/constants/theme`.
 */

import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
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
      <ThemedText type="label" themeColor="brass">
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

/** Fila seleccionable grande: para elecciones únicas que necesitan explicación. */
export function OptionCard<T extends string>({
  option,
  selected,
  onPress,
}: {
  option: Option<T>;
  selected: boolean;
  onPress: () => void;
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
          backgroundColor: selected ? theme.brassSoft : theme.backgroundElement,
          borderColor: selected ? theme.brass : theme.border,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText type="bodyStrong" themeColor={selected ? 'brass' : 'text'}>
        {option.label}
      </ThemedText>
      {option.description ? (
        <ThemedText type="small" themeColor="textSecondary">
          {option.description}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/** Chip compacto. Para selección múltiple y para elecciones de una sola palabra. */
export function Chip({
  label,
  selected,
  onPress,
  multiple = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `true` cuando forma parte de una selección múltiple: cambia el rol de a11y. */
  multiple?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, selected }}
      accessibilityLabel={label}
      // El chip mide 36 px de alto: el hitSlop lo lleva a los 44 mínimos sin
      // engordarlo visualmente ni descuadrar la rejilla.
      hitSlop={{ top: 6, bottom: 6 }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.teal : theme.backgroundElement,
          borderColor: selected ? theme.teal : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText type="smallBold" themeColor={selected ? 'onAccent' : 'textSecondary'}>
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
  ...rest
}: TextInputProps & {
  value: string;
  onChangeText: (next: string) => void;
  /** Muestra el contador "23/140" bajo el campo. Solo tiene efecto con `maxLength`. */
  showCount?: boolean;
}) {
  const theme = useTheme();

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        maxLength={maxLength}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
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
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}>
      <ThemedText type="heading" themeColor="brass">
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Botón de acción principal. Latón sólido. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.brass, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
      ]}>
      <ThemedText type="bodyStrong" themeColor="onAccent">
        {label}
      </ThemedText>
    </Pressable>
  );
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
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles.buttonOutline,
        {
          borderColor: tone === 'danger' ? theme.danger : theme.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <ThemedText type="bodyStrong" themeColor={tone === 'danger' ? 'danger' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  optionCard: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radii.medium,
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    minHeight: 48,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 88,
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
    borderRadius: Radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepperButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.small,
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.pill,
  },
  buttonOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
});
