import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ProjectCaptionBackground } from '@/constants/theme';
import type { Project } from '@/data';
import { ProjectAuthorFaces } from './project-author-faces';

export function ProjectCardCaption({ name, project }: { name: string; project?: Project }) {
  return (
    <View style={styles.caption}>
      {project && <ProjectAuthorFaces project={project} compact />}
      <ThemedText type="smallBold" style={styles.name} numberOfLines={2}>
        {name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { backgroundColor: ProjectCaptionBackground, padding: 5 },
  name: { color: '#fff' },
});
