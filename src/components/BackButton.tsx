import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  to?: string;
  label?: string;
}

const BackButton = ({ to, label = "Voltar" }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/50 transition-all"
    >
      <ArrowLeft className="h-5 w-5" />
      {label}
    </button>
  );
};

export default BackButton;
