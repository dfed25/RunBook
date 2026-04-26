import type { ReactNode } from "react";

type FeatureCardProps = {
  feature: string;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>;

export function FeatureCard({
  feature,
  title,
  description,
  className = "",
  children,
  ...rest
}: FeatureCardProps) {
  return (
    <section
      className={className}
      data-runbook-feature={feature}
      data-runbook-title={title}
      data-runbook-description={description}
      {...rest}
    >
      {children}
    </section>
  );
}
