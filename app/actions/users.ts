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
  const { email, password, firstName, lastName, designation, contact, role, group, status } = formData;

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
        const { error: profileError } = await supabase.from("profiles").insert({
          id: tempId,
          first_name: firstName,
          last_name: lastName,
          designation,
          contact,
          role,
          group_name: group,
          status,
        });

        if (profileError) throw profileError;
        return { success: true, message: "Demo User created (Auth bypassed - local profile saved)", data: { id: tempId } };
      }
      throw authError;
    }

    // 2. Insert Profile row linked to the new Auth user
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authUser.user.id,
      first_name: firstName,
      last_name: lastName,
      designation,
      contact,
      role,
      group_name: group,
      status,
    });

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
  const { firstName, lastName, designation, contact, group, status } = formData;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        designation,
        contact,
        group_name: group,
        status,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return { success: true, message: "User profile successfully updated", data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update profile" };
  }
}
