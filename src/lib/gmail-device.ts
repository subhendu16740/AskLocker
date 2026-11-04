// The phone app's stand-in: Gmail import for locked vaults is on the web app
// only until EAS builds exist (gmail-device.web.ts).
import type { Suggestion } from '../../supabase/functions/_shared/gmail-rules';
export interface FoundHere {
  key: string; messageId: string; partId: string; fileName: string; size: number; from: string; subject: string;
  sentAt: string | null; suggestion: Suggestion; reason: string; category: string | null;
}
export function gmailInBrowserAvailable(): boolean { return false; }
export async function connectGmailHere(): Promise<string> { throw new Error('Use the web app for this.'); }
export async function scanGmailHere(_t: string, _m?: number, _p?: (d: number) => void): Promise<FoundHere[]> { return []; }
export async function fetchAttachmentHere(_t: string, _i: FoundHere): Promise<{ bytes: Uint8Array; kind: 'pdf' | 'jpg' | 'png' }> {
  throw new Error('Use the web app for this.');
}
