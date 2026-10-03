import { act, renderHook } from '@testing-library/react-native';

import { useSingleFlight } from './use-single-flight';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

it('un segundo run con el primero en vuelo no hace nada', async () => {
  const { result } = await renderHook(() => useSingleFlight());
  const gate = deferred();
  const task = jest.fn(() => gate.promise);

  let first!: Promise<void>;
  await act(async () => {
    first = result.current.run(task);
    void result.current.run(task);
  });
  expect(task).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(true);

  await act(async () => {
    gate.resolve();
    await first;
  });
  expect(result.current.busy).toBe(false);
});

it('con hold sigue ocupado tras el éxito', async () => {
  const { result } = await renderHook(() => useSingleFlight());
  const task = jest.fn(async () => {});
  await act(async () => {
    await result.current.run(task, { hold: true });
    await result.current.run(task, { hold: true });
  });
  expect(task).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(true);
});

it('si la tarea falla, libera aunque haya hold y devuelve el error', async () => {
  const { result } = await renderHook(() => useSingleFlight());
  const error = new Error('sin red');
  await act(async () => {
    await expect(result.current.run(() => Promise.reject(error), { hold: true })).rejects.toBe(
      error
    );
  });
  expect(result.current.busy).toBe(false);

  const task = jest.fn(async () => {});
  await act(async () => {
    await result.current.run(task);
  });
  expect(task).toHaveBeenCalledTimes(1);
});

it('la tarea sabe si la pantalla sigue montada, y la escritura termina igual', async () => {
  const { result, unmount } = await renderHook(() => useSingleFlight());
  const gate = deferred();
  const seen: boolean[] = [];
  let running!: Promise<void>;
  await act(async () => {
    running = result.current.run(
      async (isCurrent) => {
        seen.push(isCurrent());
        await gate.promise;
        seen.push(isCurrent());
      },
      { hold: true }
    );
  });
  await unmount();
  gate.resolve();
  await running;
  expect(seen).toEqual([true, false]);
});
