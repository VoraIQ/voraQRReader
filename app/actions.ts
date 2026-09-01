'use server';

import { revalidatePath } from 'next/cache';
import { createLink } from '@/lib/db';

export async function createLinkAction(formData: FormData) {
  const destinationUrl = formData.get('destinationUrl');
  const label = formData.get('label');

  if (typeof destinationUrl !== 'string' || !destinationUrl.trim()) {
    throw new Error('A destination URL is required.');
  }

  await createLink(destinationUrl.trim(), typeof label === 'string' ? label.trim() : '');
  revalidatePath('/dashboard');
}
