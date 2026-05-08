import { Download, Shield, Zap, MessageCircle, AlertTriangle, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
const TutorialContent = () => {
  return <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 via-background to-fuchsia-900/30 p-8 sm:p-12">
        {/* Background glow effects */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-fuchsia-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            PRISM CHEATS
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-gradient">Tutorial de Uso</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Siga os passos abaixo para configurar e utilizar nossos produtos de forma segura e otimizada
          </p>
          
          <Button size="lg" className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white border-0 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300" onClick={() => window.open("https://prismcheats.shop/", "_blank")}>
            <ExternalLink className="h-5 w-5 mr-2" />
            Acessar Site Oficial
            <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        </div>
      </div>

      {/* Steps Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Step 1 */}
        <div className="group relative rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 shrink-0">
                <Download className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Passo 1</span>
                <h3 className="text-lg font-semibold text-foreground">Download</h3>
              </div>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Acesse o site oficial e faça o download do loader mais recente. Extraia os arquivos em uma pasta de sua preferência.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="group relative rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 shrink-0">
                <Shield className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Passo 2</span>
                <h3 className="text-lg font-semibold text-foreground">Desativar Antivírus</h3>
              </div>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Desative temporariamente o antivírus e Windows Defender. Adicione a pasta nas exclusões para evitar falsos positivos.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="group relative rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 shrink-0">
                <Zap className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Passo 3</span>
                <h3 className="text-lg font-semibold text-foreground">Executar como Admin</h3>
              </div>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Execute o loader como Administrador. Insira sua key quando solicitado e aguarde a validação ser concluída.
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div className="group relative rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 shrink-0">
                <MessageCircle className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Passo 4</span>
                <h3 className="text-lg font-semibold text-foreground">Suporte</h3>
              </div>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Em caso de dúvidas ou problemas, entre em contato com nosso suporte via Discord. Estamos prontos para ajudar!
            </p>
          </div>
        </div>
      </div>

      {/* Warning Card */}
      <div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/20 to-background p-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 shrink-0">
            <AlertTriangle className="h-6 w-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">Importante</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                Nunca compartilhe sua key com outras pessoas
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                Mantenha o software sempre atualizado
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                Use configurações moderadas para maior segurança
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                Não utilize em contas principais ou com skins valiosas
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Discord CTA */}
      
    </div>;
};
export default TutorialContent;