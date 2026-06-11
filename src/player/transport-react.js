/**
 * transport-react.js — thin React binding for player/transport.js.
 *
 * `useTransport(transport)` subscribes to a transport instance and mirrors its
 * state into React state: `{ positionSec, isPlaying, rate, durationSec }`.
 * While playing this updates every animation frame (same cadence the previous
 * per-tab state plumbing used), so it is suitable for time displays and play
 * buttons. Canvas renderers should poll `transport.getPosition()` from their
 * own rAF loop instead of re-rendering React per frame.
 */
import { useEffect, useState } from 'react';

const IDLE_STATE = { positionSec: 0, isPlaying: false, rate: 1, durationSec: 0 };

export function useTransport(transport) {
  const [state, setState] = useState(() => (transport ? transport.getState() : IDLE_STATE));

  useEffect(() => {
    if (!transport) {
      setState(IDLE_STATE);
      return undefined;
    }
    // subscribe() invokes the callback immediately with the current snapshot.
    return transport.subscribe(setState);
  }, [transport]);

  return state;
}

export default useTransport;
