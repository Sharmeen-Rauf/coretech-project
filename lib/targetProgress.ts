// Shared "units achieved" resolver for Target Management. A target is now a
// single (assignee, product, period) line - see notes on the `targets` table
// rebuild. A target can be assigned to any role except installer, and
// different roles get credited from different real activity, always scoped
// to the target's own product_id:
// - distributor -> their own outgoing ST-2 units of that product
//   (sales.source_type = 'distributor', sale_items.product_id) plus any units
//   of that product they personally Sell Out (stock.distributor_id + product_id)
// - sub_dealer  -> their own incoming ST-2 units of that product
//   (sales.destination_type = 'sub_dealer', sale_items.product_id) plus any
//   units of that product they personally Sell Out (stock.sub_dealer_id + product_id)
// - everyone else (employee, rsm, or any other role that can end up
//   coordinating a Buzzcart order - see createBuzzcartOrderAction) ->
//   orders.sales_coordinator_id, summing only the order's line item(s) whose
//   productId matches the target's product
//
// Buzzcart order volume doesn't reflect how distributor/sub_dealer actually
// move product (that's ST-2 + Sell Out), so those two roles are resolved
// entirely differently from everyone else - see computeAchievedUnitsForTargets.
//
// An order counts once it's `approved` and stays counted permanently as it
// matures through invoice_generated/delivered - never once it's declined.
// ST-2/Sell Out units count as soon as they're recorded (both are terminal,
// one-way actions with no pending/rejected state of their own).
// Matched against the target's period using the relevant activity's own date.

const COUNTED_STATUSES = ["approved", "invoice_generated", "delivered"];

export interface TargetPeriodRef {
  id: string;
  assigneeId: string;
  assigneeRole: string;
  productId: string;
  periodStart: string; // date, "YYYY-MM-DD"
  periodEnd: string; // date, "YYYY-MM-DD"
}

function sumItemQuantitiesForProduct(items: any, productId: string): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum: number, item: any) => (item?.productId === productId ? sum + (Number(item?.quantity) || 0) : sum), 0);
}

function withinPeriod(dateVal: string, periodStart: string, periodEnd: string): boolean {
  if (!dateVal) return false;
  const t = new Date(dateVal).getTime();
  const start = new Date(`${periodStart}T00:00:00`).getTime();
  const end = new Date(`${periodEnd}T23:59:59.999`).getTime();
  return t >= start && t <= end;
}

// distributor + sub_dealer: ST-2 units (as the actual sender/receiver) + Sell
// Out units they personally sold, both counted directly from their respective
// source tables rather than Buzzcart's `orders`, filtered to the target's own product.
async function computeDistributorSubDealerAchieved(
  supabase: any,
  targets: TargetPeriodRef[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (targets.length === 0) return result;

  const distributorIds = Array.from(new Set(targets.filter((t) => t.assigneeRole === "distributor").map((t) => t.assigneeId)));
  const subDealerIds = Array.from(new Set(targets.filter((t) => t.assigneeRole === "sub_dealer").map((t) => t.assigneeId)));

  const [distSalesRes, subSalesRes] = await Promise.all([
    distributorIds.length > 0
      ? supabase.from("sales").select("id, source_id, date").eq("type", "ST2").eq("source_type", "distributor").in("source_id", distributorIds)
      : Promise.resolve({ data: [] }),
    subDealerIds.length > 0
      ? supabase.from("sales").select("id, destination_id, date").eq("type", "ST2").eq("destination_type", "sub_dealer").in("destination_id", subDealerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const distSales = distSalesRes.data || [];
  const subSales = subSalesRes.data || [];

  const allSaleIds = [...distSales.map((s: any) => s.id), ...subSales.map((s: any) => s.id)];
  const { data: itemsData } =
    allSaleIds.length > 0 ? await supabase.from("sale_items").select("sale_id, product_id").in("sale_id", allSaleIds) : { data: [] };
  // sale_id -> product_id -> unit count, so a target can look up exactly its own product's share of that sale.
  const itemCountBySaleProduct = new Map<string, number>();
  (itemsData || []).forEach((it: any) => {
    const key = `${it.sale_id}|${it.product_id}`;
    itemCountBySaleProduct.set(key, (itemCountBySaleProduct.get(key) || 0) + 1);
  });

  const [distSelloutRes, subSelloutRes] = await Promise.all([
    distributorIds.length > 0
      ? supabase.from("stock").select("distributor_id, product_id, sold_out_at").eq("status", "sold_out").in("distributor_id", distributorIds)
      : Promise.resolve({ data: [] }),
    subDealerIds.length > 0
      ? supabase.from("stock").select("sub_dealer_id, product_id, sold_out_at").eq("status", "sold_out").in("sub_dealer_id", subDealerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const distSellouts = distSelloutRes.data || [];
  const subSellouts = subSelloutRes.data || [];

  targets.forEach((t) => {
    let achieved = 0;
    if (t.assigneeRole === "distributor") {
      achieved += distSales
        .filter((s: any) => s.source_id === t.assigneeId && withinPeriod(s.date, t.periodStart, t.periodEnd))
        .reduce((sum: number, s: any) => sum + (itemCountBySaleProduct.get(`${s.id}|${t.productId}`) || 0), 0);
      achieved += distSellouts.filter(
        (r: any) => r.distributor_id === t.assigneeId && r.product_id === t.productId && withinPeriod(r.sold_out_at, t.periodStart, t.periodEnd)
      ).length;
    } else if (t.assigneeRole === "sub_dealer") {
      achieved += subSales
        .filter((s: any) => s.destination_id === t.assigneeId && withinPeriod(s.date, t.periodStart, t.periodEnd))
        .reduce((sum: number, s: any) => sum + (itemCountBySaleProduct.get(`${s.id}|${t.productId}`) || 0), 0);
      achieved += subSellouts.filter(
        (r: any) => r.sub_dealer_id === t.assigneeId && r.product_id === t.productId && withinPeriod(r.sold_out_at, t.periodStart, t.periodEnd)
      ).length;
    }
    result.set(t.id, achieved);
  });

  return result;
}

// Everyone else (not distributor/sub_dealer): Buzzcart order volume attributed
// via orders.sales_coordinator_id, filtered to just the target's own product
// within each order's line items.
async function computeOrderBasedAchieved(supabase: any, targets: TargetPeriodRef[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (targets.length === 0) return result;

  const ids = Array.from(new Set(targets.map((t) => t.assigneeId)));
  const { data } = await supabase
    .from("orders")
    .select("sales_coordinator_id, items, created_at, status")
    .in("sales_coordinator_id", ids)
    .in("status", COUNTED_STATUSES);
  const orders = data || [];

  targets.forEach((t) => {
    const achieved = orders
      .filter((o: any) => o.sales_coordinator_id === t.assigneeId && withinPeriod(o.created_at, t.periodStart, t.periodEnd))
      .reduce((sum: number, o: any) => sum + sumItemQuantitiesForProduct(o.items, t.productId), 0);
    result.set(t.id, achieved);
  });

  return result;
}

export async function computeAchievedUnitsForTargets(
  supabase: any,
  targets: TargetPeriodRef[]
): Promise<Map<string, number>> {
  if (targets.length === 0) return new Map();

  const distSubTargets = targets.filter((t) => t.assigneeRole === "distributor" || t.assigneeRole === "sub_dealer");
  const otherTargets = targets.filter((t) => t.assigneeRole !== "distributor" && t.assigneeRole !== "sub_dealer");

  const [distSubMap, otherMap] = await Promise.all([
    computeDistributorSubDealerAchieved(supabase, distSubTargets),
    computeOrderBasedAchieved(supabase, otherTargets),
  ]);

  const result = new Map<string, number>();
  distSubMap.forEach((v, k) => result.set(k, v));
  otherMap.forEach((v, k) => result.set(k, v));
  return result;
}
