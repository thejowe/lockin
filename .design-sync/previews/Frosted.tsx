import { Colors, Frosted, Icon, Screen, Spacing, ThemedText } from 'cofounder';

// Frosted lleva desenfoque real: se le pone contenido detrás para que se note.
function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <Screen style={{ flex: 0, padding: Spacing.four, height: 220, justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: Spacing.four, display: 'grid', gap: Spacing.two }}>
        <ThemedText type="title">Descubrir</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Perfiles de gente que busca socio para su startup, cerca de ti.
        </ThemedText>
      </div>
      {children}
    </Screen>
  );
}

export function TabBar() {
  return (
    <Backdrop>
      <Frosted style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.three }}>
        {/* Cada pestaña en su propio contenedor posicionado: los hijos sueltos (un SVG) quedan bajo el desenfoque. */}
        {(['discover', 'chat', 'person'] as const).map((name, i) => (
          <div key={name} style={{ position: 'relative', padding: Spacing.one }}>
            <Icon name={name} color={i === 0 ? Colors.dark.text : Colors.dark.textMuted} />
          </div>
        ))}
      </Frosted>
    </Backdrop>
  );
}

export function Sheet() {
  return (
    <Backdrop>
      <Frosted radius={26} intensity={60} style={{ padding: Spacing.four, gap: Spacing.one }}>
        <ThemedText type="heading">Filtros</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Rol, sector y distancia
        </ThemedText>
      </Frosted>
    </Backdrop>
  );
}
