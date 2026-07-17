import { mimeFromFilename, isWebDownloadPlatform } from '../platformDownload';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn() },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

describe('platformDownload', () => {
  it('isWebDownloadPlatform quando Platform.OS é web', () => {
    expect(isWebDownloadPlatform()).toBe(true);
  });

  it('mimeFromFilename infere pdf e xml', () => {
    expect(mimeFromFilename('guia.pdf')).toBe('application/pdf');
    expect(mimeFromFilename('nota.XML')).toBe('application/xml');
    expect(mimeFromFilename('outro.bin')).toBe('application/octet-stream');
  });
});
