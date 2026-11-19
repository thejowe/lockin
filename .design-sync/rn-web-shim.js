// react-native -> react-native-web para el prebuild de design-sync.
// Metro tolera imports de símbolos solo-nativos que en web no existen
// (quedan undefined); esbuild no, así que aquí se declaran como stubs inertes.
export * from 'react-native-web';

export const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () => null,
};
