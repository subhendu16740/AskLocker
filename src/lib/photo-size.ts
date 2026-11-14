// Photos in the phone app are made small before they are added.
//
// The phone app does not read a photo itself: the server does, with
// OCR.space, which takes a file of 1 MB at most on its free plan (see
// ocr.ts). A phone's camera makes 2-6 MB pictures, so a photo over
// TARGET_BYTES is redrawn as a JPEG at most 2,000 pixels on its longer side,
// then smaller and plainer until it fits; text on a page stays readable at
// those sizes. It also keeps the 100 MB each person has on Free for more
// documents. A photo that cannot be redrawn is kept as it was: the server
// then reads what it can, and says so if it can't.

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { PickedPhoto } from './photo-size-types';

export type { PickedPhoto } from './photo-size-types';

/** Under OCR.space's 1 MB, with room for how it counts. */
const TARGET_BYTES = 950 * 1024;

/** Longest side, then JPEG quality: tried in turn until the photo fits. */
const STEPS: [number, number][] = [[2000, 0.75], [1600, 0.65], [1280, 0.55]];

function isPhoto(picked: PickedPhoto): boolean {
  const mime = (picked.mimeType ?? '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png') return true;
  return /\.(jpe?g|png)$/i.test(picked.name ?? '') || /\.(jpe?g|png)$/i.test(picked.uri);
}

async function sizeOf(uri: string): Promise<number | null> {
  try {
    const blob = await (await fetch(uri)).blob();
    return blob.size;
  } catch {
    return null;
  }
}

function asJpegName(name: string | null | undefined): string | null {
  if (!name) return null;
  return /\.[a-z0-9]+$/i.test(name) ? name.replace(/\.[a-z0-9]+$/i, '.jpg') : `${name}.jpg`;
}

export async function shrinkPhoto(picked: PickedPhoto): Promise<PickedPhoto> {
  if (!isPhoto(picked)) return picked;
  const size = picked.size ?? (await sizeOf(picked.uri));
  if (size != null && size <= TARGET_BYTES) return picked;
  try {
    const original = await ImageManipulator.manipulate(picked.uri).renderAsync();
    const longer = Math.max(original.width, original.height);
    let best: PickedPhoto | null = null;
    for (const [side, quality] of STEPS) {
      const context = ImageManipulator.manipulate(picked.uri);
      if (longer > side) {
        context.resize(original.width >= original.height ? { width: side } : { height: side });
      }
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
      const bytes = await sizeOf(saved.uri);
      best = { uri: saved.uri, name: asJpegName(picked.name), mimeType: 'image/jpeg', size: bytes };
      if (bytes != null && bytes <= TARGET_BYTES) return best;
    }
    return best ?? picked;
  } catch (err) {
    console.warn('[photo] Could not make the photo smaller:', err);
    return picked;
  }
}
