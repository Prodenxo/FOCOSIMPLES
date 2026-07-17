import AsyncStorage from '@react-native-async-storage/async-storage';

const IDS_KEY = 'mf_google_meet_event_ids_v1';
const LINKS_KEY = 'mf_google_meet_event_links_v1';

let idsCache: Set<string> | null = null;
let linksCache: Record<string, string> | null = null;

async function ensureLoaded(): Promise<void> {
  if (idsCache && linksCache) return;
  const [idsRaw, linksRaw] = await Promise.all([
    AsyncStorage.getItem(IDS_KEY),
    AsyncStorage.getItem(LINKS_KEY),
  ]);
  idsCache = new Set(JSON.parse(idsRaw || '[]') as string[]);
  linksCache = JSON.parse(linksRaw || '{}') as Record<string, string>;
}

export async function initMeetEventsCache(): Promise<void> {
  await ensureLoaded();
}

export function isAppMeetEventSync(eventId: string): boolean {
  return idsCache?.has(eventId) ?? false;
}

export function getCachedMeetLinkSync(eventId: string): string | undefined {
  return linksCache?.[eventId];
}

function isMeetUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === 'meet.google.com' || host.endsWith('.meet.google.com');
  } catch {
    return false;
  }
}

export async function rememberAppMeetEvent(
  eventId: string,
  hangoutLink?: string | null,
): Promise<void> {
  if (!eventId) return;
  await ensureLoaded();
  idsCache!.add(eventId);
  if (isMeetUrl(hangoutLink)) {
    linksCache![eventId] = hangoutLink!.trim();
  }
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify([...idsCache!]));
  await AsyncStorage.setItem(LINKS_KEY, JSON.stringify(linksCache));
}

export async function forgetAppMeetEvent(eventId: string): Promise<void> {
  if (!eventId) return;
  await ensureLoaded();
  idsCache!.delete(eventId);
  delete linksCache![eventId];
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify([...idsCache!]));
  await AsyncStorage.setItem(LINKS_KEY, JSON.stringify(linksCache));
}
