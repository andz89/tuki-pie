import { describe, expect, it, vi } from 'vitest';
import { oneAtATime } from './one-at-a-time';

describe('oneAtATime', () => {
  it('ignores a second submit while the first is saving', async () => {
    let finish: () => void = () => undefined;
    const save = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const submit = oneAtATime(save);
    const first = submit();
    void submit();
    expect(save).toHaveBeenCalledOnce();
    finish();
    await first;
  });

  it('takes the next submit once the first is done, even after a failure', async () => {
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('no'))
      .mockResolvedValueOnce(undefined);
    const submit = oneAtATime(save);
    await expect(submit()).rejects.toThrow('no');
    await submit();
    expect(save).toHaveBeenCalledTimes(2);
  });
});
