import { ReactNode, useEffect, useState } from "react";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        // Buscar nome do perfil
        supabase
          .from("profiles")
          .select("nome")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserName(data.nome);
          });
      }
    });
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header fixo para mobile */}
        <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between h-14 px-4 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="flex items-center gap-3">
            <MobileSidebar />
            <h1 className="text-lg font-bold truncate">DoseCerta</h1>
          </div>
          {userName && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {getGreeting()}, {userName}
            </span>
          )}
        </header>

        {/* Header fixo para desktop */}
        <header className="hidden lg:flex sticky top-0 z-50 items-center justify-between h-16 px-6 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <h2 className="text-xl font-semibold text-foreground">
            {getGreeting()}{userName && `, ${userName}`}
          </h2>
        </header>

        <main className="flex-1 w-full overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
