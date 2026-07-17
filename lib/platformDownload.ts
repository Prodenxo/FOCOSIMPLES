import { Alert, Linking, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

export function isWebDownloadPlatform(): boolean {
  return Platform.OS === 'web';
}

export function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xml')) return 'application/xml';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

export type PersistDownloadResult = {
  localUri: string;
  filename: string;
  /** No navegador o ficheiro já foi oferecido via `<a download>`. */
  deliveredViaBrowser?: boolean;
};

/**
 * Grava bytes no disco (native) ou dispara download no browser (web).
 * Evita `expo-file-system` no web — não suportado e gera erro no console.
 */
export async function persistBinaryDownload(
  data: Uint8Array,
  filename: string,
  mimeType?: string
): Promise<PersistDownloadResult> {
  const type = mimeType ?? mimeFromFilename(filename);

  if (isWebDownloadPlatform()) {
    deliverOnWeb(data, filename, type);
    return { localUri: '', filename, deliveredViaBrowser: true };
  }

  const { File } = await import('expo-file-system');
  const { getCacheOrDocumentDirectory } = await import('./expoFilePaths');
  const dir = getCacheOrDocumentDirectory();
  const file = new File(dir, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(data);
  return { localUri: file.uri, filename };
}

function deliverOnWeb(data: Uint8Array, filename: string, mimeType: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Download no browser indisponível neste ambiente.');
  }
  const safeName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  // application/pdf + atributo download → arquivo na pasta Downloads (sem diálogo "Salvar como").
  const blob = new Blob([data.slice()], { type: mimeType === 'application/pdf' ? 'application/pdf' : mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type PresentDownloadOptions = {
  mimeType: string;
  dialogTitle: string;
  /** Mensagem se não houver share nem Linking (só native). */
  successMessage?: string;
};

/** Abre share sheet (native) ou ignora se o browser já baixou o ficheiro. */
export async function presentDownloadedFile(
  result: PersistDownloadResult,
  options: PresentDownloadOptions
): Promise<void> {
  if (result.deliveredViaBrowser) {
    return;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.localUri, {
      mimeType: options.mimeType,
      dialogTitle: options.dialogTitle,
      UTI: options.mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
    });
    return;
  }

  try {
    await Linking.openURL(result.localUri);
  } catch {
    if (options.successMessage) {
      Alert.alert('Sucesso', options.successMessage);
    }
  }
}
