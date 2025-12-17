import Link from "next/link";
import type { ReactNode } from "react";

interface AgentCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export const AgentCard = ({
  title,
  description,
  icon,
  href,
  disabled = false,
  disabledMessage = "(Coming Soon)",
}: AgentCardProps) => {
  const cardContent = (
    <div
      className={`agent-card h-40 w-80 rounded-lg border border-gray-200 p-5 shadow-sm transition-all ${
        disabled
          ? "cursor-not-allowed bg-gray-50 opacity-60"
          : "cursor-pointer bg-gray-100 hover:border-cyan-400 hover:bg-gray-50 hover:shadow-md"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={disabled ? "text-gray-400" : "text-cyan-500"}
          aria-hidden="true"
        >
          {icon}
        </div>
        <span
          className={`font-bold ${disabled ? "text-gray-500" : "text-gray-800"}`}
        >
          {title}
        </span>
      </div>
      <p className={disabled ? "text-gray-400" : "text-gray-600"}>
        {description}
      </p>
      {disabled && disabledMessage && (
        <p className="mt-2 text-xs text-gray-400">{disabledMessage}</p>
      )}
    </div>
  );

  if (disabled) {
    return cardContent;
  }

  return <Link href={href}>{cardContent}</Link>;
};
