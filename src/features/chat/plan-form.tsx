import { uuid } from 'expo';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { PlanDraft } from '@/data/chat-plan';
import { Field, TextField } from '@/features/profile/controls';
import { t } from '@/i18n';

export type PlanKind = 'task' | 'meeting';

/** Los controles usan la hora local. Rechaza también horas inexistentes al cambiar de horario. */
export function meetingInstant(dayText: string, timeText: string): string | null {
  const dayParts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dayText);
  const timeParts = /^(\d{2}):(\d{2})$/.exec(timeText);
  if (!dayParts || !timeParts) return null;
  const [, day, month, year] = dayParts.map(Number);
  const [, hours, minutes] = timeParts.map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes ||
    date.getTime() <= Date.now()
  )
    return null;
  return date.toISOString();
}

function tomorrow() {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  return [day.getDate(), day.getMonth() + 1, day.getFullYear()]
    .map((n) => String(n).padStart(2, '0'))
    .join('/');
}

export function PlanForm({
  kind,
  add,
  onClose,
}: {
  kind: PlanKind;
  add: (draft: PlanDraft) => Promise<void>;
  onClose: () => void;
}) {
  const meeting = kind === 'meeting';
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState('10:00');
  const [place, setPlace] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const retry = useRef<PlanDraft | null>(null);

  async function submit() {
    if (sending.current || !title.trim()) return;
    const startsAt = meeting ? meetingInstant(date, time) : null;
    if (meeting && !startsAt) {
      setError(t('Elige una fecha y una hora futuras válidas.'));
      return;
    }
    sending.current = true;
    setPending(true);
    setError('');
    try {
      const previous = retry.current;
      const location = place.trim() || null;
      const draft =
        previous &&
        previous.title === title.trim() &&
        previous.place === location &&
        previous.startsAt === startsAt
          ? previous
          : { id: uuid.v4(), title: title.trim(), startsAt, place: location };
      retry.current = draft;
      await add(draft);
      Keyboard.dismiss();
      onClose();
    } catch {
      setError(t('No se ha podido guardar. Vuelve a intentarlo.'));
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  const titleLabel = meeting ? t('Tema de la reunión') : t('Nombre de la tarea');
  return (
    <View style={styles.form}>
      <ThemedText type="subtitle">
        {meeting ? t('Programar reunión') : t('Añadir tarea')}
      </ThemedText>
      <Field label={titleLabel}>
        <TextField
          accessibilityLabel={titleLabel}
          value={title}
          onChangeText={setTitle}
          maxLength={160}
          editable={!pending}
        />
      </Field>
      {meeting && (
        <>
          <Field label={t('Fecha (DD/MM/AAAA)')}>
            <TextField
              accessibilityLabel={t('Fecha (DD/MM/AAAA)')}
              value={date}
              selectTextOnFocus
              editable={!pending}
              keyboardType="number-pad"
              maxLength={10}
              onChangeText={(value) =>
                setDate(
                  value
                    .replace(/\D/g, '')
                    .slice(0, 8)
                    .replace(/^(\d{2})(\d)/, '$1/$2')
                    .replace(/^(\d{2}\/\d{2})(\d)/, '$1/$2')
                )
              }
            />
          </Field>
          <Field label={t('Hora local (24 h)')}>
            <TextField
              accessibilityLabel={t('Hora local (24 h)')}
              value={time}
              selectTextOnFocus
              editable={!pending}
              keyboardType="number-pad"
              maxLength={5}
              onChangeText={(value) =>
                setTime(
                  value
                    .replace(/\D/g, '')
                    .slice(0, 4)
                    .replace(/^(\d{2})(\d)/, '$1:$2')
                )
              }
            />
          </Field>
          <Field label={t('Lugar o enlace (opcional)')}>
            <TextField
              accessibilityLabel={t('Lugar o enlace (opcional)')}
              value={place}
              onChangeText={setPlace}
              maxLength={240}
              editable={!pending}
              autoCapitalize="none"
            />
          </Field>
        </>
      )}
      {error ? (
        <ThemedText accessibilityRole="alert" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      <Button
        label={pending ? t('Guardando…') : t('Guardar')}
        onPress={submit}
        disabled={!title.trim() || pending}
      />
      <Button label={t('Cancelar')} onPress={onClose} disabled={pending} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: Spacing.three } });
