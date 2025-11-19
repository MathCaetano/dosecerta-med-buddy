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
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:bg-card lg:shadow-sm">
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-full p-2">
            <Pill className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">DoseCerta</h1>
        </div>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.url}>
              <NavLink
                to={item.url}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.title}</span>
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
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-full p-2">
              <Pill className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">DoseCerta</h1>
          </div>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
