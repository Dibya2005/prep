import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";

// ============================
// Firebase — swap with your own config
// ============================
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
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ============================
// Minimal chart (no extra deps)
// ============================
function Progress({ value }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div
      className="h-2 w-full bg-slate-200 rounded-xl overflow-hidden"
      aria-label="progress"
    >
      <div className="h-2 bg-slate-900" style={{ width: `${v}%` }} />
    </div>
  );
}

// ============================
// Utility styles (Tailwind)
// ============================
const Shell = ({ title, desc, canonical, children, right }) => (
  <>
    <Helmet>
      {title && <title>{title} · prepji</title>}
      {desc && <meta name="description" content={desc} />}
      {canonical && <link rel="canonical" href={canonical} />}
      <meta property="og:site_name" content="prepji" />
      {title && <meta property="og:title" content={`${title} · prepji`} />}
      {desc && <meta property="og:description" content={desc} />}
    </Helmet>
    <div className="max-w-5xl mx-auto px-4 py-4">
      <div className="flex items-center gap-3 py-3 border-b border-slate-200 sticky top-0 bg-white z-40">
        <Link to="/" className="font-semibold text-xl text-slate-900">
          prepji
        </Link>
        <nav className="ml-auto hidden md:flex gap-2">
          <Link className="btn-ghost" to="/adda">
            Adda
          </Link>
          <Link className="btn-ghost" to="/quizzes">
            Quizzes
          </Link>
          <Link className="btn-ghost" to="/jobs">
            Jobs
          </Link>
          <Link className="btn-ghost" to="/notes">
            Notes
          </Link>
          <Link className="btn-ghost" to="/dashboard">
            Dashboard
          </Link>
          <AuthButtons />
        </nav>
      </div>

      {/* mobile quick nav */}
      <div className="flex md:hidden gap-2 py-2 overflow-x-auto no-scrollbar">
        <Link className="chip" to="/adda">
          Adda
        </Link>
        <Link className="chip" to="/quizzes">
          Quizzes
        </Link>
        <Link className="chip" to="/jobs">
          Jobs
        </Link>
        <Link className="chip" to="/notes">
          Notes
        </Link>
        <Link className="chip" to="/dashboard">
          Dashboard
        </Link>
        <AuthButtons compact />
      </div>

      <div className="py-4 flex items-start gap-4 flex-wrap md:flex-nowrap">
        <div className="grow min-w-0">{children}</div>
        {right && <aside className="w-full md:w-72 shrink-0 space-y-4">{right}</aside>}
      </div>

      <footer className="py-8 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} prepji
      </footer>
    </div>
  </>
);

// global UI atoms (TW utilities)
const styles = `
.btn { @apply px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90 transition; }
.btn-ghost { @apply px-3 py-2 rounded-xl border border-slate-200 text-slate-900 hover:bg-slate-50; }
.btn-danger { @apply px-3 py-2 rounded-xl bg-rose-600 text-white hover:opacity-90; }
.card { @apply bg-white border border-slate-200 rounded-2xl p-4; }
.chip { @apply px-3 py-1 rounded-full border border-slate-200 text-slate-700 bg-white; }
.input { @apply w-full px-3 py-2 rounded-xl border border-slate-200; }
.label { @apply text-xs text-slate-500; }
.badge { @apply inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700; }
.no-scrollbar { scrollbar-width: none; } .no-scrollbar::-webkit-scrollbar { display:none; }
`;

// ============================
// Quiz Engine — fresh logic (shuffle, per-question time, negative marking, autosave)
// ============================
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
      // deterministic-ish shuffle from seed
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
    let totalMarks = 0,
      score = 0,
      corr = 0,
      wr = 0,
      sk = 0;
    quiz.questions.forEach((q, i) => {
      totalMarks += q.marks;
      const a = answers[i];
      if (a == null) {
        sk++;
        return;
      }
      if (a === q.ans) {
        score += q.marks;
        corr++;
      } else {
        score -= quiz.settings.negativeMark;
        wr++;
      }
    });
    if (score < 0) score = 0;
    return { score, totalMarks, corr, wr, sk };
  },
  key(id) {
    return `quiz_session_${id}`;
  },
};

// ============================
//
// ============================
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
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// ============================
// Auth context (minimal hook)
// ============================
function useAuth() {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setUserDoc(null);
        return;
      }
      const uref = doc(db, "users", u.uid);
      const snap = await getDoc(uref);
      if (!snap.exists()) {
        const data = {
          uid: u.uid,
          name: u.displayName || "",
          email: u.email || "",
          role: "student", // upgrade manually in Firestore if needed
          createdAt: serverTimestamp(),
          photoURL: u.photoURL || "",
        };
        await setDoc(uref, data);
        setUserDoc(data);
      } else setUserDoc(snap.data());
    });
    return () => unsub();
  }, []);
  return { user, userDoc };
}

function AuthButtons({ compact = false }) {
  const navigate = useNavigate();
  const { user } = useSession();
  if (!user)
    return (
      <button
        className={compact ? "chip" : "btn"}
        onClick={async () => {
          await signInWithPopup(auth, provider);
          navigate("/");
        }}
      >
        {compact ? "Login" : "Login with Google"}
      </button>
    );
  return (
    <button
      className={compact ? "chip" : "btn-ghost"}
      onClick={async () => {
        await signOut(auth);
        navigate("/");
      }}
    >
      Logout
    </button>
  );
}

// simple context via module-level var
let _session = { user: null, userDoc: null };
const listeners = new Set();
function useSession() {
  const [state, setState] = useState(_session);
  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);
  return state;
}
function SessionProvider({ children }) {
  const value = useAuth();
  useEffect(() => {
    _session = value;
    listeners.forEach((l) => l(_session));
  }, [value.user, value.userDoc]);
  return children;
}

// ============================
// ADDa — Community feed
// ============================
function Adda() {
  const { user } = useSession();
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [tag, setTag] = useState("");
  const [feed, setFeed] = useState([]);
  const [qText, setQText] = useState("");

  useEffect(() => {
    const qy = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) =>
      setFeed(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  const onFile = async (file) => {
    if (!file) return;
    const path = `posts/${Date.now()}_${file.name}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    setImage({ url, name: file.name });
  };

  const post = async () => {
    if (!user) {
      alert("Login first");
      return;
    }
    const payload = {
      text: text.trim(),
      imageUrl: image?.url || "",
      tag: tag.trim().toLowerCase(),
      likes: 0,
      author: {
        uid: user.uid,
        name: user.displayName || user.email,
        photoURL: user.photoURL || "",
      },
      createdAt: serverTimestamp(),
      commentCount: 0,
    };
    await addDoc(collection(db, "posts"), payload);
    setText("");
    setImage(null);
    setTag("");
  };

  const filtered = useMemo(
    () =>
      feed.filter(
        (p) =>
          !qText ||
          p.text?.toLowerCase().includes(qText.toLowerCase()) ||
          p.tag?.includes(qText.toLowerCase())
      ),
    [feed, qText]
  );

  return (
    <Shell
      title="Adda — Discuss & Doubts"
      desc="Post doubts, tips, and exam updates. Like, comment, and collaborate in real-time."
      canonical="/adda"
      right={<TrendingSidebar />}
    >
      <div className="card space-y-3">
        <div className="text-lg font-semibold">Start a discussion</div>
        <textarea
          className="input min-h-[84px]"
          placeholder="Share a doubt, strategy, or update…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2 flex-wrap">
          <input
            className="input"
            placeholder="#tag (optional)"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
          {image && <span className="badge">{image.name}</span>}
          <button className="btn ml-auto" onClick={post}>
            Post
          </button>
        </div>
      </div>

      <div className="mt-4 card">
        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="Search posts or #tags"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((p) => (
          <Post key={p.id} p={p} />
        ))}
        {filtered.length === 0 && <div className="text-slate-500">No posts yet.</div>}
      </div>
    </Shell>
  );
}

function Post({ p }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);

  const like = async () => {
    await updateDoc(doc(db, "posts", p.id), { likes: (p.likes || 0) + 1 });
  };

  useEffect(() => {
    if (!open) return;
    const qy = query(
      collection(db, "posts", p.id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(qy, (snap) =>
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [open, p.id]);

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        {p.author?.photoURL ? (
          <img src={p.author.photoURL} alt="avatar" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-200" />
        )}
        <div className="font-medium">{p.author?.name || "User"}</div>
        <div className="ml-auto flex items-center gap-2">
          {p.tag && <span className="badge">#{p.tag}</span>}
        </div>
      </div>
      <div className="mt-3 whitespace-pre-wrap">{p.text}</div>
      {p.imageUrl && (
        <a href={p.imageUrl} target="_blank" rel="noreferrer">
          <img
            src={p.imageUrl}
            alt="post"
            className="mt-3 rounded-xl border border-slate-200"
          />
        </a>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button className="btn-ghost" onClick={like}>
          👍 {p.likes || 0}
        </button>
        <button className="btn-ghost" onClick={() => setOpen(!open)}>
          💬 {p.commentCount || comments.length}
        </button>
      </div>

      {open && (
        <Comments
          postId={p.id}
          onCount={(c) => updateDoc(doc(db, "posts", p.id), { commentCount: c })}
        />
      )}
    </div>
  );
}

function Comments({ postId, onCount }) {
  const { user } = useSession();
  const [text, setText] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const qy = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(qy, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows(list);
      onCount?.(list.length);
    });
    return unsub;
  }, [postId, onCount]);

  const add = async () => {
    if (!user || !text.trim()) return;
    await addDoc(collection(db, "posts", postId, "comments"), {
      text: text.trim(),
      author: {
        uid: user.uid,
        name: user.displayName || user.email,
        photoURL: user.photoURL || "",
      },
      createdAt: serverTimestamp(),
    });
    setText("");
  };

  return (
    <div className="mt-3 border-t border-slate-200 pt-3 space-y-3">
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="Write a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn" onClick={add}>
          Send
        </button>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3">
          {r.author?.photoURL ? (
            <img src={r.author.photoURL} alt="avatar" className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-slate-200" />
          )}
          <div>
            <div className="text-sm font-medium">{r.author?.name || "User"}</div>
            <div className="text-sm whitespace-pre-wrap">{r.text}</div>
          </div>
        </div>
      ))}
      {rows.length === 0 && <div className="text-sm text-slate-500">Be the first to comment.</div>}
    </div>
  );
}

function TrendingSidebar() {
  const [tags, setTags] = useState([]);
  useEffect(() => {
    const qy = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(200));
    const unsub = onSnapshot(qy, (snap) => {
      const counts = {};
      snap.docs.forEach((d) => {
        const t = (d.data().tag || "").trim();
        if (!t) return;
        counts[t] = (counts[t] || 0) + 1;
      });
      const list = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
      setTags(list);
    });
    return unsub;
  }, []);
  return (
    <div className="card">
      <div className="font-semibold mb-2">Trending</div>
      <div className="flex flex-wrap gap-2">
        {tags.map(([t, c]) => (
          <span key={t} className="chip">
            #{t} <span className="text-slate-400">({c})</span>
          </span>
        ))}
        {tags.length === 0 && <div className="text-sm text-slate-500">No trends yet.</div>}
      </div>
    </div>
  );
}

// ============================
// Quizzes (lightweight, adda-style) + JSON import
// ============================
function Quizzes() {
  const { user } = useSession();
  const [list, setList] = useState([]);
  useEffect(() => {
    const qy = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  return (
    <Shell
      title="Quizzes"
      desc="Quick 10-question quizzes with instant results."
      canonical="/quizzes"
      right={<CreateQuizCard />}
    >
      <div className="space-y-3">
        {list.map((q) => (
          <Link key={q.id} to={`/quiz/${q.id}`} className="card block hover:bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="font-semibold">{q.title}</div>
              <span className="badge">{q.total || q.questions?.length || 0} Q</span>
              <span className="badge">
                {q.settings?.perQuestionSec
                  ? `${Math.round((q.settings.perQuestionSec * (q.questions?.length || 0)) / 60)} min`
                  : "—"}
              </span>
            </div>
            {q.description && <div className="text-slate-600 mt-1">{q.description}</div>}
          </Link>
        ))}
        {list.length === 0 && <div className="card">No quizzes yet.</div>}
      </div>
    </Shell>
  );
}

// JSON import helper (local scope is fine)
function importQuestionsFromJSON(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON");
  }
  if (!Array.isArray(data)) throw new Error("JSON must be an array of questions");
  const out = data.map((q, i) => {
    const item = {
      q: String(q.q ?? q.question ?? "").trim(),
      options: Array.isArray(q.options)
        ? q.options.slice(0, 4)
        : [q.a, q.b, q.c, q.d].filter(Boolean),
      ans: q.ans != null ? Number(q.ans) : Number(q.answer),
      marks: q.marks != null ? Number(q.marks) : 1,
    };
    if (!item.q) throw new Error(`Item ${i + 1}: missing question text`);
    if (!item.options || item.options.length !== 4)
      throw new Error(`Item ${i + 1}: need exactly 4 options`);
    if (Number.isNaN(item.ans)) throw new Error(`Item ${i + 1}: missing ans`);
    if (item.ans >= 1 && item.ans <= 4) item.ans = item.ans - 1; // support 1–4
    if (item.ans < 0 || item.ans > 3) throw new Error(`Item ${i + 1}: ans must be 0-3 or 1-4`);
    if (!item.marks || Number.isNaN(item.marks)) item.marks = 1;
    return item;
  });
  return out;
}

function CreateQuizCard() {
  const { user, userDoc } = useSession();
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

  const importFromJSONPrompt = () => {
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
    if (!isAdmin) return alert("Admin only");
    const payload = {
      title: form.title.trim() || "Untitled Quiz",
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
    setForm({
      title: "",
      description: "",
      settings: { perQuestionSec: 60, negativeMark: 0, shuffle: true, showInstant: false },
      questions: [],
    });
    setOpen(false);
  };

  if (!isAdmin)
    return (
      <div className="card">
        <div className="font-semibold mb-2">Create Quiz</div>
        <div className="text-sm text-slate-500">
          Admin can create mini quizzes for the Adda community.
        </div>
      </div>
    );

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Create Quiz (new engine)</div>
        <button className="btn-ghost" onClick={() => setOpen(!open)}>
          {open ? "Close" : "Open"}
        </button>
      </div>
      {open && (
        <div className="space-y-3 mt-3">
          <input
            className="input"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          />
          <textarea
            className="input min-h-[72px]"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
          />

          <div className="grid md:grid-cols-2 gap-2">
            <label className="flex items-center gap-2">
              <span className="label">Sec/Q</span>
              <input
                type="number"
                className="input"
                value={form.settings.perQuestionSec}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    settings: { ...s.settings, perQuestionSec: e.target.value },
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="label">Negative</span>
              <input
                type="number"
                className="input"
                value={form.settings.negativeMark}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    settings: { ...s.settings, negativeMark: e.target.value },
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.settings.shuffle}
                onChange={(e) =>
                  setForm((s) => ({ ...s, settings: { ...s.settings, shuffle: e.target.checked } }))
                }
              />
              <span>Shuffle</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.settings.showInstant}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    settings: { ...s.settings, showInstant: e.target.checked },
                  }))
                }
              />
              <span>Show Instant Result per Q</span>
            </label>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button className="btn-ghost" onClick={addQ}>
              + Add Question
            </button>
            <button className="btn-ghost" onClick={importFromJSONPrompt}>
              Import JSON
            </button>
            <label className="btn-ghost cursor-pointer">
              Upload JSON file
              <input
                type="file"
                accept="application/json,.json"
                hidden
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
              className="btn-ghost"
              onClick={() => {
                const sample = [
                  { q: "What is 2+2?", options: ["2", "3", "4", "5"], ans: 2, marks: 1 },
                ];
                const blob = new Blob([JSON.stringify(sample, null, 2)], {
                  type: "application/json",
                });
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

          {form.questions.map((q, i) => (
            <div key={i} className="card">
              <input
                className="input"
                placeholder={`Q${i + 1}`}
                value={q.q}
                onChange={(e) => {
                  const c = structuredClone(form);
                  c.questions[i].q = e.target.value;
                  setForm(c);
                }}
              />
              {q.options.map((op, oi) => (
                <input
                  key={oi}
                  className="input mt-2"
                  placeholder={`Option ${oi + 1}`}
                  value={op}
                  onChange={(e) => {
                    const c = structuredClone(form);
                    c.questions[i].options[oi] = e.target.value;
                    setForm(c);
                  }}
                />
              ))}
              <div className="grid md:grid-cols-3 gap-2 mt-2">
                <label className="flex items-center gap-2">
                  <span className="label">Correct</span>
                  <select
                    className="input"
                    value={q.ans}
                    onChange={(e) => {
                      const c = structuredClone(form);
                      c.questions[i].ans = Number(e.target.value);
                      setForm(c);
                    }}
                  >
                    {[0, 1, 2, 3].map((x) => (
                      <option key={x} value={x}>
                        Option {x + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="label">Marks</span>
                  <input
                    type="number"
                    className="input"
                    value={q.marks}
                    onChange={(e) => {
                      const c = structuredClone(form);
                      c.questions[i].marks = Number(e.target.value) || 1;
                      setForm(c);
                    }}
                  />
                </label>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    const c = structuredClone(form);
                    c.questions.splice(i, 1);
                    setForm(c);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <button className="btn" onClick={save}>
            Save Quiz
          </button>
        </div>
      )}
    </div>
  );
}

function TakeQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [order, setOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // aligned to original indices
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [instant, setInstant] = useState(null); // { ok, correctIndex }

  // load & seed session
  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "quizzes", id));
      if (!snap.exists()) return setQuiz({ missing: true });
      const raw = { id: snap.id, ...snap.data() };
      const q = QuizEngine.normalize(raw);

      // try resume
      const saved = localStorage.getItem(QuizEngine.key(id));
      if (saved) {
        try {
          const s = JSON.parse(saved);
          if (s.id === id && Array.isArray(s.answers)) {
            setQuiz(q);
            setOrder(s.order);
            setIdx(s.idx || 0);
            setAnswers(s.answers);
            setSecondsLeft(
              s.secondsLeft || q.settings.perQuestionSec * q.questions.length
            );
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
      localStorage.setItem(
        QuizEngine.key(id),
        JSON.stringify({ id, order, idx, answers, secondsLeft })
      );
    }, 1500);
    return () => clearInterval(iv);
  }, [id, quiz, order, idx, answers, secondsLeft]);

  // timer
  useEffect(() => {
    if (secondsLeft == null) return;
    const t = setInterval(
      () =>
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(t);
            onSubmit(true);
            return 0;
          }
          return s - 1;
        }),
      1000
    );
    return () => clearInterval(t);
  }, [secondsLeft]);

  if (!quiz) return <Shell title="Quiz" desc="Loading" />;
  if (quiz.missing)
    return (
      <Shell title="Quiz">
        <div className="card">Not found</div>
      </Shell>
    );

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

  const nextQ = () => {
    setInstant(null);
    setIdx((i) => Math.min(i + 1, order.length - 1));
  };
  const prevQ = () => {
    setInstant(null);
    setIdx((i) => Math.max(i - 1, 0));
  };

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
        <div className="card space-y-2">
          <div className="font-semibold">Time</div>
          <div className="text-2xl font-mono">
            {mm}:{ss}
          </div>
          <Progress value={elapsedPct} />
          <button className="btn w-full" onClick={() => onSubmit(false)}>
            Submit
          </button>
        </div>
      }
    >
      <div className="card mb-3">
        <span className="label">Question</span>{" "}
        <span className="font-medium">
          {idx + 1} / {order.length}
        </span>
      </div>
      <div className="space-y-3">
        <div className="card">
          <div className="font-medium">
            Q{idx + 1}. {q.q}
          </div>
          <div className="mt-2 grid gap-2">
            {q.options.map((op, oi) => {
              const active = chosen === oi;
              const showInstant = instant && (active || oi === instant.correctIndex);
              const ok = instant?.ok && oi === instant.correctIndex;
              const wrong = instant && active && !instant.ok;
              return (
                <button
                  key={oi}
                  className={`btn-ghost text-left ${
                    active ? "bg-emerald-50 border-emerald-200" : ""
                  } ${
                    showInstant
                      ? ok
                        ? "bg-emerald-100 border-emerald-300"
                        : wrong
                        ? "bg-rose-50 border-rose-200"
                        : ""
                      : ""
                  }`}
                  onClick={() => select(oi)}
                >
                  <b>{String.fromCharCode(65 + oi)}.</b> {op}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 mt-3">
            <button className="btn-ghost" onClick={prevQ} disabled={idx === 0}>
              Prev
            </button>
            <button
              className="btn-ghost"
              onClick={nextQ}
              disabled={idx === order.length - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function QuizResult() {
  const { id } = useParams();
  const state = history.state?.usr || window.history.state?.usr || {};
  const [last, setLast] = useState(null);

  useEffect(() => {
    const qy = query(
      collection(db, "quiz_attempts"),
      where("quizId", "==", id),
      orderBy("createdAt", "desc"),
      limit(1)
    );
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
      <div className="card space-y-3 text-center">
        <div className="text-2xl font-semibold">Your Score</div>
        <div className="text-4xl font-mono">
          {score} / {totalMarks}
        </div>
        <Progress value={pct} />
        <div className="text-slate-600">{pct}%</div>
        <div className="flex gap-2 justify-center text-sm">
          <span className="badge">Correct: {corr}</span>
          <span className="badge">Wrong: {wr}</span>
          <span className="badge">Skipped: {sk}</span>
        </div>
        <div className="flex gap-2 justify-center">
          <Link className="btn-ghost" to={`/quiz/${id}`}>
            Retake
          </Link>
          <Link className="btn" to="/quizzes">
            Browse Quizzes
          </Link>
        </div>
      </div>
    </Shell>
  );
}

// ============================
// Jobs & Notes (simple, adda-style)
// ============================
function Jobs() {
  const [list, setList] = useState([]);
  const [qText, setQ] = useState("");
  useEffect(() => {
    const qy = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);
  const filtered = list.filter(
    (j) =>
      !qText ||
      j.title?.toLowerCase().includes(qText.toLowerCase()) ||
      j.department?.toLowerCase().includes(qText.toLowerCase())
  );
  return (
    <Shell title="Jobs" desc="Latest job posts and apply links" canonical="/jobs">
      <div className="card">
        <input
          className="input"
          placeholder="Search title or department"
          value={qText}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="mt-4 space-y-3">
        {filtered.map((j) => (
          <div key={j.id} className="card">
            <div className="flex items-center gap-2">
              <div className="font-semibold">{j.title}</div>
              {j.state && <span className="badge">{j.state}</span>}
            </div>
            <div className="text-slate-600 mt-1">{j.department}</div>
            {j.lastDate && (
              <div className="mt-1">
                <span className="label">Last Date:</span> {j.lastDate}
              </div>
            )}
            <div className="mt-2">
              <a className="btn-ghost" href={j.applyLink} target="_blank" rel="noreferrer">
                Apply
              </a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="card">No jobs found.</div>}
      </div>
    </Shell>
  );
}

function Notes() {
  const [list, setList] = useState([]);
  const [qText, setQ] = useState("");
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    const qy = query(collection(db, "notes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);
  const filtered = list.filter(
    (n) => !qText || n.title?.toLowerCase().includes(qText.toLowerCase())
  );
  return (
    <Shell title="Notes" desc="Free study notes & PDFs" canonical="/notes">
      <div className="card">
        <input
          className="input"
          placeholder="Search notes title"
          value={qText}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="mt-4 space-y-3">
        {filtered.map((n) => (
          <div key={n.id} className="card">
            <div className="font-semibold">{n.title}</div>
            <div className="text-slate-600">
              {n.exam} • {n.subject} • {n.topic}
            </div>
            {n.description && <div className="mt-1">{n.description}</div>}
            <div className="mt-2 flex gap-2">
              <button className="btn-ghost" onClick={() => setPreview(n)}>
                Preview
              </button>
              <a className="btn" href={n.fileUrl} target="_blank" rel="noreferrer">
                Download ({n.downloads || 0})
              </a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="card">No notes found.</div>}
      </div>

      {preview && (
        <div className="card mt-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Preview: {preview.title}</div>
            <button className="btn-ghost" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
          {String(preview.fileUrl || "").toLowerCase().endsWith(".pdf") ? (
            <iframe title="preview" src={preview.fileUrl} className="w-full h-[560px] mt-3" />
          ) : (
            <div className="text-sm text-slate-500 mt-3">Preview not supported.</div>
          )}
        </div>
      )}
    </Shell>
  );
}

// ============================
// Dashboard
// ============================
function Dashboard() {
  const { user } = useSession();
  const [attempts, setAttempts] = useState([]);
  useEffect(() => {
    if (!user) return;
    const qy = query(
      collection(db, "quiz_attempts"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(qy, (snap) =>
      setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [user]);
  if (!user) return <Navigate to="/" replace />;
  return (
    <Shell title="Dashboard" desc="Your recent activity" canonical="/dashboard">
      <div className="card">
        <div className="font-semibold mb-2">Recent Quiz Attempts</div>
        {attempts.length === 0 && (
          <div className="text-sm text-slate-500">No attempts yet.</div>
        )}
        <div className="space-y-2">
          {attempts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border-t border-slate-200 pt-2"
            >
              <div>Quiz: {a.quizId}</div>
              <div>
                {a.score} / {a.totalMarks ?? a.total ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ============================
// Admin (tiny): post job/note quickly
// ============================
function Admin() {
  const { userDoc } = useSession();
  const isAdmin = userDoc?.role === "admin";
  const [tab, setTab] = useState("job");
  if (!isAdmin)
    return (
      <Shell title="Admin">
        <div className="card">Admins only.</div>
      </Shell>
    );
  return (
    <Shell title="Admin" desc="Manage community content" canonical="/admin">
      <div className="flex gap-2 mb-3">
        <button
          className={tab === "job" ? "btn" : "btn-ghost"}
          onClick={() => setTab("job")}
        >
          Jobs
        </button>
        <button
          className={tab === "note" ? "btn" : "btn-ghost"}
          onClick={() => setTab("note")}
        >
          Notes
        </button>
        <button
          className={tab === "quiz" ? "btn" : "btn-ghost"}
          onClick={() => setTab("quiz")}
        >
          Quizzes
        </button>
      </div>
      {tab === "job" && <AdminJob />}
      {tab === "note" && <AdminNote />}
      {tab === "quiz" && <CreateQuizCard />}
    </Shell>
  );
}

function AdminJob() {
  const [form, setForm] = useState({
    title: "",
    department: "",
    state: "",
    lastDate: "",
    applyLink: "",
    eligibility: "",
  });
  const save = async () => {
    if (!form.title) return alert("Title required");
    await addDoc(collection(db, "jobs"), { ...form, createdAt: serverTimestamp() });
    setForm({
      title: "",
      department: "",
      state: "",
      lastDate: "",
      applyLink: "",
      eligibility: "",
    });
  };
  return (
    <div className="card space-y-2">
      <input
        className="input"
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <input
        className="input"
        placeholder="Department"
        value={form.department}
        onChange={(e) => setForm({ ...form, department: e.target.value })}
      />
      <input
        className="input"
        placeholder="State"
        value={form.state}
        onChange={(e) => setForm({ ...form, state: e.target.value })}
      />
      <label className="label">Last Date</label>
      <input
        type="date"
        className="input"
        value={form.lastDate}
        onChange={(e) => setForm({ ...form, lastDate: e.target.value })}
      />
      <input
        className="input"
        placeholder="Eligibility"
        value={form.eligibility}
        onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
      />
      <input
        className="input"
        placeholder="Apply Link"
        value={form.applyLink}
        onChange={(e) => setForm({ ...form, applyLink: e.target.value })}
      />
      <button className="btn" onClick={save}>
        Post Job
      </button>
    </div>
  );
}

function AdminNote() {
  const [form, setForm] = useState({
    title: "",
    exam: "",
    subject: "",
    topic: "",
    description: "",
    fileUrl: "",
    fileName: "",
  });
  const [uploading, setUploading] = useState(false);
  const onFile = async (f) => {
    if (!f) return;
    setUploading(true);
    try {
      const key = `notes/${Date.now()}_${f.name}`;
      const r = ref(storage, key);
      await uploadBytes(r, f);
      const url = await getDownloadURL(r);
      setForm((s) => ({ ...s, fileUrl: url, fileName: f.name }));
    } finally {
      setUploading(false);
    }
  };
  const save = async () => {
    if (!form.title || !form.fileUrl) return alert("Title and file required");
    await addDoc(collection(db, "notes"), {
      ...form,
      downloads: 0,
      createdAt: serverTimestamp(),
    });
    setForm({
      title: "",
      exam: "",
      subject: "",
      topic: "",
      description: "",
      fileUrl: "",
      fileName: "",
    });
  };
  return (
    <div className="card space-y-2">
      <input
        className="input"
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <div className="grid md:grid-cols-2 gap-2">
        <input
          className="input"
          placeholder="Exam"
          value={form.exam}
          onChange={(e) => setForm({ ...form, exam: e.target.value })}
        />
        <input
          className="input"
          placeholder="Subject"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
      </div>
      <input
        className="input"
        placeholder="Topic"
        value={form.topic}
        onChange={(e) => setForm({ ...form, topic: e.target.value })}
      />
      <textarea
        className="input min-h-[80px]"
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {uploading ? (
          <span className="label">Uploading…</span>
        ) : form.fileName ? (
          <span className="badge">{form.fileName}</span>
        ) : null}
      </div>
      <button className="btn" onClick={save}>
        Upload Note
      </button>
    </div>
  );
}

// ============================
// Home
// ============================
function Home() {
  return (
    <Shell
      title="Prep Adda"
      desc="Discuss, practice mini quizzes, and get updates — all in one Adda-style app."
      canonical="/"
    >
      <div className="card">
        <div className="text-lg font-semibold">Welcome to prepji Adda</div>
        <p className="mt-2 text-slate-700">
          A lightweight, mobile-first community space for exam aspirants. Post doubts, take quick
          quizzes, find jobs & notes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="btn" to="/adda">
            Open Adda
          </Link>
          <Link className="btn-ghost" to="/quizzes">
            Take a Quiz
          </Link>
          <Link className="btn-ghost" to="/jobs">
            Browse Jobs
          </Link>
          <Link className="btn-ghost" to="/notes">
            Study Notes
          </Link>
        </div>
      </div>
    </Shell>
  );
}

// ============================
// App (Router + global CSS)
// ============================
export default function App() {
  return (
    <HelmetProvider>
      <style>{styles}</style>
      <SessionProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/adda" element={<Adda />} />
            <Route path="/quizzes" element={<Quizzes />} />
            <Route path="/quiz/:id" element={<TakeQuiz />} />
            <Route path="/quiz/:id/result" element={<QuizResult />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SessionProvider>
    </HelmetProvider>
  );
}
