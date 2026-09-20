/* One LLM entry point for the pipeline.

   DEEPSEEK_API_KEY    the provider in use. OpenAI-compatible, no web search,
                       so drafts are written from the article text the run
                       fetched and told to state nothing beyond it.
   OPENROUTER_API_KEY  optional alternative: model fallback chain plus web search.
   ANTHROPIC_API_KEY   optional alternative, no web search.

   The first one set wins, in that order.

   Routes that call this export `preferredRegion = "iad1"`. OpenRouter and
   Anthropic geo-block some Vercel regions, Singapore (sin1) among them, and
   this project's default region is Singapore. DeepSeek does not, but the pin
   costs nothing and keeps the alternatives working. */

export type LlmRequest = {
  system: string;
  user: string;
  /** OpenRouter model ids, tried in order. */
  models: string[];
  maxTokens: number;
  temperature?: number;
  /** Let the model search the web. OpenRouter only. */
  web?: boolean;
};

export type LlmResult = { text: string; model: string };

export function llmConfigured(): boolean {
  return Boolean(
    process.env.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY,
  );
}

/** Whether the active provider can search the web. Prompts change when it cannot. */
export function llmHasWeb(): boolean {
  return !process.env.DEEPSEEK_API_KEY && Boolean(process.env.OPENROUTER_API_KEY);
}

/* deepseek-chat caps output at 8K tokens. That is about 6,000 words, several
   times the longest post, so the clamp never truncates an article. */
const DEEPSEEK_MAX_OUTPUT = 8192;

async function viaDeepSeek(req: LlmRequest): Promise<LlmResult> {
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: Math.min(req.maxTokens, DEEPSEEK_MAX_OUTPUT),
      temperature: req.temperature ?? 0.6,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
    signal: AbortSignal.timeout(280_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${raw.slice(0, 300)}`);
  const json = JSON.parse(raw) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const out = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!out) throw new Error("DeepSeek returned no content");
  if (json.choices?.[0]?.finish_reason === "length") {
    throw new Error("DeepSeek hit max_tokens before finishing");
  }
  return { text: out, model };
}

async function viaOpenRouter(req: LlmRequest, model: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://www.groovesheet.net",
      "X-Title": "GrooveSheet content pipeline",
    },
    body: JSON.stringify({
      model,
      // Reasoning models count thinking tokens inside max_tokens here, so a
      // tight ceiling truncates the article mid-sentence. Callers pass generous
      // values on purpose.
      max_tokens: req.maxTokens,
      temperature: req.temperature ?? 0.6,
      ...(req.web ? { plugins: [{ id: "web", max_results: 5 }] } : {}),
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
    signal: AbortSignal.timeout(240_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenRouter ${res.status} for ${model}: ${raw.slice(0, 300)}`);
  const json = JSON.parse(raw) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    error?: { message?: string };
  };
  if (json.error) throw new Error(`OpenRouter error for ${model}: ${json.error.message}`);
  const out = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!out) throw new Error(`OpenRouter returned no content for ${model}`);
  if (json.choices?.[0]?.finish_reason === "length") {
    throw new Error(`${model} hit max_tokens before finishing`);
  }
  return out;
}

async function viaAnthropic(req: LlmRequest, model: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    }),
    signal: AbortSignal.timeout(240_000),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${raw.slice(0, 300)}`);
  const json = JSON.parse(raw) as { content?: { type: string; text?: string }[] };
  const out = (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
  if (!out) throw new Error("Anthropic returned no text");
  return out;
}

export async function complete(req: LlmRequest): Promise<LlmResult> {
  if (process.env.DEEPSEEK_API_KEY) return viaDeepSeek(req);
  if (process.env.OPENROUTER_API_KEY) {
    const errors: string[] = [];
    for (const model of req.models) {
      try {
        return { text: await viaOpenRouter(req, model), model };
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    throw new Error(`Every model failed. ${errors.join(" | ")}`);
  }
  if (process.env.ANTHROPIC_API_KEY) {
    // "anthropic/claude-sonnet-5" on OpenRouter is "claude-sonnet-5" direct.
    const first = req.models.find((m) => m.startsWith("anthropic/")) ?? "anthropic/claude-sonnet-5";
    const model = first.replace(/^anthropic\//, "").replace(/(\d)\.(\d)/, "$1-$2");
    return { text: await viaAnthropic(req, model), model };
  }
  throw new Error("No LLM key. Set DEEPSEEK_API_KEY.");
}

/** The first balanced JSON value in a model reply, fenced or not. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("No JSON in model reply");
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      return JSON.parse(body.slice(start, i + 1)) as T;
    }
  }
  throw new Error("Unbalanced JSON in model reply");
}
