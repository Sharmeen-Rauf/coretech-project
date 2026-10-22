"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import UserModal from "@/components/UserModal";
import AdminPasswordReset from "@/components/AdminPasswordReset";
import DealerAssignment from "@/components/DealerAssignment";
import RoleManagement from "@/components/RoleManagement";
import toast from "react-hot-toast";
import { deleteUserAction, fetchUsersPageAction, fetchAllUsersForExportAction } from "@/app/actions/users";
import { getMyPermissionKeysAction } from "@/app/actions/roles";

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  designation: string;
  contact: string;
  group_name: string;
  status: string;
  role: string;
  created_at: string;
}

export default function UsersPage() {
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  // Active role filter based on URL query parameter (?role=employee|distributor...)
  const activeRole = searchParams.get("role") || "employee";

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | undefined>(undefined);

  const perPage = 30;
  const [pageTotalCount, setPageTotalCount] = useState(0);

  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set());
  const [canWrite, setCanWrite] = useState(false); // deny-until-resolved, same as other scoped pages

  useEffect(() => {
    const checkCurrentUserRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (prof) setCurrentUserProfile(prof);
      } catch (e) {
        console.warn("Failed to fetch session profile", e);
      }

      try {
        const permRes = await getMyPermissionKeysAction();
        setGrantedKeys(new Set(permRes.keys));
      } catch (e) {
        console.warn("Failed to fetch permissions", e);
      }
    };
    checkCurrentUserRole();
  }, [supabase]);

  // Guards against a slower, older request's response landing after a newer
  // one and clobbering it (e.g. switching tabs then typing a search char).
  const fetchRequestIdRef = useRef(0);

  const fetchUsers = async () => {
    const requestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    try {
      // Scoped + paginated + searched server-side (role_permissions.scope_level
      // for the matching users.add_* key) - replaces the old "fetch every
      // profile matching this role tab, filter/paginate in the browser"
      // approach (no range/limit at all, the same silent-1000-row-cap bug
      // already found and fixed elsewhere, never applied here).
      const res = await fetchUsersPageAction({ activeRole, page: currentPage, pageSize: perPage, search: searchQuery });
      if (requestId !== fetchRequestIdRef.current) return;
      if (!res.success) throw new Error(res.error);

      if (res.data.length === 0 && currentPage > 1 && res.totalCount > 0) {
        setUsers([]);
        setCurrentPage((p) => Math.max(1, p - 1));
        return;
      }

      setUsers(res.data);
      setPageTotalCount(res.totalCount);
      setCanWrite(!!res.canWrite);
    } catch (err: any) {
      if (requestId !== fetchRequestIdRef.current) return;
      toast.error(err.message || "Failed to fetch users");
    } finally {
      if (requestId === fetchRequestIdRef.current) setIsLoading(false);
    }
  };

  const fetchAllMatchingUsers = async (): Promise<UserProfile[]> => {
    const res = await fetchAllUsersForExportAction({ activeRole, search: searchQuery });
    if (!res.success) throw new Error(res.error || "Failed to load records");
    return res.data;
  };

  // Switching tabs resets back to page 1 with no search, independent of the
  // fetch effect below (which would otherwise fire with the previous tab's
  // stale page/search for one request before the reset took effect).
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery("");
  }, [activeRole]);

  const prevSearchQueryRef = useRef(searchQuery);
  useEffect(() => {
    if (activeRole === "reset_password" || activeRole === "dealer_assignment" || activeRole === "role_management") return;
    const searchChanged = prevSearchQueryRef.current !== searchQuery;
    prevSearchQueryRef.current = searchQuery;
    const handle = setTimeout(() => {
      fetchUsers();
    }, searchChanged ? 350 : 0);
    return () => clearTimeout(handle);
  }, [activeRole, currentPage, searchQuery]);

  // Handle Edit Action
  const handleEditClick = (user: UserProfile) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  // Handle Delete Action
  const handleDeleteUser = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to delete ${user.first_name} ${user.last_name}?`)) return;

    try {
      const res = await deleteUserAction(user.id);
      if (res.success) {
        toast.success(res.message || `${user.first_name} deleted successfully!`);
        fetchUsers();
      } else {
        toast.error(res.error || "Failed to delete user");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const handleBulkDeleteUsers = async (selectedIds: string[]) => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected users?`)) return;

    try {
      let deletedCount = 0;
      for (const id of selectedIds) {
        const res = await deleteUserAction(id);
        if (res.success) {
          deletedCount++;
        }
      }
      toast.success(`Successfully deleted ${deletedCount} users!`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to perform bulk deletion");
    }
  };

  // Handle Create Action
  const handleAddClick = () => {
    setEditingUser(undefined);
    setIsModalOpen(true);
  };


  const columns = [
    { key: "first_name", label: activeRole === "distributor" ? "Distributor Name" : activeRole === "sub_dealer" ? "Sub Dealer Name" : "First Name" },
    { key: "last_name", label: (activeRole === "distributor" || activeRole === "sub_dealer") ? "Owner Name" : "Last Name" },
    { key: "email", label: "Email Address" },
    {
      key: "designation",
      label: "Designation",
      render: (val: string, row: any) => {
        // Never render raw metadata JSON on screen - it may contain sensitive fields.
        if (val && (val.includes("[DISTRIBUTOR_METADATA]") || val.includes("[INSTALLER_METADATA]"))) {
          if (val.startsWith("[DISTRIBUTOR_METADATA]")) {
            try {
              const meta = JSON.parse(val.replace("[DISTRIBUTOR_METADATA]", ""));
              return meta.designation && !meta.designation.includes("METADATA")
                ? meta.designation
                : (row.role === "distributor" ? "Distributor" : "Installer");
            } catch (e) {
              return row.role === "distributor" ? "Distributor" : "Installer";
            }
          }
          return "Installer";
        }
        return val;
      }
    },
    { key: "contact", label: "Contact" },
    {
      key: "region",
      label: "System Region",
      render: (val: string, row: any) => {
        let displayRegion = val || row.warehouse || "";
        if (!displayRegion && typeof row.designation === "string" && row.designation.includes("DISTRIBUTOR_METADATA")) {
          try {
            const meta = JSON.parse(row.designation.replace("[DISTRIBUTOR_METADATA]", ""));
            displayRegion = meta.region || meta.warehouse || "";
          } catch (e) {}
        }
        return displayRegion ? (
          <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-extrabold uppercase">
            {displayRegion}
          </span>
        ) : (
          <span className="text-slate-400 text-xs italic">-</span>
        );
      }
    },
    {
      key: "group_name",
      label: "Group",
      render: (val: string) => (
        <span className="capitalize font-semibold text-slate-600">{val}</span>
      ),
    },
    { key: "status", label: "Status" },
  ];

  // Map activeRole to display titles
  const getRoleTitle = (r: string) => {
    switch (r) {
      case "employee":
        return "Employee";
      case "distributor":
        return "Distributor";
      case "sub_dealer":
        return "Sub Dealer";
      case "installer":
        return "Installer";
      default:
        return "User";
    }
  };

  const roleTitle = getRoleTitle(activeRole);

  const hasPermission = (key: string) => currentUserProfile?.role === "admin" || grantedKeys.has(key);

  if (activeRole === "reset_password") {
    if (currentUserProfile && !hasPermission("users.reset_password")) {
      return (
        <div className="space-y-2 select-none">
          <h1 className="text-2xl font-bold text-slate-800">Reset Password</h1>
          <p className="text-xs text-rose-500 font-semibold">Only admins can access this page.</p>
        </div>
      );
    }
    return (
      <div className="space-y-6 select-none">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reset Password</h1>
          <p className="text-xs text-slate-500">
            Generate a new password for any CoreTECH account.
          </p>
        </div>
        <AdminPasswordReset />
      </div>
    );
  }

  if (activeRole === "role_management") {
    if (currentUserProfile && !hasPermission("users.role_management")) {
      return (
        <div className="space-y-2 select-none">
          <h1 className="text-2xl font-bold text-slate-800">Role Management</h1>
          <p className="text-xs text-rose-500 font-semibold">Only admins can access this page.</p>
        </div>
      );
    }
    return <RoleManagement />;
  }

  if (activeRole === "dealer_assignment") {
    if (currentUserProfile && !hasPermission("users.dealer_assignment")) {
      return (
        <div className="space-y-2 select-none">
          <h1 className="text-2xl font-bold text-slate-800">Dealer Assignment</h1>
          <p className="text-xs text-rose-500 font-semibold">Only admins can access this page.</p>
        </div>
      );
    }
    return (
      <div className="space-y-6 select-none">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dealer Assignment</h1>
          <p className="text-xs text-slate-500">
            Map sub dealers to the distributor they operate under.
          </p>
        </div>
        <DealerAssignment />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none">
      {/* Breadcrumbs / Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Users</h1>
          <p className="text-xs text-slate-500">
            Manage and register CoreTECH {roleTitle}s.
          </p>
        </div>
      </div>

      {/* Reusable Data Table Component */}
      <DataTable
        title={`${roleTitle} Register`}
        columns={columns}
        data={users}
        isLoading={isLoading}
        searchPlaceholder={`Search ${roleTitle}s...`}
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        onFetchAll={fetchAllMatchingUsers}
        actionButton={canWrite ? {
          label: `Add ${roleTitle}`,
          onClick: handleAddClick,
        } : undefined}
        pagination={{
          current: currentPage,
          total: pageTotalCount,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        onEditClick={canWrite ? handleEditClick : undefined}
        onDeleteClick={canWrite ? handleDeleteUser : undefined}
        onBulkDelete={canWrite ? handleBulkDeleteUsers : undefined}
      />

      {/* User Management Form Modal */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        role={roleTitle}
        onSuccess={fetchUsers}
        editingUser={editingUser}
      />
    </div>
  );
}
