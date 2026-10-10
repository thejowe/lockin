import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { REPORT_MAX_LENGTH, REPORT_REASONS, type ReportReason } from '@/data';
import { useTheme } from '@/hooks/use-theme';

const reasonLabels: Record<ReportReason, string> = {
  acoso: 'Acoso',
  'contenido-inapropiado': 'Contenido inapropiado',
  spam: 'Spam o estafa',
  suplantacion: 'Suplantación de identidad',
  otro: 'Otro motivo',
};

export function ReportForm({
  name,
  onSubmit,
  onCancel,
  onSubmitted,
}: {
  name: string;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const theme = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const submitting = useRef(false);
  const length = Array.from(details).length;
  const valid = reason !== null && length <= REPORT_MAX_LENGTH;

  async function submit() {
    if (!reason || !valid || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(false);
    try {
      await onSubmit(reason, details);
      onSubmitted();
    } catch {
      setError(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <ThemedText type="subtitle">Reportar a {name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        El reporte es privado. Esta persona no recibirá ningún aviso.
      </ThemedText>
      <ThemedText type="bodyStrong">Motivo</ThemedText>
      <View accessibilityRole="radiogroup" accessibilityLabel="Motivo del reporte">
        {REPORT_REASONS.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={reasonLabels[value]}
            accessibilityState={{ checked: reason === value, disabled: busy }}
            disabled={busy}
            onPress={() => setReason(value)}
            style={[
              styles.reason,
              {
                borderColor: reason === value ? theme.brass : theme.border,
                backgroundColor: theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small" themeColor={reason === value ? 'brass' : 'text'}>
              {reason === value ? '✓ ' : ''}
              {reasonLabels[value]}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <ThemedText type="small">Detalles (opcional)</ThemedText>
      <TextInput
        accessibilityLabel="Detalles del reporte (opcional)"
        value={details}
        onChangeText={setDetails}
        editable={!busy}
        multiline
        maxLength={REPORT_MAX_LENGTH}
        textAlignVertical="top"
        placeholder="Añade contexto si lo necesitas"
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: theme.backgroundElement,
          },
        ]}
      />
      <ThemedText
        type="caption"
        themeColor={valid || length <= REPORT_MAX_LENGTH ? 'textMuted' : 'danger'}>
        {length}/{REPORT_MAX_LENGTH} caracteres
      </ThemedText>
      {error ? (
        <ThemedText accessibilityRole="alert" type="small" themeColor="danger">
          No se ha podido enviar el reporte. Inténtalo otra vez.
        </ThemedText>
      ) : null}
      <Button
        label={busy ? 'Enviando…' : 'Enviar reporte'}
        accessibilityLabel="Enviar reporte"
        disabled={!valid || busy}
        onPress={() => void submit()}
      />
      <Button
        label="Cancelar"
        accessibilityLabel="Cancelar reporte"
        variant="secondary"
        disabled={busy}
        onPress={onCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  reason: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.one,
    borderWidth: Stroke.hairline,
    borderRadius: Radii.small,
  },
  input: {
    minHeight: 88,
    padding: Spacing.two,
    borderWidth: Stroke.hairline,
    borderRadius: Radii.small,
  },
});
