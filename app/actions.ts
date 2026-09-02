'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createLink, deleteLink } from '@/lib/db';
import { enforceContrastSafety, sanitizeQrStyle } from '@/lib/qrStyles';
import { SESSION_COOKIE_NAME } from '@/lib/auth';

export async function createLinkAction(formData: FormData) {
  const destinationUrl = formData.get('destinationUrl');
  const label = formData.get('label');
  const styleRaw = formData.get('style');

  if (typeof destinationUrl !== 'string' || !destinationUrl.trim()) {
    throw new Error('A destination URL is required.');
  }
  const trimmedDestinationUrl = destinationUrl.trim();

  // The client only hints at this via disabling the submit button — enforce
  // it here too, since a direct form submission bypasses that entirely, and
  // a malformed URL would otherwise crash the redirect route on first scan.
  let parsedDestination: URL;
  try {
    parsedDestination = new URL(trimmedDestinationUrl);
  } catch {
    throw new Error('Enter a valid destination URL, including http:// or https://.');
  }
  if (parsedDestination.protocol !== 'http:' && parsedDestination.protocol !== 'https:') {
    throw new Error('Destination URL must start with http:// or https://.');
  }

  let style = null;
  if (typeof styleRaw === 'string' && styleRaw.trim()) {
    try {
      const structurallyValid = sanitizeQrStyle(JSON.parse(styleRaw));
      style = structurallyValid ? enforceContrastSafety(structurallyValid) : null;
    } catch {
      style = null;
    }
  }

  const { code } = await createLink(trimmedDestinationUrl, typeof label === 'string' ? label.trim() : '', style);
  revalidatePath('/');
  redirect(`/?created=${code}`);
}

export async function deleteLinkAction(formData: FormData) {
  const idRaw = formData.get('id');
  const id = typeof idRaw === 'string' ? Number(idRaw) : NaN;

  if (!Number.isInteger(id)) {
    throw new Error('A valid link id is required.');
  }

  await deleteLink(id);
  revalidatePath('/');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/login');
}
