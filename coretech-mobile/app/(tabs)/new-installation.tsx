import { useEffect } from "react";
import { useRouter } from "expo-router";

// Safety-net screen only - the "+" tab button in _layout.tsx intercepts the
// tab press and pushes /job/new directly, so this should never actually
// render. Exists in case some other code path ever navigates here directly.
export default function NewInstallationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(tabs)/jobs");
  }, []);
  return null;
}
