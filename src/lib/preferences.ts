'use client';
import { useSyncExternalStore } from 'react';
const event = 'atlas-preferences';
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(event, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(event, callback); };
}
export function usePreference(key: string, fallback: string): [string, (value: string) => void] {
  const read = () => { try { return localStorage.getItem(`atlas:v1:${key}`) ?? fallback; } catch { return fallback; } };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const write = (next: string) => {
    try { localStorage.setItem(`atlas:v1:${key}`, next); } catch { /* Storage can be disabled by the browser. Data access does not depend on it. */ }
    window.dispatchEvent(new Event(event));
  };
  return [value, write];
}
