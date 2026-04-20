const DB_KEY = 'prompt_env_data';

function loadDb() {
  const data = localStorage.getItem(DB_KEY);
  if (data) {
    try { return JSON.parse(data); } catch (e) { return initDb(); }
  }
  return initDb();
}

function saveDb(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

function initDb() {
  const initial = {
    prompts: {
      p1: {
        versions: [
          { version: 'v3', label: 'v3', description: 'Added context variable', createdAt: new Date().toISOString(), systemPrompt: "You are an expert medical assistant. Reply in structured json.", userPrompt: "Patient shows symptoms of {symptom_1} and {symptom_2}. Patient age is {age}. Provide a diagnosis." },
          { version: 'v2', label: 'v2', description: 'Tweaked temperature instructions', createdAt: new Date(Date.now() - 3600000).toISOString(), systemPrompt: "You are a medical assistant. Reply in json.", userPrompt: "Patient shows symptoms of {symptom_1}. Provide a diagnosis." },
          { version: 'v1', label: 'v1', description: 'Initial version', createdAt: new Date(Date.now() - 86400000).toISOString(), systemPrompt: "You are a medical bot. Be helpful.", userPrompt: "Patient is sick with {symptom_1}. Help." }
        ]
      }
    },
    experiments: []
  };
  saveDb(initial);
  return initial;
}

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " mins ago";
  return "just now";
}

export const savePromptVersion = async (promptData) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const db = loadDb();
      if (!db.prompts[promptData.id]) db.prompts[promptData.id] = { versions: [] };
      const versions = db.prompts[promptData.id].versions;
      
      const newVersionNum = versions.length > 0 ? parseInt(versions[0].version.replace('v', '')) + 1 : 1;
      const newVersionName = `v${newVersionNum}`;
      
      const newEntry = {
        version: newVersionName,
        label: newVersionName,
        description: 'Saved draft version',
        createdAt: new Date().toISOString(),
        systemPrompt: promptData.systemPrompt || "",
        userPrompt: promptData.userPrompt || ""
      };
      
      versions.unshift(newEntry);
      saveDb(db);
      
      resolve(newEntry);
    }, 300);
  });
};

export const loadVersionHistory = async (promptId) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const db = loadDb();
      const versions = db.prompts[promptId]?.versions || [];
      const mapped = versions.map(v => ({
        ...v,
        createdAtDisplay: timeAgo(v.createdAt)
      }));
      resolve(mapped);
    }, 300);
  });
};

export const runPromptTest = async (promptVersion, variables, model) => {
  return new Promise(resolve => {
    const latency = Math.floor(Math.random() * (1200 - 300 + 1)) + 300;
    setTimeout(() => {
      let diagnosis = "Common Cold";
      if (variables.symptom_1 && variables.symptom_1.toLowerCase().includes('fever')) diagnosis = "Flu";
      if (variables.symptom_2 && variables.symptom_2.toLowerCase().includes('cough')) diagnosis = "Flu or Bronchitis";
      
      const outputObj = {
        diagnosis: diagnosis,
        confidence: 0.82 + (Math.random() * 0.15),
        recommended_action: "Rest, monitor symptoms, and hydrate."
      };

      const outputJson = JSON.stringify(outputObj, null, 2);

      const db = loadDb();
      const experimentId = `e${Math.floor(Math.random()*10000)}`;
      db.experiments.unshift({
        id: experimentId,
        promptVersion: promptVersion,
        model: model,
        dataset: 'Manual Run',
        latency: `${latency}ms`,
        cost: "$0.001",
        score: Math.floor(Math.random() * 20) + 80,
        date: new Date().toISOString()
      });
      saveDb(db);

      resolve({
        output: outputJson,
        latency: `${latency}ms`,
        tokensUsed: { prompt: 130, completion: 45, total: 175 },
        costEstimate: "$0.0016",
        status: "success"
      });
    }, latency);
  });
};

export const loadExperiments = async () => {
    return new Promise(resolve => {
        setTimeout(() => {
            const db = loadDb();
            const mapped = db.experiments.map(e => ({
                ...e,
                dateDisplay: timeAgo(e.date)
            }));
            resolve(mapped);
        }, 300);
    });
};
