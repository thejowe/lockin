import { CloseHeader } from '@/components/close-button';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useRepositories } from '@/data';

import { ReportForm } from './report-form';
import { t } from '@/i18n';

/**
 * Reporte de un mensaje concreto. El reportado es su autor; la persona no
 * recibe ningún aviso. Mismo formulario que el reporte de perfil.
 */
export function MessageReportPanel({
  messageId,
  name,
  onClose,
}: {
  messageId: string;
  name: string;
  onClose: () => void;
}) {
  const repositories = useRepositories();
  const [sent, setSent] = useState(false);

  if (sent)
    return (
      <View style={styles.panel}>
        <CloseHeader onPress={onClose}>
          <ThemedText type="subtitle" accessibilityRole="alert">
            {t('Reporte enviado.')}
          </ThemedText>
        </CloseHeader>
        <ThemedText type="small" themeColor="textSecondary">
          {t('El reporte es privado.')}
        </ThemedText>
      </View>
    );

  return (
    <ReportForm
      name={name}
      title={t('Reportar este mensaje')}
      onSubmit={(reason, details) => repositories.messages.report({ messageId, reason, details })}
      onCancel={onClose}
      onSubmitted={() => setSent(true)}
    />
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.three },
});
