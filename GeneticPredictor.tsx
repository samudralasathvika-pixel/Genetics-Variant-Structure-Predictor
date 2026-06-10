import { useState, useRef, useEffect } from "react";

import heroMain from "@assets/gene_1776781555334.jpg";
import heroSmall1 from "@assets/gene1_1776781555332.jpg";
import heroSmall2 from "@assets/g_1776781555333.jpg";
import flip1Img from "@assets/gen_1776781555334.jpg";
import flip2Img from "@assets/Screenshot_(104)_1776781543420.png";
import flip3Img from "@assets/ROC_1776782066894.JPG";

interface PredictionResult {
  prediction: string;
  label: number;
  confidence: string;
  pathogenic_score: string;
  dpsic: string;
  explanation: string;
}

interface BatchRow {
  [key: string]: string;
}

interface BatchResult {
  prediction: string;
  label: number;
  confidence: string;
  pathogenic_score: string;
  dpsic: string;
}

interface FormValues {
  wt_psic: string;
  mt_psic: string;
  plddt: string;
  mean_plddt: string;
  hydrophobicity_change: string;
  volume: string;
}

interface User {
  username: string;
  password: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const STORAGE_KEY = "gvsp_users";
const SESSION_KEY = "gvsp_session";

const REQUIRED_BATCH_COLS = ["wt_psic", "mt_psic", "plddt", "mean_plddt", "hydrophobicity_change", "volume"];

// Map column name aliases (the model's native feature names) to our raw input names.
// Lookup is case-insensitive and ignores spaces, underscores, parens, dashes.
const COL_ALIASES: Record<string, string> = {
  wt_psic: "wt_psic",
  wtpsic: "wt_psic",
  mt_psic: "mt_psic",
  mtpsic: "mt_psic",
  plddt: "plddt",
  mean_plddt: "mean_plddt",
  meanplddt: "mean_plddt",
  plddt_mean: "mean_plddt",
  plddtmean: "mean_plddt",
  hydrophobicity_change: "hydrophobicity_change",
  hydrophobicitychange: "hydrophobicity_change",
  kdhydrophobicity_deltamn: "hydrophobicity_change",
  kdhydrophobicitydeltamn: "hydrophobicity_change",
  deltahydrophobicity: "hydrophobicity_change",
  volume: "volume",
  volume_a3_n: "volume",
  volumea3n: "volume",
  volume_n: "volume",
};

function normKey(k: string) {
  return k.toLowerCase().replace(/[\s_()\-/]+/g, "");
}

function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const canonical = COL_ALIASES[normKey(h)];
    if (canonical && !(canonical in map)) map[canonical] = h;
  }
  return map;
}

function getUsers(): User[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveUsers(users: User[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(users)); }
function getSession(): string | null { return localStorage.getItem(SESSION_KEY); }
function setSession(u: string) { localStorage.setItem(SESSION_KEY, u); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function csvEscape(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export default function GeneticPredictor() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  const [loggedInUser, setLoggedInUser] = useState<string | null>(getSession);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "", confirm: "" });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<FormValues>({
    wt_psic: "", mt_psic: "", plddt: "", mean_plddt: "", hydrophobicity_change: "", volume: "",
  });
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [predictError, setPredictError] = useState<string | null>(null);

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvAllRows, setCsvAllRows] = useState<BatchRow[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [resultsTableLimit, setResultsTableLimit] = useState(200);
  const [batchColsOk, setBatchColsOk] = useState(false);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({});
  const [missingCols, setMissingCols] = useState<string[]>([]);

  const homeRef = useRef<HTMLElement>(null);
  const authRef = useRef<HTMLElement>(null);
  const predictorRef = useRef<HTMLElement>(null);
  const uploadRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); }); },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0.05 }
    );
    const refs = [homeRef.current, authRef.current, predictorRef.current, uploadRef.current];
    refs.forEach((r) => r && observer.observe(r));
    return () => refs.forEach((r) => r && observer.unobserve(r));
  }, [loggedInUser]);

  const handleNav = (sec: string) => document.getElementById(sec)?.scrollIntoView({ behavior: "smooth" });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(null); setAuthSuccess(null);
    const users = getUsers();
    const user = users.find(u => u.username === authForm.username.trim());
    if (!user) { setAuthError("Username not found. Please register first."); return; }
    if (user.password !== authForm.password) { setAuthError("Incorrect password."); return; }
    setSession(user.username); setLoggedInUser(user.username);
    setAuthForm({ username: "", password: "", confirm: "" });
    setTimeout(() => handleNav("predictor"), 200);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(null); setAuthSuccess(null);
    const uname = authForm.username.trim();
    if (uname.length < 3) { setAuthError("Username must be at least 3 characters."); return; }
    if (authForm.password.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    if (authForm.password !== authForm.confirm) { setAuthError("Passwords do not match."); return; }
    const users = getUsers();
    if (users.find(u => u.username === uname)) { setAuthError("Username already taken."); return; }
    users.push({ username: uname, password: authForm.password });
    saveUsers(users); setAuthSuccess("Account created! You can now log in.");
    setAuthTab("login"); setAuthForm({ username: uname, password: "", confirm: "" });
  };

  const handleLogout = () => {
    clearSession(); setLoggedInUser(null); setResult(null); setPredictError(null);
  };

  const tryExample = () => {
    setForm({ wt_psic: "1.38", mt_psic: "0.61", plddt: "71.4", mean_plddt: "82.2", hydrophobicity_change: "-0.8", volume: "46" });
    setResult(null); setPredictError(null);
  };

  const clearForm = () => {
    setForm({ wt_psic: "", mt_psic: "", plddt: "", mean_plddt: "", hydrophobicity_change: "", volume: "" });
    setResult(null); setPredictError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setPredicting(true); setResult(null); setPredictError(null);
    try {
      const payload = {
        wt_psic: parseFloat(form.wt_psic), mt_psic: parseFloat(form.mt_psic),
        plddt: parseFloat(form.plddt), mean_plddt: parseFloat(form.mean_plddt),
        hydrophobicity_change: parseFloat(form.hydrophobicity_change), volume: parseFloat(form.volume),
      };
      const res = await fetch(`${BASE}/api/predict`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "Prediction failed");
      setResult(data as PredictionResult);
    } catch (err) {
      setPredictError(err instanceof Error ? err.message : "Unknown error");
    } finally { setPredicting(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setBatchResults(null); setBatchError(null);
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(",").map(h => h.trim());
    setCsvHeaders(headers);
    const rows: BatchRow[] = lines.slice(1).map(l => {
      const vals = l.split(",").map(v => v.trim());
      const obj: BatchRow = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      return obj;
    }).filter(r => Object.values(r).some(v => v !== ""));
    setCsvAllRows(rows);
    const map = buildHeaderMap(headers);
    const missing = REQUIRED_BATCH_COLS.filter(c => !(c in map));
    setHeaderMap(map);
    setMissingCols(missing);
    setBatchColsOk(missing.length === 0);
  };

  const handleBatchPredict = async () => {
    if (!csvAllRows.length || !batchColsOk) return;
    setBatchLoading(true); setBatchError(null); setBatchResults(null);
    setBatchProgress(0); setResultsTableLimit(200);
    try {
      const allRows = csvAllRows.map(r => ({
        wt_psic: parseFloat(r[headerMap.wt_psic]),
        mt_psic: parseFloat(r[headerMap.mt_psic]),
        plddt: parseFloat(r[headerMap.plddt]),
        mean_plddt: parseFloat(r[headerMap.mean_plddt]),
        hydrophobicity_change: parseFloat(r[headerMap.hydrophobicity_change]),
        volume: parseFloat(r[headerMap.volume]),
      }));
      const CHUNK = 1000;
      const collected: BatchResult[] = [];
      for (let i = 0; i < allRows.length; i += CHUNK) {
        const chunk = allRows.slice(i, i + CHUNK);
        const res = await fetch(`${BASE}/api/predict/batch`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk }),
        });
        const data = await res.json() as { results?: BatchResult[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Batch prediction failed");
        collected.push(...(data.results ?? []));
        setBatchProgress(collected.length);
        // Yield to UI between chunks so the page stays responsive.
        await new Promise(r => setTimeout(r, 0));
      }
      setBatchResults(collected);
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Batch prediction failed");
    } finally { setBatchLoading(false); }
  };

  const downloadCsv = () => {
    if (!batchResults || !csvHeaders.length) return;
    const outHeaders = [...csvHeaders, "label", "prediction", "confidence", "pathogenic_score", "dpsic"];
    const lines = [outHeaders.map(csvEscape).join(",")];
    csvAllRows.forEach((row, i) => {
      const r = batchResults[i];
      const vals = csvHeaders.map(h => csvEscape(row[h] ?? ""));
      if (r) {
        vals.push(csvEscape(String(r.label)), csvEscape(r.prediction), csvEscape(r.confidence), csvEscape(r.pathogenic_score), csvEscape(r.dpsic));
      } else {
        vals.push("", "", "", "", "");
      }
      lines.push(vals.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `predictions_${uploadedFileName ?? "results"}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const isPathogenic = result?.prediction?.toLowerCase() === "pathogenic";
  const confidenceNum = result ? parseFloat(result.confidence) : 0;

  const navItems = loggedInUser
    ? [
        { id: "home", icon: "🏠", label: "Home" },
        { id: "predictor", icon: "🔬", label: "Predictor" },
        { id: "upload", icon: "📂", label: "Upload Dataset" },
      ]
    : [
        { id: "home", icon: "🏠", label: "Home" },
        { id: "auth", icon: "🔐", label: "Login / Register" },
      ];

  const previewRows = csvAllRows.slice(0, 5);

  return (
    <div className="layout">
      <style>{`
        :root {
          --sidebar-w: 220px; --sidebar-collapsed: 64px; --transition: 0.25s ease;
          --accent-deep: #4a5568; --text: #000000; --muted: #111111;
          --danger: #e53e3e; --success: #38a169;
          --panel: rgba(255,255,255,0.85);
          --shadow: 0 8px 32px rgba(120,130,200,0.10); --radius: 20px;
          --grad: linear-gradient(135deg,#9ba7ec,#c98aa8,#f0b3c4);
        }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'Segoe UI',system-ui,sans-serif; background:linear-gradient(135deg,#f0eeff 0%,#fdf5ff 50%,#eef5ff 100%); min-height:100vh; color:var(--text); }

        .layout { position:relative; z-index:1; display:flex; min-height:100vh; }
        .sidebar {
          width:var(--sidebar-w); min-height:100vh; position:sticky; top:0; height:100vh;
          display:flex; flex-direction:column;
          background:rgba(255,255,255,0.72); backdrop-filter:blur(20px);
          border-right:1px solid rgba(220,210,240,0.7);
          transition:width var(--transition); overflow:hidden; flex-shrink:0; z-index:10;
        }
        .sidebar.collapsed { width:var(--sidebar-collapsed); }
        .sidebar-inner { padding:22px 16px; display:flex; flex-direction:column; height:100%; gap:8px; }
        .sidebar-toggle {
          align-self:flex-end; width:34px; height:34px; border:none; border-radius:10px;
          background:rgba(233,225,255,0.8); color:var(--accent-deep); cursor:pointer;
          display:flex; align-items:center; justify-content:center; font-size:1rem;
          transition:background 0.2s; flex-shrink:0;
        }
        .sidebar-toggle:hover { background:rgba(200,190,255,0.9); }
        .sidebar-brand { padding:10px 6px 18px; white-space:nowrap; overflow:hidden; flex-shrink:0; }
        .brand-dot { display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--grad); margin-right:10px; flex-shrink:0; }
        .brand-text { font-size:0.75rem; font-weight:800; color:var(--accent-deep); letter-spacing:0.04em; text-transform:uppercase; line-height:1.4; opacity:1; transition:opacity var(--transition); white-space:normal; }
        .sidebar.collapsed .brand-text { opacity:0; }
        .sidebar-nav { display:flex; flex-direction:column; gap:4px; }
        .nav-link {
          display:flex; align-items:center; gap:14px; padding:13px 12px; border-radius:16px;
          color:var(--text); text-decoration:none; font-weight:700; font-size:0.93rem;
          white-space:nowrap; overflow:hidden; cursor:pointer;
          transition:background 0.2s, color 0.2s, transform 0.15s;
          border:none; background:transparent; width:100%; text-align:left;
        }
        .nav-link:hover { background:rgba(233,225,255,0.7); transform:translateX(2px); }
        .nav-link.active { background:linear-gradient(135deg,rgba(233,225,255,0.95),rgba(255,223,232,0.85)); color:var(--accent-deep); box-shadow:0 8px 24px rgba(120,130,200,0.12); }
        .nav-icon { font-size:1.15rem; flex-shrink:0; width:22px; text-align:center; }
        .nav-label { transition:opacity var(--transition); }
        .sidebar.collapsed .nav-label { opacity:0; }
        .sidebar-user { margin-top:auto; padding:12px; border-radius:16px; background:linear-gradient(135deg,rgba(233,225,255,0.7),rgba(255,223,232,0.6)); border:1px solid rgba(255,255,255,0.9); white-space:nowrap; overflow:hidden; transition:opacity var(--transition); }
        .sidebar.collapsed .sidebar-user { opacity:0; pointer-events:none; }
        .sidebar-user-name { font-size:0.82rem; font-weight:800; color:var(--accent-deep); margin-bottom:6px; }
        .logout-btn { font-size:0.78rem; color:var(--muted); background:none; border:none; cursor:pointer; padding:0; text-decoration:underline; }
        .logout-btn:hover { color:var(--danger); }

        .main { flex:1; padding:36px 36px 60px; min-width:0; overflow:hidden; }
        .section { scroll-margin-top:24px; margin-bottom:60px; }

        .page-title-wrap { text-align:center; margin-bottom:32px; }
        .page-title-outer { display:inline-flex; flex-direction:column; align-items:center; gap:10px; }
        .page-title-eyebrow { display:flex; align-items:center; gap:10px; font-size:0.72rem; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:var(--muted); }
        .pt-line { display:inline-block; width:40px; height:1.5px; background:linear-gradient(90deg,transparent,#c4aee8); border-radius:2px; }
        .pt-line.r { background:linear-gradient(90deg,#c4aee8,transparent); }
        .page-title-row { display:inline-flex; align-items:center; gap:14px; flex-wrap:wrap; justify-content:center; }
        .page-title-emoji { font-size:clamp(1.7rem, 3.8vw, 2.9rem); line-height:1; filter:drop-shadow(0 2px 8px rgba(155,130,200,0.25)); }
        .page-title-main { position:relative; display:inline-block; font-size:clamp(1.5rem, 3.5vw, 2.6rem); font-weight:900; letter-spacing:0.07em; text-transform:uppercase; background:linear-gradient(120deg,#7b88d4 0%,#a678c0 40%,#d47ea0 70%,#9ecfbd 100%); -webkit-background-clip:text; background-clip:text; color:transparent; filter:drop-shadow(0 2px 12px rgba(155,130,200,0.22)); line-height:1.1; }
        .page-title-sub { font-size:0.82rem; font-weight:600; color:var(--muted); letter-spacing:0.04em; }
        .page-title-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 14px; border-radius:999px; background:linear-gradient(135deg,rgba(155,167,236,0.15),rgba(240,179,196,0.15)); border:1px solid rgba(155,167,236,0.28); font-size:0.72rem; font-weight:800; letter-spacing:0.08em; color:#8a7fc4; text-transform:uppercase; }
        .pt-dot { width:6px; height:6px; border-radius:50%; background:var(--grad); }

        .card { border-radius:var(--radius); background:var(--panel); border:1px solid rgba(255,255,255,0.9); backdrop-filter:blur(16px); box-shadow:var(--shadow); transition:transform 0.22s ease, box-shadow 0.22s ease; overflow:hidden; }
        .card:hover { transform:translateY(-2px); box-shadow:0 28px 64px rgba(120,130,200,0.17); }

        .hero-grid { display:grid; grid-template-columns:1.2fr 0.85fr; gap:22px; align-items:start; }
        .hero-copy { padding:36px; overflow:hidden; }
        .hero-visual { padding:22px; }
        .hero-imgs { display:flex; flex-direction:column; gap:12px; }
        .hero-img-main img { width:100%; border-radius:16px; object-fit:contain; background:#f8f5ff; display:block; }
        .hero-img-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .hero-img-row img { width:100%; border-radius:14px; object-fit:cover; background:#f8f5ff; display:block; height:180px; }

        .kicker { display:inline-flex; align-items:center; gap:8px; padding:7px 14px; border-radius:999px; background:rgba(233,225,255,0.8); color:var(--accent-deep); font-size:0.78rem; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; }
        .hero-copy h2 { margin:18px 0 18px; font-size:clamp(1.7rem,3vw,3rem); line-height:1.1; letter-spacing:-0.03em; font-weight:900; word-break:break-word; }
        .accent-text { background:linear-gradient(135deg,#7d89d2 0%,#c98aa8 50%,#79a8a0 100%); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .hero-copy p { color:#111111 !important; line-height:1.75; font-size:0.97rem; margin-bottom:14px; word-break:break-word; }
        .btn-row { display:flex; flex-wrap:wrap; gap:12px; margin-top:24px; }
        .btn { display:inline-flex; align-items:center; gap:8px; padding:13px 22px; border-radius:999px; font-size:0.95rem; font-weight:800; cursor:pointer; text-decoration:none; border:none; transition:transform 0.12s ease, box-shadow 0.2s ease; white-space:nowrap; }
        .btn:active { transform:scale(0.97); }
        .btn-primary { background:var(--grad); color:white; box-shadow:0 12px 30px rgba(155,167,236,0.3); }
        .btn-primary:hover { box-shadow:0 16px 40px rgba(155,167,236,0.4); }
        .btn-ghost { background:rgba(246,247,255,0.9); color:var(--text); border:1px solid rgba(122,132,203,0.15); }
        .btn-ghost:hover { background:rgba(233,225,255,0.8); }
        .btn-success { background:linear-gradient(135deg,#56c886,#38a169); color:white; box-shadow:0 8px 20px rgba(56,161,105,0.25); }
        .btn-success:hover { box-shadow:0 12px 28px rgba(56,161,105,0.35); }
        .btn[disabled] { opacity:0.55; cursor:not-allowed; }

        .section-header { margin-bottom:22px; }
        .section-header h3 { font-size:clamp(1.4rem,2.2vw,2rem); letter-spacing:-0.02em; font-weight:900; }
        .section-header p { color:var(--muted); margin-top:8px; line-height:1.7; }

        .overview-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; perspective:1400px; }
        .flip-card { position:relative; width:100%; background:transparent; border:none; padding:0; box-shadow:none; aspect-ratio:4/5; }
        .flip-inner { position:relative; width:100%; height:100%; transition:transform 0.7s cubic-bezier(0.4,0.2,0.2,1); transform-style:preserve-3d; }
        .flip-card:hover .flip-inner { transform:rotateY(180deg); }
        .flip-front, .flip-back { position:absolute; inset:0; width:100%; height:100%; -webkit-backface-visibility:hidden; backface-visibility:hidden; border-radius:24px; padding:26px; background:rgba(255,255,255,0.95); border:1px solid rgba(220,215,240,0.8); box-shadow:0 10px 30px rgba(122,132,203,0.10); display:flex; flex-direction:column; overflow:hidden; }
        .flip-back { transform:rotateY(180deg); align-items:center; justify-content:center; background:linear-gradient(180deg,#fdfeff,#f5f6ff); padding:18px; }
        .flip-back img { width:100%; height:100%; object-fit:contain; border-radius:14px; background:#f8f5ff; }
        .ov-icon { font-size:2rem; margin-bottom:14px; flex-shrink:0; }
        .flip-front h4 { font-size:1.05rem; font-weight:800; margin-bottom:10px; flex-shrink:0; }
        .flip-front p { color:var(--muted); font-size:0.88rem; line-height:1.7; overflow:hidden; display:-webkit-box; -webkit-line-clamp:9; -webkit-box-orient:vertical; }

        .auth-section-wrap { display:grid; grid-template-columns:1fr 1fr; gap:22px; align-items:start; }
        .auth-info-card { padding:36px; overflow:hidden; }
        .auth-info-card h3 { font-size:1.5rem; font-weight:900; margin-bottom:12px; }
        .auth-info-card p { color:var(--muted); line-height:1.8; margin-bottom:12px; font-size:0.96rem; }
        .auth-form-card { padding:32px; }
        .auth-tabs { display:flex; gap:0; margin-bottom:24px; border-radius:12px; overflow:hidden; border:1px solid rgba(220,215,240,0.8); }
        .auth-tab { flex:1; padding:11px; font-size:0.92rem; font-weight:700; cursor:pointer; border:none; background:rgba(246,247,255,0.8); color:var(--muted); transition:background 0.2s, color 0.2s; }
        .auth-tab.active { background:var(--grad); color:white; }
        .auth-form-inner { display:grid; gap:16px; }
        .auth-input-group { display:grid; gap:7px; }
        .auth-input-group label { font-size:0.87rem; font-weight:700; color:var(--text); }
        .auth-input-group input { width:100%; border:1.5px solid #d4d8f0; border-radius:14px; padding:12px 16px; font-size:0.95rem; color:var(--text); background:linear-gradient(180deg,#fdfeff,#f5f6ff); outline:none; transition:border-color 0.2s, box-shadow 0.2s; box-sizing:border-box; }
        .auth-input-group input:focus { border-color:#98a3e8; box-shadow:0 0 0 4px rgba(152,163,232,0.15); }
        .auth-error { font-size:0.85rem; color:var(--danger); background:rgba(255,220,230,0.5); padding:10px 14px; border-radius:10px; }
        .auth-success { font-size:0.85rem; color:var(--success); background:rgba(220,248,235,0.6); padding:10px 14px; border-radius:10px; }
        .auth-note { font-size:0.8rem; color:var(--muted); margin-top:6px; text-align:center; }

        .predict-grid { display:grid; grid-template-columns:1.1fr 0.95fr; gap:22px; align-items:start; }
        .predict-card { padding:32px; overflow:hidden; }
        .result-card { padding:28px; overflow:hidden; }
        form.predict-form { display:grid; gap:22px; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .input-group { display:grid; gap:8px; }
        .input-group label { font-size:0.88rem; font-weight:800; color:var(--text); }
        .input-hint { font-size:0.78rem; color:var(--muted); }
        input[type=number] { width:100%; border:1.5px solid #d4d8f0; border-radius:16px; padding:13px 16px; font-size:0.97rem; color:var(--text); background:linear-gradient(180deg,#fdfeff,#f5f6ff); outline:none; transition:border-color 0.2s, box-shadow 0.2s, transform 0.15s; box-sizing:border-box; }
        input[type=number]:focus { border-color:#98a3e8; box-shadow:0 0 0 4px rgba(152,163,232,0.15); transform:translateY(-1px); }

        .conf-label { display:flex; justify-content:space-between; font-size:0.88rem; color:var(--muted); margin-bottom:10px; }
        .conf-bar { width:100%; height:12px; border-radius:999px; background:rgba(230,230,245,0.9); overflow:hidden; }
        .conf-fill { height:100%; border-radius:inherit; background:linear-gradient(90deg,#95dbc2,#9ba7ec,#f0b3c4); transition:width 0.4s ease; }
        .result-box { animation:rise 0.35s ease; }
        @keyframes rise { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .result-pill { display:inline-flex; align-items:center; gap:10px; padding:10px 18px; border-radius:999px; font-weight:900; font-size:1rem; letter-spacing:0.04em; margin-bottom:16px; }
        .result-pill.pathogenic { background:rgba(255,220,230,0.9); color:var(--danger); }
        .result-pill.benign { background:rgba(220,248,235,0.9); color:var(--success); }
        .result-pill.predicting { background:rgba(233,225,255,0.8); color:var(--accent-deep); }
        .result-pill.error { background:rgba(255,220,230,0.9); color:var(--danger); }
        .result-metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:16px; }
        .metric { padding:14px 16px; border-radius:18px; background:rgba(255,255,255,0.95); border:1px solid rgba(215,220,245,0.8); overflow:hidden; }
        .metric span { display:block; font-size:0.78rem; color:var(--muted); margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .metric strong { font-size:1rem; }
        .note { font-size:0.85rem; color:var(--muted); line-height:1.7; margin-top:16px; }

        .upload-top-grid { display:grid; grid-template-columns:1.05fr 1fr; gap:22px; align-items:start; }
        .upload-card { padding:32px; overflow:hidden; }
        .upload-preview-card { padding:28px; overflow:hidden; }
        .upload-zone { min-height:170px; border-radius:22px; border:2px dashed rgba(122,132,203,0.3); background:linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,243,255,0.8)); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:14px; padding:24px; transition:border-color 0.2s, background 0.2s; }
        .upload-zone:hover { border-color:rgba(122,132,203,0.55); background:rgba(233,225,255,0.3); }
        .upload-zone-icon { font-size:2.2rem; }
        .upload-zone p { color:var(--muted); font-size:0.88rem; }
        .file-input { display:none; }
        .file-meta { font-size:0.83rem; color:var(--muted); margin-top:6px; word-break:break-all; }

        .table-wrap { overflow-x:auto; border-radius:14px; border:1px solid rgba(220,215,240,0.7); }
        table { width:100%; border-collapse:collapse; font-size:0.83rem; }
        th, td { padding:9px 12px; text-align:left; border-bottom:1px solid rgba(220,215,240,0.6); white-space:nowrap; }
        th { background:linear-gradient(135deg,rgba(233,225,255,0.9),rgba(255,230,240,0.8)); color:var(--accent-deep); font-weight:800; position:sticky; top:0; }
        tr:last-child td { border-bottom:none; }
        tr:hover td { background:rgba(248,245,255,0.7); }
        td.label-1 { color:var(--danger); font-weight:800; }
        td.label-0 { color:var(--success); font-weight:800; }

        .upload-empty { min-height:140px; border-radius:18px; border:1.5px dashed rgba(122,132,203,0.2); display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:0.9rem; text-align:center; padding:24px; }

        .batch-results-section { margin-top:22px; }
        .batch-bar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
        .batch-bar h4 { font-size:1.05rem; font-weight:900; }
        .batch-stats { display:flex; gap:10px; flex-wrap:wrap; }
        .batch-stat { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:999px; font-size:0.8rem; font-weight:700; }
        .batch-stat.path { background:rgba(255,220,230,0.9); color:var(--danger); }
        .batch-stat.ben { background:rgba(220,248,235,0.9); color:var(--success); }
        .batch-stat.total { background:rgba(233,225,255,0.8); color:var(--accent-deep); }
        .batch-warn { font-size:0.83rem; color:#b07a00; background:rgba(255,240,200,0.7); padding:10px 14px; border-radius:10px; }
        .batch-error { font-size:0.85rem; color:var(--danger); background:rgba(255,220,230,0.5); padding:10px 14px; border-radius:10px; margin-bottom:14px; }

        @media(max-width:1100px) {
          .hero-grid, .predict-grid, .upload-top-grid, .overview-grid, .auth-section-wrap { grid-template-columns:1fr; }
          .overview-grid { grid-template-columns:1fr 1fr; }
        }
        @media(max-width:720px) {
          .main { padding:20px 16px 40px; }
          .form-grid, .result-metrics { grid-template-columns:1fr; }
          .overview-grid { grid-template-columns:1fr; }
        }
      `}</style>

      <aside className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
        <div className="sidebar-inner">
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(c => !c)} title="Toggle sidebar">
            {sidebarCollapsed ? "☰" : "✕"}
          </button>
          <div className="sidebar-brand">
            <div style={{ display:"flex", alignItems:"flex-start" }}>
              <span className="brand-dot" style={{ marginTop:"3px" }} />
              <span className="brand-text">Genetic Variants Structure Predictor</span>
            </div>
          </div>
          <nav className="sidebar-nav">
            {navItems.map(({ id, icon, label }) => (
              <button key={id} className={`nav-link${activeSection === id ? " active" : ""}`} onClick={() => handleNav(id)}>
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>
          {loggedInUser && (
            <div className="sidebar-user">
              <div className="sidebar-user-name">Signed in as {loggedInUser}</div>
              <button className="logout-btn" onClick={handleLogout}>Sign out</button>
            </div>
          )}
        </div>
      </aside>

      <main className="main">

        <section className="section" id="home" ref={homeRef}>
          <div className="page-title-wrap">
            <div className="page-title-outer">
              <span className="page-title-eyebrow">
                <span className="pt-line" />
                Bioinformatics · Machine Learning · Clinical Genomics
                <span className="pt-line r" />
              </span>
              <span className="page-title-row">
                <span className="page-title-emoji" aria-hidden="true">🧬</span>
                <span className="page-title-main">Genetic Variants Structure Predictor</span>
              </span>
              <span className="page-title-sub">
                XGBoost · AlphaFold · ClinVar
              </span>
              <span className="page-title-badge">
                <span className="pt-dot" />
                Pathogenicity Classification Model
                <span className="pt-dot" />
              </span>
            </div>
          </div>

          <div className="hero-grid">
            <div className="card hero-copy">
              <h2>
                Predict whether a genetic mutation is{" "}
                <span className="accent-text">pathogenic or benign</span>.
              </h2>
              <p style={{ fontWeight:700, fontSize:"1.02rem", color:"var(--text)", marginBottom:"6px" }}>
                Understanding the Impact of Genetic Mutations
              </p>
              <p>
                Breaking down the language of the genome is one of the greatest challenges in modern medicine. A single-letter change in DNA — a <em>missense mutation</em> — can be the difference between a silent variation and the root cause of a genetic disorder.
              </p>
              <p>
                Our platform bridges the gap between raw genetic data and clinical insight, providing confidence predictions on whether a mutation is <em>Pathogenic</em> (harmful) or <em>Benign</em> (harmless).
              </p>
              <p style={{ fontWeight:700, fontSize:"1.02rem", color:"var(--text)", marginBottom:"6px", marginTop:"6px" }}>
                How this Prediction Model Works
              </p>
              <p>Our model evaluates each variant by synthesizing three core pillars of biological data:</p>
              <p><strong>Structural Context:</strong> We leverage <strong>AlphaFold</strong> structural predictions to determine if a mutation destabilizes the protein's 3D architecture.</p>
              <p><strong>Evolutionary Conservation:</strong> By analyzing how well a specific site has been preserved across species, we identify "mission-critical" regions of the protein sequence.</p>
              <p><strong>Physicochemical Shifts:</strong> We calculate the changes in charge, hydrophobicity, and molecular size resulting from the amino acid swap to predict functional disruption.</p>
              <p style={{ fontWeight:700, fontSize:"1.02rem", color:"var(--text)", marginBottom:"6px", marginTop:"6px" }}>
                Data-Driven Precision
              </p>
              <p>
                Our model is trained on standard datasets, including <em>ClinVar-annotated variants</em>. By combining historical clinical data with cutting-edge structural biology, we provide researchers and clinicians with a powerful tool for variant interpretation.
              </p>
              <p style={{ fontStyle:"italic", color:"var(--accent-deep)" }}>
                Ready to analyze a variant? Enter your mutation details below to generate a pathogenicity assessment.
              </p>
              <div className="btn-row">
                <button className="btn btn-primary" onClick={() => handleNav(loggedInUser ? "predictor" : "auth")}>
                  {loggedInUser ? "Open Predictor" : "Get Started"}
                </button>
                {loggedInUser && <button className="btn btn-ghost" onClick={() => handleNav("upload")}>Upload Dataset</button>}
              </div>
            </div>

            <div className="card hero-visual">
              <div className="hero-imgs">
                <div className="hero-img-main">
                  <img src={heroMain} alt="Genes and DNA diagram showing gene segments and allele inheritance" />
                </div>
                <div className="hero-img-row">
                  <img src={heroSmall1} alt="Genetic mutation diagram" />
                  <img src={heroSmall2} alt="Mutation pathway" />
                </div>
              </div>
            </div>
          </div>

          <div style={{ height:"32px" }} />

          <div className="section-header">
            <h3>Why It Matters</h3>
            <p>Accurate missense variant interpretation supports disease research, clinical decision-making, and protein function studies.</p>
          </div>

          <div className="overview-grid">
            {[
              {
                icon: "🧬", title: "Missense Mutations & Disease",
                front: "A single amino acid change can alter protein shape or function—impacting stability, interactions, or activity. These variants are often linked to genetic disorders and disease risk. This tool predicts whether a mutation is likely harmful or benign. Even subtle changes can disrupt folding or active sites. Early classification helps prioritize variants for further study.",
                backImg: flip1Img, backAlt: "Wild-type vs mutant protein",
              },
              {
                icon: "🔬", title: "Structural & Evolutionary Signals",
                front: "Predictions combine structural confidence, evolutionary importance, and biochemical change. Features include pLDDT scores, PSIC conservation, and shifts in hydrophobicity and residue size. Highly conserved regions are more sensitive to mutation. Structural confidence helps weigh prediction reliability.",
                backImg: flip2Img, backAlt: "AlphaFold protein structure confidence",
              },
              {
                icon: "📊", title: "ClinVar-Trained Model",
                front: "Trained on 75,000+ ClinVar variants using XGBoost, the model learns patterns of harmful vs neutral mutations. It delivers reliable predictions with strong ROC-AUC and balanced performance across cases. Built on real clinical annotations for practical relevance. Optimized to generalize across diverse mutation types.",
                backImg: flip3Img, backAlt: "ROC Curve — XGBoost AUC 0.936",
              },
            ].map(({ icon, title, front, backImg, backAlt }) => (
              <article className="flip-card" key={title}>
                <div className="flip-inner">
                  <div className="flip-front">
                    <div className="ov-icon">{icon}</div>
                    <h4>{title}</h4>
                    <p>{front}</p>
                  </div>
                  <div className="flip-back"><img src={backImg} alt={backAlt} /></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {!loggedInUser && (
          <section className="section" id="auth" ref={authRef}>
            <div className="section-header">
              <h3>Access the Predictor</h3>
              <p>Create an account or sign in to use the variant prediction tool.</p>
            </div>
            <div className="auth-section-wrap">
              <div className="card auth-info-card">
                <div className="kicker">Secure Access</div>
                <h3 style={{ marginTop:"14px" }}>Why sign in?</h3>
                <p style={{ marginTop:"12px" }}>
                  Creating a free account lets you access the full predictor, run pathogenicity predictions, and upload batch datasets for review.
                </p>
                <p>Your account is stored locally on this device. No data is sent to external servers — your session is private.</p>
                <p>Registration takes under a minute. Simply choose a username and password to get started.</p>
              </div>
              <div className="card auth-form-card">
                <div className="auth-tabs">
                  <button className={`auth-tab${authTab === "login" ? " active" : ""}`} onClick={() => { setAuthTab("login"); setAuthError(null); setAuthSuccess(null); }}>Sign In</button>
                  <button className={`auth-tab${authTab === "register" ? " active" : ""}`} onClick={() => { setAuthTab("register"); setAuthError(null); setAuthSuccess(null); }}>Register</button>
                </div>
                {authTab === "login" ? (
                  <form className="auth-form-inner" onSubmit={handleLogin}>
                    {authSuccess && <div className="auth-success">{authSuccess}</div>}
                    {authError && <div className="auth-error">{authError}</div>}
                    <div className="auth-input-group">
                      <label htmlFor="auth-username">Username</label>
                      <input id="auth-username" type="text" placeholder="Your username" required autoComplete="username"
                        value={authForm.username} onChange={e => setAuthForm(f => ({ ...f, username: e.target.value }))} />
                    </div>
                    <div className="auth-input-group">
                      <label htmlFor="auth-password">Password</label>
                      <input id="auth-password" type="password" placeholder="Your password" required autoComplete="current-password"
                        value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} />
                    </div>
                    <button className="btn btn-primary" type="submit" style={{ width:"100%", justifyContent:"center" }}>Sign In</button>
                    <p className="auth-note">Don't have an account? Switch to Register above.</p>
                  </form>
                ) : (
                  <form className="auth-form-inner" onSubmit={handleRegister}>
                    {authError && <div className="auth-error">{authError}</div>}
                    <div className="auth-input-group">
                      <label htmlFor="reg-username">Username</label>
                      <input id="reg-username" type="text" placeholder="Choose a username (min 3 chars)" required autoComplete="username"
                        value={authForm.username} onChange={e => setAuthForm(f => ({ ...f, username: e.target.value }))} />
                    </div>
                    <div className="auth-input-group">
                      <label htmlFor="reg-password">Password</label>
                      <input id="reg-password" type="password" placeholder="Choose a password (min 6 chars)" required autoComplete="new-password"
                        value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} />
                    </div>
                    <div className="auth-input-group">
                      <label htmlFor="reg-confirm">Confirm Password</label>
                      <input id="reg-confirm" type="password" placeholder="Repeat your password" required autoComplete="new-password"
                        value={authForm.confirm} onChange={e => setAuthForm(f => ({ ...f, confirm: e.target.value }))} />
                    </div>
                    <button className="btn btn-primary" type="submit" style={{ width:"100%", justifyContent:"center" }}>Create Account</button>
                    <p className="auth-note">Already have an account? Switch to Sign In above.</p>
                  </form>
                )}
              </div>
            </div>
          </section>
        )}

        {loggedInUser && (
          <section className="section" id="predictor" ref={predictorRef}>
            <div className="section-header">
              <h3>Variant Predictor</h3>
              <p>Input the mutation's structural and biochemical properties below.</p>
            </div>
            <div className="predict-grid">
              <div className="card predict-card">
                <div className="kicker">Single Variant Assessment</div>
                <h4 style={{ margin:"16px 0 6px", fontSize:"1.1rem" }}>Mutation Feature Input</h4>
                <p style={{ color:"var(--muted)", fontSize:"0.9rem", marginBottom:"22px", lineHeight:1.7 }}>
                  Enter the structural and physicochemical properties of the variant.
                </p>
                <form className="predict-form" onSubmit={handleSubmit}>
                  <div className="form-grid">
                    {[
                      { id:"wt_psic", label:"WT PSIC", placeholder:"e.g. 1.42", hint:"Wildtype position-specific conservation score" },
                      { id:"mt_psic", label:"MT PSIC", placeholder:"e.g. 0.64", hint:"Mutant residue conservation score" },
                      { id:"plddt", label:"pLDDT", placeholder:"e.g. 78.5", hint:"AlphaFold confidence at mutation site (0–100)" },
                      { id:"mean_plddt", label:"Mean pLDDT", placeholder:"e.g. 82.1", hint:"Average AlphaFold confidence across protein" },
                      { id:"hydrophobicity_change", label:"Hydrophobicity Change (ΔKD)", placeholder:"e.g. -0.7", hint:"Kyte-Doolittle hydrophobicity difference (wt − mt)" },
                      { id:"volume", label:"Volume (ų)", placeholder:"e.g. 41", hint:"Van der Waals volume of mutant amino acid" },
                    ].map(({ id, label, placeholder, hint }) => (
                      <div className="input-group" key={id}>
                        <label htmlFor={id}>{label}</label>
                        <input id={id} name={id} type="number" step="any" placeholder={placeholder} required
                          value={form[id as keyof FormValues]}
                          onChange={(e) => setForm(f => ({ ...f, [id]: e.target.value }))} />
                        <span className="input-hint">{hint}</span>
                      </div>
                    ))}
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-primary" type="submit" disabled={predicting}>
                      {predicting ? "Predicting…" : "Predict Variant"}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={tryExample}>Try Example</button>
                    <button className="btn btn-ghost" type="button" onClick={clearForm}>Clear</button>
                  </div>
                </form>
              </div>

              <div className="card result-card">
                <div className="kicker">Prediction Output</div>
                <h4 style={{ margin:"16px 0 20px", fontSize:"1.1rem" }}>Pathogenicity Assessment</h4>
                {!result && !predicting && !predictError && (
                  <p style={{ color:"var(--muted)", fontSize:"0.95rem" }}>Enter the variant features and click <strong>Predict Variant</strong> to see the result.</p>
                )}
                {predicting && <div className="result-box"><div className="result-pill predicting">Predicting…</div></div>}
                {predictError && !predicting && <div className="result-box"><div className="result-pill error">⚠️ {predictError}</div></div>}
                {result && !predicting && (
                  <div className="result-box">
                    <div className={`result-pill ${isPathogenic ? "pathogenic" : "benign"}`}>
                      {isPathogenic ? "🔴" : "🟢"} {result.prediction}
                    </div>
                    <div className="conf-label"><span>Confidence</span><span>{result.confidence}</span></div>
                    <div className="conf-bar"><div className="conf-fill" style={{ width:`${confidenceNum}%` }} /></div>
                    <div className="result-metrics">
                      <div className="metric"><span>Label</span><strong>{result.label === 1 ? "1 (Pathogenic)" : "0 (Benign)"}</strong></div>
                      <div className="metric"><span>Pathogenic Score</span><strong>{result.pathogenic_score}</strong></div>
                      <div className="metric"><span>dPSIC</span><strong>{result.dpsic}</strong></div>
                    </div>
                    <p className="note">{result.explanation}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {loggedInUser && (
          <section className="section" id="upload" ref={uploadRef}>
            <div className="section-header">
              <h3>Upload Dataset</h3>
              <p>Upload a CSV with variant features to run batch predictions. Requires columns: <code>wt_psic, mt_psic, plddt, mean_plddt, hydrophobicity_change, volume</code>.</p>
            </div>

            <div className="upload-top-grid">
              <div className="card upload-card">
                <div className="kicker">Batch Dataset Input</div>
                <h4 style={{ margin:"16px 0 10px", fontSize:"1.1rem" }}>CSV Workspace</h4>
                <p style={{ color:"var(--muted)", fontSize:"0.9rem", lineHeight:1.75, marginBottom:"20px" }}>
                  Upload a mutation dataset for batch pathogenicity prediction. Columns must include the six feature fields used by the model.
                </p>
                <div className="upload-zone">
                  <div className="upload-zone-icon">📁</div>
                  <p>Drag & drop your CSV file here, or click to browse</p>
                  <label className="btn btn-primary" htmlFor="dataset-file" style={{ cursor:"pointer" }}>
                    Choose CSV File
                  </label>
                  <input className="file-input" id="dataset-file" type="file" accept=".csv,text/csv"
                    onChange={handleFileChange} />
                  <div className="file-meta">{uploadedFileName ? `${uploadedFileName} — ${csvAllRows.length} row${csvAllRows.length !== 1 ? "s" : ""}` : "No file selected"}</div>
                </div>

                {csvAllRows.length > 0 && (
                  <div className="btn-row" style={{ marginTop:"20px" }}>
                    {batchColsOk ? (
                      <button className="btn btn-primary" onClick={handleBatchPredict} disabled={batchLoading}>
                        {batchLoading ? `Predicting ${csvAllRows.length} rows…` : `Run Batch Prediction (${csvAllRows.length} rows)`}
                      </button>
                    ) : (
                      <div className="batch-warn">
                        ⚠️ CSV is missing required feature{missingCols.length > 1 ? "s" : ""}: <strong>{missingCols.join(", ")}</strong>.
                        <br />Accepted column names include the model's native names (e.g. <code>plddt_mean</code>, <code>kdHydrophobicity_DELTAmn</code>, <code>Volume_(A3)_n</code>) or simpler aliases (<code>mean_plddt</code>, <code>hydrophobicity_change</code>, <code>volume</code>).
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="card upload-preview-card">
                <div className="kicker">Dataset Preview</div>
                <h4 style={{ margin:"16px 0 16px", fontSize:"1.1rem" }}>First 5 Rows</h4>
                {csvHeaders.length === 0 ? (
                  <div className="upload-empty">Upload a CSV file to preview its contents here.</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {csvHeaders.map(h => <th key={h}>{h}</th>)}
                          {batchResults && <th style={{ background:"linear-gradient(135deg,rgba(255,220,230,0.9),rgba(220,248,235,0.8))" }}>label</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {csvHeaders.map(h => <td key={h}>{row[h] ?? ""}</td>)}
                            {batchResults && (
                              <td className={batchResults[i]?.label === 1 ? "label-1" : "label-0"}>
                                {batchResults[i]?.label ?? "—"}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {(batchLoading || batchError || batchResults) && (
              <div className="batch-results-section">
                <div className="card" style={{ padding:"28px", marginTop:"4px" }}>
                  {batchLoading && (
                    <div>
                      <div style={{ color:"var(--muted)", fontSize:"0.95rem", marginBottom:"10px" }}>
                        Running model on {csvAllRows.length.toLocaleString()} variants — {batchProgress.toLocaleString()} done
                        ({csvAllRows.length ? Math.round((batchProgress / csvAllRows.length) * 100) : 0}%)
                      </div>
                      <div className="conf-bar"><div className="conf-fill" style={{ width: `${csvAllRows.length ? (batchProgress / csvAllRows.length) * 100 : 0}%` }} /></div>
                    </div>
                  )}
                  {batchError && <div className="batch-error">⚠️ {batchError}</div>}

                  {batchResults && !batchLoading && (() => {
                    const pathCount = batchResults.filter(r => r.label === 1).length;
                    const benCount = batchResults.filter(r => r.label === 0).length;
                    return (
                      <>
                        <div className="batch-bar">
                          <h4>Batch Prediction Results</h4>
                          <div className="batch-stats">
                            <span className="batch-stat total">Total: {batchResults.length}</span>
                            <span className="batch-stat path">Pathogenic: {pathCount}</span>
                            <span className="batch-stat ben">Benign: {benCount}</span>
                          </div>
                        </div>

                        <div className="btn-row" style={{ marginBottom:"18px" }}>
                          <button className="btn btn-success" onClick={downloadCsv}>
                            ⬇ Download Results CSV
                          </button>
                        </div>

                        <div className="table-wrap" style={{ maxHeight:"360px", overflowY:"auto" }}>
                          <table>
                            <thead>
                              <tr>
                                <th>#</th>
                                {csvHeaders.map(h => <th key={h}>{h}</th>)}
                                <th style={{ background:"linear-gradient(135deg,rgba(255,220,230,0.9),rgba(220,248,235,0.8))" }}>label</th>
                                <th>prediction</th>
                                <th>confidence</th>
                                <th>pathogenic_score</th>
                                <th>dpsic</th>
                              </tr>
                            </thead>
                            <tbody>
                              {csvAllRows.slice(0, resultsTableLimit).map((row, i) => {
                                const r = batchResults[i];
                                return (
                                  <tr key={i}>
                                    <td style={{ color:"var(--muted)", fontSize:"0.75rem" }}>{i + 1}</td>
                                    {csvHeaders.map(h => <td key={h}>{row[h] ?? ""}</td>)}
                                    <td className={r?.label === 1 ? "label-1" : "label-0"}>
                                      {r?.label ?? "—"}
                                    </td>
                                    <td style={{ fontWeight:700, color: r?.label === 1 ? "var(--danger)" : "var(--success)" }}>
                                      {r?.prediction ?? "—"}
                                    </td>
                                    <td>{r?.confidence ?? "—"}</td>
                                    <td>{r?.pathogenic_score ?? "—"}</td>
                                    <td>{r?.dpsic ?? "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {csvAllRows.length > resultsTableLimit && (
                          <div style={{ marginTop:"14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"10px" }}>
                            <span style={{ fontSize:"0.85rem", color:"var(--muted)" }}>
                              Showing {resultsTableLimit.toLocaleString()} of {csvAllRows.length.toLocaleString()} rows. Download the full CSV to see them all.
                            </span>
                            <button className="btn btn-ghost" onClick={() => setResultsTableLimit(l => l + 500)}>
                              Show 500 more
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
