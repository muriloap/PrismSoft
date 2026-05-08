import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendVerificationRequest {
  phone: string;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SMS_PER_HOUR = 5;

// In-memory rate limiting store (resets on function restart, but provides protection during attacks)
const smsSends = new Map<string, { count: number; firstSend: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const sends = smsSends.get(userId);

  if (!sends || now - sends.firstSend > RATE_LIMIT_WINDOW_MS) {
    smsSends.set(userId, { count: 1, firstSend: now });
    return { allowed: true, remaining: MAX_SMS_PER_HOUR - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (sends.count >= MAX_SMS_PER_HOUR) {
    const resetIn = RATE_LIMIT_WINDOW_MS - (now - sends.firstSend);
    return { allowed: false, remaining: 0, resetIn };
  }

  sends.count++;
  return { allowed: true, remaining: MAX_SMS_PER_HOUR - sends.count, resetIn: RATE_LIMIT_WINDOW_MS - (now - sends.firstSend) };
}

// Generate a random 6-digit code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Validate Brazilian phone number format
function isValidBrazilianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  // Brazilian phones: 10-11 digits (with area code), or 12-13 with country code 55
  if (cleaned.startsWith("55")) {
    return cleaned.length >= 12 && cleaned.length <= 13;
  }
  return cleaned.length >= 10 && cleaned.length <= 11;
}

// Format phone number for Vonage (must include country code)
function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, "");

  // If starts with 0, assume Brazil and add 55
  if (cleaned.startsWith("0")) {
    cleaned = "55" + cleaned.substring(1);
  }

  // If doesn't start with country code, assume Brazil
  if (!cleaned.startsWith("55") && cleaned.length <= 11) {
    cleaned = "55" + cleaned;
  }

  return cleaned;
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

    // Check rate limit before processing
    const rateLimitResult = checkRateLimit(userId);
    if (!rateLimitResult.allowed) {
      const resetInMinutes = Math.ceil(rateLimitResult.resetIn / 60000);
      console.warn(`Rate limit exceeded for user ${userId}. Reset in ${resetInMinutes} minutes.`);
      return new Response(
        JSON.stringify({
          error: `Limite de SMS excedido. Tente novamente em ${resetInMinutes} minutos.`,
          retryAfter: resetInMinutes,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(rateLimitResult.resetIn / 1000).toString(),
          },
        }
      );
    }

    const { phone }: SendVerificationRequest = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Número de telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone number format
    if (!isValidBrazilianPhone(phone)) {
      return new Response(
        JSON.stringify({ error: "Número de telefone inválido. Use o formato brasileiro (DDD + número)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhoneNumber(phone);
    console.log(`Sending verification to: ${formattedPhone} for user: ${userId} (${rateLimitResult.remaining} SMS remaining this hour)`);

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the code using service role client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete any existing pending verifications for this user
    await supabaseAdmin
      .from("phone_verifications")
      .delete()
      .eq("user_id", userId);

    // Insert new verification
    const { error: insertError } = await supabaseAdmin
      .from("phone_verifications")
      .insert({
        user_id: userId,
        phone: formattedPhone,
        code: code,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing verification code:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar código de verificação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS via Vonage
    const vonageApiKey = Deno.env.get("VONAGE_API_KEY");
    const vonageApiSecret = Deno.env.get("VONAGE_API_SECRET");

    if (!vonageApiKey || !vonageApiSecret) {
      console.error("Vonage credentials not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de SMS não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smsResponse = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: vonageApiKey,
        api_secret: vonageApiSecret,
        to: formattedPhone,
        from: "Vonage",
        text: `Codigo de verificacao: ${code}`,
        type: "text",
      }),
    });

    const smsResult = await smsResponse.json();
    console.log("Vonage response:", JSON.stringify(smsResult));

    if (smsResult.messages?.[0]?.status !== "0") {
      console.error("Vonage error:", smsResult.messages?.[0]?.["error-text"]);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar SMS. Verifique o número." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verification code sent successfully to ${formattedPhone}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Código enviado com sucesso",
        remaining: rateLimitResult.remaining,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-phone-verification:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
