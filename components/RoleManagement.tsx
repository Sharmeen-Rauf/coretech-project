"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Lock, Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import {
  fetchRolesAction,
  fetchRolePermissionsAction,
  createRoleAction,
  updateRolePermissionsAction,
  deleteRoleAction,
} from "@/app/actions/roles";
import { PERMISSION_CATALOG, ScopeLevel } from "@/lib/permissionCatalog";

interface RoleRow {
  id: string;
  name: string;
  display_name: string;
  is_system_role: boolean;
  granted_count: number;
}

interface PermRow {
  permission_key: string;
  granted: boolean;
  locked: boolean;
  scope_level: ScopeLevel;
  can_write: boolean;
  mobile_granted: boolean;
  mobile_scope_level: ScopeLevel;
  mobile_can_write: boolean;
}

const SCOPE_LABELS: Record<ScopeLevel, string> = { self: "Self only", region: "My region", everything: "Everything" };

export default function RoleManagement() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [modalDisplayName, setModalDisplayName] = useState("");
  const [modalPerms, setModalPerms] = useState<Record<string, PermRow>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  const loadRoles = async () => {
    setIsLoading(true);
    const res = await fetchRolesAction();
    if (res.success) setRoles(res.data as RoleRow[]);
    else toast.error(res.error || "Failed to load roles");
    setIsLoading(false);
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const openCreate = () => {
    setEditingRole(null);
    setModalDisplayName("");
    const empty: Record<string, PermRow> = {};
    PERMISSION_CATALOG.forEach((g) => g.items.forEach((i) => {
      empty[i.key] = { permission_key: i.key, granted: false, locked: false, scope_level: "everything", can_write: true, mobile_granted: false, mobile_scope_level: "everything", mobile_can_write: true };
    }));
    setModalPerms(empty);
    setIsModalOpen(true);
  };

  const openEdit = async (role: RoleRow) => {
    setEditingRole(role);
    setModalDisplayName(role.display_name);
    setIsModalOpen(true);
    setIsModalLoading(true);
    const res = await fetchRolePermissionsAction(role.id);
    if (res.success) {
      // Start from catalog defaults (same base openCreate uses) so a
      // permission key added to the catalog after this role's row was last
      // saved still gets a real, toggleable entry - without this, editing an
      // existing role could only ever act on keys that already had a
      // role_permissions row, silently no-opping the checkbox for anything
      // newer. Fetched rows then override the defaults for whatever this
      // role actually has saved.
      const map: Record<string, PermRow> = {};
      PERMISSION_CATALOG.forEach((g) => g.items.forEach((i) => {
        map[i.key] = { permission_key: i.key, granted: false, locked: false, scope_level: "everything", can_write: true, mobile_granted: false, mobile_scope_level: "everything", mobile_can_write: true };
      }));
      (res.data as PermRow[]).forEach((p) => { map[p.permission_key] = p; });
      setModalPerms(map);
    } else {
      toast.error(res.error || "Failed to load role permissions");
    }
    setIsModalLoading(false);
  };

  const togglePerm = (key: string) => {
    setModalPerms((prev) => {
      const row = prev[key];
      if (!row || row.locked) return prev; // locked rows can't be toggled client-side either
      const granting = !row.granted;
      // A fresh grant defaults to Read/Write rather than inheriting whatever
      // can_write happened to be left over from before (e.g. a prior revoke) -
      // otherwise re-checking a box can silently save as read-only with no
      // visual cue, since the write dropdown only reflects existing state and
      // easy to not double check.
      return { ...prev, [key]: { ...row, granted: granting, can_write: granting ? true : row.can_write } };
    });
  };

  const setScope = (key: string, scope: ScopeLevel) => {
    setModalPerms((prev) => {
      const row = prev[key];
      if (!row || row.locked) return prev;
      return { ...prev, [key]: { ...row, scope_level: scope } };
    });
  };

  const setWrite = (key: string, canWrite: boolean) => {
    setModalPerms((prev) => {
      const row = prev[key];
      if (!row || row.locked) return prev;
      return { ...prev, [key]: { ...row, can_write: canWrite } };
    });
  };

  // Mobile toggles are independent of `locked` (§9 - mobile has no locked
  // concept of its own yet) and of the row's web `granted` state.
  const toggleMobilePerm = (key: string) => {
    setModalPerms((prev) => {
      const row = prev[key];
      if (!row) return prev;
      const granting = !row.mobile_granted;
      return { ...prev, [key]: { ...row, mobile_granted: granting, mobile_can_write: granting ? true : row.mobile_can_write } };
    });
  };

  const setMobileScope = (key: string, scope: ScopeLevel) => {
    setModalPerms((prev) => {
      const row = prev[key];
      if (!row) return prev;
      return { ...prev, [key]: { ...row, mobile_scope_level: scope } };
    });
  };

  const setMobileWrite = (key: string, canWrite: boolean) => {
    setModalPerms((prev) => {
      const row = prev[key];
      if (!row) return prev;
      return { ...prev, [key]: { ...row, mobile_can_write: canWrite } };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const grants = Object.values(modalPerms)
        .filter((p) => p.granted)
        .map((p) => ({ key: p.permission_key, scope: p.scope_level, canWrite: p.can_write }));
      const mobileGrants = Object.values(modalPerms)
        .filter((p) => p.mobile_granted)
        .map((p) => ({ key: p.permission_key, scope: p.mobile_scope_level, canWrite: p.mobile_can_write }));

      if (editingRole) {
        const res = await updateRolePermissionsAction(editingRole.id, grants, mobileGrants, editingRole.is_system_role ? undefined : modalDisplayName);
        if (!res.success) { toast.error(res.error || "Failed to update role"); return; }
        toast.success("Role updated");
      } else {
        const createRes = await createRoleAction(modalDisplayName);
        if (!createRes.success || !createRes.roleId) { toast.error(createRes.error || "Failed to create role"); return; }
        const permRes = await updateRolePermissionsAction(createRes.roleId, grants, mobileGrants);
        if (!permRes.success) { toast.error(permRes.error || "Role created, but permissions failed to save"); return; }
        toast.success("Role created");
      }

      setIsModalOpen(false);
      loadRoles();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (role: RoleRow) => {
    if (role.is_system_role) return;
    if (!window.confirm(`Delete role "${role.display_name}"? This can't be undone.`)) return;
    const res = await deleteRoleAction(role.id);
    if (!res.success) { toast.error(res.error || "Failed to delete role"); return; }
    toast.success("Role deleted");
    loadRoles();
  };

  return (
    <div className="space-y-6 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Role Management</h1>
          <p className="text-xs text-slate-500">Control which tabs each role can access. System roles with real approval logic behind them show a lock icon and can't be revoked.</p>
        </div>
        <button
          onClick={openCreate}
          className="h-9 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-bold rounded-[6px] shadow flex items-center gap-1.5 transition-all hover:scale-105"
        >
          <Plus className="w-3.5 h-3.5" /> Create Role
        </button>
      </div>

      {/* overflow-hidden here exists to clip the rounded corners, but it also
          clips the table itself - on a phone the Actions column was cut off
          and unreachable rather than scrollable. Restoring horizontal scroll
          on small screens only; the corner clipping is unchanged above 640px,
          where the table has never needed to scroll. */}
      <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden shadow-sm max-sm:overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs max-sm:min-w-[520px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/40">
              <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Role</th>
              <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Tabs Granted</th>
              <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {isLoading ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>
            ) : roles.map((role) => (
              <tr key={role.id} className="hover:bg-slate-50/30">
                <td className="px-5 py-3 font-bold text-slate-800">{role.display_name}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${role.is_system_role ? "bg-slate-50 text-slate-500 border-slate-200" : "bg-cyan-50 text-cyan-600 border-cyan-100"}`}>
                    {role.is_system_role ? "System" : "Custom"}
                  </span>
                </td>
                <td className="px-5 py-3">{role.granted_count}</td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => openEdit(role)} className="p-1.5 hover:bg-slate-100 text-slate-500 rounded border border-slate-200">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!role.is_system_role && (
                      <button onClick={() => handleDelete(role)} className="p-1.5 hover:bg-rose-50 text-rose-500 rounded border border-rose-100">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
          <div className="relative bg-white w-full max-w-2xl border border-slate-200 rounded-[12px] shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">{editingRole ? "Edit Role" : "Create Role"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-full"><X className="w-4 h-4" /></button>
            </div>

            {!editingRole && (
              <input
                type="text" placeholder="Role Name (e.g. Warehouse Clerk)"
                value={modalDisplayName}
                onChange={(e) => setModalDisplayName(e.target.value)}
                className="w-full h-10 px-3 mb-4 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00B4D8]"
              />
            )}
            {editingRole && !editingRole.is_system_role && (
              <input
                type="text" placeholder="Role Name"
                value={modalDisplayName}
                onChange={(e) => setModalDisplayName(e.target.value)}
                className="w-full h-10 px-3 mb-4 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00B4D8]"
              />
            )}
            {editingRole && editingRole.is_system_role && (
              <div className="mb-4 text-xs text-slate-500">
                <span className="font-bold text-slate-800">{editingRole.display_name}</span> is a system role - its name can't be changed.
              </div>
            )}

            <div className="overflow-y-auto flex-1 pr-1">
              {isModalLoading ? (
                <div className="text-center py-8 text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
              ) : (
                <div className="space-y-4">
                  {PERMISSION_CATALOG.map((group) => (
                    <div key={group.groupKey}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{group.groupLabel}</p>
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const row = modalPerms[item.key];
                          const granted = row?.granted || false;
                          const locked = row?.locked || false;
                          const scope = row?.scope_level || "everything";
                          const canWrite = row?.can_write !== false;
                          const scopeOptions = item.supportedScopes;

                          const mobileEligible = item.mobileEligible === true;
                          const mobileWriteEligible = item.mobileWriteEligible !== false;
                          const mobileScopeOptions = item.mobileSupportedScopes || scopeOptions;
                          const mobileGranted = row?.mobile_granted || false;
                          const mobileScope = row?.mobile_scope_level || "everything";
                          const mobileCanWrite = row?.mobile_can_write !== false;

                          return (
                            <div key={item.key} className={`rounded-[6px] ${locked ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                              <div className={`flex items-center gap-2 px-2 py-1.5 text-xs font-semibold ${locked ? "text-slate-400" : "text-slate-700"}`}>
                                <label className="flex items-center gap-2 cursor-pointer flex-1">
                                  <input
                                    type="checkbox"
                                    checked={granted}
                                    disabled={locked}
                                    onChange={() => togglePerm(item.key)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#00B4D8] focus:ring-[#00B4D8] disabled:opacity-60"
                                  />
                                  <span>{item.label}</span>
                                  {locked && (
                                    <span title="This role's access here is tied to real approval logic in the app and can't be changed">
                                      <Lock className="w-3 h-3 text-slate-400" />
                                    </span>
                                  )}
                                </label>
                                {granted && !locked && scopeOptions && scopeOptions.length > 1 && (
                                  <select
                                    value={scope}
                                    onChange={(e) => setScope(item.key, e.target.value as ScopeLevel)}
                                    className="h-6 px-1.5 border border-slate-200 rounded text-[10px] font-semibold text-slate-600 focus:outline-none focus:border-[#00B4D8]"
                                  >
                                    {scopeOptions.map((opt) => (
                                      <option key={opt} value={opt}>{SCOPE_LABELS[opt]}</option>
                                    ))}
                                  </select>
                                )}
                                {granted && !locked && (
                                  <select
                                    value={canWrite ? "write" : "read"}
                                    onChange={(e) => setWrite(item.key, e.target.value === "write")}
                                    className="h-6 px-1.5 border border-slate-200 rounded text-[10px] font-semibold text-slate-600 focus:outline-none focus:border-[#00B4D8]"
                                  >
                                    <option value="write">Read/Write</option>
                                    <option value="read">Read Only</option>
                                  </select>
                                )}
                              </div>

                              {/* Mobile column - fully independent of the web row above (§9).
                                  Greyed out and un-clickable when this permission has no mobile
                                  screen at all (mobileEligible false), not just left unchecked. */}
                              <div className={`flex items-center gap-2 pl-7 pr-2 py-1 text-[11px] ${mobileEligible ? "text-slate-500" : "text-slate-300"}`}>
                                <span className="text-[9px] font-bold uppercase tracking-wider w-11 shrink-0">Mobile</span>
                                {!mobileEligible ? (
                                  <span className="italic">Not available on mobile</span>
                                ) : (
                                  <>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={mobileGranted}
                                        onChange={() => toggleMobilePerm(item.key)}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-[#00B4D8] focus:ring-[#00B4D8]"
                                      />
                                      <span className="font-semibold">Granted</span>
                                    </label>
                                    {mobileGranted && mobileScopeOptions && mobileScopeOptions.length > 1 && (
                                      <select
                                        value={mobileScope}
                                        onChange={(e) => setMobileScope(item.key, e.target.value as ScopeLevel)}
                                        className="h-6 px-1.5 border border-slate-200 rounded text-[10px] font-semibold text-slate-600 focus:outline-none focus:border-[#00B4D8]"
                                      >
                                        {mobileScopeOptions.map((opt) => (
                                          <option key={opt} value={opt}>{SCOPE_LABELS[opt]}</option>
                                        ))}
                                      </select>
                                    )}
                                    {mobileGranted && mobileWriteEligible && (
                                      <select
                                        value={mobileCanWrite ? "write" : "read"}
                                        onChange={(e) => setMobileWrite(item.key, e.target.value === "write")}
                                        className="h-6 px-1.5 border border-slate-200 rounded text-[10px] font-semibold text-slate-600 focus:outline-none focus:border-[#00B4D8]"
                                      >
                                        <option value="write">Read/Write</option>
                                        <option value="read">Read Only</option>
                                      </select>
                                    )}
                                    {mobileGranted && !mobileWriteEligible && (
                                      <span
                                        className="italic"
                                        title="No write screen is built for this on mobile - it's view only regardless of this setting"
                                      >
                                        View only (app-level)
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
              <button onClick={() => setIsModalOpen(false)} className="h-9 px-4 text-xs font-semibold hover:bg-slate-100 rounded-[6px] text-slate-500">Cancel</button>
              <button
                onClick={handleSave}
                disabled={isSaving || isModalLoading || (!editingRole && !modalDisplayName.trim())}
                className="h-9 px-5 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-[6px] shadow flex items-center gap-1.5"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingRole ? "Save Changes" : "Create Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
