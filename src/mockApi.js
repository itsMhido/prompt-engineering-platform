export const savePromptVersion = async (promptData) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        id: promptData.id,
        version: promptData.version,
        savedAt: new Date().toISOString(),
        status: "saved"
      });
    }, 400); // 300-800ms
  });
};

export const loadVersionHistory = async (promptId) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        { version: 'v3', label: 'v3', description: 'Added context variable', createdAt: '2 mins ago', author: 'Alex Developer' },
        { version: 'v2', label: 'v2', description: 'Tweaked temperature instructions', createdAt: '1 hour ago', author: 'Alex Developer' },
        { version: 'v1', label: 'v1', description: 'Initial version', createdAt: '2 days ago', author: 'Alex Developer' }
      ]);
    }, 500); // 300-800ms
  });
};

export const runPromptTest = async (promptVersion, variables, model) => {
  return new Promise(resolve => {
    const latency = Math.floor(Math.random() * (1200 - 300 + 1)) + 300;
    setTimeout(() => {
      resolve({
        output: "{\n  \"diagnosis\": \"Common Cold\",\n  \"confidence\": 0.85,\n  \"recommended_action\": \"Rest and hydration\"\n}",
        latency: `${latency}ms`,
        tokensUsed: { prompt: 120, completion: 36, total: 156 },
        costEstimate: "$0.0014",
        status: "success"
      });
    }, latency);
  });
};
