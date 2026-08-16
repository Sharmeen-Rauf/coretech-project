"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import UserModal from "@/components/UserModal";
import AdminPasswordReset from "@/components/AdminPasswordReset";
import DealerAssignment from "@/components/DealerAssignment";
import toast from "react-hot-toast";
import { deleteUserAction, fetchEmailsByIdsAction } from "@/app/actions/users";

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

      const profilesRes = await query.order("created_at", { ascending: false });
      if (profilesRes.error) throw profilesRes.error;
      const profiles = profilesRes.data || [];

      // Real emails live in auth.users - profiles has no email column of its own.
      const emailsRes = await fetchEmailsByIdsAction(profiles.map((p: any) => p.id));
      const emailMap = emailsRes.success ? emailsRes.data : {};

      let formattedProfiles = (profiles || []).map((prof: any) => ({
        ...prof,
        email: emailMap[prof.id] || "",
      }));

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
    if (activeRole === "reset_password" || activeRole === "dealer_assignment") return;
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

  if (activeRole === "reset_password") {
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

  if (activeRole === "dealer_assignment") {
    if (currentUserProfile && currentUserProfile.role !== "admin") {
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
