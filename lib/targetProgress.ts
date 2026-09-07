// Shared "units achieved" resolver for Target Management. A target is now a
// single (assignee, product, period) line - see notes on the `targets` table
// rebuild. A target can be assigned to any role except installer, and
// different roles get credited from different real activity, always scoped
// to the target's own product_id:
// - distributor -> their own incoming ST-1 units of that product - what they
//   purchase from a warehouse, or via a distributor-to-distributor transfer
//   (sales.type = 'ST1', destination_type = 'distributor', sale_items.product_id).
//   Corrected 2026-09-07: this previously credited outgoing ST-2 units plus
//   Sell Out instead, and never referenced ST-1 at all. Client confirmed
//   distributor targets track purchase commitment (ST-1), not downstream
//   resale - a deliberate, different incentive shape from sub_dealer below.
// - sub_dealer  -> their own units personally Sold Out of that product
//   (stock.sub_dealer_id + product_id, status = sold_out). Corrected
//   2026-09-07: this previously also credited incoming ST-2 units; client
//   confirmed Sell Out is the sole trigger - a sub-dealer's target reflects
//   actual sell-through to the end customer, not stock merely received.
// - everyone else (employee, rsm, or any other role that can end up
//   coordinating a Buzzcart order - see createBuzzcartOrderAction) ->
//   orders.sales_coordinator_id, summing only the order's line item(s) whose
//   productId matches the target's product
//
// Buzzcart order volume doesn't reflect how distributor/sub_dealer actually
// move product (that's ST-1 purchases for distributor, Sell Out for
// sub_dealer), so those two roles are resolved entirely differently from
// everyone else - see computeAchievedUnitsForTargets.
//
// An order counts once it's `approved` and stays counted permanently as it
// matures through invoice_generated/delivered - never once it's declined.
// ST-1/Sell Out units count as soon as they're recorded (both are terminal,
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

// distributor: their own incoming ST-1 units (purchase volume, not resale).
// sub_dealer: Sell Out units they personally sold. Counted directly from
// their respective source tables rather than Buzzcart's `orders`, filtered
// to the target's own product.
async function computeDistributorSubDealerAchieved(
  supabase: any,
  targets: TargetPeriodRef[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (targets.length === 0) return result;

  const distributorIds = Array.from(new Set(targets.filter((t) => t.assigneeRole === "distributor").map((t) => t.assigneeId)));
  const subDealerIds = Array.from(new Set(targets.filter((t) => t.assigneeRole === "sub_dealer").map((t) => t.assigneeId)));

  const [distSalesRes, subSelloutRes] = await Promise.all([
    distributorIds.length > 0
      ? supabase.from("sales").select("id, destination_id, date").eq("type", "ST1").eq("destination_type", "distributor").in("destination_id", distributorIds)
      : Promise.resolve({ data: [] }),
    subDealerIds.length > 0
      ? supabase.from("stock").select("sub_dealer_id, product_id, sold_out_at").eq("status", "sold_out").in("sub_dealer_id", subDealerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const distSales = distSalesRes.data || [];
  const subSellouts = subSelloutRes.data || [];

  const { data: itemsData } =
    distSales.length > 0
      ? await supabase.from("sale_items").select("sale_id, product_id").in("sale_id", distSales.map((s: any) => s.id))
      : { data: [] };
  // sale_id -> product_id -> unit count, so a target can look up exactly its own product's share of that sale.
  const itemCountBySaleProduct = new Map<string, number>();
  (itemsData || []).forEach((it: any) => {
    const key = `${it.sale_id}|${it.product_id}`;
    itemCountBySaleProduct.set(key, (itemCountBySaleProduct.get(key) || 0) + 1);
  });

  targets.forEach((t) => {
    let achieved = 0;
    if (t.assigneeRole === "distributor") {
      achieved = distSales
        .filter((s: any) => s.destination_id === t.assigneeId && withinPeriod(s.date, t.periodStart, t.periodEnd))
        .reduce((sum: number, s: any) => sum + (itemCountBySaleProduct.get(`${s.id}|${t.productId}`) || 0), 0);
    } else if (t.assigneeRole === "sub_dealer") {
      achieved = subSellouts.filter(
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
