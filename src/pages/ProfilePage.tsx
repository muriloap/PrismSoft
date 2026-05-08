import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  User, 
  Camera, 
  Save, 
  Loader2, 
  Key, 
  BookOpen, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  Trash2,
  Phone,
  CheckCircle,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";

// Import the purchases page content components
import PurchasesContent from "@/components/profile/PurchasesContent";
import TutorialContent from "@/components/profile/TutorialContent";

const ProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "profile";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // Phone verification states
  const [pendingPhone, setPendingPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  
  // Password change states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, phone, phone_verified")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching profile:", error);
        } else if (data) {
          setFullName(data.full_name || "");
          setPhone(data.phone || "");
          setPhoneVerified(data.phone_verified || false);
          setAvatarUrl(data.avatar_url);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formatos aceitos: JPG, PNG, GIF, WEBP");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(newAvatarUrl);
      toast.success("Avatar atualizado!");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error("Erro ao fazer upload do avatar.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user || !avatarUrl) return;

    setIsUploadingAvatar(true);

    try {
      // Update profile to remove avatar
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(null);
      toast.success("Avatar removido!");
    } catch (error: any) {
      console.error("Error removing avatar:", error);
      toast.error("Erro ao remover avatar.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      toast.success("Perfil atualizado!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendVerificationCode = async () => {
    if (!pendingPhone) {
      toast.error("Digite um número de telefone.");
      return;
    }

    // Basic phone validation
    const cleanedPhone = pendingPhone.replace(/\D/g, "");
    if (cleanedPhone.length < 10 || cleanedPhone.length > 13) {
      toast.error("Número de telefone inválido.");
      return;
    }

    setIsSendingCode(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-phone-verification", {
        body: { phone: pendingPhone },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Código enviado! Verifique seu SMS.");
      setShowVerificationInput(true);
    } catch (error: any) {
      console.error("Error sending verification code:", error);
      toast.error(error.message || "Erro ao enviar código.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      toast.error("Digite o código de verificação.");
      return;
    }

    if (verificationCode.length !== 6) {
      toast.error("O código deve ter 6 dígitos.");
      return;
    }

    setIsVerifyingCode(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-phone-code", {
        body: { code: verificationCode },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Telefone verificado com sucesso!");
      setPhone(pendingPhone);
      setPhoneVerified(true);
      setShowVerificationInput(false);
      setVerificationCode("");
      setPendingPhone("");
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast.error(error.message || "Erro ao verificar código.");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast.error(error.message || "Erro ao alterar senha.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />
        {/* Scattered dots decoration */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-purple-500/30 rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      <Header />

      <main className="flex-1 pt-24 pb-12 relative z-10">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Back Button */}
          <div className="mb-6">
            <BackButton to="/" />
          </div>

          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Meus Produtos</h1>
            <p className="text-muted-foreground">
              Acesse seus produtos comprados e tutoriais
            </p>
          </div>

          {/* Tabs Navigation */}
          <Tabs defaultValue={tabFromUrl} className="w-full">
            <TabsList className="mb-8 bg-card/50 border border-border p-1 rounded-full inline-flex">
              <TabsTrigger 
                value="products" 
                className="flex items-center gap-2 rounded-full px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Key className="h-4 w-4" />
                Produtos & Keys
              </TabsTrigger>
              <TabsTrigger 
                value="tutorials" 
                className="flex items-center gap-2 rounded-full px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <BookOpen className="h-4 w-4" />
                Tutoriais
              </TabsTrigger>
              <TabsTrigger 
                value="profile" 
                className="flex items-center gap-2 rounded-full px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <User className="h-4 w-4" />
                Meu Perfil
              </TabsTrigger>
            </TabsList>

            {/* Products & Keys Tab */}
            <TabsContent value="products">
              <PurchasesContent />
            </TabsContent>

            {/* Tutorials Tab */}
            <TabsContent value="tutorials">
              <TutorialContent />
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Profile Photo Card */}
                <div className="bg-card rounded-2xl border border-border p-6 relative overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30">
                      <Camera className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Foto de Perfil</h3>
                      <p className="text-sm text-muted-foreground">Personalize seu avatar</p>
                    </div>
                  </div>

                  {/* Avatar Section */}
                  <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-purple-500/30 shadow-lg shadow-purple-500/20">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
                            <User className="h-12 w-12 text-white" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Avatar Actions */}
                    <div className="flex items-center gap-3 mb-4">
                      <Button
                        onClick={handleAvatarClick}
                        disabled={isUploadingAvatar}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                      >
                        {isUploadingAvatar ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                        Trocar Foto
                      </Button>
                      {avatarUrl && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleDeleteAvatar}
                          disabled={isUploadingAvatar}
                          className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      Formatos aceitos: JPG, PNG, GIF. Máximo 5MB.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Profile Info Card */}
                <div className="bg-card rounded-2xl border border-border p-6 relative overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30">
                      <User className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Informações do Perfil</h3>
                      <p className="text-sm text-muted-foreground">Personalize seu perfil</p>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm text-muted-foreground">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={user?.email || ""}
                          disabled
                          className="pl-10 bg-muted/50 border-border text-muted-foreground"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm text-muted-foreground">
                        Nome de Exibição
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Seu nome"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-muted/50 border-border focus:border-primary"
                      />
                    </div>

                    {/* Phone Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-muted-foreground">
                          Telefone
                        </Label>
                        {phoneVerified && phone && (
                          <span className="flex items-center gap-1 text-xs text-green-500">
                            <CheckCircle className="h-3 w-3" />
                            Verificado
                          </span>
                        )}
                      </div>
                      
                      {/* Current phone display */}
                      {phone && phoneVerified ? (
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="tel"
                            value={phone}
                            disabled
                            className="pl-10 bg-muted/50 border-border text-muted-foreground"
                          />
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                            onClick={() => {
                              setPendingPhone("");
                              setShowVerificationInput(false);
                              setVerificationCode("");
                            }}
                          >
                            Alterar
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Phone input for new/unverified number */}
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="tel"
                              placeholder="(00) 00000-0000"
                              value={pendingPhone}
                              onChange={(e) => setPendingPhone(e.target.value)}
                              disabled={showVerificationInput}
                              className="pl-10 bg-muted/50 border-border focus:border-primary"
                            />
                          </div>

                          {!showVerificationInput ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              onClick={handleSendVerificationCode}
                              disabled={isSendingCode || !pendingPhone}
                            >
                              {isSendingCode ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4" />
                                  Enviar código SMS
                                </>
                              )}
                            </Button>
                          ) : (
                            <div className="space-y-3">
                              <div className="relative">
                                <Input
                                  type="text"
                                  placeholder="Digite o código de 6 dígitos"
                                  value={verificationCode}
                                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                  maxLength={6}
                                  className="text-center text-lg tracking-widest bg-muted/50 border-border focus:border-primary"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    setShowVerificationInput(false);
                                    setVerificationCode("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="flex-1 gap-2"
                                  onClick={handleVerifyCode}
                                  disabled={isVerifyingCode || verificationCode.length !== 6}
                                >
                                  {isVerifyingCode ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Verificando...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4" />
                                      Verificar
                                    </>
                                  )}
                                </Button>
                              </div>
                              <button
                                type="button"
                                className="w-full text-xs text-muted-foreground hover:text-foreground"
                                onClick={handleSendVerificationCode}
                                disabled={isSendingCode}
                              >
                                {isSendingCode ? "Enviando..." : "Reenviar código"}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <Button
                      variant="hero"
                      className="w-full gap-2"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Salvar Perfil
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Change Password Card - Full Width */}
                <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6 relative overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30">
                      <Lock className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Alterar Senha</h3>
                      <p className="text-sm text-muted-foreground">Atualize sua senha de acesso</p>
                    </div>
                  </div>

                  {/* Password Form */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-sm text-muted-foreground">
                        Nova Senha
                      </Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Digite a nova senha"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="bg-muted/50 border-border focus:border-primary pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">
                        Confirmar Nova Senha
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirme a nova senha"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-muted/50 border-border focus:border-primary pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <Button
                        variant="outline"
                        className="w-full md:w-auto gap-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                      >
                        {isChangingPassword ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Alterando...
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4" />
                            Alterar Senha
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProfilePage;
