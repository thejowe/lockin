# Conexión de las animaciones de perfil

## Proyectos · paso de alta y sección del perfil

Ambas pantallas de A usan `ProjectList`. Añade estos imports a `projects.tsx`.

```tsx
import { ProjectSheetSource, useProjectSaveMotion } from '@/components/animations/ShrinkToSlot';
import { CreateProjectShift } from '@/components/animations/ProfileMotion';
```

1. Dentro de `ProjectList`, añade `const motion = useProjectSaveMotion();`.
2. En el `Pressable` de cada proyecto, conserva su `key`, sus estilos y su `testID`. Añade estas dos props.

   ```tsx
   collapsable={false}
   ref={motion.projectId === id ? motion.slot : undefined}
   ```

3. En esa tarjeta renderiza `{cover}` directamente. Sustituye la instancia provisional de `ProjectHandoff` por una única `{motion.transition}` al final de `ProjectList`, fuera del bucle. Del import de `./project-handoff` conserva solo `import type { WindowRect } from './project-handoff';`.
4. Envuelve el `ProjectEditor` existente con `<ProjectSheetSource value={motion.source}>` y `</ProjectSheetSource>`. En A (`0de08cd`), conserva los dos callbacks de `collection` que reservan y liberan la tarjeta.

   ```tsx
   onSaved={async (id, draft, source) => {
     onSaved(id, draft, source);
     if (edit === 'new') await motion.onProjectSaved(id);
     onLand(id);
     setEdit(null);
   }}
   ```

   Si el enganche ya se llama `onProjectSaved`, la llamada de la sesión D sigue siendo `await motion.onProjectSaved(id)`. La tarjeta se monta antes de medirla. El editor conserva su bloqueo de guardado hasta terminar el vuelo.

5. Rodea el `CreateProjectCard` existente con `<CreateProjectShift id={motion.landedId}>` y `</CreateProjectShift>`. En `project-card.tsx`, sustituye el `Pressable` de **Crear proyecto** por `SlotPressable` de `@/components/animations/ProfileMotion`. Conserva todas sus props.

### Editor y «Más detalles»

Añade estos imports a `project-editor.tsx`.

```tsx
import { useProjectSheet } from '@/components/animations/ShrinkToSlot';
import { DetailsChevron } from '@/components/animations/ProfileMotion';
```

- En `SaveFooter`, después de `const frame = useContext(BottomSheetFrame);`, añade `useProjectSheet(frame);`. Así se mueve el panel real, con los campos que estén visibles.
- En `save`, conserva el guardado y cambia la llamada de éxito a `await onSaved(project?.id ?? draftId, draft, measureSource());`. El callback admite `void | Promise<void>`.
- Sustituye el `View` que gira el icono de la flecha por este envoltorio.

```tsx
<DetailsChevron expanded={details}>
  <Icon name="back" color={theme.textSecondary} size={18} />
</DetailsChevron>
```

## Sobre mí · paso de alta y sección del perfil

En `board.tsx`, importa `useArrivals` desde `@/components/animations/useArrivals` y `useLayoutEffect` desde React. Sustituye el efecto que anuncia `mountedPhotoId` por estas líneas. La foto adquiere su pose inicial antes del primer fotograma visible.

```tsx
const arrivals = useArrivals();
const { start } = arrivals;
useLayoutEffect(() => {
  if (mountedPhotoId && notifiedId.current !== mountedPhotoId) {
    notifiedId.current = mountedPhotoId;
    start(mountedPhotoId);
    onPhotoAdded?.(mountedPhotoId);
  }
}, [mountedPhotoId, onPhotoAdded, start]);
```

Pasa `arrivals={arrivals}` al `BoardGrid` existente. Añade `arrivals: Arrivals` a sus props y desestructura `arrivals`. Añade estos imports a `board-grid.tsx`.

```tsx
import Animated from 'react-native-reanimated';
import type { Arrivals } from '@/components/animations/useArrivals';
import { PinDrop } from '@/components/animations/PinDrop';
import { SlotPressable } from '@/components/animations/ProfileMotion';
```

- Envuelve el `Pressable` de cada foto con `<PinDrop key={post.id} id={post.id} arrivals={arrivals}>{pinStyle => (` y ` )}</PinDrop>`. La rotación estática del papel sigue en ese mismo `Pressable`.
- Aplica el estilo de la chincheta a su vista existente.

```tsx
<Animated.View
  testID={`board-pin-${post.id}`}
  pointerEvents="none"
  style={[styles.pin, { backgroundColor: theme.textSecondary }, pinStyle]}
/>
```

- Cambia el `Pressable` del hueco «Añadir foto» por `SlotPressable`, con los mismos hijos y props. Los huecos vacíos sin acción siguen siendo vistas.

El alcance de la sesión D termina en las secciones Proyectos y Sobre mí.
