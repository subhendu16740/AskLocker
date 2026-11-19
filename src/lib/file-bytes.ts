// A picked file's bytes, on every platform.
//
// A browser's Blob has arrayBuffer(). React Native's Blob may not, and its
// FileReader may give only a data: URL, so each is tried in turn. The phone
// app uploads these bytes rather than the Blob itself: Supabase's own advice
// for React Native, where a Blob or FormData upload can arrive empty.

export function readerResult<T>(read: (reader: FileReader) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as T);
    reader.onerror = () => reject(reader.error);
    read(reader);
  });
}

export async function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  try {
    return await readerResult<ArrayBuffer>((r) => r.readAsArrayBuffer(blob));
  } catch {
    const url = await readerResult<string>((r) => r.readAsDataURL(blob));
    const binary = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
}
