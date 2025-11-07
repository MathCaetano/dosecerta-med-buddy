import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const AddMedication = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    dosagem: "",
    observacoes: "",
    horario: "",
    periodo: "manha",
    repeticao: "diariamente",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.dosagem || !formData.horario) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setIsLoading(true);

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      // Verificar se já existe um medicamento com o mesmo nome para este usuário
      const { data: existingMed } = await supabase
        .from("medicamentos")
        .select("id")
        .eq("usuario_id", userId)
        .eq("nome", formData.nome.trim())
        .maybeSingle();

      let medicamentoId: string;

      if (existingMed) {
        // Se já existe, usar o medicamento existente
        medicamentoId = existingMed.id;
        toast.info("Adicionando novo horário ao medicamento existente");
      } else {
        // Criar novo medicamento
        const { data: medicamento, error: medError } = await supabase
          .from("medicamentos")
          .insert({
            nome: formData.nome.trim(),
            dosagem: formData.dosagem.trim(),
            observacoes: formData.observacoes.trim() || null,
            usuario_id: userId,
          })
          .select()
          .single();

        if (medError) throw medError;
        medicamentoId = medicamento.id;
      }

      // Criar lembrete
      const { error: lemError } = await supabase
        .from("lembretes")
        .insert({
          medicamento_id: medicamentoId,
          horario: formData.horario,
          periodo: formData.periodo,
          repeticao: formData.repeticao,
          ativo: true,
        });

      if (lemError) throw lemError;

      toast.success("Lembrete adicionado com sucesso!");
      navigate("/medicamentos");
    } catch (error: any) {
      toast.error("Erro ao adicionar: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="max-w-2xl mx-auto mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/medicamentos")}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </header>

      <main className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Adicionar Medicamento</CardTitle>
            <CardDescription className="text-base">
              Cadastre um novo medicamento e configure o lembrete
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-base">
                  Nome do medicamento *
                </Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Ex: Paracetamol"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="text-base h-12"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dosagem" className="text-base">
                  Dosagem *
                </Label>
                <Input
                  id="dosagem"
                  type="text"
                  placeholder="Ex: 500mg"
                  value={formData.dosagem}
                  onChange={(e) => setFormData({ ...formData, dosagem: e.target.value })}
                  className="text-base h-12"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes" className="text-base">
                  Observações
                </Label>
                <Textarea
                  id="observacoes"
                  placeholder="Ex: Tomar após as refeições"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="text-base min-h-24"
                  disabled={isLoading}
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Configurar Lembrete</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="horario" className="text-base">
                      Horário *
                    </Label>
                    <Input
                      id="horario"
                      type="time"
                      value={formData.horario}
                      onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                      className="text-base h-12"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="periodo" className="text-base">
                      Período do dia
                    </Label>
                    <Select
                      value={formData.periodo}
                      onValueChange={(value) => setFormData({ ...formData, periodo: value })}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="text-base h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manha">Manhã</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="noite">Noite</SelectItem>
                        <SelectItem value="madrugada">Madrugada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="repeticao" className="text-base">
                      Frequência
                    </Label>
                    <Select
                      value={formData.repeticao}
                      onValueChange={(value) => setFormData({ ...formData, repeticao: value })}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="text-base h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diariamente">Diariamente</SelectItem>
                        <SelectItem value="dias_alternados">Dias alternados</SelectItem>
                        <SelectItem value="semanalmente">Semanalmente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 text-base"
                  onClick={() => navigate("/medicamentos")}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-12 text-base" disabled={isLoading}>
                  {isLoading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AddMedication;
