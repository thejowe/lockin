import { useState } from 'react';

import { useRefreshQuery, type Project } from '@/data';
import { ProjectCard, ProjectDetailsSheet } from '@/features/chat/joint-project-sheet';
import { ProjectEditor } from '@/features/profile/project-editor';
import { MY_GROUPS_QUERY } from './use-my-group';

export function GroupProjectHeader({ project, isAdmin }: { project: Project; isAdmin: boolean }) {
  const [sheet, setSheet] = useState<'preview' | Project | null>(null);
  const refreshMine = useRefreshQuery(MY_GROUPS_QUERY);
  return (
    <>
      <ProjectCard project={project} readOnly={!isAdmin} onPress={() => setSheet('preview')} />
      {sheet === 'preview' && (
        <ProjectDetailsSheet
          project={project}
          onClose={() => setSheet(null)}
          onEdit={isAdmin ? () => setSheet(project) : undefined}
        />
      )}
      {isAdmin && sheet && typeof sheet === 'object' && (
        <ProjectEditor
          groupProject
          project={sheet}
          canPromote={false}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            refreshMine();
          }}
        />
      )}
    </>
  );
}
