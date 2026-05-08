import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// This page now redirects to the profile page which contains purchases
const PurchasesPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to profile page - purchases are now in the Products & Keys tab
    navigate("/profile", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
    </div>
  );
};

export default PurchasesPage;
