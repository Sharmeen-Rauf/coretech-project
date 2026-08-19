// Shared "units achieved" resolver for Target Management. A target can be
// assigned to any role, but Buzzcart orders attribute a person via a
// different column depending on which role they actually are:
// - distributor -> orders.distributor_id
// - sub_dealer  -> orders.user_id (the buyer)
// - everyone else (employee, rsm, or any other role that can end up
//   coordinating an order - see createBuzzcartOrderAction) -> orders.sales_coordinator_id
//
// Some roles (installer, and most pure-management roles) never appear in any
// of these columns at all - a target assigned to one of those will always
// resolve to 0 achieved units. That's expected, not a bug: there's simply no
// Buzzcart activity to attribute to them today.
//
// An order counts once it's `approved` and stays counted permanently as it
// matures through invoice_generated/delivered - never once it's declined.
// Matched against the target's period using the order's created_at.

const COUNTED_STATUSES = ["approved", "invoice_generated", "delivered"];

export interface TargetPeriodRef {
  id: string;
  assigneeId: string;
  assigneeRole: string;
  periodStart: string; // date, "YYYY-MM-DD"
  periodEnd: string; // date, "YYYY-MM-DD"
}

function columnForRole(role: string): "distributor_id" | "user_id" | "sales_coordinator_id" {
  if (role === "distributor") return "distributor_id";
  if (role === "sub_dealer") return "user_id";
  return "sales_coordinator_id";
}

function sumItemQuantities(items: any): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0);
}

function withinPeriod(createdAt: string, periodStart: string, periodEnd: string): boolean {
  const t = new Date(createdAt).getTime();
  const start = new Date(`${periodStart}T00:00:00`).getTime();
  const end = new Date(`${periodEnd}T23:59:59.999`).getTime();
  return t >= start && t <= end;
}

// Batch-resolves achieved units for a set of targets in at most 3 queries
// total (one per attribution column actually needed), rather than one query
// per target - each target keeps its own period, so the date filtering
// happens in-memory per target after the broader per-column fetch.
export async function computeAchievedUnitsForTargets(
  supabase: any,
  targets: TargetPeriodRef[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (targets.length === 0) return result;

  const idsByColumn: Record<string, Set<string>> = {
    distributor_id: new Set(),
    user_id: new Set(),
    sales_coordinator_id: new Set(),
  };
  targets.forEach((t) => {
    idsByColumn[columnForRole(t.assigneeRole)].add(t.assigneeId);
  });

  const ordersByColumn: Record<string, any[]> = {};
  await Promise.all(
    (Object.keys(idsByColumn) as Array<keyof typeof idsByColumn>).map(async (col) => {
      const ids = Array.from(idsByColumn[col]);
      if (ids.length === 0) {
        ordersByColumn[col] = [];
        return;
      }
      const { data } = await supabase
        .from("orders")
        .select(`${col}, items, created_at, status`)
        .in(col, ids)
        .in("status", COUNTED_STATUSES);
      ordersByColumn[col] = data || [];
    })
  );

  targets.forEach((t) => {
    const col = columnForRole(t.assigneeRole);
    const orders = ordersByColumn[col] || [];
    const achieved = orders
      .filter((o: any) => o[col] === t.assigneeId && withinPeriod(o.created_at, t.periodStart, t.periodEnd))
      .reduce((sum: number, o: any) => sum + sumItemQuantities(o.items), 0);
    result.set(t.id, achieved);
  });

  return result;
}
