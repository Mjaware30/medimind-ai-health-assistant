/**
 * MediMind — AI Health Assistant
 * SDG 3: Good Health and Well-Being
 * Capstone Project | Lenovo × BharatCares
 *
 * Tech Stack:
 *   - React (hooks)
 *   - Anthropic Claude Sonnet API (AI chat + insights)
 *   - lucide-react (icons)
 *
 * Features:
 *   1. Medication tracker with dose reminders
 *   2. Daily symptom logger
 *   3. AI health chat (Claude-powered with smart fallback)
 *   4. AI-generated weekly insights
 *   5. Dashboard with health metrics
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Pill, Activity, MessageSquare, BarChart2, Bell, Plus,
  Trash2, Send, Loader2, CheckCircle2, AlertCircle, Heart,
  Clock, X, Sparkles, Calendar, Shield,
} from "lucide-react";

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  teal:   { bg: "#0D9488", light: "#CCFBF1", text: "#0F766E" },
  purple: { bg: "#7C3AED", light: "#EDE9FE", text: "#4C1D95" },
  amber:  { bg: "#D97706", light: "#FEF3C7", text: "#78350F" },
  red:    { bg: "#DC2626", light: "#FEE2E2", text: "#7F1D1D" },
  green:  { bg: "#059669", light: "#D1FAE5", text: "#064E3B" },
  blue:   { bg: "#2563EB", light: "#DBEAFE", text: "#1E3A8A" },
};
const COLOR_LIST = [C.teal, C.purple, C.amber, C.red, C.green, C.blue];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().split("T")[0];
const nowTime = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

// ─── Default seed data ────────────────────────────────────────────────────────
const DEFAULT_MEDS = [
  { id: uid(), name: "Metformin",  dose: "500 mg",   times: ["08:00", "20:00"], taken: {}, color: C.teal   },
  { id: uid(), name: "Vitamin D3", dose: "1000 IU",  times: ["09:00"],          taken: {}, color: C.amber  },
  { id: uid(), name: "Omega-3",    dose: "1 capsule", times: ["13:00"],          taken: {}, color: C.purple },
];
const DEFAULT_SYMPTOMS = [
  { id: uid(), date: todayStr(), pain: 2, energy: 4, mood: 4, sleep: 7, notes: "Feeling okay today." },
];

// ─── Smart fallback responses when API key is unavailable ─────────────────────
function simulateResponse(lastMsg, isInsights, adherence) {
  if (isInsights) {
    return JSON.stringify({
      headline: `Your medication adherence is ${adherence}% this week — keep it up!`,
      adherence_pct: adherence,
      trend: adherence >= 80 ? "improving" : adherence >= 60 ? "stable" : "needs attention",
      tips: [
        "Set a phone alarm 5 minutes before each dose to build a consistent habit.",
        "Stay well-hydrated — aim for 8 glasses of water daily, especially with Metformin.",
        "A consistent 7–8 hour sleep schedule supports medication effectiveness and recovery.",
      ],
      alert:
        adherence < 60
          ? "Adherence below 60% — missing Metformin doses can affect blood sugar control. Please consult your doctor."
          : null,
    });
  }
  const q = lastMsg.toLowerCase();
  if (q.includes("metformin"))
    return "Metformin is a first-line medication for Type 2 diabetes. Common side effects include nausea and stomach upset — these usually improve after a few weeks. Take it with food to reduce discomfort. Always consult your doctor before making any changes. 🩺";
  if (q.includes("vitamin d"))
    return "Vitamin D3 supports bone health, immune function, and mood. Many Indians are deficient due to indoor lifestyles. Your 1000 IU dose is a good maintenance amount. 15–20 minutes of morning sunlight also helps. 🌞";
  if (q.includes("sleep"))
    return "Good sleep tips: consistent bedtime, no screens 1 hour before bed, cool dark room, limit caffeine after 2 PM. Adults need 7–9 hours. Poor sleep worsens chronic conditions like diabetes and hypertension. 😴";
  if (q.includes("omega"))
    return "Omega-3 fatty acids support heart health, reduce inflammation, and may improve mood. Take with a fat-containing meal for better absorption. Benefits show after 4–8 weeks of consistent use. 🐟";
  if (q.includes("heart rate") || q.includes("pulse"))
    return "A healthy resting heart rate is 60–100 bpm. Athletes may be lower (40–60 bpm). A consistently high resting HR (>100) warrants a doctor visit. Measure by counting your wrist pulse for 60 seconds. ❤️";
  if (q.includes("blood sugar") || q.includes("glucose"))
    return "Normal fasting glucose: 70–99 mg/dL. Pre-diabetes: 100–125 mg/dL. Diabetes: 126+ mg/dL on two tests. Medication adherence, balanced diet, and regular exercise all help manage blood sugar. 🩸";
  return "That's a great health question! For personalised advice please consult your doctor. General tips: balanced diet, stay hydrated, exercise regularly, take medications on schedule, and track unusual symptoms. What else can I help clarify? 😊";
}

// ─── Claude API call with automatic fallback ──────────────────────────────────
async function askClaude(messages, systemPrompt, adherence = 100) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.content?.find((b) => b.type === "text")?.text ?? "No response.";
  } catch {
    // Fallback: generate a smart offline response
    const last = messages[messages.length - 1]?.content ?? "";
    const isInsights = systemPrompt.includes("JSON");
    return simulateResponse(last, isInsights, adherence);
  }
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function MediMind() {
  const [tab, setTab]                     = useState("dashboard");
  const [meds, setMeds]                   = useState(DEFAULT_MEDS);
  const [symptoms, setSymptoms]           = useState(DEFAULT_SYMPTOMS);
  const [chatMsgs, setChatMsgs]           = useState([
    { role: "assistant", content: "Hello! I'm your MediMind AI health assistant 💊 I can help you understand your medications, symptoms, and general wellness. What's on your mind today?" },
  ]);
  const [chatInput, setChatInput]         = useState("");
  const [chatLoading, setChatLoading]     = useState(false);
  const [insights, setInsights]           = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [showAddMed, setShowAddMed]       = useState(false);
  const [showAddSymp, setShowAddSymp]     = useState(false);
  const [notification, setNotification]   = useState(null);
  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  // Dose-due checker (runs every 60 s)
  useEffect(() => {
    const check = () => {
      const now = nowTime();
      meds.forEach((m) => {
        m.times.forEach((t) => {
          if (t === now && !m.taken[`${todayStr()}-${t}`]) {
            setNotification(`⏰ Time to take ${m.name} (${m.dose})`);
            setTimeout(() => setNotification(null), 6000);
          }
        });
      });
    };
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [meds]);

  // Adherence calculator
  const adherencePct = useCallback(() => {
    let total = 0, done = 0;
    meds.forEach((m) =>
      m.times.forEach((t) => {
        total++;
        if (m.taken[`${todayStr()}-${t}`]) done++;
      })
    );
    return total === 0 ? 100 : Math.round((done / total) * 100);
  }, [meds]);

  const markTaken = (medId, time) =>
    setMeds((prev) =>
      prev.map((m) =>
        m.id === medId ? { ...m, taken: { ...m.taken, [`${todayStr()}-${time}`]: true } } : m
      )
    );

  const deleteMed = (id) => setMeds((prev) => prev.filter((m) => m.id !== id));

  // Send chat message
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user", content: chatInput.trim() };
    setChatMsgs((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    const system = `You are MediMind, a compassionate AI health assistant for an SDG 3 (Good Health & Well-Being) capstone project. The user's medications: ${meds.map((m) => `${m.name} ${m.dose}`).join(", ")}. Keep replies under 120 words, warm and empathetic. Always remind the user to consult a doctor for diagnosis or treatment changes.`;
    const history = [...chatMsgs, userMsg].slice(-10).map((m) => ({ role: m.role, content: m.content }));
    const reply = await askClaude(history, system, adherencePct());

    setChatMsgs((prev) => [...prev, { role: "assistant", content: reply }]);
    setChatLoading(false);
  }, [chatInput, chatLoading, chatMsgs, meds, adherencePct]);

  // Generate AI insights
  const generateInsights = async () => {
    setInsightsLoading(true);
    setInsights(null);
    const adh = adherencePct();
    const system =
      "You are a health data analyst AI. Respond ONLY with valid JSON. No markdown, no code fences, no extra text.";
    const prompt = `Medication list: ${JSON.stringify(meds.map((m) => ({ name: m.name, dose: m.dose })))}. Symptom logs: ${JSON.stringify(symptoms.slice(-5))}. Adherence: ${adh}%. Generate this JSON exactly: {"headline":"one sentence summary","adherence_pct":${adh},"trend":"improving|stable|needs attention","tips":["tip1","tip2","tip3"],"alert":"one sentence or null"}`;

    const raw = await askClaude([{ role: "user", content: prompt }], system, adh);
    try {
      setInsights(JSON.parse(raw.replace(/```json|```/g, "").trim()));
    } catch {
      try {
        setInsights(JSON.parse(simulateResponse(prompt, true, adh)));
      } catch {
        setInsights({ headline: "Could not load insights. Please try again.", adherence_pct: adh, trend: "stable", tips: [], alert: null });
      }
    }
    setInsightsLoading(false);
  };

  const adh = adherencePct();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "system-ui,sans-serif", minHeight: "100vh", background: "#F0FDF9", color: "#111827" }}>
      {/* Notification banner */}
      {notification && (
        <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 999,
          background: C.amber.bg, color: "#fff", padding: "10px 20px", borderRadius: 12, fontWeight: 500,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={16} /> {notification}
        </div>
      )}

      {/* Header */}
      <header style={{ background: "linear-gradient(135deg,#0D9488,#0F766E)", color: "#fff",
        padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderRadius: "0 0 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 8 }}>
            <Heart size={20} fill="#fff" color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>MediMind</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>SDG 3 · Good Health &amp; Well-Being</div>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.2)", padding: "6px 14px", borderRadius: 20,
          fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <Shield size={13} /> Adherence: {adh}%
        </div>
      </header>

      {/* Navigation tabs */}
      <nav style={{ background: "#fff", display: "flex", overflowX: "auto",
        borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 50 }}>
        {[
          { id: "dashboard",   label: "Dashboard",   Icon: BarChart2     },
          { id: "medications", label: "Medications",  Icon: Pill          },
          { id: "symptoms",    label: "Symptoms",     Icon: Activity      },
          { id: "chat",        label: "AI Chat",      Icon: MessageSquare },
          { id: "insights",    label: "Insights",     Icon: Sparkles      },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "13px 16px",
              border: "none", background: "none", cursor: "pointer", whiteSpace: "nowrap",
              fontSize: 13, fontWeight: tab === id ? 600 : 400,
              color: tab === id ? C.teal.bg : "#6B7280",
              borderBottom: `2px solid ${tab === id ? C.teal.bg : "transparent"}` }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
        {tab === "dashboard" && (
          <div>
            <STitle>Today's Overview</STitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
              <StatCard icon="💊" label="Medications"  value={meds.length}     sub="tracked"  color={C.teal}   />
              <StatCard icon="✅" label="Adherence"    value={`${adh}%`}       sub="today"    color={C.green}  />
              <StatCard icon="📈" label="Symptom Logs" value={symptoms.length} sub="entries"  color={C.purple} />
              {symptoms.length > 0 && (
                <StatCard icon="❤️" label="Last Mood" value={`${symptoms.at(-1).mood}/5`} sub="logged" color={C.red} />
              )}
            </div>

            <STitle>Today's Medication Schedule</STitle>
            {meds.map((m) => (
              <div key={m.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ background: m.color.light, color: m.color.text, padding: "3px 10px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                    {m.name}
                  </span>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>{m.dose}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {m.times.map((t) => {
                    const done = !!m.taken[`${todayStr()}-${t}`];
                    return (
                      <button key={t} onClick={() => !done && markTaken(m.id, t)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
                          borderRadius: 7, border: `1px solid ${done ? C.green.bg : "#D1D5DB"}`,
                          background: done ? C.green.light : "#F9FAFB",
                          color: done ? C.green.text : "#374151",
                          cursor: done ? "default" : "pointer", fontSize: 12, fontWeight: 500 }}>
                        {done ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {done ? `✓ ${t} taken` : `Mark ${t} taken`}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {symptoms.length > 0 && (
              <>
                <STitle style={{ marginTop: 20 }}>Last Symptom Snapshot</STitle>
                <SympCard s={symptoms.at(-1)} />
              </>
            )}
          </div>
        )}

        {/* ── MEDICATIONS ───────────────────────────────────────────────────── */}
        {tab === "medications" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <STitle style={{ margin: 0 }}>My Medications</STitle>
              <PrimaryBtn onClick={() => setShowAddMed(true)}><Plus size={14} /> Add Medication</PrimaryBtn>
            </div>

            {meds.map((m) => (
              <div key={m.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ background: m.color.bg, color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                        {m.name}
                      </span>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{m.dose}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} /> {m.times.join(" · ")}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {m.times.map((t) => {
                        const done = !!m.taken[`${todayStr()}-${t}`];
                        return (
                          <button key={t} onClick={() => !done && markTaken(m.id, t)}
                            style={{ padding: "4px 10px", borderRadius: 6,
                              border: `1px solid ${done ? C.green.bg : "#D1D5DB"}`,
                              background: done ? C.green.light : "#fff",
                              color: done ? C.green.text : "#374151",
                              cursor: done ? "default" : "pointer", fontSize: 12 }}>
                            {done ? `✓ Taken at ${t}` : `Mark ${t} taken`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button onClick={() => deleteMed(m.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {showAddMed && (
              <AddMedModal
                onClose={() => setShowAddMed(false)}
                onAdd={(med) => { setMeds((p) => [...p, med]); setShowAddMed(false); }}
              />
            )}
          </div>
        )}

        {/* ── SYMPTOMS ──────────────────────────────────────────────────────── */}
        {tab === "symptoms" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <STitle style={{ margin: 0 }}>Symptom Log</STitle>
              <PrimaryBtn onClick={() => setShowAddSymp(true)}><Plus size={14} /> Log Today</PrimaryBtn>
            </div>
            {symptoms.length === 0 && (
              <p style={{ color: "#6B7280", fontSize: 13 }}>No logs yet. Tap "Log Today" to add your first entry.</p>
            )}
            {[...symptoms].reverse().map((s) => <SympCard key={s.id} s={s} />)}
            {showAddSymp && (
              <AddSympModal
                onClose={() => setShowAddSymp(false)}
                onAdd={(s) => { setSymptoms((p) => [...p, s]); setShowAddSymp(false); }}
              />
            )}
          </div>
        )}

        {/* ── AI CHAT ───────────────────────────────────────────────────────── */}
        {tab === "chat" && (
          <div>
            <STitle>AI Health Chat</STitle>
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: -10, marginBottom: 14 }}>
              Powered by Claude · Not a substitute for professional medical advice
            </p>

            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16,
              display: "flex", flexDirection: "column", height: 480 }}>
              {/* Message list */}
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {chatMsgs.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    alignItems: "flex-start", gap: 8 }}>
                    {m.role === "assistant" && (
                      <div style={{ width: 28, height: 28, background: C.teal.bg, borderRadius: 8,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Heart size={14} color="#fff" fill="#fff" />
                      </div>
                    )}
                    <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.6,
                      background: m.role === "user" ? C.teal.bg : "#F3F4F6",
                      color: m.role === "user" ? "#fff" : "#111827",
                      borderBottomRightRadius: m.role === "user" ? 4 : 14,
                      borderBottomLeftRadius:  m.role === "assistant" ? 4 : 14 }}>
                      {m.content}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {chatLoading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, background: C.teal.bg, borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Heart size={14} color="#fff" fill="#fff" />
                    </div>
                    <div style={{ background: "#F3F4F6", padding: "10px 14px", borderRadius: 14,
                      borderBottomLeftRadius: 4, display: "flex", gap: 5, alignItems: "center" }}>
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: 12, color: "#6B7280" }}>Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Suggested prompts */}
              <div style={{ padding: "8px 12px", borderTop: "1px solid #F3F4F6", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Side effects of Metformin?", "Tips for better sleep?", "How does Vitamin D help?", "What is a healthy heart rate?"].map((q) => (
                  <button key={q} onClick={() => setChatInput(q)}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid #D1D5DB",
                      background: "#F9FAFB", cursor: "pointer", color: "#374151" }}>
                    {q}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: "10px 12px", borderTop: "1px solid #E5E7EB", display: "flex", gap: 8, alignItems: "center" }}>
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                  placeholder="Ask a health question…"
                  style={{ flex: 1, border: "1px solid #D1D5DB", borderRadius: 10, padding: "9px 12px",
                    fontSize: 13, outline: "none", background: "#FAFAFA", fontFamily: "inherit" }} />
                <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                  style={{ background: C.teal.bg, border: "none", borderRadius: 10, padding: "9px 13px",
                    cursor: chatLoading || !chatInput.trim() ? "not-allowed" : "pointer",
                    opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}>
                  <Send size={15} color="#fff" />
                </button>
              </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── INSIGHTS ──────────────────────────────────────────────────────── */}
        {tab === "insights" && (
          <div>
            <STitle>AI Health Insights</STitle>
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: -10, marginBottom: 18 }}>
              Claude analyses your medication adherence and symptom logs to generate personalised insights.
            </p>

            {!insights && !insightsLoading && (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 32, textAlign: "center" }}>
                <Sparkles size={40} color={C.teal.bg} style={{ margin: "0 auto 12px" }} />
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Generate Your Weekly Report</div>
                <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
                  Based on {symptoms.length} symptom logs and {meds.length} tracked medications.
                </p>
                <PrimaryBtn onClick={generateInsights}><Sparkles size={14} /> Generate Insights</PrimaryBtn>
              </div>
            )}

            {insightsLoading && (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 32, textAlign: "center" }}>
                <Loader2 size={32} color={C.teal.bg} style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
                <div style={{ fontSize: 13, color: "#6B7280" }}>Analysing your health data…</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {insights && !insightsLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Hero */}
                <div style={{ background: "linear-gradient(135deg,#0D9488,#7C3AED)", color: "#fff", borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Weekly Summary</div>
                  <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.4 }}>{insights.headline}</div>
                </div>

                {/* Adherence + Trend */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Medication Adherence</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: C.green.bg }}>{insights.adherence_pct}%</div>
                    <div style={{ background: "#E5E7EB", borderRadius: 4, height: 6, marginTop: 8 }}>
                      <div style={{ width: `${insights.adherence_pct}%`, height: 6, borderRadius: 4, background: C.green.bg }} />
                    </div>
                  </div>
                  <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>Health Trend</div>
                    <div style={{ fontSize: 20, fontWeight: 600, marginTop: 8,
                      color: insights.trend === "improving" ? C.green.bg : insights.trend === "needs attention" ? C.red.bg : C.amber.bg }}>
                      {insights.trend === "improving" ? "📈 Improving" : insights.trend === "needs attention" ? "⚠️ Needs attention" : "〰️ Stable"}
                    </div>
                  </div>
                </div>

                {/* Alert */}
                {insights.alert && (
                  <div style={{ background: C.amber.light, border: `1px solid ${C.amber.bg}`, borderRadius: 12,
                    padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <AlertCircle size={16} color={C.amber.bg} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: 13, color: C.amber.text }}>{insights.alert}</div>
                  </div>
                )}

                {/* Tips */}
                <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>Personalised Tips</div>
                  {insights.tips.map((tip, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                      <div style={{ background: C.teal.light, color: C.teal.text, width: 22, height: 22, borderRadius: 6,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{tip}</div>
                    </div>
                  ))}
                </div>

                <PrimaryBtn onClick={generateInsights}><Sparkles size={14} /> Regenerate</PrimaryBtn>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function STitle({ children, style }) {
  return (
    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "#111827", ...style }}>
      {children}
    </h2>
  );
}

function PrimaryBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
        background: "#0D9488", color: "#fff", border: "none", borderRadius: 10,
        fontWeight: 600, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14 }}>
      <div style={{ background: color.light, borderRadius: 8, width: 32, height: 32,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginBottom: 8 }}>
        {icon}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color.bg }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6B7280" }}>{label}</div>
      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function SympCard({ s }) {
  const bars = [
    { label: "Pain",      val: s.pain,   max: 5,  color: "#DC2626" },
    { label: "Energy",    val: s.energy, max: 5,  color: "#D97706" },
    { label: "Mood",      val: s.mood,   max: 5,  color: "#0D9488" },
    { label: "Sleep (h)", val: s.sleep,  max: 10, color: "#7C3AED" },
  ];
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
        <Calendar size={12} /> {s.date}
        {s.notes && <span style={{ marginLeft: 4, fontStyle: "italic" }}>"{s.notes}"</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {bars.map((b) => (
          <div key={b.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "#6B7280" }}>{b.label}</span>
              <span style={{ fontWeight: 700, color: b.color }}>{b.val}</span>
            </div>
            <div style={{ background: "#E5E7EB", borderRadius: 4, height: 6 }}>
              <div style={{ width: `${(b.val / b.max) * 100}%`, height: 6, borderRadius: 4, background: b.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420,
        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#6B7280" }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{children}</div>;
}

function FInput({ value, onChange, placeholder, type = "text" }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px",
        fontSize: 13, marginBottom: 12, boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
  );
}

function AddMedModal({ onClose, onAdd }) {
  const [name,     setName]     = useState("");
  const [dose,     setDose]     = useState("");
  const [time,     setTime]     = useState("08:00");
  const [colorIdx, setColorIdx] = useState(0);

  const submit = () => {
    if (!name.trim() || !dose.trim()) return;
    onAdd({ id: uid(), name: name.trim(), dose: dose.trim(), times: [time], taken: {}, color: COLOR_LIST[colorIdx] });
  };

  return (
    <Modal title="Add Medication" onClose={onClose}>
      <FLabel>Medication name</FLabel>
      <FInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paracetamol" />
      <FLabel>Dose</FLabel>
      <FInput value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 500 mg" />
      <FLabel>Time</FLabel>
      <FInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      <FLabel>Colour</FLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {COLOR_LIST.map((c, i) => (
          <div key={i} onClick={() => setColorIdx(i)}
            style={{ width: 24, height: 24, borderRadius: 6, background: c.bg, cursor: "pointer",
              outline: colorIdx === i ? "2px solid #111" : "none", outlineOffset: 2 }} />
        ))}
      </div>
      <PrimaryBtn onClick={submit} disabled={!name.trim() || !dose.trim()}>
        Save Medication
      </PrimaryBtn>
    </Modal>
  );
}

function AddSympModal({ onClose, onAdd }) {
  const [pain,   setPain]   = useState(2);
  const [energy, setEnergy] = useState(3);
  const [mood,   setMood]   = useState(3);
  const [sleep,  setSleep]  = useState(7);
  const [notes,  setNotes]  = useState("");

  const fields = [
    { label: "Pain level (1–5)",   val: pain,   set: setPain,   min: 1, max: 5  },
    { label: "Energy level (1–5)", val: energy, set: setEnergy, min: 1, max: 5  },
    { label: "Mood (1–5)",         val: mood,   set: setMood,   min: 1, max: 5  },
    { label: "Sleep hours",        val: sleep,  set: setSleep,  min: 0, max: 12 },
  ];

  const submit = () =>
    onAdd({ id: uid(), date: todayStr(), pain: +pain, energy: +energy, mood: +mood, sleep: +sleep, notes });

  return (
    <Modal title="Log Symptoms" onClose={onClose}>
      {fields.map((f) => (
        <div key={f.label} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <FLabel>{f.label}</FLabel>
            <span style={{ fontWeight: 700, color: "#0D9488", fontSize: 13 }}>{f.val}</span>
          </div>
          <input type="range" min={f.min} max={f.max} value={f.val}
            onChange={(e) => f.set(e.target.value)} style={{ width: "100%" }} />
        </div>
      ))}
      <FLabel>Notes (optional)</FLabel>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="How are you feeling today?"
        style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 8, padding: "8px 10px",
          fontSize: 13, minHeight: 70, resize: "vertical", fontFamily: "inherit",
          boxSizing: "border-box", marginBottom: 12, outline: "none" }} />
      <PrimaryBtn onClick={submit}>Save Log</PrimaryBtn>
    </Modal>
  );
}
