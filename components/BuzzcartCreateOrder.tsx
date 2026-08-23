"use client";

import React, { useEffect, useState, useRef } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import {
  Loader2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { getLocalItems, saveLocalItem, mergeLocalItems } from "@/lib/supabaseLocalFallback";
import OrderStatusModal from "@/components/OrderStatusModal";
import { fetchRecordsAction } from "@/app/actions/users";
import { createBuzzcartOrderAction } from "@/app/actions/orders";

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
  region?: string;
  distributor_id?: string;
}

interface OrderItemInput {
  productId: string;
  productName: string;
  model: string;
  quantity: number;
  price: number;
}

interface BuzzcartCreateOrderProps {
  onSuccess?: () => void;
}

export default function BuzzcartCreateOrder({ onSuccess }: BuzzcartCreateOrderProps) {
  const supabase = createClientComponentClient();

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Loaded DB data
  const [currentRsm, setCurrentRsm] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [distributors, setDistributors] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Form selections
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedDistributorId, setSelectedDistributorId] = useState("");
  const [orderItems, setOrderItems] = useState<Record<string, { quantity: number; price: number }>>({});
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Who the order is being sold to, for a non-distributor caller: a distributor
  // directly, or a specific sub dealer (whose assigned distributor is then
  // derived automatically via the Dealer Assignment relationship).
  const [buyerType, setBuyerType] = useState<"distributor" | "sub_dealer">("distributor");

  // Distributor specific form states
  const [subDealers, setSubDealers] = useState<Profile[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [selectedSubDealerId, setSelectedSubDealerId] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");

  // Modal display states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Custom Dropdown Open States
  const [isDistributorOpen, setIsDistributorOpen] = useState(false);
  const distributorRef = useRef<HTMLDivElement>(null);
  const [isSubDealerBuyerOpen, setIsSubDealerBuyerOpen] = useState(false);
  const subDealerBuyerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (distributorRef.current && !distributorRef.current.contains(event.target as Node)) {
        setIsDistributorOpen(false);
      }
      if (subDealerBuyerRef.current && !subDealerBuyerRef.current.contains(event.target as Node)) {
        setIsSubDealerBuyerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoading(false);
          return;
        }
        const currentUserId = session.user.id;

        let rawProfiles: any[] = [];
        try {
          const { data, error } = await supabase.from("profiles").select("*");
          if (!error && data) rawProfiles = data;
        } catch (e) {
          console.warn("Failed to query full profiles table, falling back", e);
        }

        const mergedLocal = mergeLocalItems(rawProfiles, "coretech_local_users");
        const extraLocal = getLocalItems("profiles") || [];

        const allProfilesMap = new Map<string, any>();
        [...mergedLocal, ...extraLocal].forEach((p: any) => {
          if (p && p.id) {
            let rsmId = p.rsm_id;
            let wh = p.warehouse;
            let reg = p.region;

            if ((!reg || !wh) && typeof p.designation === "string" && p.designation.includes("DISTRIBUTOR_METADATA")) {
              try {
                const meta = JSON.parse(p.designation.replace("[DISTRIBUTOR_METADATA]", ""));
                if (!reg) reg = meta.region;
                if (!wh) wh = meta.warehouse;
                if (!rsmId) rsmId = meta.rsmId || meta.rsm_id;
              } catch (e) {}
            }

            allProfilesMap.set(p.id, { ...p, rsm_id: rsmId, warehouse: wh, region: reg });
          }
        });

        const profiles: Profile[] = Array.from(allProfilesMap.values());

        const activeProfile: any = profiles.find(p => p.id === currentUserId) || null;
        setCurrentRsm(activeProfile);

        // Everyone except admin gets the Employee/RSM field locked to themselves -
        // only admin can attribute an order to a different coordinator.
        if (activeProfile && activeProfile.role !== "admin" && activeProfile.role !== "distributor") {
          setSelectedEmployeeId(activeProfile.id);
        }

        const emps = profiles.filter(p => p.role !== "installer");
        setEmployees(emps);

        const isRsmUser = activeProfile && (activeProfile.role === "rsm" || (activeProfile as any).group_name === "rsm");
        const rsmRegion = (activeProfile?.region || "").toLowerCase().trim();

        let subDs = profiles.filter(p => p.role === "sub_dealer");
        if (isRsmUser && rsmRegion) {
          subDs = subDs.filter(p => !p.region || (p.region || "").toLowerCase().trim() === rsmRegion);
        }
        setSubDealers(subDs);

        let dists = profiles.filter(p => p.role === "distributor");
        if (isRsmUser && rsmRegion) {
          dists = dists.filter(p => !p.region || (p.region || "").toLowerCase().trim() === rsmRegion);
        }
        setDistributors(dists);

        const [prodRes, stockRes, regionRes] = await Promise.all([
          supabase.from("products").select("id, name, model, price").eq("is_active", true),
          supabase.from("stock").select("product_id, quantity, warehouse_name"),
          fetchRecordsAction("regions"),
        ]);

        const dbProds = prodRes.data || [];
        const mergedProds = mergeLocalItems(dbProds, "coretech_local_products");
        setProducts(mergedProds);

        const initialItems: Record<string, { quantity: number; price: number }> = {};
        mergedProds.forEach(p => {
          initialItems[p.id] = { quantity: 0, price: p.price || 0 };
        });
        setOrderItems(initialItems);

        // Still fetched for warehouse-name derivation below (whs), not for
        // any availability display - Buzzcart order creation doesn't depend
        // on stock levels at all, per the client's explicit call.
        const dbStock = stockRes.data || [];
        const localStock = getLocalItems("coretech_local_stock");
        const mergedStock = [...dbStock, ...localStock];

        let dbWarehouses: string[] = [];
        if (regionRes.success && regionRes.data) {
          dbWarehouses = Array.from(new Set(regionRes.data.map((r: any) => r.warehouse).filter(Boolean))) as string[];
        }

        const localRegions = getLocalItems("coretech_local_regions");
        const localWHs = localRegions.map((r: any) => r.warehouse).filter(Boolean);

        const whs = Array.from(new Set([
          ...dbWarehouses,
          ...localWHs,
          ...mergedStock.map(s => s.warehouse_name),
          ...profiles.map(p => p.warehouse),
        ].filter(Boolean))) as string[];
        setWarehouses(whs.length > 0 ? whs : ["Lahore Central", "Karachi Port", "Islamabad Hub"]);
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to load select parameters");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [supabase]);

  const handleToggleCheckbox = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
      setOrderItems(prev => ({ ...prev, [productId]: { ...prev[productId], quantity: 0 } }));
    } else {
      setSelectedProductIds(prev => [...prev, productId]);
      setOrderItems(prev => ({ ...prev, [productId]: { ...prev[productId], quantity: 10 } }));
    }
  };

  const handleQtyDecrement = (productId: string) => {
    const currentQty = orderItems[productId]?.quantity || 0;
    if (currentQty <= 1) return;
    setOrderItems(prev => ({ ...prev, [productId]: { ...prev[productId], quantity: currentQty - 1 } }));
  };

  const handleQtyIncrement = (productId: string) => {
    const currentQty = orderItems[productId]?.quantity || 0;
    if (!selectedProductIds.includes(productId)) {
      setSelectedProductIds(prev => [...prev, productId]);
    }
    setOrderItems(prev => ({ ...prev, [productId]: { ...prev[productId], quantity: currentQty + 1 } }));
  };

  const handleQtyTextChange = (productId: string, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    if (num > 0 && !selectedProductIds.includes(productId)) {
      setSelectedProductIds(prev => [...prev, productId]);
    } else if (num === 0 && selectedProductIds.includes(productId)) {
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
    }
    setOrderItems(prev => ({ ...prev, [productId]: { ...prev[productId], quantity: num } }));
  };

  const handleQtyChange = (productId: string, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setOrderItems(prev => ({ ...prev, [productId]: { ...prev[productId], quantity: num } }));
  };

  const handlePriceChange = (productId: string, val: string) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setOrderItems(prev => ({ ...prev, [productId]: { ...prev[productId], price: num } }));
  };

  const getDisplayDistributors = () => {
    if (!selectedEmployeeId) return distributors;
    const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
    if (!selectedEmp) return distributors;

    const empRegion = (selectedEmp.region || "").toLowerCase().trim();
    const empWH = (selectedEmp.warehouse || "").toLowerCase().trim();

    const filtered = distributors.filter(d => {
      if (d.rsm_id === selectedEmployeeId) return true;
      const dRegion = (d.region || "").toLowerCase().trim();
      const dWH = (d.warehouse || "").toLowerCase().trim();
      if (!dRegion && !dWH) return true;
      if (empRegion && dRegion) {
        if (dRegion === empRegion || dRegion.includes(empRegion) || empRegion.includes(dRegion)) return true;
      }
      if (empWH && dWH) {
        if (dWH === empWH || dWH.includes(empWH) || empWH.includes(dWH)) return true;
      }
      return false;
    });

    return filtered.length > 0 ? filtered : distributors;
  };

  const handleRemoveProduct = (prodId: string) => {
    setSelectedProductIds(prev => prev.filter(id => id !== prodId));
    setOrderItems(prev => ({ ...prev, [prodId]: { ...prev[prodId], quantity: 0 } }));
  };

  const getSubmittableItems = (): OrderItemInput[] => {
    const items: OrderItemInput[] = [];
    selectedProductIds.forEach(id => {
      const p = products.find(x => x.id === id);
      const entry = orderItems[id];
      if (p && entry && entry.quantity > 0) {
        items.push({ productId: p.id, productName: p.name, model: p.model, quantity: entry.quantity, price: entry.price });
      }
    });
    return items;
  };

  const resetForm = () => {
    setSelectedProductIds([]);
    setSelectedDistributorId("");
    setSelectedSubDealerId("");
    setSelectedWarehouse("");
    setBuyerType("distributor");
    const resetItems: Record<string, { quantity: number; price: number }> = {};
    products.forEach(p => { resetItems[p.id] = { quantity: 0, price: p.price || 0 }; });
    setOrderItems(resetItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isDist = currentRsm?.role === "distributor";
    const isGeneralSubDealer = !isDist && buyerType === "sub_dealer";

    if (isDist) {
      if (!selectedSubDealerId) { toast.error("Please select a Sub Dealer"); return; }
      if (!selectedWarehouse) { toast.error("Please select a Warehouse"); return; }
    } else if (isGeneralSubDealer) {
      if (!selectedEmployeeId) { toast.error("Please select an Employee / RSM"); return; }
      if (!selectedSubDealerId) { toast.error("Please select a Sub Dealer"); return; }
    } else {
      if (!selectedEmployeeId) { toast.error("Please select an Employee / RSM"); return; }
      if (!selectedDistributorId) { toast.error("Please select a Distributor"); return; }
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
      const totalAmount = submittable.reduce((sum, item) => sum + (item.quantity * item.price), 0);

      const activeGeneralSubDealer = isGeneralSubDealer ? subDealers.find(sd => sd.id === selectedSubDealerId) : null;

      const activeDist = isDist
        ? currentRsm
        : isGeneralSubDealer
        ? distributors.find(d => d.id === activeGeneralSubDealer?.distributor_id)
        : getDisplayDistributors().find(d => d.id === selectedDistributorId);
      const distName = activeDist ? `${activeDist.first_name} ${activeDist.last_name || ""}`.trim() : "";

      const activeUser = isDist
        ? subDealers.find(sd => sd.id === selectedSubDealerId)
        : isGeneralSubDealer
        ? activeGeneralSubDealer
        : currentRsm;
      const userName = activeUser ? `${activeUser.first_name} ${activeUser.last_name || ""}`.trim() : "";

      const activeEmp = isDist
        ? (activeUser?.rsm_id ? employees.find(emp => emp.id === activeUser.rsm_id) : null)
        : employees.find(emp => emp.id === selectedEmployeeId);
      const empName = activeEmp ? `${activeEmp.first_name} ${activeEmp.last_name || ""}`.trim() : "";

      // Real server action now - caller identity (which distributor/employee gets
      // credited) is re-derived server-side from the session, never trusted from
      // this client payload, and gated by role_permissions.can_write for
      // "buzzcart". A local-only display shape is kept here only for the genuine-
      // failure fallback path below (network error calling the action itself) -
      // an explicit permission denial must never fall back to local storage, since
      // that would let a read-only caller "create" an order that never really
      // reached the database.
      let finalOrderData: any = {
        id: orderCode,
        order_code: orderCode,
        status: "pending",
        created_at: new Date().toISOString(),
        items: submittable,
        user: activeUser ? { id: activeUser.id, first_name: activeUser.first_name, last_name: activeUser.last_name } : null,
        product: { name: submittable[0].productName },
        distributor: activeDist ? { id: activeDist.id, first_name: activeDist.first_name, last_name: activeDist.last_name } : null,
        coordinator: activeEmp ? { id: activeEmp.id, first_name: activeEmp.first_name, last_name: activeEmp.last_name } : null,
      };

      try {
        const res = await createBuzzcartOrderAction({
          buyerType: isGeneralSubDealer ? "sub_dealer" : "distributor",
          selectedDistributorId: isDist || isGeneralSubDealer ? null : selectedDistributorId,
          selectedSubDealerId: isDist || isGeneralSubDealer ? selectedSubDealerId : null,
          selectedEmployeeId: currentRsm?.role === "admin" ? selectedEmployeeId : null,
          items: submittable,
        });

        if (!res.success) {
          toast.error(res.error || "Failed to create order");
          return;
        }
        if (res.data) finalOrderData = res.data;
        toast.success(`Order ${res.data?.order_code || orderCode} created successfully!`);
      } catch (dbErr) {
        console.warn("createBuzzcartOrderAction failed unexpectedly. Saving locally.", dbErr);
        saveLocalItem("coretech_local_orders", {
          order_code: orderCode,
          status: "pending",
          items: submittable,
          local_user_name: userName,
          local_product_name: submittable[0].productName,
          local_distributor_name: distName,
          local_coordinator_name: empName,
        });
        toast.success(`Order ${orderCode} created locally (Database fallback)!`);
      }

      setCreatedOrder(finalOrderData);
      setIsStatusModalOpen(true);
      resetForm();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItems = getSubmittableItems();
  const totalPieces = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = selectedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const displayDistributorsList = getDisplayDistributors();
  const activeDistributor = displayDistributorsList.find(d => d.id === selectedDistributorId);
  const distributorLabel = activeDistributor
    ? `${activeDistributor.first_name} ${activeDistributor.last_name || ""}`.trim()
    : "Distributer";

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-[12px] p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#00B4D8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none animate-in fade-in duration-300">
      <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
        Create New Order
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-20">

          {currentRsm?.role === "distributor" ? (
            <>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Sub Dealer*</label>
                <select
                  value={selectedSubDealerId}
                  onChange={(e) => setSelectedSubDealerId(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#00B4D8] cursor-pointer"
                  required
                >
                  <option value="">Select Sub Dealer</option>
                  {subDealers.map((sd) => (
                    <option key={sd.id} value={sd.id}>{sd.first_name} {sd.last_name || ""}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Warehouse*</label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#00B4D8] cursor-pointer"
                  required
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((wh, idx) => (<option key={idx} value={wh}>{wh}</option>))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Select Employee / RSM*</label>
                {currentRsm?.role !== "admin" ? (
                  <div className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-500 bg-slate-50 flex items-center">
                    {currentRsm ? `${currentRsm.first_name} ${currentRsm.last_name || ""}`.trim() : "You"}
                  </div>
                ) : (
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      const empId = e.target.value;
                      setSelectedEmployeeId(empId);
                      setSelectedDistributorId("");
                    }}
                    className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#00B4D8] cursor-pointer"
                    required
                  >
                    <option value="">Select Employee / RSM</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name || ""} {emp.region ? `(${emp.region})` : emp.warehouse ? `(${emp.warehouse})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Sell To*</label>
                <select
                  value={buyerType}
                  onChange={(e) => {
                    setBuyerType(e.target.value as "distributor" | "sub_dealer");
                    setSelectedDistributorId("");
                    setSelectedSubDealerId("");
                  }}
                  className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#00B4D8] cursor-pointer"
                >
                  <option value="distributor">Distributor</option>
                  <option value="sub_dealer">Sub Dealer</option>
                </select>
              </div>

              {buyerType === "distributor" ? (
                <div className="flex-1 min-w-[220px]" ref={distributorRef}>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Distributer*</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDistributorOpen(prev => !prev)}
                      className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-700 bg-white flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer"
                    >
                      <span className={selectedDistributorId ? "text-slate-800" : "text-slate-400"}>{distributorLabel}</span>
                      {isDistributorOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isDistributorOpen && (
                      <div className="absolute left-0 mt-1.5 w-[420px] bg-white border border-slate-150 rounded-[12px] shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                        {displayDistributorsList.length === 0 ? (
                          <p className="text-xs text-slate-400 p-2 text-center italic">No distributors assigned to this employee's region.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                            {displayDistributorsList.map((d) => {
                              const labelText = `${d.first_name} ${d.last_name || ""}`.trim();
                              const subText = d.region ? ` (${d.region})` : d.warehouse ? ` (${d.warehouse})` : "";
                              const isSelected = selectedDistributorId === d.id;
                              return (
                                <div
                                  key={d.id}
                                  onClick={() => { setSelectedDistributorId(d.id); setIsDistributorOpen(false); }}
                                  className={`px-3 py-2 text-[11px] font-bold rounded-[6px] transition-all cursor-pointer border ${
                                    isSelected ? "bg-[#00B4D8] text-white border-[#00B4D8]" : "text-slate-700 hover:bg-[#F0FAFE] hover:text-[#00B4D8] border-slate-100"
                                  }`}
                                >
                                  <div>{labelText}</div>
                                  {subText && <div className={`text-[9px] ${isSelected ? "text-white/80" : "text-slate-400"}`}>{subText}</div>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-[220px]" ref={subDealerBuyerRef}>
                  <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Sub Dealer*</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsSubDealerBuyerOpen(prev => !prev)}
                      className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-700 bg-white flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer"
                    >
                      <span className={selectedSubDealerId ? "text-slate-800" : "text-slate-400"}>
                        {subDealers.find(sd => sd.id === selectedSubDealerId)
                          ? `${subDealers.find(sd => sd.id === selectedSubDealerId)!.first_name} ${subDealers.find(sd => sd.id === selectedSubDealerId)!.last_name || ""}`.trim()
                          : "Sub Dealer"}
                      </span>
                      {isSubDealerBuyerOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isSubDealerBuyerOpen && (
                      <div className="absolute left-0 mt-1.5 w-[420px] bg-white border border-slate-150 rounded-[12px] shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                        {subDealers.length === 0 ? (
                          <p className="text-xs text-slate-400 p-2 text-center italic">No sub dealers found.</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                            {subDealers.map((sd) => {
                              const labelText = `${sd.first_name} ${sd.last_name || ""}`.trim();
                              const subText = sd.region ? ` (${sd.region})` : "";
                              const isSelected = selectedSubDealerId === sd.id;
                              return (
                                <div
                                  key={sd.id}
                                  onClick={() => { setSelectedSubDealerId(sd.id); setIsSubDealerBuyerOpen(false); }}
                                  className={`px-3 py-2 text-[11px] font-bold rounded-[6px] transition-all cursor-pointer border ${
                                    isSelected ? "bg-[#00B4D8] text-white border-[#00B4D8]" : "text-slate-700 hover:bg-[#F0FAFE] hover:text-[#00B4D8] border-slate-100"
                                  }`}
                                >
                                  <div>{labelText}</div>
                                  {subText && <div className={`text-[9px] ${isSelected ? "text-white/80" : "text-slate-400"}`}>{subText}</div>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Product</label>
            <button
              type="button"
              onClick={() => setIsProductModalOpen(true)}
              className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs font-bold text-slate-700 bg-white flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer text-left"
            >
              <span className={selectedProductIds.length > 0 ? "text-slate-800" : "text-slate-400"}>
                {selectedProductIds.length > 0 ? `${selectedProductIds.length} Product(s) Selected` : "Choose Model to Add"}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {selectedProductIds.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-[12px] overflow-hidden shadow-sm animate-in slide-in-from-bottom-2 duration-300 relative z-10">
            <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Selected Products Specifications</h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold uppercase">{selectedProductIds.length} Added</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/10">
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Model Name</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider w-32">Order Qty (Pcs)</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider w-40">Suggested Price (PKR)</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Subtotal</th>
                    <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-center w-16">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {selectedProductIds.map((id) => {
                    const p = products.find(x => x.id === id);
                    if (!p) return null;
                    const entry = orderItems[p.id] || { quantity: 1, price: p.price || 0 };
                    const subtotal = entry.quantity * entry.price;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-800">
                          {p.name}
                          <p className="text-[10px] text-slate-400 font-normal">{p.model || "Generic"}</p>
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number" min="1" placeholder="1"
                            value={entry.quantity || ""}
                            onChange={(e) => handleQtyChange(p.id, e.target.value)}
                            className="w-24 h-8 px-2.5 border border-slate-200 rounded-[6px] text-xs font-semibold focus:outline-none focus:border-[#00B4D8] text-center"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number" min="0" placeholder={String(p.price || 0)}
                            value={entry.price || ""}
                            onChange={(e) => handlePriceChange(p.id, e.target.value)}
                            className="w-32 h-8 px-2.5 border border-slate-200 rounded-[6px] text-xs font-semibold focus:outline-none focus:border-[#00B4D8]"
                          />
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-800">PKR {subtotal.toLocaleString()}</td>
                        <td className="px-5 py-3 text-center">
                          <button type="button" onClick={() => handleRemoveProduct(p.id)} className="p-1 hover:bg-rose-50 text-rose-500 rounded border border-rose-100 transition-colors cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50/60 border-t border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Pieces</p>
                  <p className="text-xl font-extrabold text-slate-800 mt-0.5">{totalPieces} Pcs</p>
                </div>
                <div className="border-l border-slate-200 pl-6">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Estimated Order Value</p>
                  <p className="text-xl font-extrabold text-[#00B4D8] mt-0.5">PKR {totalValue.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={resetForm} className="h-9 px-4 text-xs font-semibold hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-[6px] transition-all cursor-pointer">
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || totalPieces === 0}
                  className="h-9 px-5 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-xs rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-all hover:scale-105 duration-200 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Order Request
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-[12px] p-8 text-center shadow-sm space-y-2 animate-in fade-in duration-300">
            <div className="w-10 h-10 rounded-full bg-[#F0FAFE] text-[#00B4D8] flex items-center justify-center mx-auto border border-[#00B4D8]/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">No Products Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                Choose a product model from the dropdown above to add it to your order details ledger.
              </p>
            </div>
          </div>
        )}
      </form>

      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsProductModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"></div>
          <div className="relative bg-white w-full max-w-4xl border border-slate-200 rounded-[12px] shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Select Product Specifications</h3>
              <button type="button" onClick={() => setIsProductModalOpen(false)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 mb-6 pr-1">
              <table className="w-full text-left border-collapse text-xs select-none">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 sticky top-0 bg-white z-10">
                    <th className="px-4 py-3 w-12 text-center">Select</th>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Select Product</th>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-center w-36">Quantity</th>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider w-36">Price</th>
                    <th className="px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-right w-40">Total Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {products.map((p) => {
                    const isChecked = selectedProductIds.includes(p.id);
                    const qty = orderItems[p.id]?.quantity || 0;
                    const price = orderItems[p.id]?.price || p.price || 0;
                    const totalPrice = qty * price;

                    return (
                      <tr key={p.id} className={`hover:bg-slate-50/30 transition-colors ${isChecked ? "bg-slate-50/10" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={isChecked} onChange={() => handleToggleCheckbox(p.id)} className="w-4 h-4 rounded border-slate-300 text-[#00B4D8] focus:ring-[#00B4D8] cursor-pointer" />
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {p.name}
                          <p className="text-[10px] text-slate-400 font-normal">{p.model || "Generic"}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center border border-slate-200 rounded-[6px] overflow-hidden bg-white">
                            <button type="button" onClick={() => handleQtyDecrement(p.id)} className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold border-r border-slate-200 transition-colors">-</button>
                            <input type="number" min="1" value={qty || ""} onChange={(e) => handleQtyTextChange(p.id, e.target.value)} className="w-12 text-center text-xs font-bold text-slate-800 focus:outline-none h-7" />
                            <button type="button" onClick={() => handleQtyIncrement(p.id)} className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold border-l border-slate-200 transition-colors">+</button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-semibold">Rs {price.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">Rs {totalPrice.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 font-bold">{selectedProductIds.length} product(s) selected</div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="h-9 px-4 text-xs font-semibold hover:bg-slate-100 rounded-[6px] text-slate-500 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedProductIds.length === 0}
                  onClick={() => setIsProductModalOpen(false)}
                  className="h-9 px-6 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold text-xs rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-all hover:scale-[1.03] duration-200 cursor-pointer"
                >
                  Add to Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createdOrder && (
        <OrderStatusModal
          isOpen={isStatusModalOpen}
          callerRole={currentRsm?.role}
          onClose={() => {
            setIsStatusModalOpen(false);
            setCreatedOrder(null);
          }}
          order={createdOrder}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
