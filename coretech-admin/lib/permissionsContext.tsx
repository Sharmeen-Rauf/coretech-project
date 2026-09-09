import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchMyPermissions } from "./api";

interface PermissionsState {
  loading: boolean;
  keys: string[];
}

const PermissionsContext = createContext<PermissionsState>({ loading: true, keys: [] });

// Fetched once per app session by the tabs shell, shared by every screen
// that needs to know what the caller is granted (the bottom bar's two
// conditional slots, the Home icon grid) - avoids each screen independently
// re-fetching the same /api/mobile/me call.
export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PermissionsState>({ loading: true, keys: [] });

  useEffect(() => {
    fetchMyPermissions()
      .then((res) => setState({ loading: false, keys: res.success ? res.keys || [] : [] }))
      .catch(() => setState({ loading: false, keys: [] }));
  }, []);

  return <PermissionsContext.Provider value={state}>{children}</PermissionsContext.Provider>;
}

export function useMyPermissions(): PermissionsState {
  return useContext(PermissionsContext);
}
