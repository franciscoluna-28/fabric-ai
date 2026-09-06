import { cn } from "@/src/shared/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Responsible for the container and padding of a section
 */
export function SectionLayout({ children, className }: Props) {
  return (
    <div className={cn("container mx-auto px-4 py-8 max-w-4xl", className)}>
      {children}
    </div>
  );
}
