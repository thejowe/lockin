import { addProfileWorkRanges } from './profile-work-ranges';
import type { DeckRow } from './database.types';
import type { LockInSupabaseClient } from './client';

it('completa la jornada sin reordenar candidatos y descarta los perfiles que desaparecieron entre lecturas', async () => {
  const filter = jest.fn().mockResolvedValue({
    data: [
      { id: 'b', work_ranges: [] },
      { id: 'a', work_ranges: [{ start_min: 600, end_min: 960 }] },
    ],
  });
  const from = jest.fn(() => ({ select: () => ({ in: filter }) }));
  const client = { from } as unknown as LockInSupabaseClient;
  await expect(addProfileWorkRanges(client, [])).resolves.toEqual([]);
  expect(from).not.toHaveBeenCalled();
  const rows = ['a', 'missing', 'b'].map((id) => ({ id, name: id.toUpperCase() }) as DeckRow);
  const result = await addProfileWorkRanges(client, rows);
  expect(result.map((p) => [p.name, p.work_ranges])).toEqual([
    ['A', [{ start_min: 600, end_min: 960 }]],
    ['B', []],
  ]);
  expect(filter).toHaveBeenCalledWith('id', ['a', 'missing', 'b']);
  const error = new Error('connection lost');
  filter.mockResolvedValueOnce({ error });
  await expect(addProfileWorkRanges(client, rows)).rejects.toThrow(error);
});
