interface StreakData {
  currentStreak: number;
  lastDate: string;
}

interface AdhesionData {
  taken: number;
  total: number;
  percentage: number;
}

export const getStreakMessage = (streak: number): string | null => {
  if (streak >= 30) return `🔥 ${streak} dias em sequência! Você é incrível!`;
  if (streak >= 14) return `🎯 ${streak} dias seguidos! Continue assim!`;
  if (streak >= 7) return `⭐ ${streak} dias consecutivos! Excelente!`;
  if (streak >= 3) return `✨ ${streak} dias em sequência! Continue!`;
  return null;
};

export const getWeeklyAdhesionMessage = (data: AdhesionData): string | null => {
  const { taken, total, percentage } = data;
  
  if (percentage === 100) {
    return `🏆 Semana perfeita! ${taken} de ${total} doses tomadas!`;
  }
  
  if (percentage >= 90) {
    return `💪 Semana excelente! ${taken} de ${total} doses tomadas (${percentage.toFixed(0)}%)`;
  }
  
  if (percentage >= 75) {
    return `👍 Boa semana! ${taken} de ${total} doses tomadas (${percentage.toFixed(0)}%)`;
  }
  
  if (percentage >= 50) {
    return `📈 Continue melhorando! ${taken} de ${total} doses tomadas`;
  }
  
  return null;
};

export const getMotivationalMessage = (percentage: number): string => {
  if (percentage >= 95) return "Você está mandando muito bem! 🌟";
  if (percentage >= 85) return "Excelente trabalho! Continue assim! 💪";
  if (percentage >= 75) return "Muito bom! Você está no caminho certo! 👏";
  if (percentage >= 60) return "Bom trabalho! Vamos manter o ritmo! 📈";
  if (percentage >= 40) return "Continue tentando! Cada dose importa! 💙";
  return "Não desista! Estamos aqui para ajudar! 🤝";
};

export const getDelayWarning = (delayMinutes: number): string | null => {
  if (delayMinutes > 120) {
    return "Dose tomada com atraso significativo. Tente manter os horários!";
  }
  if (delayMinutes > 60) {
    return "Dose tomada com atraso. Ajuste os lembretes se necessário.";
  }
  if (delayMinutes > 30) {
    return "Tudo certo! Próxima dose tente tomar no horário.";
  }
  return null;
};

export const calculateStreak = (history: Array<{ data: string; status: string }>): StreakData => {
  const sortedHistory = [...history]
    .filter(h => h.status === "tomado")
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  if (sortedHistory.length === 0) {
    return { currentStreak: 0, lastDate: "" };
  }

  let streak = 1;
  let lastDate = new Date(sortedHistory[0].data);

  for (let i = 1; i < sortedHistory.length; i++) {
    const currentDate = new Date(sortedHistory[i].data);
    const daysDiff = Math.floor(
      (lastDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      streak++;
      lastDate = currentDate;
    } else {
      break;
    }
  }

  return {
    currentStreak: streak,
    lastDate: sortedHistory[0].data,
  };
};
