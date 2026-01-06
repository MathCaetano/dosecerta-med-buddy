import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, X, AlertCircle, Clock, Sun, Sunset, Moon } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/useNotifications";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TimePicker, detectPeriodFromTime, getPeriodLabel } from "@/components/ui/time-picker";

interface Horario {
  horario: string;
  periodo: string;
  repeticao: string;
}

const AddMedication = () => {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    dosagem: "",
    observacoes: "",
  });
  const [horarios, setHorarios] = useState<Horario[]>([
    { horario: "08:00", periodo: "manha", repeticao: "diariamente" }
  ]);
  const [horariosConflitantes, setHorariosConflitantes] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.dosagem) {
      toast.error("Preencha nome e dosagem do medicamento");
      return;
    }

    const horariosValidos = horarios.filter(h => h.horario.trim() !== "");
    if (horariosValidos.length === 0) {
      toast.error("Adicione pelo menos um horário");
      return;
    }

    // Validar horários duplicados no formulário
    const horariosSet = new Set(horariosValidos.map(h => h.horario));
    if (horariosSet.size !== horariosValidos.length) {
      toast.error("Você adicionou horários duplicados. Remova os duplicados.");
      return;
    }

    setIsLoading(true);

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      // Verificar se já existe medicamento com mesmo nome
      const { data: medicamentoExistente } = await supabase
        .from("medicamentos")
        .select("id")
        .eq("usuario_id", userId)
        .eq("nome", formData.nome)
        .maybeSingle();

      let medicamentoId: string;

      if (medicamentoExistente) {
        // Verificar se horários já existem para evitar duplicação
        const { data: lembretesExistentes } = await supabase
          .from("lembretes")
          .select("horario")
          .eq("medicamento_id", medicamentoExistente.id);

        const horariosJaExistem = horariosValidos.filter(h => 
          lembretesExistentes?.some(l => l.horario === h.horario)
        );

        if (horariosJaExistem.length > 0) {
          const horarios = horariosJaExistem.map(h => h.horario).join(", ");
          toast.error(`Os seguintes horários já existem para este medicamento: ${horarios}`);
          return;
        }

        // Atualizar medicamento existente
        const { error: updateError } = await supabase
          .from("medicamentos")
          .update({
            dosagem: formData.dosagem,
            observacoes: formData.observacoes,
          })
          .eq("id", medicamentoExistente.id);

        if (updateError) throw updateError;
        medicamentoId = medicamentoExistente.id;
      } else {
        // Criar novo medicamento
        const { data: novoMedicamento, error: medError } = await supabase
          .from("medicamentos")
          .insert({
            nome: formData.nome,
            dosagem: formData.dosagem,
            observacoes: formData.observacoes,
            usuario_id: userId,
          })
          .select()
          .single();

        if (medError) throw medError;
        medicamentoId = novoMedicamento.id;
      }

      // Criar lembretes para cada horário
      const lembretesData = horariosValidos.map(h => ({
        medicamento_id: medicamentoId,
        horario: h.horario,
        periodo: h.periodo,
        repeticao: h.repeticao,
        ativo: true,
      }));

      const { data: lembretesInseridos, error: lemError } = await supabase
        .from("lembretes")
        .insert(lembretesData)
        .select();

      if (lemError) throw lemError;

      // Agendar notificações se já tem permissão
      if (notifications.isInitialized && lembretesInseridos) {
        let scheduled = 0;
        for (const lembrete of lembretesInseridos) {
          const success = await notifications.scheduleNotification(
            lembrete.id,
            formData.nome,
            formData.dosagem,
            lembrete.horario,
            medicamentoId
          );
          if (success) scheduled++;
        }

        toast.success(
          medicamentoExistente 
            ? `Horários adicionados! ${scheduled} notificações agendadas.`
            : `Medicamento criado! ${scheduled} notificações agendadas.`
        );
      } else {
        toast.success(
          medicamentoExistente 
            ? "Horários adicionados com sucesso!" 
            : "Medicamento adicionado com sucesso!"
        );

        if (notifications.permission !== "granted") {
          toast.info("Ative as notificações no Dashboard para receber lembretes!");
        }
      }

      navigate("/medicamentos");
    } catch (error: any) {
      toast.error("Erro ao adicionar medicamento: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addHorario = () => {
    setHorarios([...horarios, { horario: "08:00", periodo: "manha", repeticao: "diariamente" }]);
  };

  const removeHorario = (index: number) => {
    if (horarios.length > 1) {
      setHorarios(horarios.filter((_, i) => i !== index));
    }
  };

  const updateHorario = (index: number, field: keyof Horario, value: string) => {
    const novosHorarios = [...horarios];
    
    if (field === "horario") {
      // Auto-detect period when time changes
      const periodo = detectPeriodFromTime(value);
      novosHorarios[index] = { ...novosHorarios[index], horario: value, periodo };
    } else {
      novosHorarios[index] = { ...novosHorarios[index], [field]: value };
    }
    
    setHorarios(novosHorarios);

    // Verificar conflitos de horários próximos
    if (field === "horario" && value) {
      const conflitos: string[] = [];
      novosHorarios.forEach((h, i) => {
        if (i !== index && h.horario && value) {
          const [h1, m1] = h.horario.split(":").map(Number);
          const [h2, m2] = value.split(":").map(Number);
          const diff = Math.abs((h1 * 60 + m1) - (h2 * 60 + m2));
          
          if (diff < 15) { // Menos de 15 minutos
            conflitos.push(h.horario);
          }
        }
      });
      setHorariosConflitantes(conflitos);
    }
  };

  const getPeriodIcon = (period: string) => {
    switch (period) {
      case "manha":
        return <Sun className="h-4 w-4 text-amber-500" />;
      case "tarde":
        return <Sunset className="h-4 w-4 text-orange-500" />;
      case "noite":
        return <Moon className="h-4 w-4 text-indigo-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="max-w-2xl mx-auto mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
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
              {/* Aviso de horários conflitantes */}
              {horariosConflitantes.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Atenção:</strong> Você tem horários muito próximos ({horariosConflitantes.join(", ")}). 
                    Considere espaçar mais os horários para evitar confusão.
                  </AlertDescription>
                </Alert>
              )}

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

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold">Horários</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addHorario}
                    disabled={isLoading}
                    className="h-8 text-sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                <div className="space-y-3">
                  {horarios.map((horario, index) => (
                    <div key={index} className="p-3 border rounded-lg bg-muted/20">
                      {/* Header with remove button */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Horário {index + 1}</span>
                        {horarios.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHorario(index)}
                            disabled={isLoading}
                            className="h-6 w-6"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Time picker + Period chip inline */}
                      <div className="flex items-center justify-center gap-3 mb-3">
                        <TimePicker
                          value={horario.horario}
                          onChange={(time) => updateHorario(index, "horario", time)}
                          disabled={isLoading}
                        />
                        
                        {/* Compact period chip */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full text-xs font-medium whitespace-nowrap">
                          {getPeriodIcon(horario.periodo)}
                          <span>{getPeriodLabel(horario.periodo)}</span>
                        </div>
                      </div>

                      {/* Frequency as inline row */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">🔁 Frequência:</span>
                        <Select
                          value={horario.repeticao}
                          onValueChange={(value) => updateHorario(index, "repeticao", value)}
                          disabled={isLoading}
                        >
                          <SelectTrigger className="h-9 text-sm flex-1">
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
                  ))}
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
