import { useEffect } from 'react';
import { Zap, History, Database, LineChart, Bot, Shield, Play } from 'lucide-react';
import { cn } from '../utils/helpers';

export default function LandingPage({ authed }) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.15 }
    );

    const elements = document.querySelectorAll('.fade-in');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const scrollToAnchor = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0e0d] text-[#f0ece4] selection:bg-[#88d273] selection:text-[#0f0e0d] overflow-x-hidden font-sans">
      <style>{`
        .fade-in {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 600ms ease, transform 600ms ease;
        }
        .fade-in.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .glow-bg {
          position: absolute;
          top: -20%;
          left: 50%;
          transform: translateX(-50%);
          width: 800px;
          height: 600px;
          background: radial-gradient(ellipse at 50% 0%, rgba(136,210,115,0.08) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
      `}</style>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[#252320] backdrop-blur-[12px] bg-[#0f0e0d]/80">
        <div className="flex items-center gap-10">
          <span className="font-mono text-lg font-bold text-[#88d273] cursor-pointer" onClick={() => scrollToAnchor('hero')}>
            Prompt_Env
          </span>
          <div className="hidden md:flex items-center gap-6 text-sm text-[#f0ece4] font-medium">
            <button onClick={() => scrollToAnchor('features')} className="hover:text-[#88d273] transition-colors">Features</button>
            <button onClick={() => scrollToAnchor('how-it-works')} className="hover:text-[#88d273] transition-colors">How it works</button>
            <button className="hover:text-[#88d273] transition-colors">Docs</button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          {!authed && (
            <button onClick={() => navigateTo('/login')} className="text-[#f0ece4] hover:text-[#88d273] transition-colors">
              Sign in
            </button>
          )}
          {authed ? (
            <button 
              onClick={() => navigateTo('/app')}
              className="bg-[#88d273] text-[#0f0e0d] px-4 py-2 rounded-md hover:bg-[#7bc068] transition-colors"
            >
              Go to App &rarr;
            </button>
          ) : (
            <button 
              onClick={() => navigateTo('/register')}
              className="bg-[#88d273] text-[#0f0e0d] px-4 py-2 rounded-md hover:bg-[#7bc068] transition-colors"
            >
              Get Started &rarr;
            </button>
          )}
        </div>
      </nav>

      <main className="relative z-10 pt-20">
        {/* Hero Section */}
        <section id="hero" className="relative flex flex-col items-center justify-center min-h-[90vh] px-6 text-center">
          <div className="glow-bg"></div>
          
          <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center mt-12 fade-in">
            <div className="inline-block px-3 py-1 mb-8 text-xs font-mono font-semibold tracking-widest text-[#88d273] uppercase border border-[#88d273]/30 rounded-full">
              ⚡ Prompt Engineering, Systematized
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Design. Version. <span className="text-[#88d273]">Evaluate.</span><br />
              Ship better AI prompts.
            </h1>
            
            <p className="text-lg md:text-xl text-[#6b6860] max-w-[520px] mx-auto mb-10 leading-relaxed">
              A complete platform for AI teams to iterate on prompts, run systematic evaluations, and track performance over time.
            </p>
            
            <div className="flex items-center justify-center gap-4 mb-8">
              {authed ? (
                <button 
                  onClick={() => navigateTo('/app')}
                  className="flex items-center justify-center bg-[#88d273] text-[#0f0e0d] font-semibold px-6 h-[44px] rounded-md hover:bg-[#7bc068] transition-colors"
                >
                  Go to App &rarr;
                </button>
              ) : (
                <button 
                  onClick={() => navigateTo('/register')}
                  className="flex items-center justify-center bg-[#88d273] text-[#0f0e0d] font-semibold px-6 h-[44px] rounded-md hover:bg-[#7bc068] transition-colors"
                >
                  Get Started for free &rarr;
                </button>
              )}
              <button className="flex items-center justify-center border border-[#252320] text-[#f0ece4] font-medium px-6 h-[44px] rounded-md hover:bg-[#161613] transition-colors">
                View the docs &#x2197;
              </button>
            </div>
            
            <div className="text-xs font-mono text-[#6b6860] flex items-center justify-center gap-3">
              <span>Multi-provider</span>
              <span className="text-[#252320]">&bull;</span>
              <span>Version controlled</span>
              <span className="text-[#252320]">&bull;</span>
              <span>Dataset-driven evaluation</span>
            </div>

            <div className="mt-16 w-full max-w-[600px] text-left bg-[#161613] border border-[#252320] rounded-lg shadow-2xl shadow-black/50 overflow-hidden relative">
              <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(136,210,115,0.02)] pointer-events-none"></div>
              
              <div className="border-b border-[#252320] p-4 pb-2">
                <div className="text-[11px] font-mono text-[#6b6860] mb-2 uppercase tracking-wider">System Prompt</div>
                <div className="text-sm font-mono text-[#f0ece4] leading-relaxed">
                  You are a customer support assistant...
                </div>
              </div>
              
              <div className="p-4 relative">
                <div className="text-[11px] font-mono text-[#6b6860] mb-2 uppercase tracking-wider">User Template</div>
                <div className="text-sm font-mono text-[#f0ece4] leading-relaxed mb-6">
                  Hello <span className="text-[#88d273]">{"{customer_name}"}</span>, your issue is...
                </div>
                
                <div className="absolute right-4 bottom-4 flex items-center text-xs font-mono font-medium text-[#f0ece4] bg-[#252320] px-3 py-1.5 rounded cursor-pointer hover:bg-[#2a2825] transition-colors border border-[#2a2825]">
                  <Play size={12} className="mr-2 text-[#88d273]" fill="currentColor" /> Run Prompt
                </div>
              </div>

              <div className="border-t border-[#252320] bg-[#0f0e0d] p-4 flex flex-col relative">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[11px] font-mono text-[#6b6860] uppercase tracking-wider">Output</div>
                  <div className="flex gap-4 text-[11px] font-mono text-[#6b6860]">
                    <span className="flex items-center gap-1">⏱ 847ms</span>
                    <span className="flex items-center gap-1">🔤 312 tokens</span>
                  </div>
                </div>
                <div className="text-sm font-mono text-[#f0ece4] leading-relaxed">
                  Hi Sarah, I understand your concern...
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section Divider */}
        <div className="w-full h-px bg-[#252320]"></div>

        {/* Features Section */}
        <section id="features" className="py-32 px-6 max-w-6xl mx-auto">
          <div className="mb-16 text-center fade-in">
            <h2 className="text-[13px] font-mono text-[#6b6860] uppercase tracking-widest mb-4">Features</h2>
            <h3 className="text-3xl md:text-4xl font-bold">Everything your team needs to build reliable prompts</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Zap size={18} className="text-[#88d273]" />}
              title="Multi-Provider Inference"
              description="Run prompts against Anthropic, OpenAI, Google, Groq, and custom endpoints from one interface. API keys encrypted at rest, never exposed to the browser."
            />
            <FeatureCard 
              icon={<History size={18} className="text-[#88d273]" />}
              title="Prompt Versioning"
              description="Every change is tracked. Save edits in place or commit new versions with a message. Roll back instantly. Treat prompts like code."
            />
            <FeatureCard 
              icon={<Database size={18} className="text-[#88d273]" />}
              title="Dataset-Driven Testing"
              description="Upload CSV or JSON datasets and run your prompt against every row automatically. Map variables to columns and batch-evaluate in one click."
            />
            <FeatureCard 
              icon={<LineChart size={18} className="text-[#88d273]" />}
              title="Experiment Tracking"
              description="Every run is logged — output, latency, tokens, cost. Filter, search, and compare across models and versions. Nothing gets lost."
            />
            <FeatureCard 
              icon={<Bot size={18} className="text-[#88d273]" />}
              title="AI-Powered Evaluation"
              description="Score outputs automatically on Relevance, Correctness, Fluency, and Toxicity using any model as the evaluator. See reasoning per metric."
            />
            <FeatureCard 
              icon={<Shield size={18} className="text-[#88d273]" />}
              title="Secure by Design"
              description="API keys are Fernet-encrypted before storage. All inference runs through your backend. Nothing sensitive ever touches the browser."
            />
          </div>
        </section>

        {/* Section Divider */}
        <div className="w-full h-px bg-[#252320]"></div>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-32 px-6 max-w-4xl mx-auto">
          <div className="mb-16 fade-in">
            <h2 className="text-[13px] font-mono text-[#6b6860] uppercase tracking-widest mb-4">Workflow</h2>
            <h3 className="text-3xl md:text-4xl font-bold">From first prompt to production-ready</h3>
          </div>
          
          <div className="relative pl-6 md:pl-8 border-l border-[#252320] space-y-16 ml-2 md:ml-4">
            <Step 
              number="01" 
              title="Register a model" 
              description="Add any AI provider — Anthropic, OpenAI, Groq, or a custom endpoint. Your API key is encrypted and stored securely."
            />
            <Step 
              number="02" 
              title="Create and version your prompt" 
              description="Write your system prompt and user template with {variable} support. Save edits in place or commit new versions with a message."
            />
            <Step 
              number="03" 
              title="Run against a dataset" 
              description="Upload a CSV or JSON dataset. Map your variables to columns. Run the batch — every row is tested and logged automatically."
            />
            <Step 
              number="04" 
              title="Evaluate and iterate" 
              description="Score outputs with AI across multiple metrics. Compare versions, identify regressions, ship with confidence."
            />
          </div>
        </section>

        {/* Section Divider */}
        <div className="w-full h-px bg-[#252320]"></div>

        {/* Providers Section */}
        <section className="py-24 px-6 text-center max-w-3xl mx-auto fade-in">
          <h2 className="text-[13px] font-mono text-[#6b6860] uppercase tracking-widest mb-8">Works with your stack</h2>
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {['Anthropic', 'OpenAI', 'Google', 'Groq', 'Mistral', 'Custom'].map(provider => (
              <div key={provider} className="px-3.5 py-1.5 border border-[#252320] rounded-full text-sm font-mono text-[#6b6860] hover:border-[#88d273] transition-colors cursor-default">
                {provider}
              </div>
            ))}
          </div>
          <p className="text-sm text-[#6b6860]">Or connect any OpenAI-compatible endpoint</p>
        </section>

        {/* Section Divider */}
        <div className="w-full h-px bg-[#252320]"></div>

        {/* CTA Section */}
        <section className="py-32 px-6">
          <div className="max-w-3xl mx-auto bg-[#161613] border border-[#252320] rounded-xl p-12 md:p-16 text-center fade-in">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to engineer better prompts?</h2>
            <p className="text-lg text-[#6b6860] mb-10 max-w-md mx-auto">
              Join teams using Prompt_Env to build, test, and evaluate LLM prompts systematically.
            </p>
            {authed ? (
              <button 
                onClick={() => navigateTo('/app')}
                className="inline-flex items-center justify-center bg-[#88d273] text-[#0f0e0d] font-semibold px-8 h-[44px] rounded-md hover:bg-[#7bc068] transition-colors"
              >
                Go to App &rarr;
              </button>
            ) : (
              <button 
                onClick={() => navigateTo('/register')}
                className="inline-flex items-center justify-center bg-[#88d273] text-[#0f0e0d] font-semibold px-8 h-[44px] rounded-md hover:bg-[#7bc068] transition-colors"
              >
                Get Started for free &rarr;
              </button>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#252320] py-8 px-6 bg-[#0f0e0d]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="font-mono text-sm font-bold text-[#88d273]">Prompt_Env</div>
          <div className="text-sm text-[#6b6860]">Built with FastAPI + React</div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-[#161613] border border-[#252320] rounded-lg p-6 fade-in">
      <div className="mb-4">{icon}</div>
      <h4 className="font-bold text-[15px] mb-2">{title}</h4>
      <p className="text-[13px] text-[#6b6860] leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <div className="relative fade-in">
      <div className="absolute -left-[45px] md:-left-[55px] top-0 bg-[#0f0e0d] py-1 text-sm font-mono text-[#88d273] font-bold">
        {number}
      </div>
      <h4 className="font-bold text-lg mb-2">{title}</h4>
      <p className="text-[#6b6860] leading-relaxed max-w-lg">{description}</p>
    </div>
  );
}
