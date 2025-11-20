import { Home, Pill, History, Settings, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const menuItems = [
  { title: "Lembretes de Hoje", url: "/dashboard", icon: Home },
  { title: "Meus Medicamentos", url: "/medicamentos", icon: Pill },
  { title: "Histórico de Doses", url: "/history", icon: History },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:bg-card lg:shadow-sm lg:sticky lg:top-0 lg:h-screen">
      <div className="p-6 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-full p-2 shrink-0">
            <Pill className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold truncate">DoseCerta</h1>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.url}>
              <NavLink
                to={item.url}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-accent text-foreground hover:translate-x-1"
                  }`
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="font-medium truncate">{item.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden -ml-2 touch-manipulation">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
        <div className="p-6 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-full p-2 shrink-0">
              <Pill className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold truncate">DoseCerta</h1>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px] ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-accent text-foreground active:scale-95"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="font-medium truncate">{item.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
