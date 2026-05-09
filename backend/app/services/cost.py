COST_PER_1K_TOKENS = {
    "claude-haiku-4-5-20251001":    {"input": 0.00025,  "output": 0.00125},
    "claude-sonnet-4-20250514":     {"input": 0.003,    "output": 0.015},
    "claude-opus-4-5":              {"input": 0.015,    "output": 0.075},
    "gpt-4-turbo":                  {"input": 0.01,     "output": 0.03},
    "gpt-4o":                       {"input": 0.005,    "output": 0.015},
    "gpt-4o-mini":                  {"input": 0.00015,  "output": 0.0006},
    "gpt-3.5-turbo":                {"input": 0.0005,   "output": 0.0015},
    "gemini-2.5-flash":             {"input": 0.00015,  "output": 0.0006},
    "gemini-2.5-pro":               {"input": 0.00125,  "output": 0.005},
    "gemini-1.5-pro":               {"input": 0.00125,  "output": 0.005},
    "mistral-large-latest":         {"input": 0.003,    "output": 0.009},
    "mistral-small-latest":         {"input": 0.001,    "output": 0.003},
    # Groq models — free tier, always 0
    "llama-3.1-8b-instant":         {"input": 0.0,      "output": 0.0},
    "llama-3.3-70b-versatile":      {"input": 0.0,      "output": 0.0},
    "llama3-70b-8192":              {"input": 0.0,      "output": 0.0},
    "mixtral-8x7b-32768":           {"input": 0.0,      "output": 0.0},
}

def calculate_cost(model_id: str, input_tokens: int, output_tokens: int) -> float:
    rates = COST_PER_1K_TOKENS.get(model_id)
    if not rates:
        return 0.0   # unknown model — return 0, don't crash
    input_cost = (input_tokens / 1000) * rates["input"]
    output_cost = (output_tokens / 1000) * rates["output"]
    return round(input_cost + output_cost, 6)
