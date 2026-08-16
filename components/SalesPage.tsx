"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import {
  Loader2,
  ArrowLeft,
  Trash2,
  Barcode,
  Plus,
  Download,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { mergeLocalItems } from "@/lib/supabaseLocalFallback";
import { fetchRecordsAction } from "@/app/actions/users";
import { submitSt2Action, submitReturnAction, submitTransferAction } from "@/app/actions/sales";

interface SalesPageProps {
  type: "ST1" | "ST2" | "return" | "transfer";
  title: string;
  buttonLabel: string;
  stIdPrefix: string;
}

interface ScannedItem {
  imei: string;
  productName: string;
  model: string;
  productId: string;
  status?: "pass" | "fail";
  reason?: string;
}

interface OrderDetailRow {
  productId: string;
  productName: string;
  model: string;
  quantity: number;
}

type PartyType = "warehouse" | "distributor" | "sub_dealer";

interface ReturnLock {
  sourceType: "distributor" | "sub_dealer";
  sourceId: string;
  sourceName: string;
  destType: "distributor" | "warehouse";
  destId: string;
  destName: string;
}

export default function SalesPage({ type, title, buttonLabel, stIdPrefix }: SalesPageProps) {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const mode = searchParams?.get("mode");

  const isST1 = type === "ST1";
  const isST2 = type === "ST2";
  const isReturn = type === "return";
  const isTransfer = type === "transfer";

  // View toggles
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (mode === "create") {
      setIsCreating(true);
    }
  }, [mode]);

  // Data states
  const [sales, setSales] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]); // includes region, used by Return
  const [subDealers, setSubDealers] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<{ id: string; name: string }[]>([]);
  const [regionWarehouseMap, setRegionWarehouseMap] = useState<Map<string, string>>(new Map());
  const [callerProfile, setCallerProfile] = useState<{ id: string; role: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  // NOTE: `warehouse` and `selectedDistributor` are reused across transaction
  // types rather than adding parallel state per type, to keep validation/reset
  // logic in one place:
  //  - ST1: warehouse = source warehouse NAME, selectedDistributor = buyer distributor id.
  //  - ST2: warehouse = source distributor id, selectedDistributor = destination sub dealer id.
  //  - Transfer: warehouse = "From" entity id (or warehouse id), selectedDistributor = "To" entity id.
  //  - Return: neither is used - both source and destination are auto-resolved into `returnLock`.
  const [seller, setSeller] = useState("CoreTECH HQ");
  const [selectedDistributor, setSelectedDistributor] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [transferType, setTransferType] = useState<PartyType | "">("");
  const [returnLock, setReturnLock] = useState<ReturnLock | null>(null);
  const [sourceMissing, setSourceMissing] = useState(false);
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [remarks, setRemarks] = useState("");

  // Serial number scanning states
  const [imeiInput, setImeiInput] = useState("");
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetailRow[]>([]);
  const [isCheckingImei, setIsCheckingImei] = useState(false);

  // Filter states
  const [filterDistributor, setFilterDistributor] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const partyName = (t: PartyType, id: string | null) => {
    if (!id) return "-";
    if (t === "warehouse") return warehousesList.find(w => w.id === id)?.name || "-";
    if (t === "distributor") {
      const d = distributors.find(x => x.id === id);
      return d ? `${d.first_name} ${d.last_name || ""}`.trim() : "-";
    }
    const s = subDealers.find(x => x.id === id);
    return s ? `${s.first_name} ${s.last_name || ""}`.trim() : "-";
  };

  const resolveCurrentLocation = (dbRow: any): { type: PartyType; id: string | null; name: string } => {
    if (dbRow.sub_dealer_id) return { type: "sub_dealer", id: dbRow.sub_dealer_id, name: partyName("sub_dealer", dbRow.sub_dealer_id) };
    if (dbRow.distributor_id) return { type: "distributor", id: dbRow.distributor_id, name: partyName("distributor", dbRow.distributor_id) };
    const wh = warehousesList.find(w => w.name === dbRow.warehouse_name);
    return { type: "warehouse", id: wh?.id || null, name: dbRow.warehouse_name };
  };

  const resolveReturnParent = (current: { type: PartyType; id: string | null }) => {
    if (current.type === "sub_dealer") {
      const sd = subDealers.find(s => s.id === current.id);
      if (!sd || !sd.distributor_id) return null;
      return { type: "distributor" as const, id: sd.distributor_id, name: partyName("distributor", sd.distributor_id) };
    }
    if (current.type === "distributor") {
      const dist = distributors.find(d => d.id === current.id);
      const whName = dist?.region ? regionWarehouseMap.get(dist.region) : null;
      const wh = whName ? warehousesList.find(w => w.name === whName) : null;
      if (!wh) return null;
      return { type: "warehouse" as const, id: wh.id, name: wh.name };
    }
    return null;
  };

  // Fetch initial sales records, distributors, sub dealers & warehouses
  const fetchData = async () => {
    setIsLoading(true);
    try {
      let caller: { id: string; role: string } | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
          if (profile) {
            caller = { id: session.user.id, role: profile.role };
            setCallerProfile(caller);
          }
        }
      } catch (callerErr) {
        console.warn("Failed to resolve caller identity", callerErr);
      }

      // 1. Distributors (includes region - needed by Return to resolve the warehouse a distributor's stock returns to)
      let dbDists: any[] = [];
      try {
        const { data: distData, error: distErr } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, region")
          .eq("role", "distributor");
        if (distErr) throw distErr;
        dbDists = distData || [];
      } catch (distErr) {
        console.warn("Failed to fetch distributors.", distErr);
      }
      setDistributors(dbDists);

      // 2. Sub dealers (Dealer Assignment relationship via distributor_id)
      let dbSubDealers: any[] = [];
      try {
        const { data: subData, error: subErr } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, distributor_id")
          .eq("role", "sub_dealer");
        if (subErr) throw subErr;
        dbSubDealers = subData || [];
      } catch (subErr) {
        console.warn("Failed to fetch sub dealers.", subErr);
      }
      setSubDealers(dbSubDealers);

      // 3. Region -> warehouse map, needed by Return to resolve which warehouse a
      // distributor's stock returns to.
      const regionWhMap = new Map<string, string>();
      try {
        const res = await fetchRecordsAction("regions");
        if (res.success && res.data) {
          res.data.forEach((r: any) => { if (r.name && r.warehouse) regionWhMap.set(r.name, r.warehouse); });
        }
      } catch (regionErr) {
        console.warn("Failed to fetch regions.", regionErr);
      }
      setRegionWarehouseMap(regionWhMap);

      // 4. Real warehouses table (id + name) - needed by ST1/Return/Transfer for a real source/destination id
      let dbWarehousesList: { id: string; name: string }[] = [];
      try {
        const { data: whData, error: whErr } = await supabase.from("warehouses").select("id, name").order("name");
        if (whErr) throw whErr;
        dbWarehousesList = whData || [];
      } catch (whErr) {
        console.warn("Failed to fetch warehouses table.", whErr);
      }
      setWarehousesList(dbWarehousesList);

      // 5. Sales ledger
      let dbSales: any[] = [];
      try {
        let query = supabase.from("sales").select("*").eq("type", type);
        if (isST2 && caller?.role === "distributor") query = query.eq("source_id", caller.id);
        const { data: salesData, error: salesErr } = await query.order("created_at", { ascending: false });
        if (salesErr) throw salesErr;
        dbSales = salesData || [];
      } catch (dbErr) {
        console.warn("Failed to fetch sales from Supabase. Using local fallback.", dbErr);
      }

      const mergedSales = mergeLocalItems(dbSales, "coretech_local_sales", (x: any) => x.type === type);

      const distMap = new Map(dbDists.map((d: any) => [d.id, `${d.first_name} ${d.last_name || ""}`.trim()]));
      const subDealerMap = new Map(dbSubDealers.map((s: any) => [s.id, `${s.first_name} ${s.last_name || ""}`.trim()]));
      const warehouseMap = new Map(dbWarehousesList.map((w: any) => [w.id, w.name]));

      const resolveName = (t: string, id: string | null) => {
        if (!id) return "-";
        if (t === "warehouse") return warehouseMap.get(id) || "-";
        if (t === "distributor") return distMap.get(id) || "-";
        if (t === "sub_dealer") return subDealerMap.get(id) || "-";
        return "-";
      };

      const formattedSales = (mergedSales || []).map((row: any, idx: number) => ({
        ...row,
        sno: String(idx + 1).padStart(2, "0"),
        source_name: resolveName(row.source_type, row.source_id) !== "-" ? resolveName(row.source_type, row.source_id) : (row.local_source_name || "-"),
        destination_name: resolveName(row.destination_type, row.destination_id) !== "-" ? resolveName(row.destination_type, row.destination_id) : (row.local_destination_name || "-"),
      }));

      setSales(formattedSales);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleOpenCreateView = () => {
    setSelectedDistributor("");
    setWarehouse(isST2 && callerProfile?.role === "distributor" ? callerProfile.id : "");
    setTransferType("");
    setReturnLock(null);
    setRemarks("");
    setImeiInput("");
    setScannedItems([]);
    setOrderDetails([]);
    setSourceMissing(false);
    const today = new Date().toLocaleDateString('en-CA');
    setDate(today);
    setIsCreating(true);
  };

  const clearScanIfNeeded = () => {
    if (scannedItems.length > 0 || orderDetails.length > 0) {
      setScannedItems([]);
      setOrderDetails([]);
      toast("Selection changed — scan record cleared.", { icon: "⚠️" });
    }
  };

  // Changing the source (warehouse for ST1, distributor for ST2, From for
  // Transfer) invalidates any already-checked pass/fail results.
  const handleWarehouseChange = (value: string) => {
    setWarehouse(value);
    setSourceMissing(false);
    if (isST2) setSelectedDistributor("");
    clearScanIfNeeded();
  };

  const handleTransferTypeChange = (value: PartyType | "") => {
    setTransferType(value);
    setWarehouse("");
    setSelectedDistributor("");
    setSourceMissing(false);
    clearScanIfNeeded();
  };

  const handleTransferFromChange = (value: string) => {
    setWarehouse(value);
    setSourceMissing(false);
    setSelectedDistributor("");
    clearScanIfNeeded();
  };

  // Scan / Check serial number input (supports bulk copy-paste split by
  // comma/newline/tabs/spaces, since that's how a pasted Excel column comes through).
  const handleCheckImei = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = imeiInput.trim();
    if (!cleanInput) {
      toast.error("Enter at least one serial number");
      return;
    }

    if (isST1 && !warehouse) { setSourceMissing(true); toast.error("Select a warehouse first"); return; }
    if (isST2 && !warehouse) { setSourceMissing(true); toast.error("Select a distributor first"); return; }
    if (isTransfer && (!transferType || !warehouse)) { setSourceMissing(true); toast.error("Select a transfer type and source first"); return; }
    setSourceMissing(false);

    const inputs = cleanInput.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
    if (inputs.length === 0) return;

    const newInputs = Array.from(new Set(inputs.filter(x => !scannedItems.some(item => item.imei === x))));
    const duplicatesCount = inputs.length - newInputs.length;

    if (newInputs.length === 0) {
      if (duplicatesCount > 0) toast.error("All entered serial numbers have already been scanned!");
      setImeiInput("");
      return;
    }

    setIsCheckingImei(true);
    try {
      const { data } = await supabase
        .from("stock")
        .select(`
          serial_no,
          product_id,
          model_no,
          status,
          warehouse_name,
          distributor_id,
          sub_dealer_id,
          product:products(id, name, model)
        `)
        .in("serial_no", newInputs);

      const dbMap = new Map<string, any>();
      if (data) data.forEach((row: any) => dbMap.set(row.serial_no, row));

      const itemsToAdd: ScannedItem[] = [];
      let passCount = 0;
      let failCount = 0;
      let lockInProgress = returnLock;

      const pushFail = (imei: string, dbRow: any, reason: string) => {
        itemsToAdd.push({ imei, productName: dbRow?.product?.name || "-", model: dbRow?.product?.model || "-", productId: dbRow?.product_id || "", status: "fail", reason });
        failCount++;
      };
      const pushPass = (dbRow: any) => {
        itemsToAdd.push({
          imei: dbRow.serial_no,
          productName: dbRow.product?.name || "Stock Item",
          model: dbRow.product?.model || dbRow.model_no || "Generic",
          productId: dbRow.product_id,
          status: "pass",
        });
        passCount++;
      };

      newInputs.forEach(imei => {
        const dbRow = dbMap.get(imei);
        if (!dbRow) { pushFail(imei, dbRow, "Serial number not found"); return; }

        // A sold-out unit is permanently out of the supply chain - checked once,
        // for every type, before any type-specific logic runs.
        if (dbRow.status === "sold_out") { pushFail(imei, dbRow, "Serial number is already sold out"); return; }

        if (isST1) {
          if (dbRow.warehouse_name !== warehouse) { pushFail(imei, dbRow, `Not in ${warehouse} (currently in ${dbRow.warehouse_name})`); return; }
          if (dbRow.distributor_id) { pushFail(imei, dbRow, "Already assigned to another distributor"); return; }
          pushPass(dbRow);
        } else if (isST2) {
          if (dbRow.distributor_id !== warehouse) { pushFail(imei, dbRow, dbRow.distributor_id ? "Held by a different distributor" : "Not yet transferred to any distributor"); return; }
          if (dbRow.sub_dealer_id) { pushFail(imei, dbRow, "Already assigned to another sub dealer"); return; }
          pushPass(dbRow);
        } else if (isReturn) {
          const current = resolveCurrentLocation(dbRow);
          if (current.type === "warehouse") { pushFail(imei, dbRow, "Already at the warehouse — nothing to return"); return; }
          const parent = resolveReturnParent(current);
          if (!parent) {
            pushFail(imei, dbRow, current.type === "sub_dealer" ? "No distributor assigned to this sub dealer" : "No warehouse mapped to this distributor's region");
            return;
          }
          if (!lockInProgress) {
            lockInProgress = {
              sourceType: current.type as "distributor" | "sub_dealer",
              sourceId: current.id as string,
              sourceName: current.name,
              destType: parent.type as "distributor" | "warehouse",
              destId: parent.id,
              destName: parent.name,
            };
          } else if (lockInProgress.sourceType !== current.type || lockInProgress.sourceId !== current.id) {
            pushFail(imei, dbRow, "Different origin — submit separately");
            return;
          }
          pushPass(dbRow);
        } else if (isTransfer) {
          const current = resolveCurrentLocation(dbRow);
          const fromMatches = transferType === "warehouse"
            ? current.type === "warehouse" && current.id === warehouse
            : current.type === transferType && current.id === warehouse;
          if (!fromMatches) {
            pushFail(imei, dbRow, `Not held by the selected source (currently ${current.type === "warehouse" ? `in ${current.name}` : `with ${current.name}`})`);
            return;
          }
          pushPass(dbRow);
        }
      });

      if (isReturn && lockInProgress && lockInProgress !== returnLock) {
        setReturnLock(lockInProgress);
      }

      setScannedItems(prev => [...itemsToAdd, ...prev]);
      setOrderDetails(prev => {
        const updated = [...prev];
        itemsToAdd.filter(item => item.status === "pass").forEach(item => {
          const idx = updated.findIndex(row => row.productName === item.productName);
          if (idx >= 0) updated[idx].quantity += 1;
          else updated.push({ productId: item.productId, productName: item.productName, model: item.model, quantity: 1 });
        });
        return updated;
      });

      toast.success(`Checked ${newInputs.length} serial(s) — ${passCount} passed, ${failCount} failed.`);
      setImeiInput("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to check serial numbers.");
    } finally {
      setIsCheckingImei(false);
    }
  };

  const downloadRejectedCsv = () => {
    const failed = scannedItems.filter(item => item.status === "fail");
    if (failed.length === 0) return;
    const headers = "Serial Number,Reason\n";
    const rows = failed.map(item => `${item.imei},"${(item.reason || "").replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${stIdPrefix}_rejected_serials.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const removeScannedItem = (index: number) => {
    const itemToRemove = scannedItems[index];
    setScannedItems(prev => prev.filter((_, idx) => idx !== index));
    if (itemToRemove.status === "fail") return;
    setOrderDetails(prev => {
      const idx = prev.findIndex(item => item.productName === itemToRemove.productName);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].quantity -= 1;
        if (updated[idx].quantity <= 0) return updated.filter((_, i) => i !== idx);
        return updated;
      }
      return prev;
    });
  };

  const handleCreateSales = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isST2) {
      if (!warehouse) { toast.error("Distributor selection is required"); return; }
      if (!selectedDistributor) { toast.error("Sub Dealer selection is required"); return; }
    } else if (isST1) {
      if (!selectedDistributor) { toast.error("Distributor (Buyer) selection is required"); return; }
      if (!warehouse.trim()) { toast.error("Warehouse Name is required"); return; }
    } else if (isTransfer) {
      if (!transferType) { toast.error("Transfer type is required"); return; }
      if (!warehouse) { toast.error("Transfer From is required"); return; }
      if (!selectedDistributor) { toast.error("Transfer To is required"); return; }
    } else if (isReturn) {
      if (!returnLock) { toast.error("Check at least one serial number first"); return; }
    }

    const passedItems = scannedItems.filter(item => item.status === "pass");
    if (passedItems.length === 0) {
      toast.error("Please check at least one passing serial number before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const nextIdNum = 12 + sales.length;
      const stId = `${stIdPrefix}${nextIdNum}`;
      const passedForAction = passedItems.map(item => ({ serial_no: item.imei, product_id: item.productId }));

      if (isST2) {
        const res = await submitSt2Action({ distributorId: warehouse, subDealerId: selectedDistributor, passedItems: passedForAction, date, stId });
        if (!res.success) throw new Error(res.error || "Failed to save transaction");
      } else if (isReturn) {
        if (!returnLock) throw new Error("Nothing resolved to return");
        const res = await submitReturnAction({
          sourceType: returnLock.sourceType,
          sourceId: returnLock.sourceId,
          destType: returnLock.destType,
          destId: returnLock.destId,
          passedItems: passedForAction,
          date,
          stId,
        });
        if (!res.success) throw new Error(res.error || "Failed to save transaction");
      } else if (isTransfer) {
        const res = await submitTransferAction({ transferType: transferType as PartyType, fromId: warehouse, toId: selectedDistributor, passedItems: passedForAction, date, stId });
        if (!res.success) throw new Error(res.error || "Failed to save transaction");
      } else if (isST1) {
        const passedSerials = passedItems.map(item => item.imei);
        const { data: transferred, error: transferErr } = await supabase
          .from("stock")
          .update({ distributor_id: selectedDistributor })
          .in("serial_no", passedSerials)
          .eq("warehouse_name", warehouse)
          .is("distributor_id", null)
          .neq("status", "sold_out")
          .select("id, product_id, serial_no");

        if (transferErr) throw transferErr;
        if (!transferred || transferred.length !== passedSerials.length) {
          throw new Error(`Only ${transferred?.length || 0} of ${passedSerials.length} units could be transferred — some may have already been claimed by another order. Please re-check serials and try again.`);
        }

        const warehouseRow = warehousesList.find(w => w.name === warehouse);
        const { data: saleRow, error: saleErr } = await supabase
          .from("sales")
          .insert({ type, source_type: "warehouse", source_id: warehouseRow?.id || null, destination_type: "distributor", destination_id: selectedDistributor, st_id: stId, date })
          .select("id")
          .single();
        if (saleErr) throw saleErr;

        const itemRows = transferred.map((t: any) => ({ sale_id: saleRow.id, stock_id: t.id, product_id: t.product_id }));
        if (itemRows.length > 0) {
          const { error: itemsErr } = await supabase.from("sale_items").insert(itemRows);
          if (itemsErr) throw itemsErr;
        }

        try {
          await supabase.from("activity_logs").insert({ action: `Create ${type} Ledger`, details: `${type} transaction ID "${stId}" transferred ${transferred.length} units from warehouse "${warehouse}" to distributor.` });
        } catch (logErr) {
          console.warn("Activity log failed:", logErr);
        }
      }

      toast.success(`${title} transaction successfully created!`);
      setIsCreating(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = sales.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = q ? item.st_id?.toLowerCase().includes(q) || item.source_name?.toLowerCase().includes(q) || item.destination_name?.toLowerCase().includes(q) : true;
    const matchesDistributor = filterDistributor ? item.destination_name === filterDistributor : true;
    const matchesWarehouse = filterWarehouse ? item.source_name === filterWarehouse : true;
    return matchesSearch && matchesDistributor && matchesWarehouse;
  });

  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const columns = [
    { key: "sno", label: "S.No" },
    { key: "date", label: "Date" },
    { key: "source_name", label: "Source" },
    { key: "destination_name", label: "Destination" },
    { key: "st_id", label: `${type.toUpperCase()} ID` },
  ];

  const uniqueWarehouses = Array.from(new Set(sales.map((s: any) => s.source_name).filter(Boolean))) as string[];
  const uniqueDistributorNames = Array.from(new Set(sales.map((s: any) => s.destination_name).filter(Boolean))) as string[];

  const isLockedDistributorCaller = isST2 && callerProfile?.role === "distributor";
  const callerDisplayName = isLockedDistributorCaller ? distributors.find(d => d.id === callerProfile?.id) : null;
  const availableSubDealers = subDealers.filter(s => s.distributor_id === warehouse);

  const transferFromOptions = transferType === "warehouse" ? warehousesList : transferType === "distributor" ? distributors : transferType === "sub_dealer" ? subDealers : [];
  const transferToOptions = transferFromOptions.filter((o: any) => o.id !== warehouse);

  return (
    <div className="space-y-6 select-none">
      {!isCreating ? (
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-500">Manage and track details for your {title} transactions.</p>
          </div>
          <button
            onClick={handleOpenCreateView}
            className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-semibold rounded-[6px] shadow flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {buttonLabel}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button onClick={() => setIsCreating(false)} className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-full transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Sales / {type} Dispatch Form</h1>
            <p className="text-xs text-slate-500">Scan serial numbers and verify delivery quantities before shipment.</p>
          </div>
        </div>
      )}

      {!isCreating ? (
        <DataTable
          title={`${title} Ledger`}
          columns={columns}
          data={paginated}
          isLoading={isLoading}
          searchPlaceholder={`Search ${type.toUpperCase()} ID...`}
          onSearch={(q) => { setSearchQuery(q); setCurrentPage(1); }}
          filters={[
            { label: "Destination", options: uniqueDistributorNames, value: filterDistributor, onChange: (val) => { setFilterDistributor(val); setCurrentPage(1); } },
            { label: "Source", options: uniqueWarehouses, value: filterWarehouse, onChange: (val) => { setFilterWarehouse(val); setCurrentPage(1); } },
          ]}
          pagination={{ current: currentPage, total: filtered.length, perPage: perPage, onChange: (page) => setCurrentPage(page) }}
        />
      ) : (
        <form onSubmit={handleCreateSales} className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

          <div className="lg:col-span-2 space-y-6">

            <div className="bg-white border border-slate-150 rounded-[8px] p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Basic Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!isST2 && !isTransfer && (
                  <div className={isReturn ? "md:col-span-2" : ""}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Seller</label>
                    <input type="text" value={seller} onChange={(e) => setSeller(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]" />
                  </div>
                )}

                {isST1 && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Warehouse Name*</label>
                      <select value={warehouse} onChange={(e) => handleWarehouseChange(e.target.value)} className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${sourceMissing ? "border-rose-500" : "border-slate-200"}`} required>
                        <option value="">Select Warehouse</option>
                        {warehousesList.map((wh) => (<option key={wh.id} value={wh.name}>{wh.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Buyer (Distributor)*</label>
                      <select value={selectedDistributor} onChange={(e) => setSelectedDistributor(e.target.value)} className="w-full h-10 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8]" required>
                        <option value="">Select Distributor</option>
                        {distributors.map((d) => (<option key={d.id} value={d.id}>{d.first_name} {d.last_name || ""}</option>))}
                      </select>
                    </div>
                  </>
                )}

                {isST2 && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Distributor Name*</label>
                      {isLockedDistributorCaller ? (
                        <div className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-500 bg-slate-50 flex items-center">
                          {callerDisplayName ? `${callerDisplayName.first_name} ${callerDisplayName.last_name || ""}`.trim() : "You"}
                        </div>
                      ) : (
                        <select value={warehouse} onChange={(e) => handleWarehouseChange(e.target.value)} className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${sourceMissing ? "border-rose-500" : "border-slate-200"}`} required>
                          <option value="">Select Distributor</option>
                          {distributors.map((d) => (<option key={d.id} value={d.id}>{d.first_name} {d.last_name || ""}</option>))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sub Dealer*</label>
                      <select value={selectedDistributor} onChange={(e) => setSelectedDistributor(e.target.value)} disabled={!warehouse} className="w-full h-10 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] disabled:bg-slate-50 disabled:text-slate-400" required>
                        <option value="">{!warehouse ? "Select a distributor first" : availableSubDealers.length === 0 ? "No sub dealers assigned" : "Select Sub Dealer"}</option>
                        {availableSubDealers.map((s) => (<option key={s.id} value={s.id}>{s.first_name} {s.last_name || ""}</option>))}
                      </select>
                    </div>
                  </>
                )}

                {isReturn && (
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Source / Destination</label>
                    {returnLock ? (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="px-3 h-9 flex items-center border border-slate-200 rounded-[6px] bg-slate-50 text-slate-700 font-semibold">{returnLock.sourceName}</span>
                        <ArrowLeft className="w-3.5 h-3.5 text-slate-400 rotate-180" />
                        <span className="px-3 h-9 flex items-center border border-slate-200 rounded-[6px] bg-slate-50 text-slate-700 font-semibold">{returnLock.destName}</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic py-2">Scan a serial number below — the source and destination are detected automatically.</p>
                    )}
                  </div>
                )}

                {isTransfer && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Transfer Type*</label>
                      <select value={transferType} onChange={(e) => handleTransferTypeChange(e.target.value as PartyType | "")} className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] ${sourceMissing && !transferType ? "border-rose-500" : "border-slate-200"}`} required>
                        <option value="">Select Type</option>
                        <option value="warehouse">Warehouse ↔ Warehouse</option>
                        <option value="distributor">Distributor ↔ Distributor</option>
                        <option value="sub_dealer">Sub Dealer ↔ Sub Dealer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Transfer From*</label>
                      <select value={warehouse} onChange={(e) => handleTransferFromChange(e.target.value)} disabled={!transferType} className={`w-full h-10 px-2 border rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] disabled:bg-slate-50 disabled:text-slate-400 ${sourceMissing && transferType && !warehouse ? "border-rose-500" : "border-slate-200"}`} required>
                        <option value="">{!transferType ? "Select a type first" : "Select Source"}</option>
                        {transferFromOptions.map((o: any) => (<option key={o.id} value={o.id}>{o.name || `${o.first_name} ${o.last_name || ""}`}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Transfer To*</label>
                      <select value={selectedDistributor} onChange={(e) => setSelectedDistributor(e.target.value)} disabled={!warehouse} className="w-full h-10 px-2 border border-slate-200 rounded-[6px] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00B4D8] disabled:bg-slate-50 disabled:text-slate-400" required>
                        <option value="">{!warehouse ? "Select a source first" : "Select Destination"}</option>
                        {transferToOptions.map((o: any) => (<option key={o.id} value={o.id}>{o.name || `${o.first_name} ${o.last_name || ""}`}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Delivery Date*</label>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]" required />
                    </div>
                  </>
                )}

                {!isTransfer && (
                  <div className={(isReturn || isST2) ? "md:col-span-2" : ""}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Delivery Date*</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]" required />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Order ID Remark</label>
                <input type="text" placeholder="Enter remarks or order reference note..." value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]" />
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-[8px] overflow-hidden shadow-sm flex flex-col justify-between">
              <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Order Summary</h3>
              </div>
              <div className="overflow-x-auto min-h-[160px]">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/10">
                      <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Product</th>
                      <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Delivery Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {orderDetails.map((row) => (
                      <tr key={row.productId} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-5 py-3 font-bold text-slate-800">{row.productName}</td>
                        <td className="px-5 py-3 text-right font-bold text-[#00B4D8]">{row.quantity} Units</td>
                      </tr>
                    ))}
                    {orderDetails.length === 0 && (
                      <tr><td colSpan={2} className="px-5 py-12 text-center text-slate-400 italic">No Data. Scan or verify serial numbers to populate details.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Submit operations - relocated to the bottom of Order Summary */}
              <div className="flex items-center gap-3 p-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 h-10 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-[6px] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || scannedItems.filter(i => i.status === "pass").length === 0} className="flex-[2] h-10 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white font-semibold text-xs rounded-[6px] shadow flex items-center justify-center gap-1.5 transition-colors">
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Order
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-150 rounded-[8px] p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Barcode className="w-4 h-4 text-[#00B4D8]" />
                BOXID / SN
              </h3>
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Please enter Serial Number(s), press enter or Check button to check</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Serial Number"
                    value={imeiInput}
                    onChange={(e) => setImeiInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCheckImei(); } }}
                    className="flex-1 h-10 px-3 border border-slate-200 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                  <button type="button" onClick={() => handleCheckImei()} disabled={isCheckingImei} className="h-10 px-4 bg-[#00B4D8] hover:bg-[#0077B6] text-white text-xs font-bold rounded-[6px] shadow flex items-center justify-center transition-colors min-w-[70px]">
                    {isCheckingImei ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] text-white border border-[#00B4D8]/20 rounded-[8px] p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-cyan-100 uppercase tracking-wider">Delivery Quantity</p>
                <p className="text-3xl font-extrabold tracking-tight mt-1">{scannedItems.filter(i => i.status === "pass").length}</p>
              </div>
              <Barcode className="w-12 h-12 opacity-30 text-white" />
            </div>

            <div className="bg-white border border-slate-150 rounded-[8px] p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Scan Record</h3>
                {scannedItems.some(i => i.status === "fail") && (
                  <button type="button" onClick={downloadRejectedCsv} className="flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:underline">
                    <Download className="w-3 h-3" />
                    Download Rejected CSV
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {scannedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-[6px] border border-slate-100 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{item.imei}</p>
                      {item.status === "fail" ? (
                        <p className="text-[9px] text-rose-500 font-bold mt-0.5">{item.reason}</p>
                      ) : (
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">{item.productName} ({item.model})</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${item.status === "fail" ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                        {item.status === "fail" ? "Fail" : "Pass"}
                      </span>
                      <button type="button" onClick={() => removeScannedItem(idx)} className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {scannedItems.length === 0 && (<div className="text-center py-8 text-slate-400 italic text-xs">No Record.</div>)}
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
