const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
      if (request.method !== "POST") return json({ error: "استخدم POST لإرسال رسالة." }, 405);
      try {
        const body = await request.json();
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return json({ error: "أرسل رسالة واحدة على الأقل." }, 400);
        }
        const messages = body.messages.slice(-12).map((m) => {
          if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") {
            throw new Error("صيغة الرسائل غير صحيحة.");
          }
          return { role: m.role, content: m.content.slice(0, 6000) };
        });
        if (!messages.some((m) => m.role === "user" && m.content.trim())) {
          return json({ error: "اكتب رسالة غير فارغة." }, 400);
        }
        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
          messages: [
            { role: "system", content: "أنت Hassan GPT-6.1 Sol، مساعد ذكاء اصطناعي مفيد وآمن. أجب باللغة العربية ما لم يطلب المستخدم لغة أخرى. كن واضحًا وصادقًا، ولا تدّعِ أنك موديل رسمي من OpenAI أو GPT. الاسم علامة لمشروع المستخدم فقط." },
            ...messages,
          ],
          max_tokens: 900,
          temperature: 0.6,
        });
        const response = result?.response ?? result?.choices?.[0]?.message?.content;
        if (typeof response !== "string" || !response.trim()) {
          return json({ error: "لم يُرجع النموذج نصًا. حاول مرة أخرى." }, 502);
        }
        return json({ response });
      } catch (error) {
        return json({ error: error instanceof SyntaxError ? "بيانات JSON غير صحيحة." : "حدث خطأ أثناء معالجة الرسالة. تحقق من إعداد Workers AI ثم حاول مجددًا." }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
