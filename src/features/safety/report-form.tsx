import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

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
  anchorActions = false,
}: {
  name: string;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
  onCancel: () => void;
  onSubmitted: () => void;
  /**
   * Saca «Enviar reporte» y «Cancelar» del scroll: los campos se desplazan en
   * su propia zona y las acciones quedan fijas al pie. Hace falta cuando el
   * formulario vive en un contenedor de alto acotado (la tarjeta del deck, que
   * termina sobre la barra de tabs flotante) y el padre NO lo envuelve en un
   * `ScrollView`: el formulario ocupa todo el alto disponible (`flex: 1`).
   */
  anchorActions?: boolean;
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

  const fields = (
    <>
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
    </>
  );
  const actions = (
    <>
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
    </>
  );

  if (anchorActions)
    return (
      <View style={styles.anchoredRoot}>
        <ScrollView
          testID="report-fields"
          style={styles.anchoredScroll}
          contentContainerStyle={styles.root}
          keyboardShouldPersistTaps="handled">
          {fields}
        </ScrollView>
        <View testID="report-actions" style={styles.actions}>
          {actions}
        </View>
      </View>
    );

  return (
    <View style={styles.root}>
      {fields}
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  anchoredRoot: { flex: 1, gap: Spacing.two },
  anchoredScroll: { flex: 1 },
  actions: { gap: Spacing.two },
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
