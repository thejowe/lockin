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
import { arrivalImpact } from '@/components/animations/haptics';
import { CreateProjectShift } from '@/components/animations/ProfileMotion';
import { ProjectSheetSource, useProjectSaveMotion } from '@/components/animations/ShrinkToSlot';
import { BottomSheetBackground } from '@/components/BottomSheet';
import { ThemedText } from '@/components/themed-text';
import { Opacity, Radii, Spacing } from '@/constants/theme';
import type { Project, ProjectInput, ProjectPhoto } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { SecondaryButton } from './controls';
import { CreateProjectCard, ProjectCover } from './project-card';
import { ProjectEditor } from './project-editor';
import type { WindowRect } from './window-rect';
import { useProjects } from './use-projects';
import { WizardScreen } from './wizard';

export function ProjectStep({
  ownerId,
  step,
  total,
  onBack,
  onContinue,
}: {
  ownerId: string;
  step: number;
  total: number;
  onBack: () => void;
  onContinue: () => void;
}) {
  const collection = useProjectCards(ownerId);
  return (
    // El mismo armazón que la foto y «Sobre mí»: barra, título, espaciados y un solo botón.
    // BottomSheetBackground es lo que difumina la hoja del editor cuando se abre encima.
    <BottomSheetBackground style={styles.step}>
      <WizardScreen
        step={step}
        total={total}
        title={t('Tus proyectos')}
        primaryLabel={collection.cards.length ? t('Continuar') : t('Ahora no')}
        busy={collection.loading}
        onBack={onBack}
        onPrimary={onContinue}>
        <ProjectList collection={collection} onboarding />
      </WizardScreen>
    </BottomSheetBackground>
  );
}

export function MyProjects({ ownerId, wizard = false }: { ownerId: string; wizard?: boolean }) {
  const collection = useProjectCards(ownerId);
  return (
    <BottomSheetBackground style={styles.section}>
      {wizard ? null : (
        <ThemedText type="subtitle" accessibilityRole="header">
          {t('Tus proyectos')}
        </ThemedText>
      )}
      <ProjectList collection={collection} />
    </BottomSheetBackground>
  );
}

type Arrival = {
  id: string;
  draft: ProjectInput;
  source: WindowRect | null;
  landed: boolean;
  previousList: Project[] | null;
};
type Card = { id: string; preview: ProjectInput; project: Project | null };

function useProjectCards(ownerId: string) {
  const { data, refresh, loading, error, refreshing } = useProjects(ownerId);
  const [saved, setSaved] = useState<Arrival | null>(null);
  const arrival =
    saved && (!saved.landed || (refreshing && data === saved.previousList)) ? saved : null;
  const list = data ?? [];
  // The repository confirms the write before it fetches the published revision and photo URLs.
  // Keep its slot occupied across that fetch, without making a synthetic revision editable.
  const cards: Card[] = list.map((project) =>
    arrival?.id === project.id
      ? { id: project.id, preview: arrival.draft, project: null }
      : { id: project.id, preview: project, project }
  );
  if (arrival && (!error || !arrival.landed) && !cards.some((card) => card.id === arrival.id)) {
    cards.push({ id: arrival.id, preview: arrival.draft, project: null });
  }
  function onSaved(id: string, draft: ProjectInput, source: WindowRect | null) {
    setSaved({ id, draft, source, previousList: data, landed: false });
    refresh();
  }
  function onLand(id: string) {
    setSaved((current) => (current?.id === id ? { ...current, landed: true } : current));
  }
  return { cards, loading, error, refresh, arrival, onSaved, onLand };
}

function ProjectList({
  collection,
  onboarding = false,
}: {
  collection: ReturnType<typeof useProjectCards>;
  onboarding?: boolean;
}) {
  const { cards, refresh, loading, error, arrival, onLand, onSaved } = collection;
  const [edit, setEdit] = useState<Project | 'new' | null>(null);
  const motion = useProjectSaveMotion();
  return (
    <View style={styles.section}>
      {error ? <SecondaryButton label={t('Reintentar')} onPress={refresh} /> : null}
      {cards.map(({ id, preview, project }) => {
        const landing = arrival?.id === id && !arrival.landed;
        return (
          <Pressable
            key={id}
            collapsable={false}
            ref={motion.projectId === id ? motion.slot : undefined}
            accessibilityRole="button"
            accessibilityLabel={t('Editar {name}', { name: preview.name })}
            accessibilityHint={preview.tagline}
            disabled={!project}
            onPress={() => project && setEdit(project)}
            style={({ pressed }) => [
              { opacity: pressed ? Opacity.pressed : 1, zIndex: landing ? 1 : 0 },
            ]}>
            <ProjectCover {...preview} editable />
          </Pressable>
        );
      })}
      {!loading && !error && cards.length < 3 ? (
        <CreateProjectShift id={motion.landedId}>
          <CreateProjectCard
            prominent={onboarding && cards.length === 0}
            onPress={() => setEdit('new')}
          />
        </CreateProjectShift>
      ) : null}
      {edit ? (
        <ProjectSheetSource value={motion.source}>
          <ProjectEditor
            project={edit === 'new' ? undefined : edit}
            canPromote={edit !== 'new' && cards[0]?.id !== edit.id}
            onClose={() => {
              refresh();
              setEdit(null);
            }}
            onSaved={async (id, draft, source) => {
              onSaved(id, draft, source);
              // Al crear, la hoja vuela hasta su tarjeta y la vibración llega al aterrizar.
              // Al editar, la tarjeta ya está en su sitio: basta la vibración suave.
              if (edit === 'new') await motion.onProjectSaved(id);
              else arrivalImpact('project');
              onLand(id);
              setEdit(null);
            }}
          />
        </ProjectSheetSource>
      ) : null}
      {motion.transition}
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
            <Image style={styles.thumb} source={{ uri: p.uri }} />
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
                  source={{ uri: p.uri }}
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
          {p.cover ? <Image source={{ uri: p.cover.uri }} style={styles.cover} /> : null}
          <ThemedText type="subtitle">{p.name}</ThemedText>
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
  step: { flex: 1 },
  section: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two },
  thumb: { width: 100, height: 100, borderRadius: Radii.small },
  cover: { width: '100%', aspectRatio: 1.6, borderRadius: Radii.card },
});
