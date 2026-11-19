@AGENTS.md

Al retomar el trabajo tras una pausa, invoca la skill `pilar` para saber por dónde seguir y qué lanzar a continuación.

Para builds de iOS con EAS (fallos de pods, firma, relanzar con auto-submit), invoca la skill `build-ios` (`/build-ios`, `/build-ios lanza`). Si cambias de equipo, pide «adapta la skill build-ios» para ajustar los comandos a ese entorno.

## Sistema de diseño en Claude Design (design-sync)

El sistema «cristal» (`src/components` + `src/constants/theme.ts`) está sincronizado con el proyecto de Claude Design **cofounder** (https://claude.ai/design/p/fd5378fc-e1da-4b1c-ab34-4bea446d2c9b). Todo lo necesario para repetir la sync vive en `.design-sync/`:

- `config.json`: proyecto destino (`projectId`), alcance y contratos escritos a mano.
- `build-web.mjs`: prebuild web obligatorio. La app no tiene `dist/`; compila `ds-entry.ts` con react-native-web, con los shims de `rn-web-shim.js`.
- `ds-entry.ts`: qué componentes se sincronizan. Un componente nuevo se añade aquí y en `GROUPS` de `build-web.mjs`.
- `previews/*.tsx`: las previews de cada componente.
- `conventions.md`: la guía que lee el agente de diseño.
- `NOTES.md`: problemas resueltos y riesgos. **Léelo antes de re-sincronizar.**

**Adoptarlo en otro dispositivo** (o re-sincronizar tras cambiar componentes o tokens):
1. `npm ci` en la raíz del repo.
2. En Claude Code, `/design-login` si `DesignSync` pide autorización.
3. `/design-sync`. Lee `.design-sync/config.json`, ve el `projectId` fijado y trata la sync como re-sync del mismo proyecto. No crea uno nuevo.
4. Si cambian las props de Frosted, Icon, Glass, Screen o ScalePressable, actualiza su `dtsPropsFor` en `config.json`.

Las carpetas `.ds-sync/`, `ds-bundle/` y `.design-sync/.cache/` son regenerables y están en `.gitignore`. Playwright (para las capturas) se instala en `.ds-sync/` y necesita un Chromium compatible: ver «Entorno» en `NOTES.md`.
