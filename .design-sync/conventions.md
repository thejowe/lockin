# cofounder — sistema «cristal»

App de React Native (Expo) compilada para web con react-native-web. Los componentes aceptan **objetos de estilo de React Native** (`style={{ padding: 16 }}`), no `className`.

## Reglas que no se negocian
- **Solo modo oscuro.** Fondo negro liso `#000`. Nunca fondos claros.
- **Vidrio translúcido** sobre negro (`Glass`, `Frosted`). Nada de halos, degradados multicolor ni iconos decorativos.
- **Acento = blanco** (`Colors.dark.brass` es `#FFFFFF`): el botón principal es una píldora blanca. Una acción principal por pantalla.
- Ningún color literal: usa los tokens.

## Montaje
No hace falta provider. Cada pantalla va en `Screen` (raíz negra, `flex: 1`). Si la pantalla no es de alto completo, pásale `style={{ flex: 0 }}` o un `height`, porque si no se colapsa. `Button` con `href` necesita el router de la app: usa siempre `onPress`.

```jsx
const { Screen, ThemedText, Glass, Button, Spacing } = window.Cofounder;

<Screen style={{ padding: Spacing.four, gap: Spacing.four }}>
  <ThemedText type="label" themeColor="textSecondary">Perfil</ThemedText>
  <ThemedText type="title">Sobre ti</ThemedText>
  <Glass style={{ padding: Spacing.three, gap: Spacing.one }}>
    <ThemedText type="heading">Rol</ThemedText>
    <ThemedText type="body" themeColor="textSecondary">Producto y diseño</ThemedText>
  </Glass>
  <Button label="Guardar y continuar" onPress={() => {}} />
</Screen>
```

## Estilo: tokens como objetos JS (fuente de verdad)
Exportados en `window.Cofounder`:
- `Colors.dark.*`: `background`, `backgroundElement` (cristal), `backgroundSelected` (cristal activo), `surfaceOpaque`, `text`, `textSecondary`, `textMuted`, `border`, `glassHighlight`, `brass` (acento), `teal` (confirmación), `danger` (descartar/error), `diamond` (premium), `unread`. Las variantes `*Soft` son rellenos con alfa.
- `Spacing`: `half` 2, `one` 4, `two` 8, `three` 16, `four` 24, `five` 32, `six` 64.
- `Radii`: `small` 8, `medium` 12, `large` 16, `card` 22, `sheet` 26, `pill` 999 (solo chips, botones y barras).
- `Control`: `minTouch` 44, `field` 50, `button` 56, `textArea` 88.
- `Opacity`, `Elevation.dark` (`raised`, `overlay`, `glow`), `BlurIntensity`, `Duration`, `Curves`, `Springs`.

Texto: **siempre `ThemedText` con un `type`**, nunca tamaños sueltos. Los tipos son `display`, `title` y `subtitle` (Instrument Serif), y `heading`, `body`, `bodyStrong`, `small`, `smallBold`, `caption`, `label`, `mono`, `link` y `timer` (Instrument Sans). El color se pone con `themeColor="textSecondary"` (cualquier clave de `Colors.dark`). La serif solo tiene peso 400: nunca le pongas `fontWeight`.

## Maquetación propia (DOM)
Para tu propio layout con `div`, usa las variables CSS de `_ds_bundle.css` (incluida en `styles.css`):
- Color: `--color-background`, `--color-background-element`, `--color-text`, `--color-text-secondary`, `--color-border`, `--color-brass`…
- Espaciado y forma: `--space-three`, `--space-four`, `--radius-card`, `--radius-pill`.
- Sombra y movimiento: `--shadow-raised`, `--duration-base`, `--ease-out`.
- Clases de rol tipográfico: `.type-display`, `.type-title`, `.type-subtitle`, `.type-heading`, `.type-body`, `.type-small`, `.type-caption`, `.type-label`.

## Avisos
- `Frosted` desenfoca lo que hay detrás. Sus hijos tienen que estar posicionados (componentes RN o un `div` con `position: relative`). Un `Icon` suelto queda debajo del desenfoque y sale borroso.
- `Icon` acepta solo los 24 nombres de su `.d.ts`, y `color` es obligatorio (un token).
- Para pulsables a medida, usa `ScalePressable` (escala 0.97 al pulsar) con `glassStyle(Colors.dark)` como forma.

Referencia de cada componente: `components/<grupo>/<Name>/<Name>.prompt.md`.
