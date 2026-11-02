/**
 * Selectores del perfil que pintan igual el alta por pasos (`profile-wizard.tsx`)
 * y la edición (`profile-form.tsx`). Solo pintan: el borrador, la validación y
 * los errores son de quien los monta.
 */

import { LANGUAGE_OPTIONS, OTHER_SPECIALTY_MAX_LENGTH, SPECIALTY_OPTIONS } from './catalog';
import { Chip, ChipRow, TextField } from './controls';
import { toggle } from './profile-form';

import type { Language, Specialty } from '@/data';
import { t } from '@/i18n';

/**
 * Lo que domino: la lista y, al final, «Otra», que abre un campo para escribirla.
 * `other` a `null` es «Otra» sin marcar; una cadena (aunque vacía), marcada.
 */
export function MasteryPicker({
  specialties,
  other,
  onSpecialtiesChange,
  onOtherChange,
}: {
  specialties: Specialty[];
  other: string | null;
  onSpecialtiesChange: (next: Specialty[]) => void;
  onOtherChange: (next: string | null) => void;
}) {
  return (
    <>
      <ChipRow>
        {SPECIALTY_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            multiple
            selected={specialties.includes(option.value)}
            onPress={() => onSpecialtiesChange(toggle(specialties, option.value))}
          />
        ))}
        <Chip
          label={t('Otra')}
          multiple
          selected={other !== null}
          onPress={() => onOtherChange(other === null ? '' : null)}
        />
      </ChipRow>
      {other !== null ? (
        <TextField
          value={other}
          onChangeText={onOtherChange}
          placeholder={t('Escribe cuál')}
          autoCapitalize="sentences"
          autoCorrect={false}
          maxLength={OTHER_SPECIALTY_MAX_LENGTH}
          accessibilityLabel={t('Otra especialidad')}
        />
      ) : null}
    </>
  );
}

/** Lo que debe dominar quien busco. Solo la lista: aquí no hay «Otra». */
export function SeekingSpecialtyPicker({
  values,
  onChange,
}: {
  values: Specialty[];
  onChange: (next: Specialty[]) => void;
}) {
  return (
    <ChipRow>
      {SPECIALTY_OPTIONS.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          // Sin esto, «Desarrollo» nombraría dos chips distintos: el que domino
          // y el que busco.
          accessibilityLabel={t('Busco {label}', { label: option.label })}
          multiple
          selected={values.includes(option.value)}
          onPress={() => onChange(toggle(values, option.value))}
        />
      ))}
    </ChipRow>
  );
}

/** Idiomas que hablo (`seeking` falso) o que debe hablar quien busco. */
export function LanguagePicker({
  values,
  onChange,
  seeking = false,
}: {
  values: Language[];
  onChange: (next: Language[]) => void;
  seeking?: boolean;
}) {
  return (
    <ChipRow>
      {LANGUAGE_OPTIONS.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          accessibilityLabel={
            seeking ? t('Que hable {label}', { label: option.label }) : option.label
          }
          multiple
          selected={values.includes(option.value)}
          onPress={() => onChange(toggle(values, option.value))}
        />
      ))}
    </ChipRow>
  );
}
