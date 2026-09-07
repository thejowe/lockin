/**
 * RN exporta sus componentes mediante getters: Babel conserva el acceso hasta
 * el primer render. En frío eso compilaba TextInput/ScrollView dentro del test
 * asíncrono de ProfileForm (timeout de 5 s). Inicializar los módulos al preparar
 * la suite evita medir la transformación de dependencias como tiempo de UI.
 * No monta componentes, no añade mocks y no cambia timers ni aserciones.
 */
const { expect } = require('@jest/globals');

if (expect.getState().testPath.endsWith('.tsx')) {
  const native = require('react-native');
  for (const name of [
    'View',
    'Text',
    'TextInput',
    'Pressable',
    'ScrollView',
    'KeyboardAvoidingView',
    'FlatList',
    'ActivityIndicator',
    'Modal',
  ]) {
    void native[name];
  }
}
