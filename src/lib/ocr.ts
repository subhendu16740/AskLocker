// ─── Client-Side OCR ────────────────────────────────────────────
// Web: Tesseract.js (WASM, runs in browser), free with no API limits.
// Android/iOS: nothing on the phone. The photo is sent without text and
// the server reads it (OCR.space, English only), as it reads a scanned PDF.
//
// LANGUAGES. Tesseract reads every major Indian script, but each language
// model is a separate ~10-20MB download (fetched from a CDN on first use and
// cached by the browser afterwards), so we load only the ones the person says
// their documents use — Settings › Documents, see ocr-languages.ts. English
// is always included alongside, because Indian documents are almost always
// bilingual.
//
// The phone app read photos with react-native-mlkit-ocr until November
// 2026: Latin script only, and a 2021 package that predates React Native's
// new architecture, too risky for the first Android build. The server's
// reader is English only too, so ocrLanguageGapOnThisDevice() still says
// which chosen languages a photo added here will not be read in.
// ────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import {
  resolveOcrLanguages,
  unsupportedOnNativeApp,
  type OcrLanguage,
} from './ocr-languages';

const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'bmp', 'gif', 'tiff'];

export function isImageFile(fileType: string): boolean {
  return IMAGE_TYPES.includes(fileType.toLowerCase());
}

export interface OcrProgress {
  stage: 'loading' | 'recognizing' | 'done';
  progress: number; // 0–1
  /** Set while a language model is being fetched — the slow first-run step. */
  downloading?: boolean;
}

type ProgressCallback = (p: OcrProgress) => void;

/**
 * Languages this device cannot actually read, given what the person chose.
 * Empty on web, where Tesseract handles all of them.
 */
export function ocrLanguageGapOnThisDevice(languages: string[] | undefined): OcrLanguage[] {
  if (Platform.OS === 'web') return [];
  return unsupportedOnNativeApp(languages);
}

/**
 * Extract text from an image file using client-side OCR.
 * Automatically picks the right engine based on platform.
 *
 * `languages` are the person's chosen Tesseract codes; English is added for
 * them. Omitting it reads English only, which is the old behaviour.
 */
export async function extractTextFromImage(
  imageUri: string,
  onProgress?: ProgressCallback,
  languages?: string[],
): Promise<string> {
  onProgress?.({ stage: 'loading', progress: 0 });

  if (Platform.OS === 'web') {
    return extractWithTesseract(imageUri, onProgress, resolveOcrLanguages(languages));
  }
  // The phone app sends the photo without text; the server reads it.
  onProgress?.({ stage: 'done', progress: 1 });
  return '';
}

// ─── Web: Tesseract.js ──────────────────────────────────────────

async function extractWithTesseract(
  imageUri: string,
  onProgress?: ProgressCallback,
  languages: string[] = ['eng'],
): Promise<string> {
  const { createWorker } = await import('tesseract.js');

  onProgress?.({ stage: 'loading', progress: 0.1 });

  // tesseract.js fetches each language model from a CDN on first use, so a
  // newly chosen language costs one slow run and is instant afterwards.
  // Surface that rather than letting the bar sit still.
  const worker = await createWorker(languages, undefined, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        onProgress?.({ stage: 'recognizing', progress: 0.1 + m.progress * 0.85 });
      } else if (m.status?.startsWith('loading language traineddata')
              || m.status === 'downloading language traineddata') {
        onProgress?.({ stage: 'loading', progress: 0.02 + m.progress * 0.08, downloading: true });
      }
    },
  });

  onProgress?.({ stage: 'recognizing', progress: 0.15 });

  let text = '';
  try {
    ({ data: { text } } = await worker.recognize(imageUri));
  } finally {
    // A worker that outlives a failed recognise holds on to its WASM heap,
    // and a few of those will exhaust a phone browser.
    await worker.terminate();
  }

  onProgress?.({ stage: 'done', progress: 1 });
  return text.trim();
}
