import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair: " + error.message);
    } else {
      toast.success("Você saiu da conta");
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <main className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Configurações</CardTitle>
            <CardDescription className="text-base">
              Gerencie suas preferências e conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-base">Perfil</p>
                  <p className="text-sm text-muted-foreground">
                    Visualizar e editar informações do perfil
                  </p>
                </div>
              </div>
              <Button variant="ghost" disabled>
                Em breve
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-destructive/10">
              <div className="flex items-center gap-3">
                <LogOut className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-base text-destructive">Sair da conta</p>
                  <p className="text-sm text-muted-foreground">
                    Desconectar-se do aplicativo
                  </p>
                </div>
              </div>
              <Button variant="destructive" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sobre o DoseCerta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base text-muted-foreground mb-4">
              DoseCerta é um aplicativo para ajudar você a seguir corretamente 
              seus medicamentos com lembretes automáticos e histórico de doses tomadas.
            </p>
            <p className="text-sm text-muted-foreground">Versão 1.0.0</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
