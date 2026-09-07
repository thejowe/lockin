/**
 * Campo de escritura y botón de enviar.
 *
 * Es controlado a propósito: la pantalla necesita poder escribir en él cuando se
 * elige un icebreaker. `inputRef` existe para devolver el foco tras esa
 * elección, sin que el componente tenga que saber por qué le cambian el texto.
 */

import { forwardRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface MessageComposerProps {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  /** Bloquea el envío mientras el anterior está en vuelo. */
  sending?: boolean;
  placeholder?: string;
}

export const MessageComposer = forwardRef<TextInput, MessageComposerProps>(function MessageComposer(
  { value, onChangeText, onSend, sending = false, placeholder = 'Escribe un mensaje' },
  ref
) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View
      style={[
        styles.root,
        {
          borderTopColor: theme.border,
          backgroundColor: theme.background,
          // Con edge-to-edge el compositor llega hasta el borde de la ventana, y
          // `KeyboardProvider` va con `navigationBarTranslucent`: la librería ya
          // no descuenta la barra de navegación de la altura del teclado, así
          // que ese hueco lo reserva aquí quien sabe cuánto mide.
          paddingBottom: Spacing.two + insets.bottom,
        },
      ]}>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        multiline
        // `default` en vez de `send`: con multilínea, Enter debe hacer salto de
        // línea, no mandar a medias un mensaje largo.
        returnKeyType="default"
        accessibilityLabel="Mensaje"
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            color: theme.text,
            fontFamily: FontFamily.sans,
          },
        ]}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enviar mensaje"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={onSend}
        style={({ pressed }) => [
          styles.send,
          {
            backgroundColor: canSend ? theme.brass : theme.backgroundSelected,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <ThemedText type="smallBold" style={{ color: canSend ? theme.onAccent : theme.textMuted }}>
          Enviar
        </ThemedText>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    // Crece con el texto, pero sin comerse la conversación.
    minHeight: 44,
    maxHeight: 132,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderRadius: Radii.large,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
  },
  send: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
  },
});
