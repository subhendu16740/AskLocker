/** A picked file as Upload's pickers hand it on. */
export interface PickedPhoto {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
}
