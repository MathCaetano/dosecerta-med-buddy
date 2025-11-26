import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

interface DosageSelectorProps {
  value: string; // formato "500mg" ou "10 gotas"
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const UNIDADES = [
  { value: "mg", label: "mg", icon: "💊" },
  { value: "ml", label: "ml", icon: "💧" },
  { value: "gotas", label: "gotas", icon: "💧" },
  { value: "comprimidos", label: "comprimidos", icon: "💊" },
  { value: "cápsulas", label: "cápsulas", icon: "💊" },
  { value: "puffs", label: "puffs", icon: "💨" },
  { value: "unidades", label: "unidades", icon: "📦" },
];

export const DosageSelector = ({ value, onChange, disabled, className }: DosageSelectorProps) => {
  const [quantidade, setQuantidade] = useState<number>(0);
  const [unidade, setUnidade] = useState<string>("mg");
  const [isValid, setIsValid] = useState(false);

  // Parse initial value
  useEffect(() => {
    if (value) {
      // Extrair número e unidade (ex: "500mg" ou "10 gotas")
      const match = value.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
      if (match) {
        const [, qtd, unit] = match;
        setQuantidade(parseFloat(qtd));
        setUnidade(unit.trim());
        setIsValid(parseFloat(qtd) > 0);
      }
    }
  }, [value]);

  // Update parent when quantity or unit changes
  useEffect(() => {
    if (quantidade > 0) {
      const newValue = `${quantidade}${unidade}`;
      if (newValue !== value) {
        onChange(newValue);
        setIsValid(true);
      }
    } else {
      setIsValid(false);
    }
  }, [quantidade, unidade]);

  const handleIncrement = () => {
    setQuantidade((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setQuantidade((prev) => Math.max(0, prev - 1));
  };

  const handleQuantidadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) || 0;
    setQuantidade(Math.max(0, val));
  };

  const selectedUnit = UNIDADES.find((u) => u.value === unidade);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-3">
        {/* Quantidade com Spinner */}
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Quantidade</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleDecrement}
              disabled={disabled || quantidade <= 0}
              className="h-12 w-12 shrink-0"
            >
              <Minus className="h-4 w-4" />
            </Button>
            
            <Input
              type="number"
              min="0"
              step="0.5"
              value={quantidade}
              onChange={handleQuantidadeChange}
              disabled={disabled}
              className="text-base h-12 text-center font-semibold"
              placeholder="0"
            />
            
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleIncrement}
              disabled={disabled}
              className="h-12 w-12 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Unidade */}
        <div className="w-40 space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Unidade</div>
          <Select value={unidade} onValueChange={setUnidade} disabled={disabled}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue>
                <span className="flex items-center gap-2">
                  <span>{selectedUnit?.icon}</span>
                  <span>{selectedUnit?.label}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {UNIDADES.map((unit) => (
                <SelectItem key={unit.value} value={unit.value}>
                  <span className="flex items-center gap-2">
                    <span>{unit.icon}</span>
                    <span>{unit.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Feedback Visual */}
      {isValid && (
        <div className="flex items-center gap-2 text-sm text-success animate-fade-in">
          <Check className="h-4 w-4" />
          <span className="font-medium">
            Dosagem válida: {quantidade}{unidade}
          </span>
        </div>
      )}

      {!isValid && quantidade === 0 && (
        <div className="text-sm text-muted-foreground">
          Defina a quantidade do medicamento
        </div>
      )}
    </div>
  );
};
