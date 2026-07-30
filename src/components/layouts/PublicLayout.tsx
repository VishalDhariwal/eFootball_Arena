import { ReactNode } from "react";

interface PublicLayoutProps {
  children: ReactNode;
}

export const PublicLayout = ({ children }: PublicLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <main>
        {children}
      </main>
    </div>
  );
};
