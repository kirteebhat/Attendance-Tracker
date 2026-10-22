import React from "react";
import { Card } from "../ui/Card";
import { LucideIcon } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: number | string;
  subtext?: string;
  icon: LucideIcon;
  variant?: "blue" | "emerald" | "amber" | "indigo" | "rose" | "cyan";
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  variant = "blue",
}) => {
  const variantStyles = {
    blue: {
      bg: "bg-blue-50 text-blue-700 border-blue-100",
      iconBg: "bg-blue-100 text-blue-700",
      accent: "text-blue-600",
    },
    emerald: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-100",
      iconBg: "bg-emerald-100 text-emerald-700",
      accent: "text-emerald-600",
    },
    amber: {
      bg: "bg-amber-50 text-amber-700 border-amber-100",
      iconBg: "bg-amber-100 text-amber-700",
      accent: "text-amber-600",
    },
    indigo: {
      bg: "bg-indigo-50 text-indigo-700 border-indigo-100",
      iconBg: "bg-indigo-100 text-indigo-700",
      accent: "text-indigo-600",
    },
    rose: {
      bg: "bg-rose-50 text-rose-700 border-rose-100",
      iconBg: "bg-rose-100 text-rose-700",
      accent: "text-rose-600",
    },
    cyan: {
      bg: "bg-cyan-50 text-cyan-700 border-cyan-100",
      iconBg: "bg-cyan-100 text-cyan-700",
      accent: "text-cyan-600",
    },
  };

  const style = variantStyles[variant];

  return (
    <Card hoverEffect className="p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        <div className={`p-2.5 rounded-xl ${style.iconBg} shadow-xs`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
        {subtext && <p className="text-xs text-slate-500 mt-1 font-medium">{subtext}</p>}
      </div>
    </Card>
  );
};
