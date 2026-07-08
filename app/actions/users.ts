"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createJSClient } from "@supabase/supabase-js";

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
  } = formData;

  try {
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
        };

        let { error: profileError } = await supabase.from("profiles").insert(profileInsertData);

        if (profileError && (profileError.message.includes("column") || profileError.code === "PGRST204" || profileError.code === "42703")) {
          const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic, designation };
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
    };

    let { error: profileError } = await supabase.from("profiles").insert(profileInsertData);

    if (profileError && (profileError.message.includes("column") || profileError.code === "PGRST204" || profileError.code === "42703")) {
      const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic, designation };
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
      // Cleanup created auth user if profile insert fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
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
  } = formData;

  try {
    const updateData: any = {
      first_name: firstName,
      last_name: lastName,
      designation,
      contact,
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
    };

    let { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      // If RLS or other errors happened, let's keep going to column-missing checks
    } else if (!data) {
      throw new Error(`Profile not found in database for ID ${id}`);
    }

    if (error && (error.message.includes("column") || error.code === "PGRST204" || error.code === "42703")) {
      const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic, designation };
      const cleanUpdateData = {
        first_name: firstName,
        last_name: lastName,
        designation: `[DISTRIBUTOR_METADATA]${JSON.stringify(metadata)}`,
        contact,
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

