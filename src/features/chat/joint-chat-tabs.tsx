import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import {
  useQuery,
  useRefreshQuery,
  useRefreshQueryPrefix,
  useRepositories,
  type MatchWithProfile,
  type Project,
} from '@/data';
import { ProjectEditor } from '@/features/profile/project-editor';
import { t } from '@/i18n';
import {
  ProjectCard,
  ProjectNotes,
  ProjectSheet,
  PublicationControls,
} from './joint-project-sheet';
import { ChatTabBar, SharedPlan } from './shared-plan';

export function JointChatTabs({
  match,
  children,
}: {
  match: MatchWithProfile;
  children: (createCard: ReactNode, notice: ReactNode) => ReactNode;
}) {
  const { projects } = useRepositories();
  const [plan, setPlan] = useState(false);
  const [sheet, setSheet] = useState<'preview' | 'new' | Project | null>(null);
  const { id: matchId, counterpart } = match;
  const me = match.profileIds[0] === counterpart.id ? match.profileIds[1] : match.profileIds[0];
  const { data, refresh, error } = useQuery('joint-workspace:' + matchId, async () => {
    const workspace = await projects.workspace(matchId);
    return { workspace, deletion: workspace ? null : await projects.lastDeletion(matchId) };
  });
  const refreshMatch = useRefreshQuery('match:' + matchId);
  const refreshProjects = useRefreshQueryPrefix('projects');
  useFocusEffect(
    useCallback(() => {
      const sync = () => {
        refresh();
        refreshMatch();
      };
      sync();
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') sync();
      }, 15000);
      const listener = AppState.addEventListener('change', (state) => {
        if (state === 'active') sync();
      });
      return () => {
        clearInterval(timer);
        listener.remove();
      };
    }, [refresh, refreshMatch])
  );
  const workspace = data?.workspace;
  const project = workspace?.project;
  const changed = () => {
    refresh();
    refreshProjects();
  };
  const card = data && (
    <ProjectCard project={project} onPress={() => setSheet(project ? 'preview' : 'new')} />
  );
  const retry = error && (
    <Button variant="secondary" compact label={t('Volver a cargar proyectos')} onPress={refresh} />
  );
  const deleted = data?.deletion && data.deletion.actorId !== me && (
    <ThemedText themeColor="textSecondary">
      {t('{name} ha eliminado el proyecto conjunto.', { name: counterpart.name })}
    </ThemedText>
  );
  return (
    <>
      <ChatTabBar
        plan={plan}
        project={!!workspace}
        onSelect={(value) => {
          setPlan(value);
          refresh();
        }}
      />
      {plan ? (
        <SharedPlan
          scope={{ kind: 'match', id: matchId }}
          members={
            workspace
              ? [
                  { id: me, label: t('Yo') },
                  { id: counterpart.id, label: counterpart.name },
                  { id: null, label: t('Los dos') },
                ]
              : undefined
          }
          header={
            <>
              {deleted}
              {card}
              {retry}
            </>
          }
          footer={
            workspace && (
              <ProjectNotes
                key={workspace.project.id}
                workspace={workspace}
                me={me}
                peerName={counterpart.name}
                onChange={refresh}
              />
            )
          }
        />
      ) : (
        children(
          !workspace && card,
          <>
            {deleted}
            {retry}
            {workspace && <PublicationControls workspace={workspace} me={me} onChange={changed} />}
          </>
        )
      )}
      {sheet === 'preview' && workspace && (
        <ProjectSheet
          workspace={workspace}
          me={me}
          onChange={changed}
          onClose={() => setSheet(null)}
          onEdit={() => setSheet(workspace.project)}
        />
      )}
      {(sheet === 'new' || (sheet && typeof sheet === 'object' && sheet.id === project?.id)) && (
        <ProjectEditor
          matchId={matchId}
          project={sheet === 'new' ? undefined : sheet}
          canPromote={false}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            setPlan(true);
            changed();
          }}
        />
      )}
    </>
  );
}
