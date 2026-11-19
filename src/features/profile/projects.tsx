import type { ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/icon';
import { glassStyle } from '@/components/glass';
import { Radii, Spacing } from '@/constants/theme';
import type { Project, ProjectPhoto } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { SecondaryButton } from './controls';
import { ProjectAuthorFaces } from './project-author-faces';
import { ProjectEditor } from './project-editor';
import { useProjects } from './use-projects';

export function MyProjects({ ownerId, wizard = false }: { ownerId: string; wizard?: boolean }) {
  const theme = useTheme();
  const { data, refresh, loading, error } = useProjects(ownerId);
  const [edit, setEdit] = useState<Project | 'new' | null>(null);
  const list = data ?? [];
  return (
    <View style={styles.section}>
      {wizard ? null : (
        <ThemedText type="label" themeColor="textSecondary">
          {t('Tus proyectos')}
        </ThemedText>
      )}
      {error ? <SecondaryButton label={t('Reintentar')} onPress={refresh} /> : null}
      <View style={styles.row}>
        {list.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={t('Editar {name}', { name: p.name })}
            onPress={() => setEdit(p)}
            style={[glassStyle(theme), styles.tile]}>
            {p.cover ? (
              <Image
                source={p.cover}
                cachePolicy={p.cover.headers ? 'none' : undefined}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View style={styles.pencil}>
              <Icon name="pencil" size={16} color="#fff" />
            </View>
            <View style={styles.caption}>
              <ProjectAuthorFaces project={p} compact />
              <ThemedText type="smallBold" style={styles.white} numberOfLines={2}>
                {p.name}
              </ThemedText>
            </View>
          </Pressable>
        ))}
        {!loading && !error && list.length < 3 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Crear proyecto')}
            style={[glassStyle(theme), styles.tile, styles.add]}
            onPress={() => setEdit('new')}>
            <ThemedText type="title">+</ThemedText>
            {wizard ? <ThemedText type="small">{t('Crear proyecto')}</ThemedText> : null}
          </Pressable>
        ) : null}
      </View>
      {edit ? (
        <ProjectEditor
          project={edit === 'new' ? undefined : edit}
          canPromote={edit !== 'new' && list[0]?.id !== edit.id}
          onClose={() => {
            refresh();
            setEdit(null);
          }}
          onSaved={() => {
            refresh();
            setEdit(null);
          }}
        />
      ) : null}
    </View>
  );
}

function Gallery({ photos }: { photos: ProjectPhoto[] }) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const pager = useRef<ScrollViewInstance>(null);
  const [start, setStart] = useState<number | null>(null);
  return (
    <>
      <ScrollView horizontal contentContainerStyle={styles.row}>
        {photos.map((p, i) => (
          <Pressable
            key={i}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('Ampliar foto {n}', { n: i + 1 })}
            onPress={() => setStart(i)}>
            <Image style={styles.thumb} source={p} cachePolicy={p.headers ? 'none' : undefined} />
          </Pressable>
        ))}
      </ScrollView>
      {start !== null ? (
        <Modal onRequestClose={() => setStart(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <ScrollView
              key={start}
              horizontal
              pagingEnabled
              contentOffset={{ x: width * start, y: 0 }}
              ref={pager}
              onContentSizeChange={() =>
                pager.current?.scrollTo({ x: width * start, animated: false })
              }>
              {photos.map((p, i) => (
                <Image
                  key={i}
                  accessibilityLabel={t('Foto {n}', { n: i + 1 })}
                  contentFit="contain"
                  style={{ width, height: '100%' }}
                  source={p}
                  cachePolicy={p.headers ? 'none' : undefined}
                />
              ))}
            </ScrollView>
            <SecondaryButton label={t('Cerrar')} onPress={() => setStart(null)} />
          </SafeAreaView>
        </Modal>
      ) : null}
    </>
  );
}
export function PublicProjects({ ownerId }: { ownerId: string }) {
  const { data, error, refresh } = useProjects(ownerId);
  const [linkError, setLinkError] = useState(false);
  if (error) return <SecondaryButton label={t('Volver a cargar proyectos')} onPress={refresh} />;
  if (!data?.length) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary">
        {t('Proyectos')}
      </ThemedText>
      {data.map((p) => (
        <View key={p.id} style={styles.section}>
          {p.cover ? (
            <Image
              source={p.cover}
              cachePolicy={p.cover.headers ? 'none' : undefined}
              style={styles.cover}
            />
          ) : null}
          <ThemedText type="subtitle">{p.name}</ThemedText>
          <ProjectAuthorFaces project={p} />
          <ThemedText type="smallBold">{p.tagline}</ThemedText>
          {p.description ? <ThemedText>{p.description}</ThemedText> : null}
          {p.photos.length ? <Gallery photos={p.photos} /> : null}
          {p.link ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                setLinkError(false);
                void Linking.openURL(p.link).catch(() => setLinkError(true));
              }}>
              <ThemedText style={{ textDecorationLine: 'underline' }}>{p.link}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ))}
      {linkError ? (
        <ThemedText accessibilityRole="alert">{t('No se ha podido abrir el enlace.')}</ThemedText>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two },
  tile: {
    width: '30%',
    maxWidth: 110,
    aspectRatio: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  add: { alignItems: 'center', justifyContent: 'center' },
  pencil: {
    position: 'absolute',
    right: 4,
    top: 4,
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#181818',
  },
  caption: { backgroundColor: 'rgba(16,16,16,0.88)', padding: 5 },
  white: { color: '#fff' },
  thumb: { width: 100, height: 100, borderRadius: Radii.small },
  cover: { width: '100%', aspectRatio: 1.6, borderRadius: Radii.card },
});
