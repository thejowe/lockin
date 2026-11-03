/**
 * País, ciudad y zona horaria, juntos (2026-11-03). Lo usan el alta por pasos
 * (`ProfileWizard`) y la edición (`ProfileForm`).
 *
 * El país se busca escribiendo: con «es» salen España, Eslovaquia, Eslovenia,
 * Estados Unidos, Estonia…, en el idioma de la app. Al elegirlo se fija su zona
 * horaria; si tiene varias, se enseñan para escoger. La ciudad se escribe a mano.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Control, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { Chip, ChipRow, Field, TextField } from './controls';
import { countryByIso, fold, searchCountries, timezonesOf, zoneLabel } from './locations';

/** Sugerencias a la vista: más empuja la ciudad fuera de pantalla con el teclado abierto. */
const MAX_SUGGESTIONS = 6;

export interface LocationValue {
  /** ISO del país, o `''` sin elegir. */
  country: string;
  city: string;
  timezone: string;
}

export function LocationFields({
  value,
  errors,
  onCountryChange,
  onCityChange,
  onTimezoneChange,
  onLayoutField,
}: {
  value: LocationValue;
  errors: Partial<Record<keyof LocationValue, string>>;
  /** `''` cuando se borra o se cambia lo escrito: el país deja de estar elegido. */
  onCountryChange: (iso: string) => void;
  onCityChange: (city: string) => void;
  onTimezoneChange: (timezone: string) => void;
  onLayoutField?: (key: keyof LocationValue) => (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  const selected = value.country ? countryByIso(value.country) : undefined;
  const [query, setQuery] = useState(selected?.name ?? '');

  const suggestions =
    selected && fold(query) === fold(selected.name)
      ? []
      : searchCountries(query).slice(0, MAX_SUGGESTIONS);
  const zones = selected ? timezonesOf(selected.iso) : [];

  function type(next: string) {
    setQuery(next);
    // Escrito entero («españa», sin tilde) vale igual que tocar la sugerencia.
    const exact = searchCountries(next).find((country) => fold(country.name) === fold(next));
    if (exact) {
      if (exact.iso !== value.country) onCountryChange(exact.iso);
    } else if (value.country) {
      onCountryChange('');
    }
  }

  return (
    <>
      <Field label={t('País')} error={errors.country} onLayout={onLayoutField?.('country')}>
        <TextField
          value={query}
          onChangeText={type}
          placeholder={t('Escribe tu país')}
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel={t('País')}
        />
        {suggestions.length > 0 ? (
          <View
            style={[
              styles.list,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            {suggestions.map((country) => (
              <Pressable
                key={country.iso}
                accessibilityRole="button"
                accessibilityLabel={country.name}
                onPress={() => {
                  setQuery(country.name);
                  onCountryChange(country.iso);
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="body">{country.name}</ThemedText>
              </Pressable>
            ))}
          </View>
        ) : query.trim() && !selected ? (
          <ThemedText type="caption" themeColor="textMuted">
            {t('Ningún país coincide.')}
          </ThemedText>
        ) : null}
      </Field>

      {selected ? (
        <Field label={t('Ciudad')} error={errors.city} onLayout={onLayoutField?.('city')}>
          <TextField
            value={value.city}
            onChangeText={onCityChange}
            placeholder={t('Tu ciudad')}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel={t('Ciudad')}
          />
        </Field>
      ) : null}

      {zones.length > 1 ? (
        <Field
          label={t('Zona horaria')}
          hint={t('{country} tiene varias. Elige la tuya.', { country: selected?.name ?? '' })}
          error={errors.timezone}
          onLayout={onLayoutField?.('timezone')}>
          <ChipRow>
            {zones.map((zone) => (
              <Chip
                key={zone}
                label={zoneLabel(zone)}
                selected={value.timezone === zone}
                onPress={() => onTimezoneChange(zone)}
              />
            ))}
          </ChipRow>
        </Field>
      ) : errors.timezone ? (
        <ThemedText type="caption" themeColor="danger">
          {errors.timezone}
        </ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: Radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    minHeight: Control.minTouch,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
});
