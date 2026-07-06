export const PENDING_TEMPLATE_KEY = 'gp-pending-template';

/** Persist ?template= from URL so it survives login. */
export function captureTemplateFromUrl(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const templateId = params.get('template');
  if (!templateId) return;

  sessionStorage.setItem(PENDING_TEMPLATE_KEY, templateId);

  const url = new URL(window.location.href);
  url.searchParams.delete('template');
  const next = url.pathname + url.search + url.hash;
  window.history.replaceState(null, '', next);
}

export function peekPendingTemplateId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PENDING_TEMPLATE_KEY);
}

export function takePendingTemplateId(): string | null {
  const id = peekPendingTemplateId();
  if (id) sessionStorage.removeItem(PENDING_TEMPLATE_KEY);
  return id;
}
