import { Directory, Paths } from 'expo-file-system';

/** Diretório base (cache ou documents) para downloads temporários no Expo SDK 54+. */
export function getCacheOrDocumentDirectory(): Directory {
  const dir = Paths.cache ?? Paths.document;
  if (!dir) throw new Error('Local directory not available.');
  return dir;
}
