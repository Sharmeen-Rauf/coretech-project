"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createJSClient } from "@supabase/supabase-js";
import { Client } from "pg";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseServiceKey) {
    // If service role key is present, bypass SSR cookies to run as superuser
    return createJSClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  const cookieStore = cookies();
  const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createServerClient(supabaseUrl, fallbackKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Safe to ignore in actions
        }
      },
    },
  });
}

export async function createUserAction(formData: any) {
  const supabase = getAdminClient();
  const {
    email,
    password,
    firstName,
    lastName,
    designation,
    contact,
    role,
    group,
    status,
    state,
    region,
    warehouse,
    address,
    city,
    bankName,
    bankAccount,
    accountHolderName,
    cnic,
    maritalStatus,
    paymentProvider,
    paymentAccountNo,
  } = formData;

  try {
    // 0. Pre-register / Whitelist email to pass database auth.users trigger
    const cookieStore = cookies();
    const serverClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );
    const { data: { session } } = await serverClient.auth.getSession();
    const invitedBy = session?.user?.id || null;

    const { error: whitelistError } = await supabase.from("allowed_users").upsert({
      email: email.trim().toLowerCase(),
      role: role,
      approval_status: status === "active" ? "approved" : "pending",
      invited_by: invitedBy,
    }, { onConflict: "email" });

    if (whitelistError) {
      throw new Error(`Whitelist pre-registration failed: ${whitelistError.message}`);
    }

    // 1. Create Auth User
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (authError) {
      // If service role isn't available, we fallback to creating a mock profile with a generated UUID for demo/local display
      if (authError.message.includes("Service Role") || authError.status === 401) {
        const tempId = crypto.randomUUID();
        const profileInsertData: any = {
          id: tempId,
          first_name: firstName,
          last_name: lastName,
          designation,
          contact,
          role,
          group_name: group,
          status,
          state: state || null,
          region: region || null,
          warehouse: warehouse || null,
          address: address || null,
          city: city || null,
          bank_name: bankName || null,
          bank_account: bankAccount || null,
          account_holder_name: accountHolderName || null,
          cnic: cnic || null,
          marital_status: maritalStatus || null,
          payment_provider: paymentProvider || null,
          payment_account_no: paymentAccountNo || null,
        };

        let { error: profileError } = await supabase.from("profiles").insert(profileInsertData);

        if (profileError && (profileError.message.includes("column") || profileError.code === "PGRST204" || profileError.code === "42703")) {
          const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic, maritalStatus, paymentProvider, paymentAccountNo, designation };
          const cleanInsertData = {
            id: tempId,
            first_name: firstName,
            last_name: lastName,
            designation: `[DISTRIBUTOR_METADATA]${JSON.stringify(metadata)}`,
            contact,
            role,
            group_name: group,
            status,
          };
          const { error: retryError } = await supabase.from("profiles").insert(cleanInsertData);
          profileError = retryError;
        }

        if (profileError) throw profileError;
        return { success: true, message: "Demo User created (Auth bypassed - local profile saved)", data: { id: tempId } };
      }
      throw authError;
    }

    // 2. Insert Profile row linked to the new Auth user
    const profileInsertData: any = {
      id: authUser.user.id,
      first_name: firstName,
      last_name: lastName,
      designation,
      contact,
      role,
      group_name: group,
      status,
      state: state || null,
      region: region || null,
      warehouse: warehouse || null,
      address: address || null,
      city: city || null,
      bank_name: bankName || null,
      bank_account: bankAccount || null,
      account_holder_name: accountHolderName || null,
      cnic: cnic || null,
      marital_status: maritalStatus || null,
      payment_provider: paymentProvider || null,
      payment_account_no: paymentAccountNo || null,
    };

    let { error: profileError } = await supabase.from("profiles").insert(profileInsertData);

    if (profileError && (profileError.message.includes("column") || profileError.code === "PGRST204" || profileError.code === "42703")) {
      const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic, maritalStatus, paymentProvider, paymentAccountNo, designation };
      const cleanInsertData = {
        id: authUser.user.id,
        first_name: firstName,
        last_name: lastName,
        designation: `[DISTRIBUTOR_METADATA]${JSON.stringify(metadata)}`,
        contact,
        role,
        group_name: group,
        status,
      };
      const { error: retryError } = await supabase.from("profiles").insert(cleanInsertData);
      profileError = retryError;
    }

    if (profileError) {
      // Cleanup created auth user and whitelist entry if profile insert fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      await supabase.from("allowed_users").delete().eq("email", email.trim().toLowerCase());
      throw profileError;
    }

    return { success: true, message: "User and Profile successfully created", data: authUser.user };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create user" };
  }
}

export async function updateUserAction(id: string, formData: any) {
  const supabase = getAdminClient();
  const {
    firstName,
    lastName,
    designation,
    contact,
    role,
    group,
    status,
    state,
    region,
    warehouse,
    address,
    city,
    bankName,
    bankAccount,
    accountHolderName,
    cnic,
    maritalStatus,
    paymentProvider,
    paymentAccountNo,
  } = formData;

  try {
    const updateData: any = {
      first_name: firstName,
      last_name: lastName,
      designation,
      contact,
      role: role || null,
      group_name: group,
      status,
      state: state || null,
      region: region || null,
      warehouse: warehouse || null,
      address: address || null,
      city: city || null,
      bank_name: bankName || null,
      bank_account: bankAccount || null,
      account_holder_name: accountHolderName || null,
      cnic: cnic || null,
      marital_status: maritalStatus || null,
      payment_provider: paymentProvider || null,
      payment_account_no: paymentAccountNo || null,
    };

    let { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (!error && data) {
      // Sync role change to allowed_users for authentication triggers
      const userEmail = formData.email || data.email || "";
      if (userEmail && role) {
        await supabase
          .from("allowed_users")
          .update({ role })
          .eq("email", userEmail.trim().toLowerCase());
      }
    }

    if (error) {
      // If RLS or other errors happened, let's keep going to column-missing checks
    } else if (!data) {
      throw new Error(`Profile not found in database for ID ${id}`);
    }

    if (error && (error.message.includes("column") || error.code === "PGRST204" || error.code === "42703")) {
      const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic, maritalStatus, paymentProvider, paymentAccountNo, designation };
      const cleanUpdateData = {
        first_name: firstName,
        last_name: lastName,
        designation: `[DISTRIBUTOR_METADATA]${JSON.stringify(metadata)}`,
        contact,
        role: role || null,
        group_name: group,
        status,
      };
      const { data: retryData, error: retryError } = await supabase
        .from("profiles")
        .update(cleanUpdateData)
        .eq("id", id)
        .select()
        .maybeSingle();
      error = retryError;
      data = retryData;

      if (!error && !data) {
        throw new Error(`Profile not found in database during metadata fallback update for ID ${id}`);
      }
    }

    if (error) throw error;

    return { success: true, message: "User profile successfully updated", data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update profile" };
  }
}

export async function deleteUserAction(id: string) {
  const supabase = getAdminClient();
  try {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) throw error;
    
    // Attempt to delete auth user as well if permissions allow
    await supabase.auth.admin.deleteUser(id); 

    return { success: true, message: "User deleted successfully" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete user" };
  }
}

export async function deleteRecordAction(table: string, id: string) {
  const supabase = getAdminClient();
  try {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    return { success: true, message: "Record deleted successfully" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete record" };
  }
}

export async function updateRecordAction(table: string, id: string, data: any) {
  const supabase = getAdminClient();
  try {
    const { data: updated, error } = await supabase
      .from(table)
      .update(data)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return { success: true, message: "Record updated successfully", data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update record" };
  }
}

export async function fetchRecordsAction(table: string, filters?: { column: string; value: string }[], orderBy?: string) {
  const supabase = getAdminClient();
  try {
    let query = supabase.from(table).select("*");
    if (filters) {
      for (const f of filters) {
        query = query.eq(f.column, f.value);
      }
    }
    if (orderBy) {
      query = query.order(orderBy, { ascending: false });
    }
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch records", data: [] };
  }
}

export async function fetchProfilesAction(role?: string) {
  const supabase = getAdminClient();
  try {
    let query = supabase.from("profiles").select("*");
    if (role) {
      query = query.eq("role", role);
    }
    query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch profiles", data: [] };
  }
}

export async function createRecordAction(table: string, data: any) {
  const supabase = getAdminClient();
  try {
    const { data: created, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .maybeSingle();

    if (error) throw error;
    return { success: true, message: "Record created successfully", data: created };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create record" };
  }
}

// auth.users (Supabase's own login table) is the one place a real, correctly-typed
// email is guaranteed to live - auth.users.id is always the same id as profiles.id
// since that's how accounts get created. allowed_users.id is NOT reliable for this:
// it's a separate, independently-generated id with no link back to the real account.
async function queryAuthUsers(whereClause: string, params: any[]): Promise<{ id: string; email: string }[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query(`SELECT id, email FROM auth.users WHERE ${whereClause}`, params);
    return res.rows;
  } finally {
    await client.end().catch(() => {});
  }
}

export async function fetchEmailsByIdsAction(ids: string[]) {
  if (!ids || ids.length === 0) return { success: true, data: {} as Record<string, string> };
  try {
    const rows = await queryAuthUsers("id = ANY($1)", [ids]);
    const map: Record<string, string> = {};
    rows.forEach((r) => { map[r.id] = r.email; });
    return { success: true, data: map };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch emails", data: {} as Record<string, string> };
  }
}

// Resolves the logged-in caller's own role from their session cookie, independent of
// whatever the client claims - the password reset actions below must never trust the client.
async function getCallerSessionId(): Promise<string | null> {
  const cookieStore = cookies();
  const serverClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore in actions
          }
        },
      },
    }
  );
  const { data: { session } } = await serverClient.auth.getSession();
  return session?.user?.id || null;
}

export async function getCallerRole(): Promise<string | null> {
  const callerId = await getCallerSessionId();
  if (!callerId) return null;

  const supabase = getAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  return profile?.role || null;
}

// Same lookup as getCallerRole, but also returns the caller's own id — needed
// wherever an action must both authorize the caller AND stamp who performed it
// (e.g. verified_by/approved_by columns).
export async function getCallerIdentity(): Promise<{ id: string; role: string | null } | null> {
  const callerId = await getCallerSessionId();
  if (!callerId) return null;

  const supabase = getAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", callerId)
    .maybeSingle();

  return { id: callerId, role: profile?.role || null };
}

// === Installer registration two-stage review ===
// Stage 1 (verify/reject): Regional Manager, Country Head, or Admin.
// Stage 2 (final approve/reject): Country Head or Admin only.

export async function verifyInstallerStage1Action(instId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || !["retail_manager", "country_head", "admin"].includes(caller.role || "")) {
      return { success: false, error: "You don't have permission to verify this registration" };
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        status: "pending_approval",
        verified_by: caller.id,
        verified_at: new Date().toISOString(),
        verification_note: "Credentials and documents verified by Retail Manager.",
      })
      .eq("id", instId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify installer" };
  }
}

export async function approveInstallerStage2Action(instId: string) {
  try {
    const caller = await getCallerIdentity();
    if (!caller || !["country_head", "admin"].includes(caller.role || "")) {
      return { success: false, error: "Only Country Head or Admin can give final approval" };
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        status: "active",
        approved_by: caller.id,
        approved_at: new Date().toISOString(),
        approval_note: "Final approval granted by Country Head.",
      })
      .eq("id", instId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve installer" };
  }
}

export async function rejectInstallerStage1Action(instId: string) {
  const caller = await getCallerIdentity();
  if (!caller || !["retail_manager", "country_head", "admin"].includes(caller.role || "")) {
    return { success: false, error: "You don't have permission to reject this registration" };
  }
  return deleteUserAction(instId);
}

export async function rejectInstallerStage2Action(instId: string) {
  const caller = await getCallerIdentity();
  if (!caller || !["country_head", "admin"].includes(caller.role || "")) {
    return { success: false, error: "Only Country Head or Admin can reject at this stage" };
  }
  return deleteUserAction(instId);
}

export async function lookupUserByEmailAction(email: string) {
  try {
    const callerRole = await getCallerRole();
    if (callerRole !== "admin") {
      return { success: false, error: "Only admins can look up accounts for password reset" };
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: "Email is required" };

    const [authUser] = await queryAuthUsers("email = $1", [cleanEmail]);
    if (!authUser) {
      return { success: false, error: "No account found with that email" };
    }

    const supabase = getAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role, status")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, error: "Account found but no profile record exists for it" };
    }

    return {
      success: true,
      data: {
        id: profile.id,
        name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "-",
        role: profile.role,
        status: profile.status,
        email: authUser.email,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Lookup failed" };
  }
}

export async function resetUserPasswordAction(email: string, newPassword: string) {
  try {
    const callerRole = await getCallerRole();
    if (callerRole !== "admin") {
      return { success: false, error: "Only admins can reset passwords" };
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) return { success: false, error: "Email is required" };

    // Server-side floor — the UI enforces this too, but a server action can be
    // called directly, so this is the real security boundary.
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters" };
    }

    const [authUser] = await queryAuthUsers("email = $1", [cleanEmail]);
    if (!authUser) {
      return { success: false, error: "No account found with that email" };
    }

    const supabase = getAdminClient();
    const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
      password: newPassword,
    });

    if (updateError) throw updateError;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reset password" };
  }
}

export async function reloadSchemaAction() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  try {
    await client.connect();
    await client.query("NOTIFY pgrst, 'reload schema';");
    await client.end();
    return { success: true, message: "PostgREST schema cache reloaded successfully!" };
  } catch (err: any) {
    console.error("Failed to reload schema cache on Supabase:", err);
    return { success: false, error: err.message };
  }
}

