const TIMEOUT_MS = 15000;
const MAX_INPUT_CHARS = 8000;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  choices: Array<{ message: { content: string } }>;
}

export interface LlmResult {
  hintsMarkdown: string;
  deps: string[];
  depsTrailerPresent: boolean;
}

const SYSTEM_PROMPT = `You are a Rust learning assistant for a C++ programmer.

STRICT OUTPUT CONTRACT — obey exactly:
1. Output is valid Markdown with one "## <C++ feature>" heading per detected feature.
2. Each heading MUST be followed on the same line by an HTML comment anchor of the form: <!-- anchor: cpp-line-N --> where N is the 1-based C++ source line where the feature appears.
3. The body under each heading is ONLY Rust line comments (lines starting with //). At most 3 lines per hint. No prose, no fenced code blocks, no function bodies, no full implementations.
4. Emit a section ONLY for features actually present in the supplied C++ source.
5. The LAST line of the response MUST be exactly one trailer of the form: <!-- deps: crate1,crate2 --> listing recommended Rust crates inferred from the C++ code. Empty list is "<!-- deps: -->". No other text may follow the trailer.

EXAMPLE:
## std::vector<int>  <!-- anchor: cpp-line-12 -->
// std::vector<int> → Vec<i32>
// Hint: let mut v: Vec<i32> = Vec::new();
// Note: v[i] panics on OOB; use v.get(i) → Option<&i32>

## Lambda  <!-- anchor: cpp-line-18 -->
// Lambda → Closure
// Hint: let f = |x: i32| x * 2;
// Note: Fn / FnMut / FnOnce depending on capture

<!-- deps: -->`;

export class LlmClient {
  constructor(private endpoint: string, private model: string) {}

  updateConfig(endpoint: string, model: string): void {
    this.endpoint = endpoint;
    this.model = model;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  getModel(): string {
    return this.model;
  }

  async healthCheck(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${this.endpoint}/v1/models`, {
        method: 'GET',
        signal: controller.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async translate(cppSource: string): Promise<LlmResult | null> {
    const input = cppSource.slice(0, MAX_INPUT_CHARS);
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `C++ source (line numbers are 1-based):\n\n\`\`\`cpp\n${input}\n\`\`\``,
      },
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.4,
          top_p: 0.95,
          stream: false,
          max_tokens: 1536,
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data = (await response.json()) as ChatResponse;
      const content = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!content) return null;

      return parseLlmResponse(content);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function parseLlmResponse(content: string): LlmResult {
  const lines = content.split(/\r?\n/);
  // Find last non-empty line
  let lastIdx = lines.length - 1;
  while (lastIdx >= 0 && lines[lastIdx].trim() === '') lastIdx--;

  const depsRe = /^<!--\s*deps:\s*(.*?)\s*-->\s*$/;
  let deps: string[] = [];
  let depsTrailerPresent = false;
  let bodyEnd = lines.length;

  if (lastIdx >= 0) {
    const m = depsRe.exec(lines[lastIdx].trim());
    if (m) {
      depsTrailerPresent = true;
      deps = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      bodyEnd = lastIdx;
    }
  }

  if (!depsTrailerPresent) {
    console.warn('[cppToRust] LLM response missing <!-- deps: ... --> trailer; treating as no deps');
  }

  const hintsMarkdown = lines.slice(0, bodyEnd).join('\n').trimEnd();
  return { hintsMarkdown, deps, depsTrailerPresent };
}
