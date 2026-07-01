"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import UserModal from "@/components/UserModal";
import toast from "react-hot-toast";
import { deleteUserAction } from "@/app/actions/users";

interface InstallerProfile {
  id: string;
  first_name: string;
  last_name: string;
  designation: string;
  contact: string;
  group_name: string;
  status: string;
  role: string;
  created_at: string;
}

export default function InstallerListPage() {
  const supabase = createClientComponentClient();

  const [installers, setInstallers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(undefined);
  const perPage = 10;

  const fetchInstallers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "installer")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((prof: any) => ({
        ...prof,
        installer_id: prof.id.substring(0, 8).toUpperCase(), // readable installer ID prefix
        installer_name: `${prof.first_name} ${prof.last_name || ""}`.trim(),
      }));

      setInstallers(formatted);
    } catch (err: any) {
      toast.error(err.message || "Failed to load installers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallers();
  }, []);

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (user: any) => {
    if (window.confirm(`Are you sure you want to delete installer ${user.installer_name}?`)) {
      const res = await deleteUserAction(user.id);
      if (res.success) {
        toast.success(res.message || "Installer deleted successfully");
        fetchInstallers();
      } else {
        toast.error(res.error || "Failed to delete user");
      }
    }
  };

  const filtered = installers.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.installer_name.toLowerCase().includes(q) ||
      item.installer_id.toLowerCase().includes(q) ||
      item.contact.includes(q)
    );
  });

  const paginated = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const columns = [
    { key: "installer_id", label: "Installer ID" },
    {
      key: "installer_name",
      label: "Installer Name",
      render: (val: string) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#F0FAFE] text-[#00B4D8] font-bold text-[10px] flex items-center justify-center border border-[#00B4D8]/20">
            {val.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-slate-700">{val}</span>
        </div>
      ),
    },
    { key: "designation", label: "Designation" },
    { key: "contact", label: "Contact Phone" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Installers</h1>
        <p className="text-xs text-slate-500">
          Monitor registration, designation and active status for installation field staff.
        </p>
      </div>

      <DataTable
        title="Installers Register"
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        searchPlaceholder="Search Installer ID or Name..."
        onSearch={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        pagination={{
          current: currentPage,
          total: filtered.length,
          perPage: perPage,
          onChange: (page) => setCurrentPage(page),
        }}
        actionButton={{
          label: "Add Installer",
          onClick: () => {
            setEditingUser(undefined);
            setIsModalOpen(true);
          }
        }}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        role="Installer"
        onSuccess={fetchInstallers}
        editingUser={editingUser}
      />
    </div>
  );
}
