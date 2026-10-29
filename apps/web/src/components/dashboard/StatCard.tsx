import React from "react";
import { Link } from "react-router-dom";
import { LucideIcon, ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "../ui/Card";

export interface StatTrend {
  value: number;
  label?: string;
  isPositiveGood?: boolean; // defaults to true
  suffix?: string;
}

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  icon: LucideIcon;
  variant?: "blue" | "emerald" | "amber" | "indigo" | "rose" | "cyan" | "purple";
  to?: string;
  onClick?: () => void;
  trend?: StatTrend;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  variant = "blue",
  to,
  onClick,
  trend,
}) => {
  const variantStyles = {
    blue: {
      borderHover: "hover:border-blue-300 dark:hover:border-blue-700",
      iconBg: "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60",
      accent: "text-blue-600 dark:text-blue-400",
    },
    emerald: {
      borderHover: "hover:border-emerald-300 dark:hover:border-emerald-700",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60",
      accent: "text-emerald-600 dark:text-emerald-400",
    },
    amber: {
      borderHover: "hover:border-amber-300 dark:hover:border-amber-700",
      iconBg: "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60",
      accent: "text-amber-600 dark:text-amber-400",
    },
    indigo: {
      borderHover: "hover:border-indigo-300 dark:hover:border-indigo-700",
      iconBg: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60",
      accent: "text-indigo-600 dark:text-indigo-400",
    },
    rose: {
      borderHover: "hover:border-rose-300 dark:hover:border-rose-700",
      iconBg: "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60",
      accent: "text-rose-600 dark:text-rose-400",
    },
    cyan: {
      borderHover: "hover:border-cyan-300 dark:hover:border-cyan-700",
      iconBg: "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60",
      accent: "text-cyan-600 dark:text-cyan-400",
    },
    purple: {
      borderHover: "hover:border-purple-300 dark:hover:border-purple-700",
      iconBg: "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60",
      accent: "text-purple-600 dark:text-purple-400",
    },
  };

  const style = variantStyles[variant] || variantStyles.blue;

  // Render trend indicator only when authentic trend data exists
  const renderTrend = () => {
    if (!trend) return null;

    const { value: diff, label: trendLabel = "vs yesterday", isPositiveGood = true, suffix = "" } = trend;
    const isZero = diff === 0;
    const isUp = diff > 0;
    const isGood = isZero ? true : isPositiveGood ? isUp : !isUp;

    let badgeColor = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700";
    if (!isZero) {
      if (isGood) {
        badgeColor = "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60";
      } else {
        badgeColor = "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60";
      }
    }

    return (
      <div
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${badgeColor} mt-1`}
        title={`Comparison to previous active day: ${isUp ? "+" : ""}${diff}${suffix} ${trendLabel}`}
      >
        {isZero ? (
          <Minus className="w-2.5 h-2.5" />
        ) : isUp ? (
          <TrendingUp className="w-2.5 h-2.5" />
        ) : (
          <TrendingDown className="w-2.5 h-2.5" />
        )}
        <span>
          {isUp ? `+${diff}` : diff}
          {suffix} {trendLabel}
        </span>
      </div>
    );
  };

  const cardContent = (
    <Card
      hoverEffect
      className={`p-4 sm:p-5 flex flex-col justify-between h-full transition-all duration-200 ${
        to || onClick ? "cursor-pointer group hover:-translate-y-0.5 hover:shadow-md" : ""
      } ${style.borderHover}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
            {label}
          </span>
          <div className="flex items-center gap-1">
            <div className={`p-2 rounded-xl ${style.iconBg} shadow-xs shrink-0 transition-transform duration-200 group-hover:scale-105`}>
              <Icon className="w-4 h-4" />
            </div>
            {to && (
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-0.5 group-hover:translate-y-0 shrink-0" />
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-baseline gap-1">
            {value}
          </div>
          {renderTrend()}
        </div>
      </div>

      {subtext && (
        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          <span className="truncate">{subtext}</span>
          {to && (
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
              View &rarr;
            </span>
          )}
        </div>
      )}
    </Card>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-2xl"
        aria-label={`${label}: click to view filtered records`}
      >
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-2xl"
        aria-label={`${label}: click to view filtered records`}
      >
        {cardContent}
      </button>
    );
  }

  return cardContent;
};
