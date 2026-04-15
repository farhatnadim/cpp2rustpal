/**
 * LLM Client - Calls a local llama-server (OpenAI-compatible API)
 * for C++ to Rust concept translation.
 */

const TIMEOUT_MS = 15000;
const COOLDOWN_MS = 60000;
const MAX_INPUT_CHARS = 4000;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const SYSTEM_PROMPT = `You are a Rust learning assistant helping a C++ programmer understand Rust concepts.

STRICT RULES - never break these:
1. NEVER write complete, runnable Rust functions or full implementations.
2. ONLY produce Rust line comments (// ...) and short syntax fragments of 1-3 lines maximum.
3. Syntax fragments are illustrative skeletons showing declaration form only.
4. Focus on: type names, trait names, ownership keywords, idiomatic declaration patterns.
5. Do NOT explain things the user already knows from C++ - focus on the Rust side.
6. Do NOT write prose or markdown. Output only valid Rust comment syntax.

OUTPUT FORMAT - follow this exactly for each detected C++ feature:
// [C++ feature] → [Rust equivalent]
// Hint: [short declaration skeleton, 1-3 lines]
// Note: [one key semantic difference]
//

EXAMPLE for input containing std::vector<int> and a lambda:
// std::vector<int> → Vec<i32>
// Hint: let mut v: Vec<i32> = Vec::new();
//       let v = vec![1, 2, 3];
// Note: v[i] panics on out-of-bounds; use v.get(i) → Option<&i32>
//
// Lambda [] (int x) { return x*2; } → Closure |x: i32| x * 2
// Hint: let f = |x: i32| x * 2;
//       let f = move |x: i32| x + captured;
// Note: closures implement Fn / FnMut / FnOnce depending on capture
//

Only output entries for features actually present in the provided C++ code. No preamble, no summary.`;

export class LlmClient {
  private available: boolean = true;
  private cooldownUntil: number = 0;

  constructor(
    private endpoint: string,
    private model: string
  ) {}

  async translate(cppSource: string): Promise<string | null> {
    // Check cooldown after previous failure
    if (!this.available && Date.now() < this.cooldownUntil) {
      return null;
    }

    const input = cppSource.slice(0, MAX_INPUT_CHARS);
    const messages = this.buildMessages(input);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.6,
          top_p: 0.95,
          top_k: 20,
          stream: false,
          max_tokens: 1024,
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        this.markUnavailable();
        return null;
      }

      const data = (await response.json()) as ChatResponse;
      const cleaned = (data.choices?.[0]?.message?.content ?? '').trim();

      this.available = true;
      return cleaned.length > 0 ? this.wrapOutput(cleaned) : null;

    } catch {
      clearTimeout(timer);
      this.markUnavailable();
      return null;
    }
  }

  private markUnavailable(): void {
    this.available = false;
    this.cooldownUntil = Date.now() + COOLDOWN_MS;
  }

  private buildMessages(cppSource: string): ChatMessage[] {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Identify the C++ features in this code and provide their Rust equivalents with syntax hints:\n\n\`\`\`cpp\n${cppSource}\n\`\`\``,
      },
    ];
  }

  private wrapOutput(content: string): string {
    return `// C++ to Rust Translator (LLM-powered)
// Local model: ${this.model}
// Concepts detected in your C++ code:
//
${content}
`;
  }

  updateConfig(endpoint: string, model: string): void {
    this.endpoint = endpoint;
    this.model = model;
    // Reset availability so new config is retried immediately
    this.available = true;
    this.cooldownUntil = 0;
  }
}
