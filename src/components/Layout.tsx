import { ReactNode } from "react";
import { Sidebar, MobileSidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="lg:hidden flex items-center h-16 px-4 border-b bg-card">
          <MobileSidebar />
          <h1 className="ml-4 text-xl font-bold">DoseCerta</h1>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
