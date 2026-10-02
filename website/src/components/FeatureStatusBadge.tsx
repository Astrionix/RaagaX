import React from "react";
import { FeatureStatus } from "@/config/release";

interface FeatureStatusBadgeProps {
  status: FeatureStatus;
  size?: "sm" | "md";
}

export const FeatureStatusBadge: React.FC<FeatureStatusBadgeProps> = ({
  status,
  size = "sm",
}) => {
  const getStyles = () => {
    switch (status) {
      case "IMPLEMENTED":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
        };
      case "BETA":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
          dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
        };
      case "EXPERIMENTAL":
        return {
          bg: "bg-purple-500/10 border-purple-500/30 text-purple-300",
          dot: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]",
        };
      case "PLANNED / SPECIFICATION":
        return {
          bg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
          dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]",
        };
    }
  };

  const { bg, dot } = getStyles();
  const textSize = size === "sm" ? "text-[10px] tracking-wider" : "text-xs tracking-wider";
  const padding = size === "sm" ? "px-2.5 py-0.5" : "px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-medium uppercase ${bg} ${padding} ${textSize}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
};
