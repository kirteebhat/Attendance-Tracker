import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Lock, AlertCircle, Info, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or Employee ID is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const searchParams = new URLSearchParams(location.search);
  const sessionExpired = searchParams.get("reason") === "session_expired";
  const redirectTarget = searchParams.get("redirect") || "/";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "admin@vorldx.demo",
      password: "Admin@VorldX2026!",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await login(data);
      navigate(redirectTarget, { replace: true });
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setServerError(errorObj.message || "Invalid credentials. Please verify and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoFill = (identifier: string) => {
    setValue("identifier", identifier);
    if (identifier.includes("admin")) {
      setValue("password", "Admin@VorldX2026!");
    } else {
      setValue("password", "Hr@VorldX2026!");
    }
    setServerError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 selection:bg-cyan-500 selection:text-slate-900">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/20 to-cyan-500/20 rounded-full blur-3xl opacity-70" />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 items-center justify-center text-white shadow-xl shadow-blue-500/25 mb-1">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Vorld<span className="text-cyan-400">X</span> Workforce Suite
          </h1>
          <p className="text-xs text-slate-400">
            Enterprise Attendance, Dynamic QR & Real-Time Management
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-2xl rounded-2xl">
          {sessionExpired && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold block">Session Expired</span>
                Your authentication session has expired. Please sign in to resume.
              </div>
            </div>
          )}

          {serverError && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div className="text-xs font-medium">{serverError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                label="Email or Employee ID"
                placeholder="e.g. admin@vorldx.demo or ADM-001"
                autoComplete="username"
                error={errors.identifier?.message}
                {...register("identifier")}
              />
            </div>

            <div>
              <Input
                type="password"
                label="Password"
                placeholder="••••••••••••"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register("password")}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 font-semibold shadow-md shadow-blue-600/20"
              isLoading={isSubmitting}
            >
              <Lock className="w-4 h-4 mr-1.5" />
              Sign In to Portal
            </Button>
          </form>

          {/* Quick Demo Credentials Autofill */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
              <span>Demo Quick Switcher</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleDemoFill("admin@vorldx.demo")}
                className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium transition-colors text-left flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span>Demo Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill("hr@vorldx.demo")}
                className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium transition-colors text-left flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-600" />
                <span>Demo HR</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Pre-seeded accounts authenticate against local in-memory/MongoDB.
            </p>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          VorldX Industries &copy; 2026. Internal Corporate Portal.
        </p>
      </div>
    </div>
  );
};
