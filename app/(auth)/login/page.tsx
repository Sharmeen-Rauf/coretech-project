"use client";
 
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@/lib/supabase";
import toast from "react-hot-toast";
import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
 
  // MFA states
  const [step, setStep] = useState<"login" | "mfa">("login");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRedirectRole, setMfaRedirectRole] = useState("");
 
  const router = useRouter();
  const supabase = createClientComponentClient();
 
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }
 
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
 
      if (error) {
        toast.error(error.message);
        setIsLoading(false);
        return;
      }
 
      // Fetch user role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("Login: failed to fetch profile role:", profileError);
      }

      const userRole = profile?.role || "";
      if (!userRole) {
        toast.error("Profile role not found. Please contact administrator.");
        setIsLoading(false);
        return;
      }
      
      if (userRole === "installer") {
        toast.success("Sign in successful!");
        router.push("/installer");
      } else {
        setMfaRedirectRole(userRole);
        // Prompt MFA verification step
        toast.success("Credentials verified. Verification code sent!");
        setStep("mfa");
      }
    } catch (err: any) {
      toast.error(err.message || "An authentication error occurred");
    } finally {
      setIsLoading(false);
    }
  };
 
  const handleVerifyMfa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    if (mfaCode !== "123456") {
      toast.error("Invalid verification code. Please try again.");
      return;
    }

    setIsLoading(true);
    // Simulate short network verification delay
    setTimeout(() => {
      setIsLoading(false);
      toast.success("MFA authentication successful!");
      // Set secure cookie for middleware check
      document.cookie = "mfa_verified=true; path=/; max-age=3600; SameSite=Lax";
      
      if (mfaRedirectRole === "installer") {
        router.push("/installer");
      } else {
        router.push("/dashboard");
      }
    }, 1000);
  };
 
  return (
    <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center p-4">
      {/* Logo Area */}
      <div className="mb-6 flex flex-col items-center">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] flex items-center justify-center text-white font-extrabold text-sm shadow">
            CT
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-800">
            Core<span className="text-[#00B4D8]">TECH</span>
          </span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold">
          Your Core Partner in TECH
        </p>
      </div>

      {/* Card Wrapper */}
      <div className="w-full max-w-sm bg-[#F0FAFE] border border-[#00B4D8] rounded-[12px] p-6 shadow-lg">
        {step === "login" ? (
          <>
            <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">Login</h2>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@coretechsolar.pk"
                  className="w-full h-9 px-3 bg-white border border-[#00B4D8]/30 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 bg-white border border-[#00B4D8]/30 rounded-[6px] text-xs text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 mt-2 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white font-medium rounded-[6px] flex items-center justify-center gap-2 shadow transition-all duration-200"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign in
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center space-y-3 mb-6">
              <div className="w-12 h-12 bg-[#00B4D8]/10 text-[#00B4D8] rounded-full flex items-center justify-center border border-[#00B4D8]/20">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">MFA Verification</h2>
              <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                A verification code has been dispatched. Enter the 6-digit security code below to proceed (Use <span className="text-[#00B4D8] font-bold">123456</span> for demo).
              </p>
            </div>
 
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="0 0 0 0 0 0"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full h-11 text-center font-bold tracking-[8px] bg-white border border-[#00B4D8]/30 rounded-[6px] focus:outline-none focus:border-[#00B4D8] text-base text-slate-800 placeholder-slate-400 transition-colors"
                  required
                />
              </div>
 
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 mt-2 bg-[#00B4D8] hover:bg-[#0077B6] disabled:bg-[#00B4D8]/60 text-white font-medium rounded-[6px] flex items-center justify-center gap-2 shadow transition-all duration-200"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Verify & Authorize
              </button>
 
              <button
                type="button"
                onClick={() => setStep("login")}
                className="w-full h-8 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel & Go Back
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
