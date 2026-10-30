'use client';

import { useEffect, useRef, useState } from 'react';
import { stomp } from './stomp';

/** Subscribe to a STOMP destination for the lifetime of the component. Pass null to skip. */
export function useStompSubscription<T>(destination: string | null, onMessage: (payload: T) => void): void {
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!destination) return;
    return stomp.subscribe(destination, (body) => handler.current(body as T));
  }, [destination]);
}

/** Live socket status for "LIVE" indicators. */
export function useStompStatus(): boolean {
  const [connected, setConnected] = useState(false);
  useEffect(() => stomp.onStatus(setConnected), []);
  return connected;
}
