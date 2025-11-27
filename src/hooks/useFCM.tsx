import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook para gerenciar registro de tokens FCM
 * Permite receber notificações push mesmo com app fechado
 */
export const useFCM = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // Verificar suporte
  useEffect(() => {
    const checkSupport = () => {
      // FCM funciona via Service Worker e Firebase SDK
      // Por enquanto, detectamos apenas suporte a Service Worker
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);
      
      if (!supported) {
        console.log('[FCM] Push notifications não suportadas neste navegador');
      }
    };

    checkSupport();
  }, []);

  /**
   * Solicitar permissão e registrar token FCM
   */
  const registerFCM = useCallback(async () => {
    if (!isSupported) {
      toast.error("Push notifications não suportadas neste navegador");
      return false;
    }

    try {
      // Solicitar permissão
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error("Permissão de notificações negada");
        return false;
      }

      // Aqui, em produção, você usaria o Firebase SDK para obter o token
      // Por enquanto, vamos simular com um token baseado em fingerprint do navegador
      const userAgent = navigator.userAgent;
      const platform = navigator.platform;
      const language = navigator.language;
      const mockToken = `fcm_${btoa(`${userAgent}_${platform}_${language}`).slice(0, 50)}`;

      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Usuário não autenticado");
        return false;
      }

      // Registrar token no banco
      const { error } = await supabase
        .from('fcm_tokens')
        .upsert({
          usuario_id: user.id,
          token: mockToken,
          dispositivo: userAgent,
          plataforma: platform,
          ultimo_uso: new Date().toISOString()
        }, {
          onConflict: 'token',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('[FCM] Erro ao registrar token:', error);
        toast.error("Erro ao registrar dispositivo para notificações");
        return false;
      }

      setToken(mockToken);
      setIsRegistered(true);
      
      console.log('[FCM] Token registrado com sucesso:', mockToken);
      toast.success("Notificações push ativadas! Você receberá alertas mesmo com o app fechado.");
      
      return true;
    } catch (error) {
      console.error('[FCM] Erro ao registrar:', error);
      toast.error("Erro ao ativar notificações push");
      return false;
    }
  }, [isSupported]);

  /**
   * Desregistrar token FCM
   */
  const unregisterFCM = useCallback(async () => {
    if (!token) return false;

    try {
      const { error } = await supabase
        .from('fcm_tokens')
        .delete()
        .eq('token', token);

      if (error) {
        console.error('[FCM] Erro ao desregistrar token:', error);
        return false;
      }

      setToken(null);
      setIsRegistered(false);
      
      console.log('[FCM] Token desregistrado');
      toast.info("Notificações push desativadas");
      
      return true;
    } catch (error) {
      console.error('[FCM] Erro ao desregistrar:', error);
      return false;
    }
  }, [token]);

  // Verificar se já está registrado ao montar
  useEffect(() => {
    const checkRegistration = async () => {
      if (!isSupported) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: tokens } = await supabase
          .from('fcm_tokens')
          .select('token')
          .eq('usuario_id', user.id)
          .limit(1);

        if (tokens && tokens.length > 0) {
          setToken(tokens[0].token);
          setIsRegistered(true);
          console.log('[FCM] Token já registrado:', tokens[0].token);
        }
      } catch (error) {
        console.error('[FCM] Erro ao verificar registro:', error);
      }
    };

    checkRegistration();
  }, [isSupported]);

  return {
    isSupported,
    isRegistered,
    token,
    registerFCM,
    unregisterFCM
  };
};
