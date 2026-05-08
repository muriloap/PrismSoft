import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres");

const REMEMBER_EMAIL_KEY = "prism-remember-email";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
  
  const { signIn, signUp, signInWithGoogle, user, loading } = useAuth();
  const navigate = useNavigate();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; fullName?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (!isLogin && !fullName.trim()) {
      newErrors.fullName = "Nome é obrigatório";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      if (isLogin) {
        // Save or remove email based on remember me preference
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }

        const { error, data: signInData } = await signIn(email, password);
        
        if (error) {
          // Lógica de provisionamento automático para o Admin fixo no Primeiro Acesso
          if (
            (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) && 
            email.toLowerCase() === "manoitalo8@gmail.com"
          ) {
            console.log("Detectado possível primeiro acesso do Admin. Tentando provisionar...");
            
            // Tenta criar a conta
            const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: "Administrador" }
              }
            });

            // Se criou com sucesso ou se já existia mas por algum motivo deu erro de credencial antes 
            // (ex: senha mudou no dashboard mas queremos manter a fixada no prompt?)
            // Na verdade, se signUpError é null, acabamos de criar.
            if (!signUpError && signUpData.user) {
              await supabase.from('user_roles').insert({
                user_id: signUpData.user.id,
                role: 'admin'
              });
              
              const { error: retryError } = await signIn(email, password);
              if (!retryError) {
                toast.success("Acesso Admin configurado com sucesso!");
                navigate("/admin");
                return;
              }
            } else if (signUpError?.message.includes("User already registered")) {
              // Se já existe e deu "invalid credentials", a senha está realmente errada para o que existe no Supabase
              toast.error("Senha incorreta para o administrador.");
              setIsSubmitting(false);
              return;
            }
          }

          if (error.message === "SUPABASE_NOT_CONFIGURED") {
            toast.error("Erro na Key: A Chave Anon deve começar com 'eyJ'.");
          } else if (error.message.includes("Invalid login credentials") || error.message.includes("invalid_credentials")) {
            toast.error("Email ou senha incorretos.");
          } else if (error.message === "Failed to fetch" || error.message.includes("Invalid path")) {
            toast.error("Erro de conexão com o Supabase.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Login realizado com sucesso!");
          if (email.toLowerCase() === "manoitalo8@gmail.com") {
            navigate("/admin");
          } else {
            navigate("/");
          }
        }
      } else {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });

        if (error) {
          if (error.message === "SUPABASE_NOT_CONFIGURED") {
            toast.error("Erro na Key: A Chave Anon (anon public key) deve começar com 'eyJ'.");
          } else if (error.message.includes("User already registered")) {
            toast.error("Este email já está cadastrado. Tente fazer login.");
          } else if (error.message === "Failed to fetch" || error.message.includes("Invalid path")) {
            toast.error("Erro de conexão: Verifique as chaves em Settings.");
          } else {
            toast.error(error.message);
          }
        } else {
          // Se for o email do admin, tenta inserir o cargo automaticamente
          if (email.toLowerCase() === "manoitalo8@gmail.com" && data.user) {
            await supabase.from('user_roles').insert({
              user_id: data.user.id,
              role: 'admin'
            });
            toast.success("Conta de Administrador criada!");
          } else {
            toast.success("Conta criada com sucesso!");
          }
          navigate("/");
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Failed to fetch") {
        toast.error("Erro de conexão: Verifique as credenciais do Supabase.");
      } else {
        toast.error("Ocorreu um erro. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-background to-fuchsia-900/10 pointer-events-none" />
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center relative z-10">
        {/* Back Button */}
        <div className="w-full max-w-md mb-6">
          <button 
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/50 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </button>
        </div>

        {/* Auth Card */}
        <div className="w-full max-w-md bg-card rounded-2xl border border-border p-8">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gradient mb-2">
              {isLogin ? "Entrar" : "Criar Conta"}
            </h1>
            <p className="text-muted-foreground">
              {isLogin 
                ? "Bem-vindo de volta! Faça login para continuar."
                : "Crie sua conta para começar a comprar."
              }
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`pl-10 bg-muted/50 border-border ${errors.fullName ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-red-500">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-10 bg-muted/50 border-border ${errors.email ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 pr-10 bg-muted/50 border-border ${errors.password ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                  />
                  <span className="text-sm text-muted-foreground">Lembrar senha</span>
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Esqueceu sua senha?
                </button>
              </div>
            )}

            <Button 
              type="submit" 
              variant="hero" 
              size="lg" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isLogin ? "Entrando..." : "Criando conta..."}
                </span>
              ) : (
                isLogin ? "Entrar" : "Criar conta"
              )}
            </Button>
          </form>

          {/* Toggle Login/Signup */}
          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="ml-2 text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                {isLogin ? "Criar conta" : "Fazer login"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
