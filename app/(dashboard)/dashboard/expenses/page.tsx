"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { Loader2, Plus, X, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { fetchExpensesAction, submitExpenseAction, deleteExpenseAction } from "@/app/actions/expenses";

interface ExpenseRow {
  id: string;
  user_name: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  description: string;
}

export default function ExpensesPage() {
  const supabase = createClientComponentClient();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false); // deny-until-resolved, same as other scoped pages

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("travel");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Scoped server-side (role_permissions.scope_level for "expenses") via
      // getCallerIdentity - not a client-resolved role, which was the only real
      // barrier here given expenses' fully permissive RLS policy.
      let dbData: any[] = [];
      try {
        const res = await fetchExpensesAction();
        if (!res.success) throw new Error(res.error);
        dbData = res.data || [];
        setCanWrite(!!res.canWrite);
      } catch (dbErr) {
        console.warn("Failed to fetch expenses from Supabase. Using local fallback.", dbErr);
      }

      const { mergeLocalItems } = require("@/lib/supabaseLocalFallback");
      const merged = mergeLocalItems(dbData, "coretech_local_expenses");
 
      const formatted: ExpenseRow[] = merged.map((row: any) => ({
        id: row.id,
        user_name: row.profile ? `${row.profile.first_name} ${row.profile.last_name || ""}`.trim() : "System User",
        title: row.title,
        amount: Number(row.amount),
        category: row.category,
        date: row.date ? new Date(row.date).toLocaleDateString() : "-",
        description: row.description || "-",
      }));
 
      setExpenses(formatted);
    } catch (err: any) {
      console.error("fetchExpenses error:", err);
    } finally {
      setIsLoading(false);
    }
  };
 
  useEffect(() => {
    fetchExpenses();
  }, []);
 
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || !date) {
      toast.error("Please fill in all required fields");
      return;
    }
 
    setIsSubmitting(true);
    try {
      // Real server action now, gated by role_permissions.can_write for "expenses" -
      // an explicit denial must never fall back to local storage, since that would
      // let a read-only user "submit" locally as if the write actually went through.
      const res = await submitExpenseAction({
        title, amount: parseFloat(amount), category, date, description,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to submit expense");
        return;
      }
      toast.success("Expense claim successfully submitted!");
      setIsModalOpen(false);
      setTitle("");
      setAmount("");
      setDescription("");
      fetchExpenses();
    } catch (err: any) {
      // Genuine unexpected failure (network, etc.), not a permission denial - the
      // local fallback still makes sense here.
      console.warn("submitExpenseAction failed unexpectedly. Falling back to local storage.", err);
      const { saveLocalItem } = require("@/lib/supabaseLocalFallback");
      saveLocalItem("coretech_local_expenses", {
        title, amount: parseFloat(amount), category, date, description, status: "pending",
      });
      toast.success("Expense claim successfully submitted locally (Database fallback)!");
      setIsModalOpen(false);
      setTitle("");
      setAmount("");
      setDescription("");
      fetchExpenses();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this expense entry? This cannot be undone.")) return;

    try {
      const res = await deleteExpenseAction(id);
      if (!res.success) {
        toast.error(res.error || "Failed to delete expense");
        return;
      }

      const { deleteLocalItem } = require("@/lib/supabaseLocalFallback");
      deleteLocalItem("coretech_local_expenses", id, "id");

      toast.success("Expense entry deleted successfully!");
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete expense");
    }
  };

  const baseColumns = [
    { key: "user_name", label: "Employee" },
    { key: "title", label: "Title" },
    {
      key: "amount",
      label: "Amount",
      render: (val: number) => <span className="font-bold text-slate-700">Rs. {val.toLocaleString()}</span>,
    },
    {
      key: "category",
      label: "Category",
      render: (val: string) => <span className="capitalize">{val}</span>,
    },
    { key: "date", label: "Date" },
  ];

  // Expenses is a log, not an approval workflow - Delete is the only action left,
  // shown to anyone with real write access (not tied to a specific role).
  const columns = !canWrite ? baseColumns : [
    ...baseColumns,
    {
      key: "id",
      label: "Actions",
      render: (val: string) => (
        <button
          onClick={() => handleDeleteExpense(val)}
          className="p-1 hover:bg-rose-50 text-rose-600 rounded border border-rose-100 transition-colors"
          title="Delete Entry"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const paginated = expenses.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expense Management</h1>
          <p className="text-xs text-slate-500">
            Submit business expense claims and manage approvals.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => {
              const today = new Date().toLocaleDateString('en-CA');
              setDate(today);
              setIsModalOpen(true);
            }}
            className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit Expense
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
        <DataTable allData={expenses}
          title="Expenses Ledger"
          columns={columns}
          data={paginated}
          isLoading={false}
          searchPlaceholder="Search Expenses..."
          pagination={{
            current: currentPage,
            total: expenses.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      )}

      {/* Expense Submission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Submit Expense Claim
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Title*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fuel Allowance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Category*
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                  >
                    <option value="travel">Travel & Fuel</option>
                    <option value="meals">Meals</option>
                    <option value="hardware">Hardware / Parts</option>
                    <option value="office">Office Supplies</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Amount (PKR)*
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Date*
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Provide brief details about this expense..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold border border-slate-200 hover:bg-slate-100 rounded-[6px] text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs font-semibold text-white bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
