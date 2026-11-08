// The phone app's stand-in: locked vaults are on the web app only until EAS
// builds exist (on-device-model.web.ts).
export async function embedTexts(_texts: string[], _onProgress?: (done: number, total: number) => void): Promise<number[][]> {
  throw new Error('Locked vaults need the web app for now.');
}
export async function embedQuery(_text: string): Promise<number[]> {
  throw new Error('Locked vaults need the web app for now.');
}
export function onDeviceSearchAvailable(): boolean {
  return false;
}
