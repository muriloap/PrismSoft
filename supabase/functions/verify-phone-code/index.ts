import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyCodeRequest {
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;
    const { code }: VerifyCodeRequest = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Código é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying code for user: ${userId}`);

    // Use service role client for verification operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the pending verification
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from("phone_verifications")
      .select("*")
      .eq("user_id", userId)
      .eq("verified", false)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching verification:", fetchError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar código" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!verification) {
      return new Response(
        JSON.stringify({ error: "Nenhuma verificação pendente encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if code is expired
    if (new Date(verification.expires_at) < new Date()) {
      // Delete expired verification
      await supabaseAdmin
        .from("phone_verifications")
        .delete()
        .eq("id", verification.id);

      return new Response(
        JSON.stringify({ error: "Código expirado. Solicite um novo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if code matches
    if (verification.code !== code) {
      // Increment attempts
      const attempts = (verification.attempts || 0) + 1;
      
      if (attempts >= 3) {
        // Too many attempts, delete verification
        await supabaseAdmin
          .from("phone_verifications")
          .delete()
          .eq("id", verification.id);

        return new Response(
          JSON.stringify({ error: "Muitas tentativas. Solicite um novo código." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseAdmin
        .from("phone_verifications")
        .update({ attempts })
        .eq("id", verification.id);

      return new Response(
        JSON.stringify({ error: "Código incorreto" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Code is correct - update profile with verified phone
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        phone: verification.phone,
        phone_verified: true 
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar perfil" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete the verification record
    await supabaseAdmin
      .from("phone_verifications")
      .delete()
      .eq("id", verification.id);

    console.log(`Phone verified successfully for user: ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "Telefone verificado com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-phone-code:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
