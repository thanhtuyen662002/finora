import { redirect } from 'next/navigation';

/**
 * Finora has no public landing page. The request proxy normally redirects "/"
 * to /dashboard (signed in) or /login (signed out) before this renders; this
 * is the fallback when the proxy does not run, e.g. when auth env vars are missing.
 */
export default function HomePage() {
  redirect('/login');
}
