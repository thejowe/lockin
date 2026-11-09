/**
 * Bloquear o reportar un grupo, con el mismo recorrido que el panel de una
 * persona (`features/safety/safety-panel.tsx`): menú, confirmación del bloqueo
 * y formulario de reporte en la propia tarjeta, sin Alert del sistema.
 *
 * El reporte va al sistema de siempre (`user_reports`): el reportado es quien
 * administra el grupo, con la referencia del grupo. Bloquear el grupo lo saca
 * del deck y bloquea a su admin.
 */

import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRefreshQuery, useRefreshQueryPrefix, useRepositories } from '@/data';
import { ReportForm } from '@/features/safety/report-form';
import { t } from '@/i18n';

export function GroupSafetyPanel({
  groupId,
  name,
  onClose,
  onBlocked,
}: {
  groupId: string;
  name: string;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const repositories = useRepositories();
  const [stage, setStage] = useState<'menu' | 'block' | 'report' | 'reported'>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const submitting = useRef(false);
  // Bloquear al admin cambia también el deck y los matches de cofundador.
  const refreshDeck = useRefreshQueryPrefix('deck:par');
  const refreshMatches = useRefreshQuery('matches');

  async function block() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(false);
    try {
      await repositories.groups.block(groupId);
      refreshDeck();
      refreshMatches();
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
        title={t('Reportar el grupo {name}', { name })}
        anchorActions
        onSubmit={(reason, details) => repositories.groups.report({ groupId, reason, details })}
        onCancel={() => setStage('menu')}
        onSubmitted={() => setStage('reported')}
      />
    );

  if (stage === 'reported')
    return (
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <ThemedText type="subtitle" accessibilityRole="alert">
            {t('Reporte enviado.')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('El reporte es privado.')}
          </ThemedText>
          <Button
            label={t('Cerrar')}
            accessibilityLabel={t('Cerrar opciones')}
            variant="secondary"
            onPress={onClose}
          />
        </View>
      </ScrollView>
    );

  if (stage === 'block')
    return (
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <ThemedText type="subtitle">{t('¿Bloquear el grupo {name}?', { name })}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t(
              'El grupo dejará de salirte y quien lo administra quedará bloqueado: no os veréis en Descubrir ni en Matches. Nadie recibirá ningún aviso.'
            )}
          </ThemedText>
          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
              {t('No se ha podido bloquear. Inténtalo otra vez.')}
            </ThemedText>
          ) : null}
          <Button
            label={busy ? t('Bloqueando…') : t('Bloquear')}
            accessibilityLabel={t('Confirmar bloqueo')}
            variant="danger"
            disabled={busy}
            onPress={() => void block()}
          />
          <Button
            label={t('Cancelar')}
            accessibilityLabel={t('Cancelar bloqueo')}
            variant="secondary"
            disabled={busy}
            onPress={() => {
              setError(false);
              setStage('menu');
            }}
          />
        </View>
      </ScrollView>
    );

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.panel}>
        <ThemedText type="subtitle">{t('Opciones de {name}', { name })}</ThemedText>
        <Button
          label={t('Bloquear grupo')}
          accessibilityLabel={t('Bloquear el grupo {name}', { name })}
          variant="secondary"
          onPress={() => setStage('block')}
        />
        <Button
          label={t('Reportar grupo')}
          accessibilityLabel={t('Reportar el grupo {name}', { name })}
          variant="secondary"
          onPress={() => setStage('report')}
        />
        <Button
          label={t('Cerrar')}
          accessibilityLabel={t('Cerrar opciones')}
          variant="secondary"
          onPress={onClose}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.three },
});
