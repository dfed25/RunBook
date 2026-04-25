import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variantMap: Record<Variant, string> = {
  primary: "bg-cyan-400 text-slate-900 hover:bg-cyan-300",
  secondary: "bg-slate-100 text-slate-900 hover:bg-white",
  ghost: "border border-slate-700 text-slate-200 hover:border-slate-500",
  danger: "border border-red-500/50 text-red-200 hover:border-red-400",
};

export function AppButton({ variant = "ghost", className = "", ...props }: AppButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-md px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${variantMap[variant]} ${className}`}
    />
  );
}
