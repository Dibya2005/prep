import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore";

/* ============================
   Firebase (your keys)
   ============================ */
const firebaseConfig = {
  apiKey: "AIzaSyCQJ3dX_ZcxVKzlCD8H19JM3KYh7qf8wYk",
  authDomain: "form-ca7cc.firebaseapp.com",
  projectId: "form-ca7cc",
  storageBucket: "form-ca7cc.appspot.com",
  messagingSenderId: "1054208318782",
  appId: "1:1054208318782:web:f64f43412902af5aa06f",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

/* ============================
   Simple UI styles (no Tailwind)
   ============================ */
const wrap = { maxWidth: 980, margin: "0 auto", padding: 14, fontFamily: "Inter, system-ui, sans-serif", color: "#111827" };
const btn = { padding: "10px 12px", borderRadius: 10, background: "#0f172a", color: "#fff", border: 0, cursor: "pointer" };
const btnGhost = { padding: "10px 12px", borderRadius: 10, background: "#fff", color: "#0f172a", border: "1px solid #e5e7eb", cursor: "pointer" };
const card = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, boxSizing: "border-box" };
const input = { width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", boxSizing: "border-box" };
const label = { fontSize: 12, color: "#64748b" };

/* ============================
   Progress bar
   ============================ */
function Progress({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div style={{ width: "100%", height: 8, background: "#e5e7eb", borderRadius: 999 }}>
      <div style={{ width: `${v}%`, height: 8, background: "#0f172a", borderRadius: 999 }} />
    </div>
  );
}

/* ============================
   Shell with header/nav
   ============================ */
function Shell({ title, desc, canonical, children, right }) {
  return (
    <>
      <Helmet>
        {title && <title>{title} · prepji</title>}
        {desc && <meta name="description" content={desc} />}
        {canonical && <link rel="canonical" href={canonical} />}
      </Helmet>

      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ ...wrap, paddingTop: 10, paddingBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <Link to="/" style={{ color: "#0f172a", textDecoration: "none", fontWeight: 700, fontSize: 18 }}>prepji</Link>
          <nav style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link to="/quizzes" style={btnGhost}>Quizzes</Link>
            <Link to="/dashboard" style={btnGhost}>Dashboard</Link>
            <Link to="/admin" style={btnGhost}>Admin</Link>
            <AuthButtons />
          </nav>
        </div>
      </header>

      <main style={{ ...wrap, display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>{children}</div>
        {right && <aside style={{ width: 300, flexShrink: 0 }}>{right}</aside>}
      </main>

      <footer style={{ ...wrap, textAlign: "center", paddingTop: 18, paddingBottom: 18, color: "#64748b", fontSize: 14 }}>
        © {new Date().getFullYear()} prepji
      </footer>
    </>
  );
}

/* ============================
   Auth + Session store
   ============================ */
function useAuth() {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) { setUserDoc(null); return; }
      const uref = doc(db, "users", u.uid);
      const snap = await getDoc(uref);
      if (!snap.exists()) {
        const data = {
          uid: u.uid,
          name: u.displayName || "",
          email: u.email || "",
          role: "student", // make "admin" in Firestore to unlock Admin UI
          createdAt: serverTimestamp(),
          photoURL: u.photoURL || "",
        };
        await setDoc(uref, data);
        setUserDoc(data);
      } else {
        setUserDoc(snap.data());
      }
    });
    return () => unsub();
  }, []);
  return { user, userDoc };
}

let _session = { user: null, userDoc: null };
const listeners = new Set();
function useSession() {
  const [state, setState] = useState(_session);
  useEffect(() => { listeners.add(setState); return () => listeners.delete(setState); }, []);
  return state;
}
function SessionProvider({ children }) {
  const value = useAuth();
  useEffect(() => { _session = value; listeners.forEach((l) => l(_session)); }, [value.user, value.userDoc]);
  return children;
}

function AuthButtons() {
  const navigate = useNavigate();
  const { user } = useSession();
  if (!user)
    return (
      <button
        style={btn}
        onClick={async () => {
          await signInWithPopup(auth, provider);
          navigate("/");
        }}
      >
        Login
      </button>
    );
  return (
    <button
      style={btnGhost}
      onClick={async () => {
        await signOut(auth);
        navigate("/");
      }}
    >
      Logout
    </button>
  );
}

/* ============================
   Quiz Engine (new)
   ============================ */
const QuizEngine = {
  normalize(quiz) {
    const qs = (quiz?.questions || []).map((q) => ({
      q: String(q.q || ""),
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : ["", "", "", ""],
      ans: Number(q.ans ?? 0),
      marks: Number(q.marks ?? 1) || 1,
    }));
    const settings = {
      perQuestionSec: Number(quiz?.settings?.perQuestionSec ?? 60) || 60,
      negativeMark: Number(quiz?.settings?.negativeMark ?? 0) || 0,
      shuffle: !!quiz?.settings?.shuffle,
      showInstant: !!quiz?.settings?.showInstant,
    };
    return { ...quiz, questions: qs, settings };
  },
  order(q, seed = Date.now()) {
    let arr = [...Array(q.questions.length).keys()];
    if (q.settings.shuffle) {
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;
      const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    return arr;
  },
  score(quiz, answers) {
    let totalMarks = 0, score = 0, corr = 0, wr = 0, sk = 0;
    quiz.questions.forEach((q, i) => {
      totalMarks += q.marks;
      const a = answers[i];
      if (a == null) { sk++; return; }
      if (a === q.ans) { score += q.marks; corr++; }
      else { score -= quiz.settings.negativeMark; wr++; }
    });
    if (score < 0) score = 0;
    return { score, totalMarks, corr, wr, sk };
  },
  key(id) { return `quiz_session_${id}`; },
};

/* ============================
   JSON Import helper
   ============================ */
function importQuestionsFromJSON(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("Invalid JSON"); }
  if (!Array.isArray(data)) throw new Error("JSON must be an array of questions");
  const out = data.map((q, i) => {
    const item = {
      q: String(q.q ?? q.question ?? "").trim(),
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : [q.a, q.b, q.c, q.d].filter(Boolean),
      ans: q.ans != null ? Number(q.ans) : Number(q.answer),
      marks: q.marks != null ? Number(q.marks) : 1,
    };
    if (!item.q) throw new Error(`Item ${i + 1}: missing question text`);
    if (!item.options || item.options.length !== 4) throw new Error(`Item ${i + 1}: need exactly 4 options`);
    if (Number.isNaN(item.ans)) throw new Error(`Item ${i + 1}: missing ans`);
    if (item.ans >= 1 && item.ans <= 4) item.ans = item.ans - 1; // support 1–4
    if (item.ans < 0 || item.ans > 3) throw new Error(`Item ${i + 1}: ans must be 0-3 or 1-4`);
    if (!item.marks || Number.isNaN(item.marks)) item.marks = 1;
    return item;
  });
  return out;
}

/* ============================
   Quizzes (list)
   ============================ */
function Quizzes() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const qy = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  return (
    <Shell title="Quizzes" desc="Quick quizzes with instant feedback." canonical="/quizzes" right={<CreateQuizCard />}>
      <div style={{ display: "grid", gap: 12 }}>
        {list.map((q) => (
          <Link key={q.id} to={`/quiz/${q.id}`} style={{ ...card, textDecoration: "none", color: "#111827" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 600 }}>{q.title}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {(q.total || q.questions?.length || 0)} Q •{" "}
                {q.settings?.perQuestionSec
                  ? `${Math.round((q.settings.perQuestionSec * (q.questions?.length || 0)) / 60)} min`
                  : "—"}
              </div>
            </div>
            {q.description && <div style={{ marginTop: 4, color: "#334155" }}>{q.description}</div>}
          </Link>
        ))}
        {list.length === 0 && <div style={card}>No quizzes yet.</div>}
      </div>
    </Shell>
  );
}

/* ============================
   Create Quiz (Admin)
   ============================ */
function CreateQuizCard() {
  const { userDoc } = useSession();
  const isAdmin = userDoc?.role === "admin";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    settings: { perQuestionSec: 60, negativeMark: 0, shuffle: true, showInstant: false },
    questions: [],
  });

  const addQ = () =>
    setForm((s) => ({
      ...s,
      questions: [...s.questions, { q: "", options: ["", "", "", ""], ans: 0, marks: 1 }],
    }));

  const importPrompt = () => {
    const raw = window.prompt("Paste JSON array of questions");
    if (!raw) return;
    try {
      const qs = importQuestionsFromJSON(raw);
      setForm((s) => ({ ...s, questions: [...s.questions, ...qs] }));
      alert(`Imported ${qs.length} question(s)`);
    } catch (e) {
      alert(e.message || String(e));
    }
  };

  const save = async () => {
    if (!isAdmin) return alert("Admins only");
    if (!form.title.trim()) return alert("Title is required");
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      settings: {
        perQuestionSec: Number(form.settings.perQuestionSec) || 60,
        negativeMark: Number(form.settings.negativeMark) || 0,
        shuffle: !!form.settings.shuffle,
        showInstant: !!form.settings.showInstant,
      },
      questions: form.questions,
      total: form.questions.length,
      createdAt: serverTimestamp(),
    };
    await addDoc(collection(db, "quizzes"), payload);
    setForm({ title: "", description: "", settings: { perQuestionSec: 60, negativeMark: 0, shuffle: true, showInstant: false }, questions: [] });
    setOpen(false);
    alert("Quiz created");
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 600 }}>Create Quiz</div>
        <button style={btnGhost} onClick={() => setOpen(!open)}>{open ? "Close" : "Open"}</button>
      </div>
      {!isAdmin && <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>Login as admin to create quizzes.</div>}
      {open && (
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <input style={input} placeholder="Title" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
          <textarea style={{ ...input, minHeight: 80 }} placeholder="Description" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />

          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={label}>Sec/Q</span>
              <input type="number" style={input} value={form.settings.perQuestionSec} onChange={(e) => setForm((s) => ({ ...s, settings: { ...s.settings, perQuestionSec: e.target.value } }))} />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={label}>Negative</span>
              <input type="number" style={input} value={form.settings.negativeMark} onChange={(e) => setForm((s) => ({ ...s, settings: { ...s.settings, negativeMark: e.target.value } }))} />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={form.settings.shuffle} onChange={(e) => setForm((s) => ({ ...s, settings: { ...s.settings, shuffle: e.target.checked } }))} />
              <span>Shuffle</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={form.settings.showInstant} onChange={(e) => setForm((s) => ({ ...s, settings: { ...s.settings, showInstant: e.target.checked } }))} />
              <span>Instant feedback</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btnGhost} onClick={addQ}>+ Add Question</button>
            <button style={btnGhost} onClick={importPrompt}>Import JSON</button>
            <label style={btnGhost}>
              Upload JSON
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    const text = await f.text();
                    const qs = importQuestionsFromJSON(text);
                    setForm((s) => ({ ...s, questions: [...s.questions, ...qs] }));
                    alert(`Imported ${qs.length} question(s)`);
                  } catch (err) {
                    alert(err.message || String(err));
                  }
                }}
              />
            </label>
            <button
              style={btnGhost}
              onClick={() => {
                const sample = [{ q: "What is 2+2?", options: ["2", "3", "4", "5"], ans: 2, marks: 1 }];
                const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "quiz_sample.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download JSON sample
            </button>
          </div>

          {(form.questions || []).map((q, i) => (
            <div key={i} style={{ ...card, borderColor: "#f1f5f9", padding: 12 }}>
              <input style={input} placeholder={`Q${i + 1}`} value={q.q} onChange={(e) => {
                const c = JSON.parse(JSON.stringify(form));
                c.questions[i].q = e.target.value;
                setForm(c);
              }} />
              {q.options.map((op, oi) => (
                <input key={oi} style={{ ...input, marginTop: 8 }} placeholder={`Option ${oi + 1}`} value={op} onChange={(e) => {
                  const c = JSON.parse(JSON.stringify(form));
                  c.questions[i].options[oi] = e.target.value;
                  setForm(c);
                }} />
              ))}
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginTop: 8 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={label}>Correct</span>
                  <select style={input} value={q.ans} onChange={(e) => {
                    const c = JSON.parse(JSON.stringify(form));
                    c.questions[i].ans = Number(e.target.value);
                    setForm(c);
                  }}>
                    {[0,1,2,3].map((x)=> <option key={x} value={x}>Option {x+1}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={label}>Marks</span>
                  <input type="number" style={input} value={q.marks} onChange={(e) => {
                    const c = JSON.parse(JSON.stringify(form));
                    c.questions[i].marks = Number(e.target.value) || 1;
                    setForm(c);
                  }} />
                </label>
                <button style={btnGhost} onClick={() => {
                  const c = JSON.parse(JSON.stringify(form));
                  c.questions.splice(i, 1);
                  setForm(c);
                }}>Remove</button>
              </div>
            </div>
          ))}

          <button style={btn} onClick={save}>Save Quiz</button>
        </div>
      )}
    </div>
  );
}

/* ============================
   Take Quiz
   ============================ */
function TakeQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [instant, setInstant] = useState(null); // { ok, correctIndex }

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "quizzes", id));
      if (!snap.exists()) { setQuiz({ missing: true }); return; }
      const raw = { id: snap.id, ...snap.data() };
      const q = QuizEngine.normalize(raw);

      // resume
      const saved = localStorage.getItem(QuizEngine.key(id));
      if (saved) {
        try {
          const s = JSON.parse(saved);
          if (s.id === id && Array.isArray(s.answers)) {
            setQuiz(q);
            setOrder(s.order);
            setIdx(s.idx || 0);
            setAnswers(s.answers);
            setSecondsLeft(s.secondsLeft || q.settings.perQuestionSec * q.questions.length);
            return;
          }
        } catch {}
      }

      const ord = QuizEngine.order(q);
      setQuiz(q);
      setOrder(ord);
      setIdx(0);
      setAnswers(Array(q.questions.length).fill(null));
      setSecondsLeft(q.settings.perQuestionSec * q.questions.length);
    })();
  }, [id]);

  // autosave
  useEffect(() => {
    if (!quiz) return;
    const iv = setInterval(() => {
      localStorage.setItem(QuizEngine.key(id), JSON.stringify({ id, order, idx, answers, secondsLeft }));
    }, 1200);
    return () => clearInterval(iv);
  }, [id, quiz, order, idx, answers, secondsLeft]);

  // timer
  useEffect(() => {
    if (secondsLeft == null) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          onSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [secondsLeft]); // eslint-disable-line

  if (!quiz) return <Shell title="Quiz"><div style={card}>Loading…</div></Shell>;
  if (quiz.missing) return <Shell title="Quiz"><div style={card}>Not found.</div></Shell>;

  const currentIndex = order[idx] ?? 0;
  const q = quiz.questions[currentIndex];
  const chosen = answers[currentIndex];
  const totalSec = quiz.settings.perQuestionSec * quiz.questions.length;
  const elapsedPct = ((totalSec - (secondsLeft || 0)) / totalSec) * 100;

  const select = (oi) => {
    const next = [...answers];
    next[currentIndex] = oi;
    setAnswers(next);
    if (quiz.settings.showInstant) setInstant({ ok: oi === q.ans, correctIndex: q.ans });
  };

  const nextQ = () => { setInstant(null); setIdx((i) => Math.min(i + 1, order.length - 1)); };
  const prevQ = () => { setInstant(null); setIdx((i) => Math.max(i - 1, 0)); };

  const onSubmit = async (auto = false) => {
    const res = QuizEngine.score(quiz, answers);
    await addDoc(collection(db, "quiz_attempts"), {
      quizId: quiz.id,
      score: res.score,
      totalMarks: res.totalMarks,
      corr: res.corr,
      wr: res.wr,
      sk: res.sk,
      settings: quiz.settings,
      createdAt: serverTimestamp(),
      auto,
    });
    localStorage.removeItem(QuizEngine.key(id));
    navigate(`/quiz/${quiz.id}/result`, { state: { ...res, quiz } });
  };

  const mm = String(Math.floor((secondsLeft || 0) / 60)).padStart(2, "0");
  const ss = String((secondsLeft || 0) % 60).padStart(2, "0");

  return (
    <Shell
      title={quiz.title}
      desc={quiz.description}
      canonical={`/quiz/${quiz.id}`}
      right={
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Time</div>
          <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 24 }}>
            {mm}:{ss}
          </div>
          <div style={{ marginTop: 8 }}><Progress value={elapsedPct} /></div>
          <button style={{ ...btn, width: "100%", marginTop: 10 }} onClick={() => onSubmit(false)}>
            Submit
          </button>
        </div>
      }
    >
      <div style={{ ...card, marginBottom: 10 }}>
        <span style={label}>Question</span>{" "}
        <strong>{idx + 1} / {order.length}</strong>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600 }}>Q{idx + 1}. {q.q}</div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {q.options.map((op, oi) => {
            const active = chosen === oi;
            const showInstant = instant && (active || oi === instant.correctIndex);
            const ok = instant?.ok && oi === instant.correctIndex;
            const wrong = instant && active && !instant.ok;
            return (
              <button
                key={oi}
                onClick={() => select(oi)}
                style={{
                  ...btnGhost,
                  textAlign: "left",
                  background: active ? "#ecfeff" : "#fff",
                  borderColor: showInstant ? (ok ? "#16a34a" : wrong ? "#ef4444" : "#e5e7eb") : "#e5e7eb",
                  boxShadow: showInstant ? (ok ? "inset 0 0 0 1px #16a34a" : wrong ? "inset 0 0 0 1px #ef4444" : "none") : "none",
                }}
              >
                <strong style={{ marginRight: 6 }}>{String.fromCharCode(65 + oi)}.</strong>
                {op}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={btnGhost} onClick={prevQ} disabled={idx === 0}>Prev</button>
          <button style={btnGhost} onClick={nextQ} disabled={idx === order.length - 1}>Next</button>
        </div>
      </div>
    </Shell>
  );
}

/* ============================
   Result
   ============================ */
function QuizResult() {
  const { id } = useParams();
  const location = useLocation(); // useLocation to avoid restricted 'history'
  const state = (location && location.state) || {};

  const [last, setLast] = useState(null);

  useEffect(() => {
    const qy = query(collection(db, "quiz_attempts"), where("quizId", "==", id), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(qy, (snap) => {
      const r = snap.docs[0]?.data();
      if (r) setLast(r);
    });
    return unsub;
  }, [id]);

  const score = state?.score ?? last?.score ?? 0;
  const totalMarks = state?.totalMarks ?? last?.totalMarks ?? 0;
  const corr = state?.corr ?? last?.corr ?? 0;
  const wr = state?.wr ?? last?.wr ?? 0;
  const sk = state?.sk ?? last?.sk ?? 0;
  const pct = totalMarks ? Math.round((score / totalMarks) * 100) : 0;

  return (
    <Shell title="Result" desc="Quiz result">
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Your Score</div>
        <div style={{ fontSize: 36, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginTop: 4 }}>
          {score} / {totalMarks}
        </div>
        <div style={{ marginTop: 8 }}><Progress value={pct} /></div>
        <div style={{ color: "#64748b", marginTop: 4 }}>{pct}%</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8, fontSize: 14 }}>
          <span>✅ Correct: {corr}</span>
          <span>❌ Wrong: {wr}</span>
          <span>⏭ Skipped: {sk}</span>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <Link to={`/quiz/${id}`} style={btnGhost}>Retake</Link>
          <Link to="/quizzes" style={btn}>Browse Quizzes</Link>
        </div>
      </div>
    </Shell>
  );
}

/* ============================
   Dashboard (quiz attempts)
   ============================ */
function Dashboard() {
  const { user } = useSession();
  const [attempts, setAttempts] = useState([]);
  useEffect(() => {
    if (!user) return;
    const qy = query(collection(db, "quiz_attempts"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(qy, (snap) => setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user]);

  if (!user) return <Navigate to="/" replace />;

  return (
    <Shell title="Dashboard" desc="Your quiz activity" canonical="/dashboard">
      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Recent Attempts</div>
        {attempts.length === 0 && <div style={{ color: "#64748b", fontSize: 14 }}>No attempts yet.</div>}
        <div style={{ display: "grid", gap: 6 }}>
          {attempts.map((a) => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed #e5e7eb", paddingTop: 6 }}>
              <div>Quiz: {a.quizId}</div>
              <div>{a.score} / {a.totalMarks ?? a.total ?? "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* ============================
   Home
   ============================ */
function Home() {
  return (
    <Shell
      title="Prepji Quizzes"
      desc="Practice quick quizzes with timer, instant feedback, and analytics."
      canonical="/"
    >
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Welcome to Prepji Quizzes</div>
        <p style={{ marginTop: 6 }}>
          Create and take quick, mobile-friendly quizzes. Shuffle, per-question time, negative marking,
          instant feedback, autosave, and clean results.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <Link to="/quizzes" style={btn}>Browse Quizzes</Link>
          <Link to="/admin" style={btnGhost}>Admin</Link>
        </div>
      </div>
    </Shell>
  );
}

/* ============================
   App
   ============================ */
export default function App() {
  return (
    <HelmetProvider>
      <SessionProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quizzes" element={<Quizzes />} />
            <Route path="/quiz/:id" element={<TakeQuiz />} />
            <Route path="/quiz/:id/result" element={<QuizResult />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<CreateQuizPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SessionProvider>
    </HelmetProvider>
  );
}

/* Optional: a dedicated Admin page route that just renders CreateQuizCard */
function CreateQuizPage() {
  const { userDoc } = useSession();
  if (userDoc?.role !== "admin") {
    return (
      <Shell title="Admin">
        <div style={card}>Admins only. Update your role to "admin" in Firestore `users`.</div>
      </Shell>
    );
  }
  return (
    <Shell title="Admin" desc="Create quizzes">
      <CreateQuizCard />
    </Shell>
  );
}
