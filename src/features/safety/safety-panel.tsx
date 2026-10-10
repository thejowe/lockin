import { useRef, useState, type ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRefreshQuery, useRepositories } from '@/data';

import { ReportForm } from './report-form';

export function SafetyMenuButton({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Opciones de ${name}`}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={styles.trigger}>
      <ThemedText type="subtitle" accessible={false}>
        ⋯
      </ThemedText>
    </Pressable>
  );
}

/** Confirmación y formulario en la propia pantalla, sin Alert del sistema. */
export function SafetyPanel({
  profileId,
  name,
  matchId,
  onClose,
  onBlocked,
  anchorReportActions = false,
}: {
  profileId: string;
  name: string;
  matchId?: string;
  onClose: () => void;
  onBlocked: () => void;
  /** Ver `ReportForm.anchorActions`: el padre no debe envolver el panel en un `ScrollView`. */
  anchorReportActions?: boolean;
}) {
  const repositories = useRepositories();
  const [stage, setStage] = useState<'menu' | 'block' | 'report' | 'reported'>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const submitting = useRef(false);
  const refreshPar = useRefreshQuery('deck:par');
  const refreshLockin = useRefreshQuery('deck:lockin');
  const refreshBoth = useRefreshQuery('deck:ambos');
  const refreshMatches = useRefreshQuery('matches');
  const refreshMatch = useRefreshQuery(`match:${matchId ?? ''}`);

  async function block() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(false);
    try {
      await repositories.profiles.block(profileId);
      refreshPar();
      refreshLockin();
      refreshBoth();
      refreshMatches();
      refreshMatch();
      onBlocked();
    } catch {
      setError(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (stage === 'report')
    return (
      <ReportForm
        name={name}
        anchorActions={anchorReportActions}
        onSubmit={(reason, details) => repositories.profiles.report({ profileId, reason, details })}
        onCancel={() => setStage('menu')}
        onSubmitted={() => setStage('reported')}
      />
    );

  // Con las acciones del reporte ancladas el panel ocupa el alto del contenedor
  // y no hay un `ScrollView` por encima: las etapas cortas se envuelven aquí.
  const scrollable = (node: ReactElement) =>
    anchorReportActions ? (
      <ScrollView keyboardShouldPersistTaps="handled">{node}</ScrollView>
    ) : (
      node
    );

  if (stage === 'reported')
    return scrollable(
      <View style={styles.panel}>
        <ThemedText type="subtitle" accessibilityRole="alert">
          Reporte enviado.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          El reporte es privado.
        </ThemedText>
        <Button
          label="Cerrar"
          accessibilityLabel="Cerrar opciones"
          variant="secondary"
          onPress={onClose}
        />
      </View>
    );

  if (stage === 'block')
    return scrollable(
      <View style={styles.panel}>
        <ThemedText type="subtitle">¿Bloquear a {name}?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Dejaréis de veros en Descubrir y Matches y no podréis enviaros mensajes. Esta persona no
          recibirá ningún aviso.
        </ThemedText>
        {error ? (
          <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
            No se ha podido bloquear. Inténtalo otra vez.
          </ThemedText>
        ) : null}
        <Button
          label={busy ? 'Bloqueando…' : 'Bloquear'}
          accessibilityLabel="Confirmar bloqueo"
          variant="danger"
          disabled={busy}
          onPress={() => void block()}
        />
        <Button
          label="Cancelar"
          accessibilityLabel="Cancelar bloqueo"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setError(false);
            setStage('menu');
          }}
        />
      </View>
    );

  return scrollable(
    <View style={styles.panel}>
      <ThemedText type="subtitle">Opciones de {name}</ThemedText>
      <Button
        label="Bloquear"
        accessibilityLabel={`Bloquear a ${name}`}
        variant="secondary"
        onPress={() => setStage('block')}
      />
      <Button
        label="Reportar"
        accessibilityLabel={`Reportar a ${name}`}
        variant="secondary"
        onPress={() => setStage('report')}
      />
      <Button
        label="Cerrar"
        accessibilityLabel="Cerrar opciones"
        variant="secondary"
        onPress={onClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  panel: { gap: Spacing.three },
});
