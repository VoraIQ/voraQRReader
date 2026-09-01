'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createLink } from '@/lib/db';
import { sanitizeQrStyle } from '@/lib/qrStyles';

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
