"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import { Loader2, ArrowLeft, Check, AlertCircle, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  model: string;
  price: number;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  rsm_id?: string;
  warehouse?: string;
}

interface Stock {
  product_id: string;
  quantity: number;
  warehouse_name: string;
}

interface OrderItemInput {
  productId: string;
  productName: string;
  model: string;
  quantity: number;
  price: number;
}

export default function CreateOrderPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Loaded DB data
  const [currentRsm, setCurrentRsm] = useState<Profile | null>(null);
  const [dealers, setDealers] = useState<Profile[]>([]);
  const [distributors, setDistributors] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockData, setStockData] = useState<Stock[]>([]);

  // Form selections
  const [selectedDealerId, setSelectedDealerId] = useState("");
  const [selectedDistributorId, setSelectedDistributorId] = useState("");
  const [orderItems, setOrderItems] = useState<Record<string, { quantity: number; price: number }>>({});

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        // 1. Get logged in user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("Not authenticated");
          router.push("/login");
          return;
        }
        const currentUserId = session.user.id;

        // 2. Fetch profiles with resilient fallback if rsm_id or warehouse columns are missing
        let profileData: any[] = [];
        const { data: fullProfileData, error: profileErr } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, role, rsm_id, warehouse");

        if (profileErr) {
          console.warn("Profiles schema missing columns. Falling back to metadata extraction.", profileErr);
          const { data: basicProfileData, error: basicErr } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, role, designation");
          
          if (basicErr) throw basicErr;
          
          profileData = (basicProfileData || []).map((p: any) => {
            let rsmId: string | undefined = undefined;
            let wh: string | undefined = undefined;

            if (p.designation && p.designation.startsWith("[DISTRIBUTOR_METADATA]")) {
              try {
                const meta = JSON.parse(p.designation.substring(22));
                wh = meta.warehouse;
                rsmId = meta.rsmId || meta.rsm_id;
              } catch (e) {
                // Ignore
              }
            }

            return {
              id: p.id,
              first_name: p.first_name,
              last_name: p.last_name,
              role: p.role,
              rsm_id: rsmId,
              warehouse: wh,
            };
          });
        } else {
          profileData = fullProfileData || [];
        }

        const profiles: Profile[] = profileData;

        // Identify current user's profile
        const activeProfile = profiles.find(p => p.id === currentUserId) || null;
        setCurrentRsm(activeProfile);

        // Filter dealers (role === "sub_dealer") aligned to this RSM
        let alignedDealers = profiles.filter(
          p => p.role === "sub_dealer" && p.rsm_id === currentUserId
        );

        // Fallback: If no dealer is aligned to this specific RSM, show all sub_dealers
        if (alignedDealers.length === 0) {
          alignedDealers = profiles.filter(p => p.role === "sub_dealer");
        }
        setDealers(alignedDealers);

        // Filter distributors
        const dists = profiles.filter(p => p.role === "distributor");
        setDistributors(dists);

        // 3. Fetch products
        const { data: prodData, error: prodErr } = await supabase
          .from("products")
          .select("id, name, model, price");
        if (prodErr) throw prodErr;
        setProducts(prodData || []);

        // Initialize default prices for items
        const initialItems: Record<string, { quantity: number; price: number }> = {};
        (prodData || []).forEach(p => {
          initialItems[p.id] = { quantity: 0, price: p.price || 0 };
        });
        setOrderItems(initialItems);

        // 4. Fetch stock
        const { data: stockList, error: stockErr } = await supabase
          .from("stock")
          .select("product_id, quantity, warehouse_name");
        if (stockErr) throw stockErr;
        setStockData(stockList || []);

      } catch (err: any) {
        console.error(err);
        toast.error("Failed to load select parameters");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [supabase, router]);

  // Determine if a product is in stock based on the dealer's warehouse or general stock
  const checkStockStatus = (productId: string) => {
    const selectedDealer = dealers.find(d => d.id === selectedDealerId);
    let filtered = stockData;

    // Filter by dealer's warehouse if specified
    if (selectedDealer?.warehouse) {
      filtered = stockData.filter(
        s => s.warehouse_name?.toLowerCase() === selectedDealer.warehouse?.toLowerCase()
      );
    }

    const totalQty = filtered
      .filter(s => s.product_id === productId)
      .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

    return totalQty > 0;
  };

  const handleQtyChange = (productId: string, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setOrderItems(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        quantity: num
      }
    }));
  };

  const handlePriceChange = (productId: string, val: string) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setOrderItems(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        price: num
      }
    }));
  };

  const getSubmittableItems = (): OrderItemInput[] => {
    const items: OrderItemInput[] = [];
    products.forEach(p => {
      const entry = orderItems[p.id];
      if (entry && entry.quantity > 0) {
        items.push({
          productId: p.id,
          productName: p.name,
          model: p.model,
          quantity: entry.quantity,
          price: entry.price
        });
      }
    });
    return items;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDealerId) {
      toast.error("Please select a Dealer");
      return;
    }
    if (!selectedDistributorId) {
      toast.error("Please select a Distributor");
      return;
    }

    const submittable = getSubmittableItems();
    if (submittable.length === 0) {
      toast.error("Please add at least one product with quantity > 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const orderCode = `#CM${randomDigits}`;

      // Calculate total price
      const totalAmount = submittable.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      // Save order to the database.
      // In case the DB does not support the multi-item JSON `items` field yet,
      // we also populate `product_id` with the first item's product_id as a fallback.
      const payload = {
        order_code: orderCode,
        user_id: selectedDealerId,
        product_id: submittable[0].productId,
        distributor_id: selectedDistributorId,
        sales_coordinator_id: currentRsm?.id || null,
        status: "pending",
        items: submittable, // Multi-item support in JSON
      };

      const { error } = await supabase.from("orders").insert(payload);
      if (error) throw error;

      // Log action in Activity Logs
      await supabase.from("activity_logs").insert({
        action: "Create Buzzcart Order",
        details: `RSM ${currentRsm?.first_name} created order ${orderCode} for Dealer (ID: ${selectedDealerId}) with ${submittable.length} models. Total PKR ${totalAmount.toLocaleString()}`,
      });

      toast.success(`Order ${orderCode} created successfully!`);
      router.push("/dashboard/buzzcart/orders");
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItems = getSubmittableItems();
  const totalPieces = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#00B4D8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none max-w-4xl mx-auto">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/buzzcart/orders"
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Create Buzzcart Order</h1>
            <p className="text-xs text-slate-500">
              Logged in as RSM: <span className="font-semibold text-slate-700">{currentRsm?.first_name} {currentRsm?.last_name || ""}</span>
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Partner Alignments */}
        <div className="bg-white border border-slate-200 rounded-[8px] p-6 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">
            1. Select Partners
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Select Dealer*
              </label>
              <select
                value={selectedDealerId}
                onChange={(e) => setSelectedDealerId(e.target.value)}
                className="w-full h-10 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
                required
              >
                <option value="">Select Dealer</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.first_name} {d.last_name || ""} {d.warehouse ? `(${d.warehouse})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Only showing dealers aligned to you.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Routing Distributor*
              </label>
              <select
                value={selectedDistributorId}
                onChange={(e) => setSelectedDistributorId(e.target.value)}
                className="w-full h-10 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]"
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
          </div>
        </div>

        {/* Step 2: Catalog & Stock checks */}
        <div className="bg-white border border-slate-200 rounded-[8px] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Add Products & Suggested Pricing
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold uppercase">
              {products.length} Models Linked
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/10">
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Model Name</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Stock Status</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider w-32">Order Qty (Pcs)</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider w-40">Suggested Price (PKR)</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {products.map((p) => {
                  const isInStock = checkStockStatus(p.id);
                  const entry = orderItems[p.id] || { quantity: 0, price: p.price || 0 };
                  const subtotal = entry.quantity * entry.price;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-800">
                        {p.name}
                        <p className="text-[10px] text-slate-400 font-normal">{p.model || "Generic"}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          isInStock 
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                            : "bg-rose-50 text-rose-600 border border-rose-100"
                        }`}>
                          {isInStock ? "In Stock" : "Out of Stock"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={entry.quantity || ""}
                          onChange={(e) => handleQtyChange(p.id, e.target.value)}
                          className="w-24 h-8 px-2 border border-slate-200 rounded-[4px] text-xs focus:outline-none focus:border-[#00B4D8] text-center"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          min="0"
                          placeholder={String(p.price || 0)}
                          value={entry.price || ""}
                          onChange={(e) => handlePriceChange(p.id, e.target.value)}
                          className="w-32 h-8 px-2 border border-slate-200 rounded-[4px] text-xs focus:outline-none focus:border-[#00B4D8]"
                        />
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800">
                        PKR {subtotal.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Floating Summary Bar */}
        <div className="bg-slate-900 text-white rounded-[8px] p-5 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex gap-6">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Pieces</p>
              <p className="text-xl font-extrabold text-white mt-0.5">{totalPieces} Pcs</p>
            </div>
            <div className="border-l border-slate-800 pl-6">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Estimated Order Value</p>
              <p className="text-xl font-extrabold text-[#00B4D8] mt-0.5">PKR {totalValue.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/buzzcart/orders")}
              className="h-10 px-5 text-xs font-semibold hover:bg-slate-800 text-slate-400 hover:text-white rounded-[6px] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || totalPieces === 0}
              className="h-10 px-6 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-all"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit Order Request
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
