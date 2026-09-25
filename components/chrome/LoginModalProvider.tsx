/**
 * One login modal for the whole app, opened from anywhere.
 *
 * In the CRA app, App.js owned the modal's open state and threaded an
 * `onLoginClick` prop into every page. Here the locale layout mounts this
 * provider once, and any Client Component calls useLoginModal().openLoginModal().
 *
 * It also completes the /account gate in proxy.ts: a signed-out visitor is
 * redirected to `/?signin=1&next=/account/...`, so on arrival the modal opens
 * by itself, and once the visitor is signed in they are sent on to `next`.
 * `returnTo` is exposed so the modal's OAuth buttons can pass it as
 * `redirectUrlComplete` and land in the same place after the round trip.
 */
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LoginModal } from '@/components/auth/LoginModal';
import { useUser } from '@/lib/auth';

interface LoginModalContextValue {
  isOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  /** Same-site path to continue to after sign-in, when the visitor was sent here by the /account gate. */
  returnTo: string | null;
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

/** Only same-site absolute paths: this value becomes a navigation target. */
function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const openLoginModal = useCallback(() => {
    setIsOpen(true);
    document.body.classList.add('modal-open');
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsOpen(false);
    document.body.classList.remove('modal-open');
  }, []);

  // Arrived from the /account gate: open the modal once auth has loaded (a
  // visitor whose session was merely stale may already be signed in).
  useEffect(() => {
    if (!isLoaded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('signin') !== '1') return;
    const next = safeReturnPath(params.get('next'));
    // Reading the URL once on arrival; state is the only place it can go.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReturnTo(next);
    if (!isSignedIn) openLoginModal();
    // Drop the parameters so a reload or a shared link does not reopen it.
    params.delete('signin');
    params.delete('next');
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  }, [isLoaded, isSignedIn, openLoginModal]);

  useEffect(() => {
    if (!isSignedIn || !returnTo) return;
    const target = returnTo;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReturnTo(null);
    closeLoginModal();
    // `next` already carries its locale prefix, so this is the plain router.
    router.replace(target);
  }, [isSignedIn, returnTo, closeLoginModal, router]);

  const value = useMemo(
    () => ({ isOpen, openLoginModal, closeLoginModal, returnTo }),
    [isOpen, openLoginModal, closeLoginModal, returnTo]
  );

  return (
    <LoginModalContext.Provider value={value}>
      {children}
      <LoginModal isOpen={isOpen} onClose={closeLoginModal} />
    </LoginModalContext.Provider>
  );
}

export function useLoginModal(): LoginModalContextValue {
  const ctx = useContext(LoginModalContext);
  if (!ctx) throw new Error('useLoginModal must be used within LoginModalProvider');
  return ctx;
}
