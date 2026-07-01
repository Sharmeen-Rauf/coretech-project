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

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", activeRole)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Email addresses are stored in auth.users, but for local/demo dashboard flexibility,
      // we can parse or assign default email patterns if not loaded in profiles.
      // If we need emails, we can query auth user profiles or fallback.
      const formattedProfiles = (profiles || []).map((prof: any) => ({
        ...prof,
        email: prof.email || `${prof.first_name.toLowerCase()}.${prof.last_name.toLowerCase() || "user"}@coretech.com`,
      }));

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
    { key: "designation", label: "Designation" },
    { key: "contact", label: "Contact" },
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
      <DataTable
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
