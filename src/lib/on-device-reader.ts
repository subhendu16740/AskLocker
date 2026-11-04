// The phone app's stand-in: locked vaults are on the web app only until EAS
// builds exist (on-device-reader.web.ts).
export interface PdfReadProgress {
  stage: 'opening' | 'reading' | 'scanning';
  page: number;
  pages: number;
}
export async function readPdfOnDevice(
  _bytes: Uint8Array, _languages?: string[], _onProgress?: (p: PdfReadProgress) => void,
): Promise<{ text: string; pages: number; scanned: boolean }> {
  throw new Error('Locked vaults need the web app for now.');
}
