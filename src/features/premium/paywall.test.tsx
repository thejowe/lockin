/**
 * El paywall: precios de la oferta (ninguno a mano), estados de la compra y
 * cierre solo cuando el servidor confirma Premium.
 *
 * Ojo: en RNTL 14 `render` y `fireEvent` son asíncronos.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DataProvider } from '@/data';
import { createMockRepositories, resetState, setMockPremium } from '@/data/mock';
import {
  PurchasesUnavailableError,
  getOfferings,
  purchase,
  restore,
  type PurchasePackage,
} from '@/lib/purchases';

import { Paywall } from './paywall';

import type { Repositories } from '@/data';

jest.mock('@/lib/purchases', () => ({
  ...jest.requireActual('@/lib/purchases'),
  getOfferings: jest.fn(),
  purchase: jest.fn(),
  restore: jest.fn(),
}));

const OFFERS: PurchasePackage[] = [
  {
    id: 'm',
    period: 'month',
    priceString: '7,77 €',
    pricePerMonthString: '7,77 €',
    freeTrial: null,
  },
  {
    id: 'y',
    period: 'year',
    priceString: '31,31 €',
    pricePerMonthString: '2,61 €',
    freeTrial: null,
  },
];

let repositories: Repositories;
const onClose = jest.fn();
const onOpenLegal = jest.fn();

async function setup() {
  await render(
    <DataProvider value={repositories}>
      <Paywall onClose={onClose} onOpenLegal={onOpenLegal} />
    </DataProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetState();
  repositories = createMockRepositories();
  (getOfferings as jest.Mock).mockResolvedValue(OFFERS);
  (purchase as jest.Mock).mockResolvedValue('purchased');
  (restore as jest.Mock).mockResolvedValue(undefined);
});

describe('Paywall', () => {
  it('lista los beneficios y los planes con el precio de la oferta', async () => {
    await setup();

    expect(await screen.findByText('Likes sin límite')).toBeTruthy();
    expect(screen.getByText('Ver quién te ha dado like')).toBeTruthy();
    expect(screen.getByText('7,77 € al mes')).toBeTruthy();
    expect(screen.getByText('31,31 € al año')).toBeTruthy();
    expect(screen.getByText('2,61 € al mes')).toBeTruthy();
  });

  it('sin derecho a prueba no promete ninguna', async () => {
    await setup();

    await screen.findByText('7,77 € al mes');
    expect(screen.queryByText(/gratis/)).toBeNull();
  });

  it('con prueba gratis dice cuánto dura y qué se cobra después (Apple 3.1.2)', async () => {
    (getOfferings as jest.Mock).mockResolvedValue([
      OFFERS[0],
      { ...OFFERS[1], freeTrial: { count: 3, unit: 'day' } },
    ]);
    await setup();

    // El anual viene seleccionado: la frase completa va junto al botón de compra.
    expect(await screen.findByText('3 días gratis, luego 31,31 € al año')).toBeTruthy();
    expect(screen.getByText('3 días gratis')).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Anual, 3 días gratis, luego 31,31 € al año' })
    ).toBeTruthy();

    // El mensual no tiene prueba: al elegirlo, la frase desaparece.
    await fireEvent.press(screen.getByRole('radio', { name: 'Mensual, 7,77 € al mes' }));
    expect(screen.queryByText('3 días gratis, luego 31,31 € al año')).toBeNull();
  });

  it('una prueba de una unidad va en singular', async () => {
    (getOfferings as jest.Mock).mockResolvedValue([
      { ...OFFERS[0], freeTrial: { count: 1, unit: 'week' } },
    ]);
    await setup();

    expect(await screen.findByText('1 semana gratis, luego 7,77 € al mes')).toBeTruthy();
  });

  it('avisa de la renovación y enlaza Términos y Privacidad', async () => {
    await setup();

    expect(
      await screen.findByText('Se renueva automáticamente. Cancela cuando quieras desde la tienda.')
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Términos de uso' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Política de privacidad' }));

    expect(onOpenLegal).toHaveBeenNthCalledWith(1, 'terms');
    expect(onOpenLegal).toHaveBeenNthCalledWith(2, 'privacy');
  });

  it('muestra «Cargando» y luego los planes', async () => {
    let resolve!: (offers: PurchasePackage[]) => void;
    (getOfferings as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
    await setup();

    expect(screen.getByRole('progressbar', { name: 'Cargando los planes…' })).toBeTruthy();

    resolve(OFFERS);
    expect(await screen.findByText('7,77 € al mes')).toBeTruthy();
  });

  it('si falla la carga ofrece reintentar', async () => {
    (getOfferings as jest.Mock).mockRejectedValueOnce(new Error('red'));
    await setup();

    expect(await screen.findByText('No hemos podido cargar los planes')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('7,77 € al mes')).toBeTruthy();
  });

  it('sin tienda conectada dice que las compras aún no están disponibles', async () => {
    (getOfferings as jest.Mock).mockRejectedValue(new PurchasesUnavailableError());
    await setup();

    expect(await screen.findByText('Las compras aún no están disponibles')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hazte Premium' })).toBeNull();
    // Restaurar sigue a la vista.
    expect(screen.getByRole('button', { name: 'Restaurar compras' })).toBeTruthy();
  });

  it('al comprar sincroniza y cierra cuando Premium está activo', async () => {
    const sync = jest.spyOn(repositories.premium, 'syncEntitlement');
    (purchase as jest.Mock).mockImplementation(async () => {
      setMockPremium(true);
      return 'purchased';
    });
    await setup();
    await screen.findByText('7,77 € al mes');

    await fireEvent.press(screen.getByRole('radio', { name: /Mensual/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hazte Premium' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(purchase).toHaveBeenCalledWith('m');
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('un pago pendiente se cuenta y no cierra', async () => {
    (purchase as jest.Mock).mockResolvedValue('pending');
    await setup();
    await screen.findByText('7,77 € al mes');

    await fireEvent.press(screen.getByRole('button', { name: 'Hazte Premium' }));

    expect(await screen.findByText('Pago pendiente de confirmar')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancelar no es un error', async () => {
    (purchase as jest.Mock).mockResolvedValue('cancelled');
    await setup();
    await screen.findByText('7,77 € al mes');

    await fireEvent.press(screen.getByRole('button', { name: 'Hazte Premium' }));

    await waitFor(() => expect(purchase).toHaveBeenCalled());
    expect(screen.queryByText(/No hemos podido/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Hazte Premium' })).toBeTruthy();
  });

  it('si la compra falla lo dice y deja reintentar', async () => {
    (purchase as jest.Mock).mockRejectedValue(new Error('boom'));
    await setup();
    await screen.findByText('7,77 € al mes');

    await fireEvent.press(screen.getByRole('button', { name: 'Hazte Premium' }));

    expect(await screen.findByText(/No hemos podido completar la compra/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('mientras compra, el botón dice «Comprando…»', async () => {
    let finish!: (value: string) => void;
    (purchase as jest.Mock).mockReturnValue(new Promise((r) => (finish = r)));
    await setup();
    await screen.findByText('7,77 € al mes');

    await fireEvent.press(screen.getByRole('button', { name: 'Hazte Premium' }));

    expect(await screen.findByText('Comprando…')).toBeTruthy();
    finish('cancelled');
    expect(await screen.findByText('Hazte Premium')).toBeTruthy();
  });

  it('restaurar compras: sin suscripción lo dice; con ella cierra', async () => {
    await setup();
    await screen.findByText('7,77 € al mes');

    await fireEvent.press(screen.getByRole('button', { name: 'Restaurar compras' }));
    expect(await screen.findByText('No hemos encontrado ninguna suscripción activa.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    setMockPremium(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Restaurar compras' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('en desarrollo con mock, «Simular Premium» llama a setMockPremium', async () => {
    await setup();
    await screen.findByText('7,77 € al mes');

    await fireEvent(screen.getByLabelText('Simular Premium'), 'valueChange', true);

    expect((await repositories.premium.getQuotas()).isPremium).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('«Simular Premium» arranca encendido si el mock ya es Premium', async () => {
    setMockPremium(true);
    await setup();
    await screen.findByText('7,77 € al mes');

    await waitFor(() => expect(screen.getByLabelText('Simular Premium').props.value).toBe(true));

    await fireEvent(screen.getByLabelText('Simular Premium'), 'valueChange', false);

    expect((await repositories.premium.getQuotas()).isPremium).toBe(false);
  });
});
