"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import { Loader2, Plus, X, CreditCard, DollarSign } from "lucide-react";
import toast from "react-hot-toast";

interface InvoiceRow {
  id: string;
  invoice_code: string;
  order_code: string;
  distributor_name: string;
  amount: number;
  due_date: string;
  payment_status: string;
}

export default function InvoicesPage() {
  const supabase = createClientComponentClient();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedDistributorId, setSelectedDistributorId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selector data
  const [orders, setOrders] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch invoices
      const { data: invData, error: invError } = await supabase
        .from("invoices")
        .select(`
          id,
          invoice_code,
          amount,
          due_date,
          payment_status,
          order:orders(order_code),
          distributor:profiles!distributor_id(first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (invError) throw invError;

      const formatted: InvoiceRow[] = (invData || []).map((row: any) => ({
        id: row.id,
        invoice_code: row.invoice_code,
        order_code: row.order?.order_code || "-",
        distributor_name: row.distributor ? `${row.distributor.first_name} ${row.distributor.last_name || ""}`.trim() : "-",
        amount: Number(row.amount),
        due_date: row.due_date ? new Date(row.due_date).toLocaleDateString() : "-",
        payment_status: row.payment_status,
      }));

      setInvoices(formatted);

      // 2. Fetch completed orders that need invoices
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, order_code, product_id, products(price)")
        .eq("status", "complete");
      setOrders(orderData || []);

      // 3. Fetch distributors
      const { data: distData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("role", "distributor");
      setDistributors(distData || []);
    } catch (err: any) {
      console.error("Failed to load invoice parameters", err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || !selectedDistributorId || !amount || !dueDate) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const invoiceCode = `#INV${randomDigits}`;

      const { error } = await supabase.from("invoices").insert({
        invoice_code: invoiceCode,
        order_id: selectedOrderId,
        distributor_id: selectedDistributorId,
        amount: parseFloat(amount),
        due_date: dueDate,
        payment_status: "unpaid",
      });

      if (error) throw error;

      toast.success(`Invoice ${invoiceCode} created successfully!`);
      setIsModalOpen(false);
      setSelectedOrderId("");
      setSelectedDistributorId("");
      setAmount("");
      setDueDate("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePaymentStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ payment_status: newStatus })
        .eq("id", id);

      if (error) throw error;

      // Log activity
      const target = invoices.find((inv) => inv.id === id);
      await supabase.from("activity_logs").insert({
        action: "Invoice Payment Update",
        details: `Invoice ${target?.invoice_code} status set to ${newStatus}`,
      });

      toast.success(`Invoice payment marked as ${newStatus}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update payment status");
    }
  };

  const columns = [
    { key: "invoice_code", label: "Invoice Code" },
    { key: "order_code", label: "Order ID" },
    { key: "distributor_name", label: "Distributor" },
    {
      key: "amount",
      label: "Amount",
      render: (val: number) => <span className="font-bold text-slate-700">Rs. {val.toLocaleString()}</span>,
    },
    { key: "due_date", label: "Due Date" },
    {
      key: "payment_status",
      label: "Status",
      render: (val: string) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
          val === "paid" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
          val === "partial" ? "bg-amber-50 text-amber-600 border border-amber-200" :
          "bg-rose-50 text-rose-600 border border-rose-200"
        }`}>
          {val}
        </span>
      ),
    },
    {
      key: "id",
      label: "Actions",
      render: (val: string, row: any) => (
        <div className="flex gap-2">
          {row.payment_status !== "paid" && (
            <button
              onClick={() => handleUpdatePaymentStatus(val, "paid")}
              className="p-1 hover:bg-emerald-50 text-emerald-600 rounded border border-emerald-100 transition-colors"
              title="Mark Paid"
            >
              <DollarSign className="w-3.5 h-3.5" />
            </button>
          )}
          {row.payment_status === "unpaid" && (
            <button
              onClick={() => handleUpdatePaymentStatus(val, "partial")}
              className="p-1 hover:bg-amber-50 text-amber-600 rounded border border-amber-100 transition-colors"
              title="Mark Partial"
            >
              <CreditCard className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const paginated = invoices.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  return (
    <div className="space-y-6 select-none">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invoices & Payments</h1>
          <p className="text-xs text-slate-500">
            Generate and track billing invoices and payment collections.
          </p>
        </div>

        <button
          onClick={() => {
            const defaultDue = new Date();
            defaultDue.setDate(defaultDue.getDate() + 30); // Default 30-day net payment
            setDueDate(defaultDue.toISOString().split("T")[0]);
            setIsModalOpen(true);
          }}
          className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </button>
      </div>

      {isLoading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
        </div>
      ) : (
        <DataTable
          title="Accounts Receivable Ledger"
          columns={columns}
          data={paginated}
          isLoading={false}
          searchPlaceholder="Search Invoices..."
          pagination={{
            current: currentPage,
            total: invoices.length,
            perPage: perPage,
            onChange: (page) => setCurrentPage(page),
          }}
        />
      )}

      {/* Create Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
          ></div>

          <div className="relative bg-white w-full max-w-sm border border-slate-100 rounded-[12px] shadow-2xl p-6 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4 bg-slate-50/50 -m-6 p-6 rounded-t-[12px]">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Generate Invoice
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Link Order ID*
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => {
                    setSelectedOrderId(e.target.value);
                    const selected = orders.find((o) => o.id === e.target.value);
                    if (selected && selected.products?.price) {
                      setAmount(String(selected.products.price));
                    }
                  }}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                  required
                >
                  <option value="">Select Order</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Bill to Distributor*
                </label>
                <select
                  value={selectedDistributorId}
                  onChange={(e) => setSelectedDistributorId(e.target.value)}
                  className="w-full h-9 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                  required
                >
                  <option value="">Select Distributor</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.first_name} {d.last_name || ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Invoice Amount (PKR)*
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 150000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Due Date*
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                    required
                  />
                </div>
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
                  Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
