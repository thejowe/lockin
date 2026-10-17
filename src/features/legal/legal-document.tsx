/**
 * Un documento legal (Términos, Normas, Privacidad, Seguridad infantil) pintado
 * dentro de la app, sin abrir el navegador (decisión del usuario, 2026-10-17).
 *
 * El texto es el de `docs/tiendas/*.md` empaquetado por
 * `scripts/build-legal.mjs`: el mismo que publica la web y que se acepta en el
 * alta. Los enlaces a otro documento legal se abren aquí mismo; los de fuera
 * (p. ej. la AEPD) en el navegador integrado de la app (`expo-web-browser`),
 * que se despliega encima y se cierra sin salir de cofounder.
 */

import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LEGAL_BASE_URL } from '@/constants/legal';
import { MaxContentWidth, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { parseMarkdown, type Block, type Span } from './markdown';
import { LEGAL_TEXTS } from './texts.generated';

export type LegalDocKey = keyof typeof LEGAL_TEXTS;

export const LEGAL_TITLES: Record<LegalDocKey, string> = {
  terms: 'Términos de uso',
  guidelines: 'Normas de la comunidad',
  privacy: 'Política de privacidad',
  childSafety: 'Seguridad infantil',
};

/** Carpeta publicada de cada documento (la de `build-web.mjs`). */
const PUBLISHED: Record<string, LegalDocKey> = {
  privacidad: 'privacy',
  terminos: 'terms',
  normas: 'guidelines',
  'seguridad-infantil': 'childSafety',
};

export function isLegalDocKey(value: unknown): value is LegalDocKey {
  // Propias: `in` aceptaría `constructor` o `toString` desde la URL.
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGAL_TEXTS, value);
}

/** El documento legal al que apunta una URL publicada, o `null` si es de fuera. */
export function legalDocForUrl(url: string): LegalDocKey | null {
  if (!url.startsWith(`${LEGAL_BASE_URL}/`)) return null;
  const dir = url
    .slice(LEGAL_BASE_URL.length + 1)
    .replace(/[/?#].*$/, '')
    .trim();
  return PUBLISHED[dir] ?? null;
}

function SpanText({ spans, onLink }: { spans: Span[]; onLink: (url: string) => void }) {
  const theme = useTheme();
  return spans.map((span, index) => {
    switch (span.kind) {
      case 'bold':
        return (
          <Text key={index} style={styles.bold}>
            {span.text}
          </Text>
        );
      case 'code':
        return (
          <Text key={index} style={[styles.code, { color: theme.textSecondary }]}>
            {span.text}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={index}
            accessibilityRole="link"
            onPress={() => onLink(span.url)}
            style={[styles.link, { color: theme.text }]}>
            {span.text}
          </Text>
        );
      default:
        return span.text;
    }
  });
}

function BlockView({ block, onLink }: { block: Block; onLink: (url: string) => void }) {
  const theme = useTheme();

  if (block.kind === 'heading') {
    return (
      <ThemedText
        type={block.level === 1 ? 'title' : block.level === 2 ? 'subtitle' : 'bodyStrong'}
        accessibilityRole="header"
        style={block.level === 1 ? undefined : styles.sectionHeading}>
        <SpanText spans={block.spans} onLink={onLink} />
      </ThemedText>
    );
  }

  if (block.kind === 'quote') {
    return (
      <View style={[styles.quote, { borderColor: theme.border }]}>
        <ThemedText type="small" themeColor="textSecondary">
          <SpanText spans={block.spans} onLink={onLink} />
        </ThemedText>
      </View>
    );
  }

  if (block.kind === 'list') {
    return (
      <View style={styles.list}>
        {block.items.map((item, index) => (
          <View key={index} style={styles.item}>
            <ThemedText type="body" themeColor="textSecondary">
              •
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={styles.itemText}>
              <SpanText spans={item} onLink={onLink} />
            </ThemedText>
          </View>
        ))}
      </View>
    );
  }

  return (
    <ThemedText type="body" themeColor="textSecondary">
      <SpanText spans={block.spans} onLink={onLink} />
    </ThemedText>
  );
}

export function LegalDocument({
  doc,
  onOpenDocument,
  bottomInset = 0,
}: {
  doc: LegalDocKey;
  /** Un enlace a otro documento legal: quien monta decide cómo abrirlo. */
  onOpenDocument: (doc: LegalDocKey) => void;
  bottomInset?: number;
}) {
  const blocks = useMemo(() => parseMarkdown(LEGAL_TEXTS[doc]), [doc]);

  function handleLink(url: string) {
    const target = legalDocForUrl(url);
    if (target) {
      if (target !== doc) onOpenDocument(target);
      return;
    }
    void WebBrowser.openBrowserAsync(url).catch(() => undefined);
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: Spacing.six + bottomInset }]}>
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} onLink={handleLink} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  sectionHeading: {
    marginTop: Spacing.two,
  },
  bold: {
    fontFamily: Typography.bodyStrong.fontFamily,
  },
  code: {
    fontFamily: Typography.mono.fontFamily,
  },
  link: {
    textDecorationLine: 'underline',
  },
  quote: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  itemText: {
    flex: 1,
  },
});
