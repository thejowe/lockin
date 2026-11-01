/**
 * Caja del prefijo («+34») junto al campo del teléfono.
 *
 * Al pulsarla se abre una hoja con un buscador numérico: solo acepta dígitos y
 * filtra los prefijos que empiezan por ellos (con `3` salen +30, +31, +32, +33,
 * +34…). Elegir uno cierra la hoja.
 */

import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Control, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { TextField } from './controls';
import { filterCountries, type Country } from './countries';

export function CountryCodePicker({
  country,
  onChange,
  disabled = false,
}: {
  country: Country;
  onChange: (next: Country) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = filterCountries(query);

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Prefijo del país: ${country.name}, +${country.dial}. Cambiar`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.box,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          disabled && styles.disabled,
        ]}>
        <ThemedText type="body">+{country.dial}</ThemedText>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Prefijo del país</ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={close}>
              <ThemedText type="body" themeColor="textSecondary">
                Cerrar
              </ThemedText>
            </Pressable>
          </View>

          <TextField
            value={query}
            // Solo dígitos: es lo que hace rápida la búsqueda.
            onChangeText={(next) => setQuery(next.replace(/\D/g, ''))}
            accessibilityLabel="Buscar prefijo por número"
            placeholder="Escribe el prefijo: 3, 34…"
            keyboardType="number-pad"
            inputMode="numeric"
            autoFocus
            autoCorrect={false}
            maxLength={4}
          />

          <FlatList
            data={results}
            keyExtractor={(item) => `${item.iso}-${item.dial}`}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textMuted" style={styles.empty}>
                Ningún país tiene ese prefijo.
              </ThemedText>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, +${item.dial}`}
                onPress={() => {
                  onChange(item);
                  close();
                }}
                style={styles.row}>
                <ThemedText type="body" style={styles.rowName}>
                  {item.name}
                </ThemedText>
                <ThemedText type="body" themeColor="textSecondary">
                  +{item.dial}
                </ThemedText>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: Control.field,
    minWidth: 72,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  sheet: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: {
    minHeight: Control.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  rowName: {
    flex: 1,
  },
  empty: {
    paddingVertical: Spacing.three,
  },
});
