/**
 * Términos y Normas: aceptación obligatoria y enlaces legales.
 *
 * - `useTermsGate()` dice si esta persona ya aceptó la versión vigente
 *   (`TERMS_VERSION`). Si la lectura falla responde `required`, no `accepted`:
 *   sin saberlo, dejar publicar sería el fallo que la regla existe para evitar.
 * - `TermsAcceptance` es la pantalla de aceptación: casilla explícita (nada
 *   premarcado) y los dos documentos a un toque.
 * - `LegalLinks` son los enlaces fijos de la tab Perfil.
 */

import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LEGAL_URLS, TERMS_VERSION } from '@/constants/legal';
import { BottomTabInset, Radii, Spacing, Stroke } from '@/constants/theme';
import { useQuery, useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { PrimaryButton } from './controls';

export type TermsGate = 'checking' | 'accepted' | 'required';

const QUERY_KEY = 'terms:acceptance';

export function useTermsGate(): { gate: TermsGate; refresh: () => void } {
  const repositories = useRepositories();
  const {
    data: acceptance,
    loading,
    refresh,
  } = useQuery(QUERY_KEY, () => repositories.session.getTermsAcceptance());

  if (loading) return { gate: 'checking', refresh };
  // Versiones `AAAA-MM-DD`: el orden léxico es el cronológico. Una versión más
  // nueva que la de este cliente cuenta como aceptada (no atrapar al cliente
  // viejo en un bucle de aceptación).
  const accepted = !!acceptance?.version && acceptance.version >= TERMS_VERSION;
  return { gate: accepted ? 'accepted' : 'required', refresh };
}

function openLink(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => openLink(url)}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <ThemedText type="body" themeColor="brass">
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** `footer` va dentro del scroll para que la barra flotante de tabs no lo tape. */
export function TermsAcceptance({
  onAccepted,
  footer,
}: {
  onAccepted: () => void;
  footer?: ReactNode;
}) {
  const theme = useTheme();
  const repositories = useRepositories();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function accept() {
    setSaving(true);
    setFailed(false);
    try {
      await repositories.session.acceptTerms(TERMS_VERSION);
      onAccepted();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <ThemedText type="label" themeColor="textSecondary">
        Antes de continuar
      </ThemedText>
      <ThemedText type="title">Términos y Normas</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">
        Para publicar tu perfil y hablar con otras personas necesitas aceptar los Términos de uso y
        las Normas de la comunidad. Léelos, son cortos.
      </ThemedText>

      <LinkRow label="Leer los Términos de uso" url={LEGAL_URLS.terms} />
      <LinkRow label="Leer las Normas de la comunidad" url={LEGAL_URLS.guidelines} />
      <LinkRow label="Política de privacidad" url={LEGAL_URLS.privacy} />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="He leído y acepto los Términos de uso y las Normas de la comunidad"
        onPress={() => setChecked((value) => !value)}
        style={[
          styles.check,
          {
            borderColor: checked ? theme.brass : theme.border,
            backgroundColor: checked ? theme.backgroundSelected : theme.backgroundElement,
          },
        ]}>
        <View style={[styles.box, { borderColor: checked ? theme.brass : theme.textMuted }]}>
          {checked ? <View style={[styles.dot, { backgroundColor: theme.brass }]} /> : null}
        </View>
        <ThemedText type="body" style={styles.checkText}>
          He leído y acepto los Términos de uso y las Normas de la comunidad.
        </ThemedText>
      </Pressable>

      {failed ? (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          No hemos podido guardar tu aceptación. Inténtalo de nuevo.
        </ThemedText>
      ) : null}

      <PrimaryButton
        label={saving ? 'Guardando…' : 'Aceptar y continuar'}
        disabled={!checked || saving}
        onPress={() => void accept()}
      />
      {footer}
    </ScrollView>
  );
}

/** Enlaces legales visibles en la tab Perfil. */
export function LegalLinks() {
  return (
    <View style={styles.links}>
      <ThemedText type="label" themeColor="textSecondary">
        Legal
      </ThemedText>
      <LinkRow label="Política de privacidad" url={LEGAL_URLS.privacy} />
      <LinkRow label="Términos de uso" url={LEGAL_URLS.terms} />
      <LinkRow label="Normas de la comunidad" url={LEGAL_URLS.guidelines} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six + BottomTabInset,
  },
  links: {
    gap: Spacing.one,
  },
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
  },
  checkText: {
    flex: 1,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
});
