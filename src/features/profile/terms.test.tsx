/**
 * Aceptación de Términos y Normas: la casilla es explícita, el botón no se
 * activa sin ella y aceptar guarda la versión vigente.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { LEGAL_URLS, TERMS_VERSION } from '@/constants/legal';
import { DataProvider } from '@/data';
import { createMockRepositories, resetState } from '@/data/mock';

import { Text } from 'react-native';

import { LegalLinks, TermsAcceptance, useTermsGate } from './terms';

beforeEach(() => resetState());

describe('TermsAcceptance', () => {
  it('no deja aceptar sin marcar la casilla y guarda la versión vigente', async () => {
    const repositories = createMockRepositories();
    const onAccepted = jest.fn();

    await render(
      <DataProvider value={repositories}>
        <TermsAcceptance onAccepted={onAccepted} />
      </DataProvider>
    );

    await fireEvent.press(screen.getByText('Aceptar y continuar'));
    expect(onAccepted).not.toHaveBeenCalled();
    expect(await repositories.session.getTermsAcceptance()).toBeNull();

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByText('Aceptar y continuar'));

    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    expect((await repositories.session.getTermsAcceptance())?.version).toBe(TERMS_VERSION);
  });
});

describe('LegalLinks', () => {
  it('muestra privacidad, términos y normas', async () => {
    await render(<LegalLinks />);
    expect(screen.getByLabelText('Política de privacidad')).toBeTruthy();
    expect(screen.getByLabelText('Términos de uso')).toBeTruthy();
    expect(screen.getByLabelText('Normas de la comunidad')).toBeTruthy();
    expect(LEGAL_URLS.terms).toMatch(/^https:\/\/.+\/terminos$/);
  });
});

function GateProbe() {
  const { gate } = useTermsGate();
  return <Text>{`gate:${gate}`}</Text>;
}

describe('useTermsGate', () => {
  it('sin aceptación exige aceptar; con una versión posterior a la vigente deja pasar', async () => {
    const repositories = createMockRepositories();
    const view = await render(
      <DataProvider value={repositories}>
        <GateProbe />
      </DataProvider>
    );
    await waitFor(() => expect(screen.getByText('gate:required')).toBeTruthy());
    view.unmount();

    await repositories.session.acceptTerms('2999-01-01');
    await render(
      <DataProvider value={repositories}>
        <GateProbe />
      </DataProvider>
    );
    await waitFor(() => expect(screen.getByText('gate:accepted')).toBeTruthy());
  });
});
