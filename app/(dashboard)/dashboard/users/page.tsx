"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import UserModal from "@/components/UserModal";
import toast from "react-hot-toast";
import { deleteUserAction } from "@/app/actions/users";

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

  const perPage = 10;

  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

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
    };
    checkCurrentUserRole();
  }, [supabase]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from("profiles").select("*");
      if (activeRole === "employee") {
        query = query.in("role", ["employee", "rsm", "country_head", "retail_manager", "admin", "marketing_manager"]);
      } else {
        query = query.eq("role", activeRole);
      }

      // Parallel execution of profiles and allowed_users whitelist
      const [profilesRes, allowedRes] = await Promise.all([
        query.order("created_at", { ascending: false }),
        supabase.from("allowed_users").select("id, email")
      ]);

      if (profilesRes.error) throw profilesRes.error;
      const profiles = profilesRes.data || [];

      const allowedMap = new Map<string, string>();
      if (allowedRes.data) {
        allowedRes.data.forEach((u: any) => {
          if (u.id && u.email) allowedMap.set(u.id, u.email.trim());
        });
      }

      // 3. Resolve actual user email addresses & region filtering
      let formattedProfiles = (profiles || []).map((prof: any) => {
        let actualEmail = prof.email || allowedMap.get(prof.id) || "";

        // Check nested metadata for email if not found
        if (!actualEmail && typeof prof.designation === "string") {
          try {
            if (prof.designation.includes("INSTALLER_METADATA")) {
              const cleanVal = prof.designation.replace("[DISTRIBUTOR_METADATA]", "");
              const outer = JSON.parse(cleanVal);
              const innerVal = outer.designation || "";
              if (innerVal.startsWith("[INSTALLER_METADATA]")) {
                const innerParsed = JSON.parse(innerVal.replace("[INSTALLER_METADATA]", ""));
                if (innerParsed.email) actualEmail = innerParsed.email;
              } else if (outer.email) {
                actualEmail = outer.email;
              }
            } else if (prof.designation.startsWith("[DISTRIBUTOR_METADATA]")) {
              const parsed = JSON.parse(prof.designation.replace("[DISTRIBUTOR_METADATA]", ""));
              if (parsed.email) actualEmail = parsed.email;
            }
          } catch (e) {}
        }

        // Clean fallback email if none registered
        if (!actualEmail) {
          const nameSlug = `${prof.first_name || "user"}${prof.last_name ? "." + prof.last_name : ""}`.toLowerCase().replace(/[^a-z0-9.]/g, "");
          actualEmail = `${nameSlug}@gmail.com`;
        }

        return {
          ...prof,
          email: actualEmail,
        };
      });

      // 4. Strict Regional Data Isolation for RSM Users
      const isRsmUser = currentUserProfile && (currentUserProfile.role === "rsm" || currentUserProfile.group_name === "rsm");
      if (isRsmUser && currentUserProfile.region) {
        const rsmRegionLower = currentUserProfile.region.toLowerCase().trim();
        formattedProfiles = formattedProfiles.filter((u: any) => {
          if (u.id === currentUserProfile.id) return true;
          const uRegionLower = (u.region || "").toLowerCase().trim();
          return uRegionLower === rsmRegionLower;
        });
      }

      setUsers(formattedProfiles);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    setCurrentPage(1);
    setSearchQuery("");
  }, [activeRole]);

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

  // Filter users based on search
  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      user.first_name.toLowerCase().includes(q) ||
      user.last_name.toLowerCase().includes(q) ||
      (user.email && user.email.toLowerCase().includes(q)) ||
      user.designation.toLowerCase().includes(q) ||
      user.contact.includes(q) ||
      user.group_name.toLowerCase().includes(q)
    );
  });

  // Paginated chunk
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const columns = [
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "email", label: "Email Address" },
    {
      key: "designation",
      label: "Designation",
      render: (val: string, row: any) => {
        if (val && val.startsWith("[DISTRIBUTOR_METADATA]")) {
          try {
            const meta = JSON.parse(val.replace("[DISTRIBUTOR_METADATA]", ""));
            return meta.designation || (row.role === "distributor" ? "Distributor" : "");
          } catch (e) {
            return row.role === "distributor" ? "Distributor" : "";
          }
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
      <DataTable allData={filteredUsers}
        title={`${roleTitle} Register`}
        columns={columns}
        data={paginatedUsers}
        isLoading={isLoading}
        searchPlaceholder={`Search ${roleTitle}s...`}
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        actionButton={{
          label: `Add ${roleTitle}`,
          onClick: handleAddClick,
        }}
        pagination={{
          current: currentPage,
          total: filteredUsers.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteUser}
        onBulkDelete={handleBulkDeleteUsers}
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
