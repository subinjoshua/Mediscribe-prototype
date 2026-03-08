import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Stethoscope, ArrowRight, ChevronDown, ChevronRight,
  Camera, Brain, ShieldCheck, BarChart3, Database,
  Server, Globe, Cloud, Lock, FileText, Zap, CheckCircle,
  AlertTriangle, Heart, Shield, Activity, ClipboardList,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ─── Indian Flag ─── */
function IndianFlag({ className = "" }) {
  return (
    <svg viewBox="0 0 900 600" className={className} aria-label="Indian Flag">
      <rect width="900" height="200" fill="#FF9933" />
      <rect y="200" width="900" height="200" fill="#FFFFFF" />
      <rect y="400" width="900" height="200" fill="#138808" />
      <circle cx="450" cy="300" r="60" fill="none" stroke="#000080" strokeWidth="4" />
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * 15 * Math.PI) / 180;
        return <line key={i} x1="450" y1="300" x2={450 + 55 * Math.sin(a)} y2={300 - 55 * Math.cos(a)} stroke="#000080" strokeWidth="2" />;
      })}
    </svg>
  );
}

/* ─── Data ─── */
const SERVICES = [
  { name: "Amazon S3", role: "Stores prescription images", stat: "~0.1s upload", color: "#E7793F", icon: Cloud },
  { name: "Amazon Textract", role: "Reads handwritten notes via OCR", stat: "~3s processing", color: "#FF9900", icon: FileText },
  { name: "Amazon Bedrock", role: "Medical AI reasoning (Claude Sonnet 4.6)", stat: "~5-15s inference", color: "#00C9A7", icon: Brain },
  { name: "Amazon DynamoDB", role: "Patient records + drug database", stat: "<10ms reads", color: "#527FFF", icon: Database },
  { name: "AWS Lambda", role: "Serverless compute (7 functions)", stat: "~$0 free tier", color: "#F59E0B", icon: Zap },
  { name: "API Gateway", role: "REST API (8 endpoints)", stat: "<500ms p95", color: "#A78BFA", icon: Globe },
];

const LAYERS = [
  {
    num: "01",
    title: "Input Intelligence",
    subtitle: "Photo to Patient Record",
    accent: "#00C9A7",
    icon: Camera,
    time: "~8 seconds end-to-end",
    code: `Photo Upload → S3.putObject()
  → Textract.detectDocumentText()
  → Extract LINE blocks, join text
  → Bedrock.invokeModel() with structuring prompt
  → Parse JSON: {
      patient, vitals, diagnosis, medications
    }
  → DynamoDB.putItem()
  → Patient record created`,
  },
  {
    num: "02",
    title: "Medical Intelligence",
    subtitle: "Prescription Safety Net",
    accent: "#A78BFA",
    icon: ShieldCheck,
    time: "<2 seconds | 25 medications in drug DB",
    code: `Prescription Entry → DynamoDB.getItem(drugName)
  → Rule Engine:
  ├── Unit validation (mg vs ml vs mcg)
  ├── Dosage range check (adult/pediatric)
  ├── Allergy cross-reactivity check
  └── Diagnosis contraindication check
  → Bedrock.invokeModel() for complex reasoning
  ├── Drug-drug interactions
  ├── Duplicate therapy detection
  └── Clinical context analysis
  → Merge results → Return errors/warnings/info`,
  },
  {
    num: "03",
    title: "Pattern Intelligence",
    subtitle: "Outbreak Detection Engine",
    accent: "#F59E0B",
    icon: Activity,
    time: "<30 seconds from diagnosis entry",
    code: `New Diagnosis Saved → Lambda triggered
  → DynamoDB.query(GSI1)
    "All diagnoses at this hospital, last 24h"
  → Count by disease
  → Check thresholds:
  ├── Absolute: 5+ cases of same disease
  └── Relative: 3x above 4-week baseline
  → IF threshold crossed:
    → Bedrock.invokeModel() for epi analysis
    → Generate forecast (48-72h prediction)
    → Calculate resource needs
       (beds, fluids, test kits)
    → DynamoDB.putItem() → Alert stored`,
  },
  {
    num: "04",
    title: "Automation Intelligence",
    subtitle: "Discharge Summary Generator",
    accent: "#EF4444",
    icon: ClipboardList,
    time: "~15-20 seconds for 5-day stay",
    code: `Discharge Request → Lambda
  → DynamoDB.query(PATIENT#{id})  → Profile
  → DynamoDB.query(ENCOUNTER#{id}) → Details
  → DynamoDB.query(ENCOUNTER#{id}, NOTE#)  → Notes
  → DynamoDB.query(ENCOUNTER#{id}, MED#)   → Meds
  → DynamoDB.query(ENCOUNTER#{id}, LAB#*)  → Labs
  → Aggregate all data
  → Bedrock.invokeModel() with discharge prompt
  → Return: narrative + diagnoses
           + meds + instructions`,
  },
];

const SCHEMA_ROWS = [
  { pk: "PATIENT#P001", sk: "PROFILE", desc: "Patient demographics (name, age, gender, allergies)" },
  { pk: "PATIENT#P001", sk: "ENCOUNTER#E001", desc: "Hospital encounter (admission, diagnosis)" },
  { pk: "ENCOUNTER#E001", sk: "MED#M001", desc: "Prescribed medication (drug, dose, frequency)" },
  { pk: "ENCOUNTER#E001", sk: "NOTE#2026-03-02", desc: "Daily progress note" },
  { pk: "ENCOUNTER#E001", sk: "LAB#2026-03-01", desc: "Lab results (CBC, LFT, etc.)" },
  { pk: "DIAGNOSIS#D006", sk: "DETAIL", desc: "Diagnosis record (feeds outbreak detection)" },
];

const PROMPTS = [
  {
    title: "Structure OCR Text",
    accent: "#00C9A7",
    preview: `You are a medical data extraction specialist.
Given raw OCR text from a handwritten prescription,
extract and return ONLY valid JSON with this schema:
{
  patient: { name, age, gender, allergies },
  vitals: { bp, hr, temp, spo2 },
  diagnosis: { chiefComplaint, diagnosis, icd10 },
  medications: [{ name, dosage, unit, frequency }],
  labs: [string]
}
Rules: Infer ICD-10 codes. Flag low-confidence fields.
Never hallucinate data not present in the text.`,
  },
  {
    title: "Validate Prescription",
    accent: "#A78BFA",
    preview: `You are a clinical pharmacology AI.
Validate each medication against these 6 checks:
1. UNIT CHECK — Is the unit correct for this form?
   (e.g., tablets=mg, liquids=ml, injectables=mcg)
2. DOSAGE RANGE — Within safe range for age/weight?
3. ALLERGY CHECK — Cross-reactivity with known allergies
4. DRUG INTERACTION — Dangerous combinations?
5. DUPLICATE THERAPY — Same drug class prescribed twice?
6. DIAGNOSIS FIT — Does this drug match the diagnosis?

Return: { errors: [], warnings: [], info: [] }
Each item: { drug, type, severity, message }`,
  },
  {
    title: "Outbreak Analysis",
    accent: "#F59E0B",
    preview: `You are an epidemiologist AI.
Given: disease case counts for the last 24 hours
and the historical 4-week baseline for this hospital.

Analyze:
- Is this a statistically significant increase?
- What is the likely trajectory (48h, 72h)?
- What resources will be needed?
  (beds, IV fluids, platelet units, test kits)
- What actions should the hospital take?

Return: { forecast, resourceRecommendations,
  recommendedActions, severity, reasoning }`,
  },
  {
    title: "Discharge Summary",
    accent: "#EF4444",
    preview: `You are a senior physician generating a
discharge summary. Include ALL of:

1. Hospital course narrative (day-by-day)
2. Diagnoses (primary + secondary) with ICD-10
3. Procedures performed
4. Discharge medications with dosage/frequency
5. Follow-up appointments
6. Patient instructions (diet, activity, wound care)
7. RED FLAGS — symptoms requiring immediate return

Quality: Professional tone. Complete sentences.
No abbreviations in patient instructions.`,
  },
];

const PRODUCTION_SERVICES = [
  { name: "Amazon Transcribe Medical", desc: "Voice-to-chart: doctors speak, AI documents", status: "planned" },
  { name: "Amazon Comprehend Medical", desc: "Extract RxNorm, ICD-10, SNOMED codes automatically", status: "planned" },
  { name: "Amazon Translate", desc: "22 Indian languages, bidirectional medical translation", status: "planned" },
  { name: "Amazon SageMaker", desc: "Custom ML models for outbreak forecasting", status: "planned" },
  { name: "AWS HealthLake", desc: "FHIR R4 compliant data store for interoperability", status: "planned" },
  { name: "Amazon Cognito", desc: "Authentication with MFA, role-based access", status: "planned" },
  { name: "AWS AppSync", desc: "Real-time GraphQL subscriptions for outbreak alerts", status: "planned" },
  { name: "Amazon SNS", desc: "Multi-channel alerts: SMS, email, push", status: "planned" },
  { name: "Amazon SES", desc: "Email delivery for discharge summaries", status: "planned" },
  { name: "Amazon QuickSight", desc: "BI dashboards for hospital administrators", status: "planned" },
  { name: "Amazon Redshift", desc: "Data warehouse for historical analytics", status: "planned" },
  { name: "AWS Glue", desc: "ETL pipelines for cross-hospital data aggregation", status: "planned" },
  { name: "Amazon EventBridge", desc: "Event-driven architecture for real-time processing", status: "planned" },
  { name: "AWS Step Functions", desc: "Multi-step workflow orchestration", status: "planned" },
  { name: "AWS WAF", desc: "Web application firewall for security", status: "planned" },
  { name: "AWS KMS", desc: "Encryption key management for PHI data", status: "planned" },
  { name: "AWS CloudTrail", desc: "Audit logging for HIPAA compliance", status: "planned" },
  { name: "Amazon CloudWatch", desc: "Monitoring, metrics, and alerting", status: "planned" },
  { name: "AWS X-Ray", desc: "Distributed tracing for performance", status: "planned" },
];

const COMPLIANCE = [
  { title: "HIPAA Ready", desc: "HIPAA-eligible AWS services, encryption at rest and in transit", icon: Shield },
  { title: "India DPDP Act", desc: "Data localization in AWS Mumbai region, consent management", icon: Lock },
  { title: "FHIR R4", desc: "Healthcare interoperability standard, HealthLake ready", icon: Globe },
  { title: "ABDM Integration", desc: "Ayushman Bharat Digital Mission, ABHA health ID support", icon: Heart },
  { title: "GDPR Ready", desc: "For EU market expansion, data subject rights", icon: Shield },
  { title: "ISO 13485", desc: "Medical device quality management pathway", icon: CheckCircle },
];

/* ─── Page Component ─── */
export default function TechnicalPage() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [navSolid, setNavSolid] = useState(false);
  const [expandedLayer, setExpandedLayer] = useState(null);
  const [serviceCount, setServiceCount] = useState(6);

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        start: "top -80",
        onUpdate: (self) => setNavSolid(self.progress > 0),
      });

      /* Hero */
      gsap.from(".tech-hero-content > *", {
        opacity: 0, y: 30, duration: 0.7, stagger: 0.12, ease: "power3.out", delay: 0.2,
      });

      /* Section headers */
      gsap.utils.toArray(".section-header").forEach((el) => {
        ScrollTrigger.create({
          trigger: el, start: "top 88%", once: true,
          onEnter: () => gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }),
        });
      });

      /* Service cards */
      gsap.utils.toArray(".service-card").forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card, start: "top 92%", once: true,
          onEnter: () => gsap.fromTo(card, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, delay: i * 0.08, ease: "power3.out" }),
        });
      });

      /* Pipeline cards */
      gsap.utils.toArray(".pipeline-card").forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card, start: "top 90%", once: true,
          onEnter: () => gsap.fromTo(card, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.6, delay: i * 0.1, ease: "power3.out" }),
        });
      });

      /* Schema rows */
      gsap.utils.toArray(".schema-row").forEach((row, i) => {
        ScrollTrigger.create({
          trigger: row, start: "top 92%", once: true,
          onEnter: () => gsap.fromTo(row, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.4, delay: i * 0.06, ease: "power2.out" }),
        });
      });

      /* Prompt cards */
      gsap.utils.toArray(".prompt-card").forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card, start: "top 92%", once: true,
          onEnter: () => gsap.fromTo(card, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, delay: i * 0.1, ease: "power3.out" }),
        });
      });

      /* Production cards */
      gsap.utils.toArray(".prod-card").forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card, start: "top 95%", once: true,
          onEnter: () => gsap.fromTo(card, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.4, delay: i * 0.03, ease: "power2.out" }),
        });
      });

      /* Service count-up */
      const countTrigger = document.querySelector(".count-up-trigger");
      if (countTrigger) {
        ScrollTrigger.create({
          trigger: countTrigger, start: "top 80%", once: true,
          onEnter: () => {
            const obj = { val: 6 };
            gsap.to(obj, {
              val: 25, duration: 2, ease: "power2.out",
              onUpdate: () => setServiceCount(Math.round(obj.val)),
            });
          },
        });
      }

      /* Cost cards */
      gsap.utils.toArray(".cost-card").forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card, start: "top 90%", once: true,
          onEnter: () => gsap.fromTo(card, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, delay: i * 0.12, ease: "power3.out" }),
        });
      });

      /* Compliance badges */
      gsap.utils.toArray(".compliance-badge").forEach((badge, i) => {
        ScrollTrigger.create({
          trigger: badge, start: "top 92%", once: true,
          onEnter: () => gsap.fromTo(badge, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, delay: i * 0.08, ease: "back.out(1.5)" }),
        });
      });

      /* Architecture diagram flow animation */
      gsap.utils.toArray(".flow-dot").forEach((dot) => {
        gsap.to(dot, {
          x: "100%",
          duration: 2 + Math.random(),
          repeat: -1,
          ease: "none",
          delay: Math.random() * 2,
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="landing-page bg-void text-ghost font-sora overflow-x-hidden">
      {/* Noise overlay */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-[100] opacity-[0.03]">
        <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>

      {/* ─── NAVBAR ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${navSolid ? "bg-void/80 backdrop-blur-xl border-b border-white/5 shadow-2xl" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Stethoscope className="h-7 w-7 text-teal" />
            <span className="text-xl font-bold tracking-tight">Medi<span className="text-teal">Scribe</span></span>
          </button>
          <div className="hidden md:flex items-center gap-8 text-sm text-ghost/60">
            <button onClick={() => navigate("/")} className="hover:text-teal transition-colors">Home</button>
            <a href="#architecture" className="hover:text-teal transition-colors">Architecture</a>
            <a href="#pipeline" className="hover:text-teal transition-colors">Pipeline</a>
            <a href="#production" className="hover:text-teal transition-colors">Production</a>
            <a href="https://vision.hack2skill.com/event/ai-for-bharat/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-ghost/40 border-l border-white/10 pl-6 hover:text-teal transition-colors">
              <IndianFlag className="h-4 w-6 rounded-sm" />
              <span className="text-xs font-medium">AI For Bharat</span>
            </a>
          </div>
          <button onClick={() => navigate("/app")} className="magnetic-btn px-5 py-2.5 bg-teal text-void font-semibold text-sm rounded-lg hover:bg-teal-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,201,167,0.3)]">
            Launch Demo
          </button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center tech-hero-content">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal/20 bg-teal/5 text-sm font-fira text-teal mb-8">
            6 AWS Services &middot; 4 AI Layers &middot; 0 Mocked Features
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-4">
            Under the <span className="text-teal">Hood</span>
          </h1>
          <p className="text-xl sm:text-2xl font-instrument italic text-ghost/50 max-w-2xl mx-auto">
            How MediScribe processes real medical data through real AWS services
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 1: Architecture Diagram + Service Cards
         ═══════════════════════════════════════════════════════ */}
      <section id="architecture" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="section-header text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">// architecture</p>
            <h2 className="text-4xl sm:text-5xl font-bold">The Prototype &mdash; <span className="font-instrument italic text-ghost/50">What&apos;s Live Today</span></h2>
          </div>

          {/* Architecture Diagram */}
          <div className="relative p-6 md:p-10 rounded-2xl border border-white/5 bg-white/[0.02] mb-16 overflow-hidden">
            {/* Entry point */}
            <div className="text-center mb-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-400 text-xs font-fira">
                <Globe className="h-3.5 w-3.5" /> API Gateway &mdash; 8 REST Endpoints
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_2fr_auto_1.5fr] gap-4 md:gap-2 items-center mt-8">
              {/* INPUT */}
              <div className="text-center space-y-3">
                <p className="text-xs font-fira text-ghost/30 uppercase tracking-widest">Input</p>
                <div className="p-5 rounded-xl border border-teal/20 bg-teal/[0.04]">
                  <Camera className="h-8 w-8 text-teal mx-auto mb-2" />
                  <p className="text-sm font-semibold text-ghost">Prescription Photo</p>
                  <p className="text-xs text-ghost/30 mt-1">Base64 image upload</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center px-2">
                <div className="relative w-12 h-px bg-teal/20 overflow-hidden">
                  <div className="flow-dot absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-teal shadow-[0_0_8px_rgba(0,201,167,0.6)]" style={{ left: "-8px" }} />
                </div>
                <ArrowRight className="h-4 w-4 text-teal/40" />
              </div>

              {/* PROCESSING PIPELINE */}
              <div className="space-y-3">
                <p className="text-xs font-fira text-ghost/30 uppercase tracking-widest text-center">Processing Pipeline</p>
                {[
                  { name: "Amazon S3", sub: "Image Storage", color: "#E7793F", icon: Cloud },
                  { name: "Amazon Textract", sub: "Handwriting OCR", color: "#FF9900", icon: FileText },
                  { name: "Amazon Bedrock", sub: "Claude Sonnet 4.6 \u2014 Medical Reasoning", color: "#00C9A7", icon: Brain, large: true },
                  { name: "Amazon DynamoDB", sub: "Patients \u2022 Drugs \u2022 Alerts", color: "#527FFF", icon: Database },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${s.large ? "border-teal/20 bg-teal/[0.04] p-4" : "border-white/5 bg-white/[0.02]"}`}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.color}15` }}>
                      <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ghost">{s.name}</p>
                      <p className="text-xs text-ghost/40">{s.sub}</p>
                    </div>
                    {s.large && <span className="ml-auto text-xs font-fira text-teal/60 hidden sm:block">AI Engine</span>}
                  </div>
                ))}
                {/* Lambda glue */}
                <div className="text-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs font-fira">
                    <Zap className="h-3 w-3" /> AWS Lambda &mdash; 7 Functions (Glue Layer)
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center px-2">
                <div className="relative w-12 h-px bg-teal/20 overflow-hidden">
                  <div className="flow-dot absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-teal shadow-[0_0_8px_rgba(0,201,167,0.6)]" style={{ left: "-8px" }} />
                </div>
                <ArrowRight className="h-4 w-4 text-teal/40" />
              </div>

              {/* OUTPUT */}
              <div className="space-y-3">
                <p className="text-xs font-fira text-ghost/30 uppercase tracking-widest text-center">Output</p>
                {[
                  { label: "Structured Patient Data", color: "#00C9A7" },
                  { label: "Medication Alerts", color: "#A78BFA" },
                  { label: "Outbreak Detection", color: "#F59E0B" },
                  { label: "Discharge Summary", color: "#EF4444" },
                ].map((o, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />
                    <p className="text-sm text-ghost/70">{o.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SERVICES.map((s, i) => (
              <div key={i} className="service-card p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                    <s.icon className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <h3 className="font-bold text-ghost text-sm">{s.name}</h3>
                </div>
                <p className="text-ghost/50 text-sm mb-3">{s.role}</p>
                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-fira border border-white/10 text-ghost/40">{s.stat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2: 4-Layer Pipeline Accordion
         ═══════════════════════════════════════════════════════ */}
      <section id="pipeline" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="section-header text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">// data flow</p>
            <h2 className="text-4xl sm:text-5xl font-bold">The 4-Layer Pipeline</h2>
          </div>

          <div className="space-y-4">
            {LAYERS.map((layer, i) => {
              const isOpen = expandedLayer === i;
              return (
                <div key={i} className="pipeline-card rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all">
                  <button
                    onClick={() => setExpandedLayer(isOpen ? null : i)}
                    className="w-full flex items-center gap-4 md:gap-6 p-6 md:p-8 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-3xl md:text-4xl font-extrabold font-fira opacity-20 flex-shrink-0" style={{ color: layer.accent }}>
                      {layer.num}
                    </span>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${layer.accent}15` }}>
                      <layer.icon className="h-5 w-5" style={{ color: layer.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-ghost">{layer.title}</h3>
                      <p className="text-sm text-ghost/40">{layer.subtitle}</p>
                    </div>
                    <span className="text-xs font-fira px-3 py-1 rounded-full border border-white/10 text-ghost/30 hidden sm:block">{layer.time}</span>
                    <ChevronDown className={`h-5 w-5 text-ghost/30 transition-transform duration-300 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="px-6 md:px-8 pb-6 md:pb-8">
                      <div className="p-5 rounded-xl bg-void/80 border border-white/5 overflow-x-auto">
                        <pre className="text-sm font-fira text-ghost/60 leading-relaxed whitespace-pre">{layer.code}</pre>
                      </div>
                      <p className="mt-3 text-xs font-fira text-right" style={{ color: layer.accent }}>
                        Processing: {layer.time}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3: DynamoDB Schema
         ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="section-header text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">// database</p>
            <h2 className="text-4xl sm:text-5xl font-bold">Single-Table <span className="font-instrument italic text-ghost/50">Design</span></h2>
          </div>

          {/* Schema Table */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden mb-6">
            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_2fr] gap-4 p-4 border-b border-white/5 bg-white/[0.02]">
              <span className="text-xs font-fira text-teal uppercase tracking-wider">PK</span>
              <span className="text-xs font-fira text-teal uppercase tracking-wider">SK</span>
              <span className="text-xs font-fira text-teal uppercase tracking-wider">What it stores</span>
            </div>
            {SCHEMA_ROWS.map((row, i) => (
              <div key={i} className="schema-row grid grid-cols-[1fr_1fr_2fr] gap-4 p-4 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <span className="text-sm font-fira text-ghost/70 break-all">{row.pk}</span>
                <span className="text-sm font-fira text-ghost/70 break-all">{row.sk}</span>
                <span className="text-sm text-ghost/50">{row.desc}</span>
              </div>
            ))}
          </div>

          {/* GSI Callout */}
          <div className="p-6 rounded-xl border border-blue-500/20 bg-blue-500/[0.04]">
            <p className="text-sm font-bold text-blue-400 mb-2">GSI1 &mdash; Outbreak Query Index</p>
            <p className="font-fira text-sm text-ghost/50">
              <span className="text-blue-400">GSI1PK:</span> HOSPITAL#mumbai-gen &nbsp;
              <span className="text-blue-400">GSI1SK:</span> DX#{"<timestamp>"}
            </p>
            <p className="text-sm text-ghost/40 mt-2 italic">
              Enables: &ldquo;Give me all diagnoses at this hospital in the last 24 hours&rdquo; &mdash; the single query that powers outbreak detection.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4: Bedrock Prompts
         ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="section-header text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">// AI prompts</p>
            <h2 className="text-4xl sm:text-5xl font-bold">The AI <span className="font-instrument italic text-ghost/50">Brain</span></h2>
            <p className="text-ghost/40 mt-3">4 specialized prompts power 4 layers of intelligence</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PROMPTS.map((p, i) => (
              <div key={i} className="prompt-card p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.accent }} />
                  <h3 className="font-bold text-ghost">{p.title}</h3>
                </div>
                <pre className="text-xs font-fira text-ghost/50 leading-relaxed whitespace-pre-wrap bg-void/50 rounded-xl p-4 border border-white/5 max-h-64 overflow-y-auto">{p.preview}</pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5: Production Vision
         ═══════════════════════════════════════════════════════ */}
      <section id="production" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="section-header text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">// production vision</p>
            <h2 className="text-4xl sm:text-5xl font-bold">Where This <span className="font-instrument italic text-ghost/50">Goes</span></h2>
            <p className="font-instrument italic text-ghost/40 text-xl mt-3">The prototype uses 6 services. Production uses 25+.</p>
          </div>

          {/* Count-up */}
          <div className="count-up-trigger text-center mb-12">
            <div className="inline-flex items-center gap-4 p-6 rounded-2xl border border-teal/15 bg-teal/[0.03]">
              <span className="text-5xl md:text-6xl font-extrabold text-ghost/30">6</span>
              <ArrowRight className="h-8 w-8 text-teal/40" />
              <span className="text-5xl md:text-6xl font-extrabold text-teal">{serviceCount}</span>
              <span className="text-xl text-ghost/40 ml-2">AWS Services</span>
            </div>
          </div>

          {/* Live services */}
          <h3 className="text-sm font-fira text-teal uppercase tracking-widest mb-4">Currently Built</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-10">
            {SERVICES.map((s, i) => (
              <div key={i} className="prod-card text-center p-4 rounded-xl border border-teal/15 bg-teal/[0.03]">
                <s.icon className="h-5 w-5 mx-auto mb-2" style={{ color: s.color }} />
                <p className="text-xs font-semibold text-ghost/80">{s.name.replace("Amazon ", "").replace("AWS ", "")}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-fira bg-teal/20 text-teal border border-teal/30">LIVE</span>
              </div>
            ))}
          </div>

          {/* Planned services */}
          <h3 className="text-sm font-fira text-ghost/30 uppercase tracking-widest mb-4">Production Additions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {PRODUCTION_SERVICES.map((s, i) => (
              <div key={i} className="prod-card p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <p className="text-xs font-semibold text-ghost/70 mb-1">{s.name}</p>
                <p className="text-xs text-ghost/30 leading-relaxed">{s.desc}</p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-fira bg-ghost/5 text-ghost/30 border border-white/5">PLANNED</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 6: Scale & Cost
         ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="section-header text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">// economics</p>
            <h2 className="text-4xl sm:text-5xl font-bold">Scale &amp; <span className="font-instrument italic text-ghost/50">Cost</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Prototype Cost */}
            <div className="cost-card p-8 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-xs font-fira text-ghost/30 uppercase tracking-widest mb-4">Prototype Cost</p>
              <p className="text-5xl font-extrabold text-teal mb-1">$35-55</p>
              <p className="text-sm text-ghost/40 mb-4">total out of $100 AWS credit</p>
              <div className="text-left text-xs text-ghost/30 space-y-1 font-fira">
                <p>Bedrock &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ~$40</p>
                <p>Textract &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ~$5</p>
                <p>Everything else: free tier</p>
              </div>
            </div>

            {/* Production Cost */}
            <div className="cost-card p-8 rounded-2xl border border-teal/15 bg-teal/[0.03] text-center">
              <p className="text-xs font-fira text-ghost/30 uppercase tracking-widest mb-4">Production at Scale</p>
              <p className="text-5xl font-extrabold text-teal mb-1">$16</p>
              <p className="text-sm text-ghost/40 mb-2">/doctor/month at 1,000 doctors</p>
              <p className="text-xs text-ghost/30 font-fira">Drops to $9/doctor at 100,000 doctors</p>
            </div>

            {/* ROI */}
            <div className="cost-card p-8 rounded-2xl border border-white/5 bg-white/[0.02] text-center">
              <p className="text-xs font-fira text-ghost/30 uppercase tracking-widest mb-4">Return on Investment</p>
              <p className="text-5xl font-extrabold text-teal mb-1">308x</p>
              <p className="text-sm text-ghost/40 mb-4">ROI per doctor</p>
              <div className="text-left text-xs text-ghost/30 space-y-1 font-fira">
                <p>Cost: &nbsp;&nbsp;&nbsp;&nbsp;$600/year per doctor</p>
                <p>Savings: $185,000/year per doctor</p>
                <p className="text-ghost/20 pt-1">Time + errors + discharge + outbreaks</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 7: Compliance
         ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="section-header text-center mb-16">
            <p className="text-teal font-fira text-sm tracking-widest uppercase mb-4">// compliance</p>
            <h2 className="text-4xl sm:text-5xl font-bold">Security &amp; <span className="font-instrument italic text-ghost/50">Readiness</span></h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {COMPLIANCE.map((c, i) => (
              <div key={i} className="compliance-badge p-6 rounded-2xl border border-white/5 bg-white/[0.02] text-center hover:border-teal/15 hover:bg-teal/[0.02] transition-all">
                <c.icon className="h-8 w-8 text-teal/50 mx-auto mb-3" />
                <h3 className="font-bold text-ghost text-sm mb-1">{c.title}</h3>
                <p className="text-xs text-ghost/40 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <button onClick={() => navigate("/")} className="px-6 py-3 border border-ghost/10 text-ghost/60 font-medium rounded-xl hover:border-ghost/20 hover:text-ghost/80 transition-all text-sm">
              &larr; Back to Home
            </button>
            <button onClick={() => navigate("/app")} className="magnetic-btn group px-6 py-3 bg-teal text-void font-bold rounded-xl hover:bg-teal-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,201,167,0.3)] inline-flex items-center gap-2 text-sm">
              Launch MediScribe Demo
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Stethoscope className="h-5 w-5 text-teal/50" />
              <span className="text-sm text-ghost/30">Medi<span className="text-teal/50">Scribe</span></span>
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
        </div>
      </footer>
    </div>
  );
}
