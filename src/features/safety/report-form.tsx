import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { REPORT_MAX_LENGTH, REPORT_REASONS, type ReportReason } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { useReportKeyboardLift } from './keyboard-lift';

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
  const scrollRef = useRef<ScrollView>(null);
  const detailsFocused = useRef(false);
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
        onFocus={() => {
          detailsFocused.current = true;
          scrollRef.current?.scrollToEnd({ animated: false });
        }}
        onBlur={() => {
          detailsFocused.current = false;
        }}
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
      <AnchoredLayout scrollRef={scrollRef} detailsFocused={detailsFocused} actions={actions}>
        {fields}
      </AnchoredLayout>
    );

  return (
    <View style={styles.root}>
      {fields}
      {actions}
    </View>
  );
}

/**
 * Campos con scroll propio y acciones fijas al pie. El pie reserva el trozo de
 * teclado que invade el contenedor (ver `keyboard-lift.ts`): el scroll se
 * encoge y las acciones quedan por encima del teclado.
 */
function AnchoredLayout({
  scrollRef,
  detailsFocused,
  actions,
  children,
}: {
  scrollRef: RefObject<ScrollView | null>;
  detailsFocused: RefObject<boolean>;
  actions: ReactNode;
  children: ReactNode;
}) {
  const { ref, onLayout, lift } = useReportKeyboardLift();

  // Al encogerse el scroll, «Detalles» (último campo) podría quedar fuera.
  useEffect(() => {
    if (lift > 0 && detailsFocused.current) scrollRef.current?.scrollToEnd({ animated: false });
  }, [lift, detailsFocused, scrollRef]);

  return (
    <View ref={ref} onLayout={onLayout} collapsable={false} style={styles.anchoredOuter}>
      <View testID="report-anchored" style={[styles.anchoredRoot, { paddingBottom: lift }]}>
        <ScrollView
          ref={scrollRef}
          testID="report-fields"
          style={styles.anchoredScroll}
          contentContainerStyle={styles.root}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        <View testID="report-actions" style={styles.actions}>
          {actions}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  anchoredOuter: { flex: 1 },
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
