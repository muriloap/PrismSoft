import { MessageCircle, Mail, Instagram, Twitter } from "lucide-react";
const Footer = () => {
  return <footer className="border-t border-border bg-card/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <a href="/" className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="Logo" className="h-8 w-8" />
              <span className="text-lg font-bold">Prism <span className="text-gradient">SysteM</span></span>
            </a>
            <p className="text-sm text-muted-foreground max-w-sm">
              Sua loja de produtos digitais de confiança. Compra rápida, segura e 100% digital.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="mb-4 font-semibold">Links Rápidos</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Início</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Produtos</a></li>
              <li><a href="https://discord.gg/HEKCFhaXwF" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Suporte</a></li>
              
            </ul>
          </div>

          {/* Social */}
          <div>
            
            <div className="flex gap-3">
              
              
              
              
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          <p>© 2024 Prism SysteM. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>;
};
export default Footer;