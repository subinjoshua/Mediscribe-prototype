import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ShieldCheck, Activity, ArrowRight, ChevronDown,
  Stethoscope, ClipboardList, Heart,
  Clock, Brain, Camera, CheckCircle,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ─── Indian Flag SVG ─── */
function IndianFlag({ className = "" }) {
  return (
    <svg viewBox="0 0 900 600" className={className} aria-label="Indian Flag">
      <rect width="900" height="200" fill="#FF9933" />
      <rect y="200" width="900" height="200" fill="#FFFFFF" />
      <rect y="400" width="900" height="200" fill="#138808" />
      <circle cx="450" cy="300" r="60" fill="none" stroke="#000080" strokeWidth="4" />
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 15 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1="450" y1="300"
            x2={450 + 55 * Math.sin(angle)}
            y2={300 - 55 * Math.cos(angle)}
            stroke="#000080" strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}

/* ─── constants ─── */
const FEATURES = [
  {
    icon: Camera,
    title: "Smart Prescription Processing",
    subtitle: "Photo \u2192 Structured Data in 60 Seconds",
    description:
      "Snap a photo of any handwritten prescription. MediScribe extracts patient info, medications, dosages, vitals, and diagnosis automatically \u2014 replacing 15 minutes of manual data entry per patient.",
    tags: ["AWS Textract", "Amazon Bedrock", "Claude AI"],
    color: "#00C9A7",
  },
  {
    icon: ShieldCheck,
    title: "Drug Safety Validation",
    subtitle: "Catch Errors Before They Reach Patients",
    description:
      "Every prescription is validated against drug safety databases. Dosage errors, dangerous interactions, allergy conflicts, and wrong units \u2014 flagged instantly with AI-powered recommendations.",
    tags: ["Drug Safety DB", "AI Inference", "Real-time Alerts"],
    color: "#A78BFA",
  },
  {
    icon: Activity,
    title: "Outbreak Detection",
    subtitle: "Spot Disease Patterns Early",
    description:
      "As diagnoses are recorded, MediScribe tracks disease trends across the hospital. When cases spike above baseline, it triggers alerts with 48-hour forecasts and resource recommendations.",
    tags: ["DynamoDB", "Trend Analysis", "48h Forecast"],
    color: "#F59E0B",
  },
  {
    icon: ClipboardList,
    title: "Discharge Summary Generator",
    subtitle: "Complete Documents in One Click",
    description:
      "Generate comprehensive discharge summaries with diagnosis details, medication plans, follow-up instructions, and red-flag warnings \u2014 formatted and ready to hand to the patient.",
    tags: ["Bedrock AI", "Auto-formatted", "Print-ready"],
    color: "#EF4444",
  },
];

const PROTOCOLS = [
  {
    step: "01",
    title: "Snap",
    description: "Doctor writes a prescription. A nurse or clerk photographs it with any smartphone. That\u2019s all the manual work needed.",
    icon: Camera,
    accent: "#00C9A7",
    tab: "Process Tab",
  },
  {
    step: "02",
    title: "Extract",
    description: "AWS Textract reads the handwriting. Amazon Bedrock\u2019s Claude model structures it into patient records, medications, vitals, and ICD-10 codes.",
    icon: Brain,
    accent: "#A78BFA",
    tab: "Process Tab \u2192 Results",
  },
  {
    step: "03",
    title: "Validate",
    description: "AI cross-references every medication against safety databases. Dosage errors, drug interactions, and allergy conflicts are flagged before dispensing.",
    icon: ShieldCheck,
    accent: "#F59E0B",
    tab: "Validate Tab",
  },
  {
    step: "04",
    title: "Act",
    description: "Outbreak patterns are tracked automatically. Discharge summaries are generated instantly. Doctors focus on patients, not paperwork.",
    icon: CheckCircle,
    accent: "#EF4444",
    tab: "Outbreak + Discharge Tabs",
  },
];

const STATS = [
  { value: "4", unit: "hrs", label: "Saved Per Doctor Per Day" },
  { value: "15", unit: "min \u2192 60s", label: "Per Prescription" },
  { value: "< 2", unit: "sec", label: "Drug Validation" },
  { value: "48h", unit: "ahead", label: "Outbreak Forecast" },
];

/* ─── Landing Page ─── */
export default function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const navRef = useRef(null);
  const heroRef = useRef(null);
  const inspirationRef = useRef(null);
  const featuresRef = useRef(null);
  const philosophyRef = useRef(null);
  const protocolRef = useRef(null);
  const statsRef = useRef(null);

  const [navSolid, setNavSolid] = useState(false);

  /* ── GSAP Animations ── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        start: "top -80",
        onUpdate: (self) => setNavSolid(self.progress > 0),
      });

      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
      heroTl
        .from(".hero-badge", { opacity: 0, y: 20, duration: 0.6, delay: 0.2 })
        .from(".hero-title-line", { opacity: 0, y: 40, duration: 0.8, stagger: 0.15 }, "-=0.3")
        .from(".hero-subtitle", { opacity: 0, y: 20, duration: 0.6 }, "-=0.4")
        .from(".hero-cta", { opacity: 0, y: 20, scale: 0.95, duration: 0.6 }, "-=0.3")
        .from(".hero-scroll-hint", { opacity: 0, duration: 0.8 }, "-=0.2");

      /* Inspiration card */
      ScrollTrigger.create({
        trigger: inspirationRef.current,
        start: "top 85%",
        once: true,
        onEnter: () => {
          gsap.fromTo(".inspiration-card",
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }
          );
        },
      });

      /* Problem lines */
      gsap.utils.toArray(".philosophy-line").forEach((line, i) => {
        ScrollTrigger.create({
          trigger: line,
          start: "top 90%",
          once: true,
          onEnter: () => {
            gsap.fromTo(line,
              { opacity: 0, y: 25 },
              { opacity: 1, y: 0, duration: 0.6, delay: i * 0.08, ease: "power2.out" }
            );
          },
        });
      });

      /* Feature cards */
      gsap.utils.toArray(".feature-card").forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top 90%",
          once: true,
          onEnter: () => {
            gsap.fromTo(card,
              { opacity: 0, y: 50 },
              { opacity: 1, y: 0, duration: 0.7, delay: i * 0.1, ease: "power3.out" }
            );
          },
        });
      });

      /* Protocol cards */
      gsap.utils.toArray(".protocol-card").forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top 90%",
          once: true,
          onEnter: () => {
            gsap.fromTo(card,
              { opacity: 0, y: 60, scale: 0.97 },
              { opacity: 1, y: 0, scale: 1, duration: 0.7, delay: i * 0.1, ease: "power3.out" }
            );
          },
        });
      });

      /* Stats */
      gsap.utils.toArray(".stat-item").forEach((item, i) => {
        ScrollTrigger.create({
          trigger: item,
          start: "top 90%",
          once: true,
          onEnter: () => {
            gsap.fromTo(item,
              { opacity: 0, y: 40 },
              { opacity: 1, y: 0, duration: 0.6, delay: i * 0.1, ease: "power3.out" }
            );
          },
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="landing-page bg-void text-ghost font-sora overflow-x-hidden">
      {/* Noise overlay */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-[100] opacity-[0.03]">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* ─── NAVBAR ─── */}
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          navSolid
            ? "bg-void/80 backdrop-blur-xl border-b border-white/5 shadow-2xl"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Stethoscope className="h-7 w-7 text-teal" />
            <span className="text-xl font-bold tracking-tight">
              Medi<span className="text-teal">Scribe</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-ghost/60">
            <a href="#features" className="hover:text-teal transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-teal transition-colors">How It Works</a>
            <a href="#impact" className="hover:text-teal transition-colors">Impact</a>
            <button onClick={() => navigate("/technical")} className="hover:text-teal transition-colors">Technical</button>
            <a href="https://vision.hack2skill.com/event/ai-for-bharat/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-ghost/40 border-l border-white/10 pl-6 hover:text-teal transition-colors">
              <IndianFlag className="h-4 w-6 rounded-sm" />
              <span className="text-xs font-medium">AI For Bharat</span>
            </a>
          </div>
          <button
            onClick={() => navigate("/app")}
            className="magnetic-btn px-5 py-2.5 bg-teal text-void font-semibold text-sm rounded-lg hover:bg-teal-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,201,167,0.3)]"
          >
            Launch Demo
          </button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-teal/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="hero-badge inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-teal/20 bg-teal/5 text-sm font-medium mb-10">
            <IndianFlag className="h-4 w-6 rounded-sm" />
            <span className="text-ghost/60">Built for</span>
            <a href="https://vision.hack2skill.com/event/ai-for-bharat/" target="_blank" rel="noopener noreferrer" className="text-teal font-semibold hover:text-teal-300 transition-colors">AI For Bharat</a>
            <span className="text-ghost/30">|</span>
            <span className="text-ghost/40 font-fira text-xs">AWS + Amazon Bedrock</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[0.95] tracking-tight mb-8">
            <span className="hero-title-line block text-ghost">Give doctors back</span>
            <span className="hero-title-line block text-teal">4 hours</span>
            <span className="hero-title-line block text-ghost/40">every single day.</span>
          </h1>

          <p className="hero-subtitle text-lg sm:text-xl text-ghost/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            Indian doctors spend 4+ hours daily on manual data entry from handwritten prescriptions.
            MediScribe uses AI to do it in seconds &mdash; and catches
            prescription errors, detects outbreaks, and generates discharge summaries along the way.
          </p>

          <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate("/app")}
              className="magnetic-btn group px-8 py-4 bg-teal text-void font-bold text-lg rounded-xl hover:bg-teal-400 transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,201,167,0.35)] flex items-center gap-3"
            >
              Launch MediScribe Demo
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#features"
              className="px-8 py-4 border border-ghost/10 text-ghost/60 font-medium rounded-xl hover:border-ghost/20 hover:text-ghost/80 transition-all duration-300"
            >
              See What It Does
            </a>
          </div>

          <div className="hero-scroll-hint mt-20 flex flex-col items-center gap-2 text-ghost/20">
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ─── INSPIRATION ─── */}
      <section ref={inspirationRef} className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="inspiration-card relative p-10 md:p-12 rounded-2xl border border-teal/15 bg-teal/[0.03]">
            {/* Accent corner */}
            <div className="absolute top-0 left-0 w-1 h-20 rounded-bl bg-teal/40" />
            <div className="absolute top-0 left-0 w-20 h-1 rounded-br bg-teal/40" />

            <Heart className="h-8 w-8 text-red-500 mb-6" fill="currentColor" />

            <blockquote className="text-xl sm:text-2xl md:text-3xl font-light text-ghost/80 leading-relaxed font-instrument italic">
              &ldquo;My sister is a medical intern. She works 12-hour shifts, then spends 3 more hours
              typing, 6 times a week. She comes home at 11 PM.
            </blockquote>
            <p className="text-xl sm:text-2xl md:text-3xl font-light text-ghost/80 leading-relaxed font-instrument italic mt-4">
              MediScribe exists so she can come home on time. MediScribe exists so young doctors
              like her need not spend endless valuable hours typing and worrying about what they
              typed &mdash; in this Agentic World.&rdquo;
            </p>

            <div className="mt-8 flex items-center gap-3">
              <div className="w-10 h-px bg-teal/30" />
              <span className="text-sm text-teal font-semibold tracking-wide">Team Helios</span>
              <span className="text-ghost/20">&middot;</span>
              <a href="https://vision.hack2skill.com/event/ai-for-bharat/" target="_blank" rel="noopener noreferrer" className="text-sm text-ghost/30 font-fira hover:text-teal transition-colors">AI For Bharat</a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── THE PROBLEM ─── */}
      <section ref={philosophyRef} className="py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="philosophy-line text-teal font-fira text-sm tracking-widest uppercase mb-8">
            // the problem
          </p>
          <p className="philosophy-line text-2xl sm:text-3xl md:text-4xl font-light text-ghost/70 leading-relaxed">
            A doctor in India sees{" "}
            <span className="text-ghost font-semibold">40&ndash;60 patients a day</span>.
          </p>
          <p className="philosophy-line text-2xl sm:text-3xl md:text-4xl font-light text-ghost/70 leading-relaxed mt-4">
            Each handwritten prescription takes{" "}
            <span className="text-ghost font-semibold">10&ndash;15 minutes</span>{" "}
            to manually enter into hospital systems.
          </p>
          <p className="philosophy-line text-2xl sm:text-3xl md:text-4xl font-light text-ghost/70 leading-relaxed mt-4">
            That&apos;s{" "}
            <span className="font-instrument italic text-teal">4+ hours lost</span>{" "}
            to paperwork every day.
          </p>
          <p className="philosophy-line text-2xl sm:text-3xl md:text-4xl font-light text-ghost/70 leading-relaxed mt-4">
            Hours that should be spent{" "}
            <span className="text-ghost font-semibold">with patients</span>.
          </p>
          <p className="philosophy-line text-lg text-ghost/30 mt-12 font-fira">
            MediScribe gives that time back. Photograph the prescription. Let AI handle the rest.
          </p>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section ref={featuresRef} id="features" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">
              // what MediScribe does
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold text-ghost">
              Four capabilities. <span className="font-instrument italic text-ghost/50">One platform.</span>
            </h2>
          </div>

          {/* Time savings banner */}
          <div className="flex items-center justify-center gap-6 mb-12 p-5 rounded-xl border border-teal/10 bg-teal/[0.03]">
            <Clock className="h-6 w-6 text-teal flex-shrink-0" />
            <p className="text-ghost/60 text-sm sm:text-base">
              <span className="text-ghost font-semibold">15 minutes</span> of manual entry per prescription
              &rarr; <span className="text-teal font-bold">60 seconds</span> with MediScribe
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="feature-card group relative p-8 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500 hover:shadow-2xl"
              >
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${f.color}08, transparent 40%)`,
                  }}
                />

                <div className="relative z-10">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: `${f.color}15` }}
                  >
                    <f.icon className="h-6 w-6" style={{ color: f.color }} />
                  </div>

                  <h3 className="text-xl font-bold text-ghost mb-1">{f.title}</h3>
                  <p className="text-sm font-fira mb-4" style={{ color: f.color }}>
                    {f.subtitle}
                  </p>
                  <p className="text-ghost/50 text-sm leading-relaxed mb-6">
                    {f.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {f.tags.map((tag, j) => (
                      <span
                        key={j}
                        className="px-3 py-1 text-xs font-fira rounded-full border border-white/10 text-ghost/40"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section ref={protocolRef} id="how-it-works" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">
              // how it works
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold text-ghost">
              Four steps. <span className="font-instrument italic text-ghost/50">Zero paperwork.</span>
            </h2>
          </div>

          <div className="space-y-6">
            {PROTOCOLS.map((p, i) => (
              <div
                key={i}
                className="protocol-card relative p-8 md:p-10 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300"
                style={{ position: "sticky", top: `${120 + i * 20}px` }}
              >
                <div className="flex items-start gap-6 md:gap-10">
                  <div className="flex-shrink-0">
                    <span
                      className="text-5xl md:text-6xl font-extrabold font-fira opacity-20"
                      style={{ color: p.accent }}
                    >
                      {p.step}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${p.accent}15` }}
                      >
                        <p.icon className="h-5 w-5" style={{ color: p.accent }} />
                      </div>
                      <h3 className="text-2xl md:text-3xl font-bold text-ghost">{p.title}</h3>
                    </div>
                    <p className="text-ghost/50 text-lg leading-relaxed max-w-2xl">
                      {p.description}
                    </p>
                    <p className="mt-3 text-xs font-fira" style={{ color: p.accent }}>
                      {">"} See it in: {p.tab}
                    </p>
                  </div>
                </div>
                <div
                  className="absolute bottom-0 left-8 right-8 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${p.accent}30, transparent)` }}
                />
              </div>
            ))}
          </div>

          {/* CTA to try it */}
          <div className="text-center mt-12">
            <button
              onClick={() => navigate("/app")}
              className="magnetic-btn group px-6 py-3 border border-teal/20 text-teal font-semibold rounded-xl hover:bg-teal/10 transition-all duration-300 inline-flex items-center gap-2 text-sm"
            >
              Try all 4 steps in the demo
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── IMPACT STATS ─── */}
      <section ref={statsRef} id="impact" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">
              // impact
            </p>
            <h2 className="text-4xl sm:text-5xl font-bold text-ghost">
              Time saved. <span className="font-instrument italic text-ghost/50">Lives protected.</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <div
                key={i}
                className="stat-item text-center p-8 rounded-2xl border border-white/5 bg-white/[0.02]"
              >
                <div className="text-4xl md:text-5xl font-extrabold text-teal mb-1">
                  {s.value}
                  <span className="text-2xl md:text-3xl text-teal/60">{s.unit}</span>
                </div>
                <p className="text-ghost/40 text-sm font-medium mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-ghost mb-6">
            See it in <span className="text-teal">action</span>.
          </h2>
          <p className="text-ghost/40 text-lg mb-10 max-w-xl mx-auto">
            Upload a prescription photo, watch AI extract every detail, validate medications,
            check for outbreaks, and generate a discharge summary. All in one demo.
          </p>
          <button
            onClick={() => navigate("/app")}
            className="magnetic-btn group px-10 py-5 bg-teal text-void font-bold text-xl rounded-xl hover:bg-teal-400 transition-all duration-300 hover:shadow-[0_0_60px_rgba(0,201,167,0.3)] inline-flex items-center gap-3"
          >
            Launch MediScribe Demo
            <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Stethoscope className="h-5 w-5 text-teal/50" />
            <span className="text-sm text-ghost/30">
              Medi<span className="text-teal/50">Scribe</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <IndianFlag className="h-3.5 w-5 rounded-sm" />
            <p className="text-xs text-ghost/20 font-fira">
              <a href="https://vision.hack2skill.com/event/ai-for-bharat/" target="_blank" rel="noopener noreferrer" className="hover:text-teal transition-colors">AI For Bharat</a> Hackathon &middot; Built with Amazon Bedrock &middot; AWS Textract &middot; DynamoDB &middot; S3
            </p>
          </div>
          <div className="flex items-center gap-4 text-ghost/20 text-xs">
            <span>Team Helios</span>
            <span className="text-teal/30">&middot;</span>
            <span>2025</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
