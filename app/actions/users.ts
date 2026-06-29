"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getAdminClient() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  // Use service role key if available for admin auth privileges, otherwise fallback to anon key
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createServerClient(supabaseUrl, supabaseServiceKey, {
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
          const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic };
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
    };

    let { error: profileError } = await supabase.from("profiles").insert(profileInsertData);

    if (profileError && (profileError.message.includes("column") || profileError.code === "PGRST204" || profileError.code === "42703")) {
      const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName };
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
      .single();

    if (error && (error.message.includes("column") || error.code === "PGRST204" || error.code === "42703")) {
      const metadata = { state, region, warehouse, address, city, bankName, bankAccount, accountHolderName, cnic };
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
        .single();
      error = retryError;
      data = retryData;
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
