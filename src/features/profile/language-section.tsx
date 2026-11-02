import { useState } from 'react';

import { getLocalePreference, setLocalePreference, t, type LocalePreference } from '@/i18n';

import { Chip, ChipRow, Field } from './controls';

/** Cada idioma se escribe en sí mismo: quien no entiende el actual tiene que encontrar el suyo. */
const LANGUAGES: { value: Exclude<LocalePreference, 'auto'>; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'ca', label: 'Català' },
];

/**
 * El idioma de la app, en Ajustes. «Automático» sigue al del móvil; es lo que
 * hay hasta que se elige otro. Al cambiar, `_layout.tsx` vuelve a montar la
 * navegación para que todo se pinte en el idioma nuevo.
 */
export function LanguageSection() {
  const [selected, setSelected] = useState(getLocalePreference);

  function choose(next: LocalePreference) {
    setSelected(next);
    void setLocalePreference(next);
  }

  return (
    <Field label={t('Idioma')} hint={t('«Automático» usa el idioma de tu móvil.')}>
      <ChipRow>
        <Chip
          label={t('Automático')}
          selected={selected === 'auto'}
          onPress={() => choose('auto')}
        />
        {LANGUAGES.map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            selected={selected === value}
            onPress={() => choose(value)}
          />
        ))}
      </ChipRow>
    </Field>
  );
}
