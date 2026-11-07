/**
 * Documentos legales: versión vigente y direcciones públicas.
 *
 * `TERMS_VERSION` es la ÚNICA constante de versión de Términos y Normas. Es la
 * fecha (`AAAA-MM-DD`) más reciente de `docs/tiendas/terminos.md` y de
 * `docs/tiendas/normas.md`; al cambiar cualquiera de los dos textos de fondo se
 * sube aquí y todo el mundo vuelve a aceptar. La base valida el mismo formato
 * (`accept_terms`).
 */
export const TERMS_VERSION = '2026-11-07';

/** Raíz de las páginas públicas (GitHub Pages con dominio propio). Sin barra final. */
export const LEGAL_BASE_URL = 'https://getcofounder.app';

export const LEGAL_URLS = {
  privacy: `${LEGAL_BASE_URL}/privacidad`,
  terms: `${LEGAL_BASE_URL}/terminos`,
  guidelines: `${LEGAL_BASE_URL}/normas`,
} as const;
