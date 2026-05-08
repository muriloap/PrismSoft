import { Link } from 'react-router-dom';
import { ChevronRight, FileText, Shield, CreditCard, AlertTriangle, RefreshCw, Scale } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackButton from '@/components/BackButton';

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton to="/" />
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Termos e Condições</span>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Termos e Condições</h1>
            <p className="text-muted-foreground">
              Última atualização: Janeiro de 2025
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8">
            {/* Introdução */}
            <section className="bg-card border border-border rounded-2xl p-6">
              <p className="text-muted-foreground leading-relaxed">
                Bem-vindo à Prism SysteM. Ao acessar e utilizar nossos serviços, você concorda com os termos e condições descritos abaixo. Por favor, leia atentamente antes de realizar qualquer compra.
              </p>
            </section>

            {/* Seção 1 */}
            <section className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Scale className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">1. Aceitação dos Termos</h2>
              </div>
              <div className="pl-14 space-y-3 text-muted-foreground">
                <p>
                  Ao realizar uma compra em nossa plataforma, você declara que:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Tem pelo menos 18 anos de idade ou possui autorização de um responsável legal.</li>
                  <li>Leu, compreendeu e concorda com todos os termos aqui descritos.</li>
                  <li>Assume total responsabilidade pelo uso dos produtos adquiridos.</li>
                  <li>Entende que os produtos são destinados exclusivamente para uso pessoal e educacional.</li>
                </ul>
              </div>
            </section>

            {/* Seção 2 */}
            <section className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">2. Produtos e Pagamentos</h2>
              </div>
              <div className="pl-14 space-y-3 text-muted-foreground">
                <p>
                  <strong className="text-foreground">2.1 Produtos Digitais:</strong> Todos os produtos comercializados são digitais e entregues automaticamente após a confirmação do pagamento.
                </p>
                <p>
                  <strong className="text-foreground">2.2 Formas de Pagamento:</strong> Aceitamos pagamentos via PIX (aprovação imediata) e cartão de crédito/débito através do Mercado Pago.
                </p>
                <p>
                  <strong className="text-foreground">2.3 Entrega:</strong> A entrega do produto é feita instantaneamente via email e/ou painel do usuário após a confirmação do pagamento.
                </p>
                <p>
                  <strong className="text-foreground">2.4 Licenças:</strong> Cada licença adquirida é válida pelo período especificado na descrição do produto (diário, semanal, mensal ou lifetime).
                </p>
              </div>
            </section>

            {/* Seção 3 */}
            <section className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">3. Política de Reembolso</h2>
              </div>
              <div className="pl-14 space-y-3 text-muted-foreground">
                <p>
                  <strong className="text-foreground">3.1 Produtos Digitais:</strong> Devido à natureza digital dos produtos, não oferecemos reembolso após a entrega da chave/licença.
                </p>
                <p>
                  <strong className="text-foreground">3.2 Exceções:</strong> Reembolsos podem ser considerados apenas nos seguintes casos:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Produto não entregue em até 24 horas após confirmação do pagamento.</li>
                  <li>Chave/licença inválida ou já utilizada (mediante comprovação).</li>
                  <li>Erro técnico comprovado que impeça o uso do produto.</li>
                </ul>
                <p>
                  <strong className="text-foreground">3.3 Prazo:</strong> Solicitações de reembolso devem ser feitas em até 7 dias após a compra.
                </p>
              </div>
            </section>

            {/* Seção 4 */}
            <section className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">4. Uso dos Produtos</h2>
              </div>
              <div className="pl-14 space-y-3 text-muted-foreground">
                <p>
                  <strong className="text-foreground">4.1 Responsabilidade:</strong> O usuário é inteiramente responsável pelo uso dos produtos adquiridos.
                </p>
                <p>
                  <strong className="text-foreground">4.2 Proibições:</strong> É expressamente proibido:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Revender, distribuir ou compartilhar as licenças adquiridas.</li>
                  <li>Realizar engenharia reversa ou modificar os produtos.</li>
                  <li>Utilizar os produtos para fins ilegais ou maliciosos.</li>
                  <li>Compartilhar credenciais de acesso com terceiros.</li>
                </ul>
                <p>
                  <strong className="text-foreground">4.3 Violações:</strong> O descumprimento dessas regras pode resultar em cancelamento da licença sem direito a reembolso.
                </p>
              </div>
            </section>

            {/* Seção 5 */}
            <section className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">5. Isenção de Responsabilidade</h2>
              </div>
              <div className="pl-14 space-y-3 text-muted-foreground">
                <p>
                  <strong className="text-foreground">5.1 Uso por Conta e Risco:</strong> O uso dos produtos é feito por conta e risco do usuário. A Prism SysteM não se responsabiliza por:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Banimentos ou penalidades aplicadas por terceiros.</li>
                  <li>Danos diretos ou indiretos decorrentes do uso dos produtos.</li>
                  <li>Incompatibilidades com sistemas ou softwares do usuário.</li>
                  <li>Atualizações de terceiros que afetem o funcionamento dos produtos.</li>
                </ul>
                <p>
                  <strong className="text-foreground">5.2 Garantias:</strong> Os produtos são fornecidos "como estão", sem garantias expressas ou implícitas de funcionamento contínuo.
                </p>
              </div>
            </section>

            {/* Seção 6 */}
            <section className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">6. Disposições Gerais</h2>
              </div>
              <div className="pl-14 space-y-3 text-muted-foreground">
                <p>
                  <strong className="text-foreground">6.1 Alterações:</strong> Reservamo-nos o direito de alterar estes termos a qualquer momento, sem aviso prévio.
                </p>
                <p>
                  <strong className="text-foreground">6.2 Privacidade:</strong> Seus dados pessoais são tratados conforme nossa Política de Privacidade e nunca serão compartilhados com terceiros.
                </p>
                <p>
                  <strong className="text-foreground">6.3 Contato:</strong> Para dúvidas ou suporte, entre em contato através do nosso Discord ou WhatsApp.
                </p>
                <p>
                  <strong className="text-foreground">6.4 Foro:</strong> Fica eleito o foro da comarca do domicílio do fornecedor para dirimir quaisquer questões decorrentes destes termos.
                </p>
              </div>
            </section>

            {/* Footer note */}
            <div className="text-center py-8 text-sm text-muted-foreground">
              <p>
                Ao realizar uma compra, você confirma que leu e concorda com todos os termos acima.
              </p>
              <p className="mt-2">
                Em caso de dúvidas, entre em contato conosco antes de finalizar sua compra.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsPage;
