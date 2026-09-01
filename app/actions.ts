'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createLink, deleteLink } from '@/lib/db';
import { sanitizeQrStyle } from '@/lib/qrStyles';
import { SESSION_COOKIE_NAME } from '@/lib/auth';

export async function createLinkAction(formData: FormData) {
  const destinationUrl = formData.get('destinationUrl');
  const label = formData.get('label');
  const styleRaw = formData.get('style');

  if (typeof destinationUrl !== 'string' || !destinationUrl.trim()) {
    throw new Error('A destination URL is required.');
  }

  let style = null;
  if (typeof styleRaw === 'string' && styleRaw.trim()) {
    try {
      style = sanitizeQrStyle(JSON.parse(styleRaw));
    } catch {
      style = null;
    }
  }

  const { code } = await createLink(destinationUrl.trim(), typeof label === 'string' ? label.trim() : '', style);
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
