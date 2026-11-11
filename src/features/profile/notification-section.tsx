import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Linking, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useQuery, useRepositories, type NotificationPrefs } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { t, tk } from '@/i18n';
import { pushPermission } from '@/lib/push';

import { Field } from './controls';

const LABELS = [
  ['notify_likes', tk('Likes')],
  ['notify_matches', tk('Matches')],
  ['notify_messages', tk('Mensajes')],
  ['notify_group_messages', tk('Mensajes de grupo')],
  ['notify_group_activity', tk('Actividad de grupos')],
  ['notify_reminders', tk('Recordatorios')],
  ['notify_premium', tk('Avisos de Premium')],
] as const;

export function NotificationSection() {
  const repositories = useRepositories();
  const theme = useTheme();
  const prefs = useQuery('notification-prefs', () => repositories.push.getPreferences());
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      const check = () => {
        void pushPermission().then((status) => {
          if (mounted) setDenied(status === 'denied');
        });
      };
      check();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') check();
      });
      return () => {
        mounted = false;
        subscription.remove();
      };
    }, [])
  );

  async function save(key: keyof NotificationPrefs, value: boolean) {
    setSaving(true);
    setFailed(false);
    try {
      await repositories.push.setPreferences({ [key]: value });
      prefs.refresh();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field label={t('Notificaciones')}>
      {denied ? (
        <View style={styles.help}>
          <ThemedText type="small" themeColor="textSecondary">
            {t(
              'Las notificaciones están desactivadas en este dispositivo. Puedes activarlas en los ajustes del sistema.'
            )}
          </ThemedText>
          <Button
            compact
            variant="secondary"
            label={t('Abrir ajustes del sistema')}
            onPress={() => {
              void Linking.openSettings().catch(() => setFailed(true));
            }}
          />
        </View>
      ) : null}
      {prefs.data ? (
        LABELS.map(([key, label]) => (
          <View key={key} style={styles.row}>
            <ThemedText style={styles.label}>{t(label)}</ThemedText>
            <Switch
              accessibilityLabel={t(label)}
              value={prefs.data![key]}
              disabled={saving || prefs.refreshing}
              trackColor={{ true: theme.brass }}
              onValueChange={(value) => {
                void save(key, value);
              }}
            />
          </View>
        ))
      ) : (
        <ThemedText type="small">
          {prefs.loading
            ? t('Cargando…')
            : t('No se han podido cargar las preferencias de notificaciones.')}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {t(
          'Los recordatorios son opcionales: te avisamos si llevas unos días sin entrar y hay likes o mensajes esperando. Puedes apagarlos aquí.'
        )}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t(
          'Los resúmenes de likes llegan hacia las 11:00 de tu zona horaria. Los recordatorios llegan de 10:00 a 20:00; los avisos de Premium, de 09:00 a 22:00.'
        )}
      </ThemedText>
      {failed ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('No se han podido guardar las preferencias. Inténtalo de nuevo.')}
        </ThemedText>
      ) : null}
      {prefs.error ? (
        <Button compact variant="secondary" label={t('Reintentar')} onPress={prefs.refresh} />
      ) : null}
    </Field>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 52 },
  label: { flex: 1 },
  help: { gap: Spacing.two },
});
