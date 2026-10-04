/**
 * El plugin que hace visible a `getInitialURL()` un deep link entregado por
 * `onNewIntent` (vuelta en frío de GitHub). Ver la cabecera del plugin.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addNewIntentOverride } = require('../../plugins/with-new-intent-initial-url');

const TEMPLATE = `class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
  }
}
`;

describe('addNewIntentOverride', () => {
  it('guarda el intent nuevo antes de pasárselo a React', () => {
    const out: string = addNewIntentOverride(TEMPLATE);

    expect(out).toContain('override fun onNewIntent(intent: android.content.Intent)');
    // El orden importa: `getInitialURL()` lee `activity.intent`.
    expect(out.indexOf('setIntent(intent)')).toBeLessThan(out.indexOf('super.onNewIntent(intent)'));
    expect(out).toContain('override fun createReactActivityDelegate()');
  });

  it('es idempotente: un segundo prebuild no lo duplica', () => {
    const once: string = addNewIntentOverride(TEMPLATE);

    expect(addNewIntentOverride(once)).toBe(once);
    expect(once.match(/override fun onNewIntent/g)).toHaveLength(1);
  });

  it('si la actividad ya tiene su onNewIntent no lo pisa: falla y lo dice', () => {
    const custom = TEMPLATE.replace(
      'override fun getMainComponentName',
      'override fun onNewIntent(intent: Intent) { super.onNewIntent(intent) }\n  override fun getMainComponentName'
    );

    expect(() => addNewIntentOverride(custom)).toThrow('ya tiene onNewIntent');
  });

  it('si la plantilla de Expo cambia, falla en vez de no hacer nada', () => {
    expect(() => addNewIntentOverride('class MainActivity : ReactActivity() {}')).toThrow(
      'getMainComponentName'
    );
  });
});
