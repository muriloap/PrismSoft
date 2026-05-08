import { Shield, Zap, Clock, CreditCard } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "100% Seguro",
    description: "Transações protegidas e criptografadas",
  },
  {
    icon: Zap,
    title: "Entrega Instantânea",
    description: "Receba seus produtos em segundos",
  },
  {
    icon: Clock,
    title: "Suporte 24/7",
    description: "Atendimento a qualquer hora do dia",
  },
  {
    icon: CreditCard,
    title: "Várias Formas de Pagamento",
    description: "Pix, cartão e muito mais",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center card-hover"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/20 to-fuchsia-600/20 text-purple-500 transition-colors group-hover:from-purple-600 group-hover:to-fuchsia-600 group-hover:text-white">
                <feature.icon className="h-7 w-7" />
              </div>
              <h3 className="mb-2 font-bold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
