import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { API_BASE_URL } from "./installerAccess";

const QUEUE_KEY = "coretech_offline_submissions";

export type QueuedSubmission = {
  payload: any;
  siteFormJobId: string;
  queuedAt: string;
};

// Mirrors what the web installer page already does with localStorage - a
// failed submission (bad connection, server hiccup) shouldn't just vanish.
// Saved locally here, retried automatically the next time something calls
// syncOfflineSubmissions() with a working connection (jobs.tsx does this on
// load, same as the web page's own fetchInstallerData does on mount).
export async function queueOfflineSubmission(item: { payload: any; siteFormJobId: string }) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: QueuedSubmission[] = raw ? JSON.parse(raw) : [];
  queue.push({ ...item, queuedAt: new Date().toISOString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueuedSubmissionCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: QueuedSubmission[] = raw ? JSON.parse(raw) : [];
  return queue.length;
}

export async function syncOfflineSubmissions(): Promise<{ synced: number; remaining: number }> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: QueuedSubmission[] = raw ? JSON.parse(raw) : [];
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return { synced: 0, remaining: queue.length };

  const stillQueued: QueuedSubmission[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/installer/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payload: item.payload, siteFormJobId: item.siteFormJobId }),
      });
      const json = await res.json();
      if (json.success) {
        synced++;
      } else {
        stillQueued.push(item);
      }
    } catch {
      stillQueued.push(item);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(stillQueued));
  return { synced, remaining: stillQueued.length };
}
