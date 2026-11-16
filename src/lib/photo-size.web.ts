// The website reads a photo in the browser (Tesseract) and keeps it as it
// was picked: nothing to shrink. The phone app's twin is photo-size.ts.

import type { PickedPhoto } from './photo-size-types';

export type { PickedPhoto } from './photo-size-types';

export async function shrinkPhoto(picked: PickedPhoto): Promise<PickedPhoto> {
  return picked;
}
