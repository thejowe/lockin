import { createMockStore } from './store';

describe('purgeOldReports', () => {
  afterEach(() => jest.useRealTimers());

  it('el 29 de febrero la frontera es el 28 de febrero del año anterior', () => {
    jest.useFakeTimers().setSystemTime(new Date(2028, 1, 29, 12));
    const store = createMockStore();
    const day = 24 * 60 * 60 * 1000;
    const cutoff = new Date(2027, 1, 28).getTime();
    store.state.userReports = [
      { createdAtMs: cutoff - day },
      { createdAtMs: cutoff + day },
    ] as typeof store.state.userReports;

    expect(store.purgeOldReports()).toBe(1);
    expect(store.state.userReports).toHaveLength(1);
  });
});
