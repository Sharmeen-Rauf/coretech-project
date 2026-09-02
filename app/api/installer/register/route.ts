import { NextRequest, NextResponse } from "next/server";
import { createUserAction } from "@/app/actions/users";

// Public route - mirrors app/installer/register/page.tsx's self-registration
// flow (no auth required to apply; the real gate is the two-stage approval
// that happens afterward, same as the web form). Mobile equivalent of that
// page, called from the app's own Sign-Up screen.
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const {
    firstName,
    lastName,
    email,
    password,
    contact,
    cnic,
    address,
    city,
    state,
    maritalStatus,
    paymentProvider,
    paymentAccountNo,
  } = body || {};

  // createUserAction assumes its caller already validated required fields
  // (true for the web form, which checks client-side first) - this route has
  // no such guarantee from whatever's calling it, so it validates at the
  // boundary instead of letting a missing field crash the action outright.
  const errors: string[] = [];
  if (!String(firstName || "").trim()) errors.push("First name is required");
  if (!String(lastName || "").trim()) errors.push("Last name is required");
  if (!String(address || "").trim()) errors.push("Address is required");
  if (!String(city || "").trim()) errors.push("City is required");
  if (!String(state || "").trim()) errors.push("State is required");
  const cleanCnic = String(cnic || "").replace(/\D/g, "");
  if (cleanCnic.length !== 13) errors.push("CNIC must be exactly 13 digits");
  if (String(contact || "").trim().length < 10) errors.push("A valid contact number is required");
  if (!/\S+@\S+\.\S+/.test(String(email || ""))) errors.push("A valid email is required");
  if (String(password || "").length < 6) errors.push("Password must be at least 6 characters");
  if (!String(paymentAccountNo || "").trim()) errors.push("Payment account number is required");

  if (errors.length > 0) {
    return NextResponse.json({ success: false, error: errors.join(" ") }, { status: 400 });
  }

  const result = await createUserAction({
    firstName,
    lastName,
    email,
    password,
    designation: "Installer",
    contact,
    role: "installer",
    group: "operations",
    status: "pending_verification",
    state,
    address,
    city,
    cnic,
    maritalStatus,
    paymentProvider,
    paymentAccountNo,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
