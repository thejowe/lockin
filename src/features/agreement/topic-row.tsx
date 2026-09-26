/**
 * Un tema del acuerdo: enunciado, estado y, al tocarlo, el editor en su sitio.
 *
 * El estado nunca va solo en color: siempre lleva texto. `distinto` va en tinta
 * normal, sin `danger`: discrepar es para lo que existe la pantalla (spec § 2).
 * Sin modal: el editor se despliega en la propia fila.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { AGREEMENT_NOTE_MAX } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { topicStatus } from './status';
import { isKnownAnswer, optionLabel, optionsOf } from './topics';

import type { AgreementTopic } from './topics';
import type { AgreementAnswer, AgreementTopicView } from '@/data';

const STATUS_TEXT = {
  coincidis: 'Coincidís',
  distinto: 'Distinto',
  'por-hablar': 'Lo tenéis que hablar',
  pendiente: 'Pendiente',
} as const;

export function TopicRow({
  topic,
  view,
  counterpartName,
  saving,
  onSave,
}: {
  topic: AgreementTopic;
  view: AgreementTopicView | undefined;
  counterpartName: string;
  saving: boolean;
  onSave: (option: string, note: string | null) => void;
}) {
  const theme = useTheme();
  const status = topicStatus(topic.key, view);
  // Una clave que el catálogo no conoce cuenta como no respondida, igual que en
  // `topicStatus`: si no, la fila diría «Tú: » vacío sobre un tema pendiente.
  const mine = view?.mine && isKnownAnswer(topic.key, view.mine.option) ? view.mine : null;
  const theirs = view?.theirs && view.theirs !== 'hidden' ? view.theirs : null;
  const labelOf = (answer: AgreementAnswer) => optionLabel(topic.key, answer.option) ?? '';

  const [open, setOpen] = useState(false);
  const [option, setOption] = useState<string | null>(mine?.option ?? null);
  const [note, setNote] = useState(mine?.note ?? '');

  // Al abrir, el editor parte de la respuesta guardada: la vista puede haber
  // llegado (o cambiado) después del montaje.
  const toggle = () => {
    if (!open) {
      setOption(mine?.option ?? null);
      setNote(mine?.note ?? '');
    }
    setOpen(!open);
  };

  const statusColor =
    status === 'coincidis' ? theme.teal : status === 'por-hablar' ? theme.brass : theme.text;

  const lines: string[] = [];
  if (status === 'pendiente') {
    if (!mine) {
      lines.push('Falta tu respuesta');
      if (view?.theirs) lines.push(`${counterpartName} ya ha respondido`);
    } else {
      lines.push(`${counterpartName} aún no ha respondido`, `Tú: ${labelOf(mine)}`);
    }
  } else if (status === 'coincidis') {
    lines.push(labelOf(mine!));
  } else {
    lines.push(`Tú: ${labelOf(mine!)}`, `${counterpartName}: ${labelOf(theirs!)}`);
  }
  if (status !== 'pendiente') {
    if (mine?.note) lines.push(`Tú: «${mine.note}»`);
    if (theirs?.note) lines.push(`${counterpartName}: «${theirs.note}»`);
  }

  const a11y = `${topic.question}. ${STATUS_TEXT[status]}. ${
    status === 'distinto'
      ? `tú: ${labelOf(mine!)}; ${counterpartName}: ${labelOf(theirs!)}`
      : lines.join('. ')
  }`;

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ expanded: open }}
        onPress={toggle}>
        <ThemedText type="bodyStrong">{topic.question}</ThemedText>
        {status !== 'pendiente' && (
          <ThemedText type="small" style={{ color: statusColor }}>
            {STATUS_TEXT[status]}
          </ThemedText>
        )}
        {lines.map((line) => (
          <ThemedText key={line} type="small" themeColor="textSecondary">
            {line}
          </ThemedText>
        ))}
      </Pressable>

      {open && (
        <View style={styles.editor}>
          <View style={styles.chips}>
            {optionsOf(topic).map((candidate) => {
              const checked = candidate.key === option;
              return (
                <Pressable
                  key={candidate.key}
                  accessibilityRole="radio"
                  accessibilityLabel={candidate.label}
                  accessibilityState={{ selected: checked }}
                  onPress={() => setOption(candidate.key)}
                  style={[
                    styles.chip,
                    {
                      borderColor: checked ? theme.brass : theme.border,
                      backgroundColor: checked ? theme.brassSoft : 'transparent',
                    },
                  ]}>
                  <ThemedText type="small">{candidate.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            accessibilityLabel="Nota opcional"
            placeholder="Nota opcional"
            placeholderTextColor={theme.textSecondary}
            value={note}
            onChangeText={setNote}
            maxLength={AGREEMENT_NOTE_MAX}
            multiline
            style={[styles.note, { borderColor: theme.border, color: theme.text }]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {note.length}/{AGREEMENT_NOTE_MAX}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Guardar respuesta"
            accessibilityState={{ disabled: option === null || saving }}
            disabled={option === null || saving}
            onPress={() => {
              onSave(option!, note.trim() === '' ? null : note.trim());
              setOpen(false);
            }}
            style={[
              styles.save,
              { backgroundColor: theme.brass, opacity: option === null || saving ? 0.5 : 1 },
            ]}>
            <ThemedText type="bodyStrong" style={{ color: theme.onAccent }}>
              Guardar
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radii.medium, padding: Spacing.three, gap: Spacing.one },
  editor: { gap: Spacing.two, marginTop: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
  },
  note: { minHeight: 72, borderWidth: 1, borderRadius: Radii.medium, padding: Spacing.two },
  save: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.medium,
  },
});
