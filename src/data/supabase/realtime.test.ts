/** El aviso de reenganche, con un canal falso: sin red. */

import { subscribeResyncingOnRejoin } from './realtime';

import type { RealtimeChannel } from '@supabase/supabase-js';

type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'CLOSED' | 'TIMED_OUT';

interface FakeChannel {
  subscribe: jest.Mock<FakeChannel, [(status: Status) => void]>;
}

function fakeChannel() {
  let notify: (status: Status) => void = () => {};
  const channel: FakeChannel = {
    subscribe: jest.fn((callback: (status: Status) => void) => {
      notify = callback;
      return channel;
    }),
  };
  return {
    channel: channel as unknown as RealtimeChannel,
    raw: channel,
    status: (value: Status) => notify(value),
  };
}

describe('subscribeResyncingOnRejoin', () => {
  it('no avisa en el primer join: quien se acaba de suscribir ya ha leído', () => {
    const fake = fakeChannel();
    const onRejoin = jest.fn();

    subscribeResyncingOnRejoin(fake.channel, onRejoin);
    fake.status('SUBSCRIBED');

    expect(onRejoin).not.toHaveBeenCalled();
  });

  it('avisa en cada reenganche, porque lo perdido mientras tanto no se reemite', () => {
    const fake = fakeChannel();
    const onRejoin = jest.fn();

    subscribeResyncingOnRejoin(fake.channel, onRejoin);
    fake.status('SUBSCRIBED');
    fake.status('CHANNEL_ERROR');
    fake.status('SUBSCRIBED');

    expect(onRejoin).toHaveBeenCalledTimes(1);

    fake.status('CLOSED');
    fake.status('SUBSCRIBED');

    expect(onRejoin).toHaveBeenCalledTimes(2);
  });

  it('los estados que no son SUBSCRIBED no avisan por sí solos', () => {
    const fake = fakeChannel();
    const onRejoin = jest.fn();

    subscribeResyncingOnRejoin(fake.channel, onRejoin);
    fake.status('SUBSCRIBED');
    fake.status('CHANNEL_ERROR');
    fake.status('TIMED_OUT');
    fake.status('CLOSED');

    expect(onRejoin).not.toHaveBeenCalled();
  });

  it('devuelve el mismo canal, para poder encadenar', () => {
    const fake = fakeChannel();

    expect(subscribeResyncingOnRejoin(fake.channel, jest.fn())).toBe(fake.channel);
  });
});
