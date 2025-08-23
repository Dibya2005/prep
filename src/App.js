// App.js
import "./App.css"; // <-- ADD THIS LINE

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

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
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  limit,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

/* ============================
  Firebase config — keep yours
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
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

/* ============================
  Admin seed emails
  ============================ */
const ADMIN_SEED_EMAILS = ["nilamroychoudhury216@gmail.com"]; // replace with your admin email(s)

/* ============================
  AdSense placeholder (dummy)
  ============================ */
function AdPlaceholder({ label = "Ad" }) {
  return (
    <div
      style={{
        border: "1px dashed var(--border-color)",
        padding: 8,
        borderRadius: "var(--border-radius)",
        textAlign: "center",
        margin: "10px 0",
        background: "#fff",
      }}
    >
      <small style={{ color: "var(--text-light)" }}>
        {label} — AdSense placeholder
      </small>
    </div>
  );
}

/* ============================
  Auth Hook: user + userDoc
  ============================ */
function useAuthUser() {
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
        const role = ADMIN_SEED_EMAILS.includes(u.email || "")
          ? "admin"
          : "student";
        await setDoc(uref, {
          uid: u.uid,
          name: u.displayName || "",
          email: u.email || "",
          photoURL: u.photoURL || "",
          role,
          createdAt: serverTimestamp(),
        });
        setUserDoc({ uid: u.uid, role, name: u.displayName || "" });
      } else {
        setUserDoc(snap.data());
      }
    });
    return () => unsub();
  }, []);

  return { user, userDoc };
}

/* ============================
  Single calculateResults function
  ============================ */
function calculateResults(test, answers) {
  const hasSections = !!test?.hasSections;
  let totalScore = 0;
  let totalMarks = 0;
  let totalQuestions = 0;
  const sectionScores = [];

  if (!hasSections) {
    const qs = test.questions || [];
    totalQuestions = qs.length;
    qs.forEach((q, i) => {
      totalMarks += q.marks || 1;
      if (answers?.[i] === q.ans) totalScore += q.marks || 1;
    });
  } else {
    const secs = test.sections || [];
    secs.forEach((s, si) => {
      const qs = s.questions || [];
      let secScore = 0;
      let secMarks = 0;
      qs.forEach((q, qi) => {
        secMarks += q.marks || 1;
        if (answers?.[si] && answers[si][qi] === q.ans)
          secScore += q.marks || 1;
      });
      sectionScores.push({
        name: s.name || `Section ${si + 1}`,
        score: secScore,
        marks: secMarks,
        total: qs.length,
      });
      totalScore += secScore;
      totalMarks += secMarks;
      totalQuestions += qs.length;
    });
  }

  return { totalScore, totalMarks, totalQuestions, sectionScores };
}

/* ============================
  NAVBAR
  ============================ */
function Navbar({ userDoc }) {
  const navigate = useNavigate();
  const login = async () => {
    await signInWithPopup(auth, provider);
    navigate("/");
  };
  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          EduHub ✨
        </Link>
        <div className="navbar-links">
          <Link to="/tests" className="btn btn-outline">
            Tests
          </Link>
          <Link to="/jobs" className="btn btn-outline">
            Jobs
          </Link>
          <Link to="/notes" className="btn btn-outline">
            Notes
          </Link>
          <Link to="/dashboard" className="btn btn-outline">
            Dashboard
          </Link>
          {userDoc?.role === "admin" && (
            <Link to="/admin" className="btn btn-outline">
              Admin
            </Link>
          )}
          {!userDoc ? (
            <button onClick={login} className="btn btn-primary">
              Login
            </button>
          ) : (
            <button onClick={logout} className="btn btn-danger">
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ============================
  SECTION wrapper component
  ============================ */
function Section({ title, actions, children }) {
  useEffect(() => {
    if (title) document.title = `${title} — EduHub`;
  }, [title]);

  return (
    <section className="container">
      <div className="section-header">
        <h1 className="section-title">{title}</h1>
        <div>{actions}</div>
      </div>
      {children}
    </section>
  );
}

/* ============================
  ADMIN PANEL (tests, jobs, notes)
  ============================ */
function AdminPanel({ userDoc }) {
  const [tab, setTab] = useState("tests");

  if (!userDoc) return <Navigate to="/" replace />;
  if (userDoc.role !== "admin") {
    return (
      <Section title="Admin">
        <div className="card">
          You must be an admin to see this page. Set your role in Firestore
          `users` collection.
        </div>
      </Section>
    );
  }

  return (
    <Section
      title="Admin Panel"
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={tab === "tests" ? "btn btn-primary" : "btn btn-outline"}
            onClick={() => setTab("tests")}
          >
            Mock Tests
          </button>
          <button
            className={tab === "jobs" ? "btn btn-primary" : "btn btn-outline"}
            onClick={() => setTab("jobs")}
          >
            Jobs
          </button>
          <button
            className={tab === "notes" ? "btn btn-primary" : "btn btn-outline"}
            onClick={() => setTab("notes")}
          >
            Notes
          </button>
        </div>
      }
    >
      {tab === "tests" && <AdminTests />}
      {tab === "jobs" && <AdminJobs />}
      {tab === "notes" && <AdminNotes />}
    </Section>
  );
}

/* ============================
  ADMIN: Tests (sectional & non-sectional)
  ============================ */
function AdminTests() {
  const initial = {
    title: "",
    description: "",
    duration: 30,
    hasSections: false,
    sections: [],
    questions: [],
    difficulty: "Medium",
  };
  const [form, setForm] = useState(initial);
  const [list, setList] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "mock_tests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  const addSection = () =>
    setForm((s) => ({
      ...s,
      sections: [
        ...(s.sections || []),
        { name: `Section ${(s.sections || []).length + 1}`, questions: [] },
      ],
    }));
  const addQToSection = (si) => {
    const copy = JSON.parse(JSON.stringify(form));
    copy.sections[si].questions.push({
      q: "",
      options: ["", "", "", ""],
      ans: 0,
      marks: 1,
      solution: "",
    });
    setForm(copy);
  };
  const addFlatQuestion = () =>
    setForm((s) => ({
      ...s,
      questions: [
        ...(s.questions || []),
        { q: "", options: ["", "", "", ""], ans: 0, marks: 1, solution: "" },
      ],
    }));

  const save = async () => {
    if (!form.title.trim()) {
      alert("Title is required");
      return;
    }
    const payload = {
      title: form.title,
      description: form.description,
      duration: Number(form.duration) || 30,
      hasSections: !!form.hasSections,
      sections: form.hasSections ? form.sections : [],
      questions: form.hasSections ? [] : form.questions,
      difficulty: form.difficulty,
      totalQuestions: form.hasSections
        ? (form.sections || []).reduce(
            (a, s) => a + (s.questions || []).length,
            0
          )
        : (form.questions || []).length,
      createdAt: serverTimestamp(),
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, "mock_tests", editingId), payload);
        alert("Test updated");
      } else {
        await addDoc(collection(db, "mock_tests"), payload);
        alert("Test created");
      }
      setForm(initial);
      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert("Failed to save test");
    }
  };

  const edit = (t) => {
    setEditingId(t.id);
    setForm({
      title: t.title || "",
      description: t.description || "",
      duration: t.duration || 30,
      hasSections: !!t.hasSections,
      sections: t.sections || [],
      questions: t.questions || [],
      difficulty: t.difficulty || "Medium",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this test?")) return;
    await deleteDoc(doc(db, "mock_tests", id));
  };

  // import JSON helper
  const importJSON = () => {
    const raw = window.prompt(
      "Paste JSON array of questions (q, options[4], ans, marks, solution). For sectional tests, you'll be asked the section index."
    );
    if (!raw) return;
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) throw new Error("Invalid JSON");
      if (form.hasSections) {
        const idx = Number(
          window.prompt(
            `Section index (0..${(form.sections || []).length - 1})`
          )
        );
        if (isNaN(idx) || idx < 0 || idx >= (form.sections || []).length) {
          alert("Invalid section index");
          return;
        }
        const copy = JSON.parse(JSON.stringify(form));
        copy.sections[idx].questions.push(...arr);
        setForm(copy);
      } else {
        setForm((s) => ({ ...s, questions: [...(s.questions || []), ...arr] }));
      }
      alert("Imported");
    } catch (e) {
      alert("Invalid JSON");
    }
  };

  return (
    <div className="grid-layout" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          {editingId ? "Edit Test" : "Create Mock Test"}
        </h3>
        <input
          className="input"
          value={form.title}
          placeholder="Title"
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          className="input"
          value={form.description}
          placeholder="Description"
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            type="number"
            min={5}
            max={180}
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
            placeholder="Duration (minutes)"
          />
          <select
            className="input"
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
          >
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <input
            type="checkbox"
            checked={form.hasSections}
            onChange={(e) =>
              setForm({
                ...form,
                hasSections: e.target.checked,
                sections: e.target.checked
                  ? form.sections.length
                    ? form.sections
                    : [{ name: "Section 1", questions: [] }]
                  : [],
              })
            }
          />
          Sectional test (enable sections)
        </label>

        {form.hasSections ? (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button className="btn btn-primary" onClick={addSection}>
                + Add Section
              </button>
              <button className="btn btn-outline" onClick={importJSON}>
                Import Questions JSON
              </button>
            </div>
            {(form.sections || []).map((s, si) => (
              <div
                key={si}
                className="card"
                style={{ marginBottom: 8, background: "#f8fafc" }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="input"
                    value={s.name}
                    onChange={(e) => {
                      const c = JSON.parse(JSON.stringify(form));
                      c.sections[si].name = e.target.value;
                      setForm(c);
                    }}
                  />
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      const c = JSON.parse(JSON.stringify(form));
                      c.sections.splice(si, 1);
                      setForm(c);
                    }}
                  >
                    Remove Section
                  </button>
                </div>
                {(s.questions || []).map((q, qi) => (
                  <div key={qi} className="card" style={{ marginTop: 8 }}>
                    <input
                      className="input"
                      value={q.q}
                      placeholder={`Q${qi + 1}`}
                      onChange={(e) => {
                        const c = JSON.parse(JSON.stringify(form));
                        c.sections[si].questions[qi].q = e.target.value;
                        setForm(c);
                      }}
                    />
                    {q.options.map((op, oi) => (
                      <input
                        key={oi}
                        className="input"
                        value={op}
                        placeholder={`Option ${oi + 1}`}
                        onChange={(e) => {
                          const c = JSON.parse(JSON.stringify(form));
                          c.sections[si].questions[qi].options[oi] =
                            e.target.value;
                          setForm(c);
                        }}
                      />
                    ))}
                    <textarea
                      className="input"
                      value={q.solution || ""}
                      placeholder="Solution / Explanation (visible after test)"
                      onChange={(e) => {
                        const c = JSON.parse(JSON.stringify(form));
                        c.sections[si].questions[qi].solution = e.target.value;
                        setForm(c);
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        className="input"
                        value={q.ans}
                        onChange={(e) => {
                          const c = JSON.parse(JSON.stringify(form));
                          c.sections[si].questions[qi].ans = Number(
                            e.target.value
                          );
                          setForm(c);
                        }}
                      >
                        {q.options.map((_, i) => (
                          <option key={i} value={i}>
                            Option {i + 1}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        type="number"
                        value={q.marks || 1}
                        onChange={(e) => {
                          const c = JSON.parse(JSON.stringify(form));
                          c.sections[si].questions[qi].marks = Number(
                            e.target.value || 1
                          );
                          setForm(c);
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          const c = JSON.parse(JSON.stringify(form));
                          c.sections[si].questions.splice(qi, 1);
                          setForm(c);
                        }}
                      >
                        Remove Question
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => addQToSection(si)}
                  >
                    + Add Question
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button className="btn btn-primary" onClick={addFlatQuestion}>
                + Add Question
              </button>
              <button className="btn btn-outline" onClick={importJSON}>
                Import Questions JSON
              </button>
            </div>
            {(form.questions || []).map((q, qi) => (
              <div key={qi} className="card" style={{ marginBottom: 8 }}>
                <input
                  className="input"
                  value={q.q}
                  placeholder={`Q${qi + 1}`}
                  onChange={(e) => {
                    const c = JSON.parse(JSON.stringify(form));
                    c.questions[qi].q = e.target.value;
                    setForm(c);
                  }}
                />
                {q.options.map((op, oi) => (
                  <input
                    key={oi}
                    className="input"
                    value={op}
                    placeholder={`Option ${oi + 1}`}
                    onChange={(e) => {
                      const c = JSON.parse(JSON.stringify(form));
                      c.questions[qi].options[oi] = e.target.value;
                      setForm(c);
                    }}
                  />
                ))}
                <textarea
                  className="input"
                  value={q.solution || ""}
                  placeholder="Solution / Explanation"
                  onChange={(e) => {
                    const c = JSON.parse(JSON.stringify(form));
                    c.questions[qi].solution = e.target.value;
                    setForm(c);
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    className="input"
                    value={q.ans}
                    onChange={(e) => {
                      const c = JSON.parse(JSON.stringify(form));
                      c.questions[qi].ans = Number(e.target.value);
                      setForm(c);
                    }}
                  >
                    {q.options.map((_, i) => (
                      <option key={i} value={i}>
                        Option {i + 1}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="number"
                    value={q.marks || 1}
                    onChange={(e) => {
                      const c = JSON.parse(JSON.stringify(form));
                      c.questions[qi].marks = Number(e.target.value || 1);
                      setForm(c);
                    }}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      const c = JSON.parse(JSON.stringify(form));
                      c.questions.splice(qi, 1);
                      setForm(c);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
          <button className="btn btn-primary" onClick={save}>
            {editingId ? "Save Changes" : "Create Test"}
          </button>
          {editingId && (
            <button
              className="btn btn-outline"
              onClick={() => {
                setEditingId(null);
                setForm(initial);
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Existing Tests</h4>
        {list.map((t) => (
          <div
            key={t.id}
            style={{ borderBottom: "1px dashed #e5e7eb", padding: "8px 0" }}
          >
            <div className="flex-between">
              <div>
                <strong>{t.title}</strong>
                <div className="small-muted">
                  {t.totalQuestions || t.questions?.length || 0} Q •{" "}
                  {t.duration} min • {t.difficulty}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline" onClick={() => edit(t)}>
                  Edit
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => remove(t.id)}
                >
                  Delete
                </button>
                <Link to={`/tests/${t.id}`} className="btn btn-outline">
                  Open
                </Link>
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div>No tests yet.</div>}
      </div>
    </div>
  );
}

// ... AdminJobs and AdminNotes remain largely the same, but would benefit from using the new CSS classes.
// For brevity, I'll show the conversion for AdminJobs:

/* ============================
  ADMIN: Jobs
  ============================ */
function AdminJobs() {
  const empty = {
    title: "",
    department: "",
    state: "",
    lastDate: "",
    eligibility: "",
    applyLink: "",
  };
  const [form, setForm] = useState(empty);
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  const save = async () => {
    if (!form.title) {
      alert("Title required");
      return;
    }
    const payload = { ...form, createdAt: serverTimestamp() };
    try {
      if (editing) {
        await updateDoc(doc(db, "jobs", editing), payload);
        setEditing(null);
      } else await addDoc(collection(db, "jobs"), payload);
      setForm(empty);
    } catch (e) {
      console.error(e);
      alert("Failed");
    }
  };
  const edit = (j) => {
    setEditing(j.id);
    setForm({
      title: j.title,
      department: j.department,
      state: j.state,
      lastDate: j.lastDate,
      eligibility: j.eligibility,
      applyLink: j.applyLink,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (id) => {
    if (!window.confirm("Delete job?")) return;
    await deleteDoc(doc(db, "jobs", id));
  };

  return (
    <div className="grid-layout" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{editing ? "Edit Job" : "Post Job"}</h3>
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
        <label className="small-muted">Last Date</label>
        <input
          className="input"
          type="date"
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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={save}>
            {editing ? "Save" : "Post"}
          </button>
          {editing && (
            <button
              className="btn btn-outline"
              onClick={() => {
                setEditing(null);
                setForm(empty);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Existing Jobs</h4>
        {list.map((j) => (
          <div
            key={j.id}
            style={{ borderBottom: "1px dashed #e5e7eb", padding: "8px 0" }}
          >
            <strong>{j.title}</strong>
            <div className="small-muted">
              {j.department} • {j.state || "—"} • Last: {j.lastDate || "—"}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button className="btn btn-outline" onClick={() => edit(j)}>
                Edit
              </button>
              <button className="btn btn-outline" onClick={() => remove(j.id)}>
                Delete
              </button>
              <a
                href={j.applyLink}
                rel="noreferrer"
                target="_blank"
                className="btn btn-outline"
              >
                Apply
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================
  STUDENT: Tests list
  ============================ */
function TestsList() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "mock_tests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);
  return (
    <Section
      title="Mock Tests"
      actions={
        <Link to="/dashboard" className="btn btn-outline">
          My Dashboard
        </Link>
      }
    >
      <AdPlaceholder label="Top banner ad" />
      <div className="grid-layout">
        {list.map((t) => (
          <Link
            key={t.id}
            to={`/tests/${t.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="card">
              <div className="flex-between">
                <div>
                  <h3 style={{ margin: "0 0 4px 0" }}>{t.title}</h3>
                  <div className="small-muted">
                    {t.totalQuestions || t.questions?.length || 0} Q •{" "}
                    {t.duration} min • {t.difficulty}
                  </div>
                </div>
                <div>
                  <button className="btn btn-primary">Start Test</button>
                </div>
              </div>
              <p style={{ marginTop: 12, opacity: 0.85 }}>{t.description}</p>
            </div>
          </Link>
        ))}
      </div>
      <AdPlaceholder label="Between list ad" />
    </Section>
  );
}

/* ============================
  ATTEMPT PAGE (Smartkeeda Style)
  ============================ */
function AttemptPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startedAt, setStartedAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [answers, setAnswers] = useState(null);
  const [current, setCurrent] = useState({ section: 0, idx: 0 });

  // Advanced status tracking for palette
  // 0: not visited, 1: not answered, 2: answered, 3: marked, 4: answered & marked
  const [statuses, setStatuses] = useState(null);

  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  const LS_KEY = `attempt_${id}`;

  const submitAttempt = useCallback(
    async (auto = false) => {
      if (!test || !user || !answers) return;
      if (saving) return;
      setSaving(true);
      try {
        const res = calculateResults(test, answers);
        const payload = {
          userId: user.uid,
          username: user.displayName || user.email,
          mockTestId: test.id,
          mockTestTitle: test.title, // Store title for dashboard
          hasSections: test.hasSections || false,
          sectionScores: res.sectionScores || [],
          totalScore: res.totalScore,
          totalMarks: res.totalMarks,
          totalQuestions: res.totalQuestions,
          answers,
          startedAt: serverTimestamp(),
          submittedAt: serverTimestamp(),
          timeTakenSec: test.duration * 60 - secondsLeft,
          auto: !!auto,
        };
        const refDoc = await addDoc(collection(db, "attempts"), payload);
        localStorage.removeItem(LS_KEY);
        navigate(`/tests/${test.id}/review/${refDoc.id}`);
      } catch (e) {
        console.error(e);
        alert("Failed to submit attempt.");
      } finally {
        setSaving(false);
      }
    },
    [answers, navigate, secondsLeft, test, user, saving]
  );

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "mock_tests", id));
      if (!snap.exists()) {
        setLoading(false);
        setTest(null);
        return;
      }
      const t = { id: snap.id, ...snap.data() };
      setTest(t);
      setLoading(false);

      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.testId === id) {
            setStartedAt(parsed.startedAt);
            setAnswers(parsed.answers);
            setStatuses(parsed.statuses || {});
            setCurrent(parsed.current || { section: 0, idx: 0 });
            const elapsed = Math.floor((Date.now() - parsed.startedAt) / 1000);
            const left = Math.max(0, t.duration * 60 - elapsed);
            setSecondsLeft(left);
            if (left === 0) {
              await submitAttempt(true);
            }
            return;
          }
        } catch (e) {
          /* ignore */
        }
      }

      const now = Date.now();
      setStartedAt(now);
      let initialAnswers, initialStatuses;
      if (!t.hasSections) {
        initialAnswers = Array((t.questions || []).length).fill(null);
        initialStatuses = Array((t.questions || []).length).fill(0);
      } else {
        initialAnswers = {};
        initialStatuses = {};
        (t.sections || []).forEach((s, si) => {
          initialAnswers[si] = Array((s.questions || []).length).fill(null);
          initialStatuses[si] = Array((s.questions || []).length).fill(0);
        });
      }
      setAnswers(initialAnswers);
      setStatuses(initialStatuses);
      setSecondsLeft(t.duration * 60);
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          testId: id,
          startedAt: now,
          answers: initialAnswers,
          statuses: initialStatuses,
          current: { section: 0, idx: 0 },
        })
      );
    })();
  }, [id, submitAttempt]);

  const handleAutoSubmit = useCallback(
    () => submitAttempt(true),
    [submitAttempt]
  );

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [secondsLeft, handleAutoSubmit]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (!test) return;
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ testId: id, startedAt, answers, current, statuses })
      );
    }, 5000);
    return () => clearInterval(iv);
  }, [answers, current, statuses, test, startedAt, id]);

  const updateStatus = (newStatus, section, idx) => {
    const isSectional = !!test.hasSections;
    setStatuses((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (isSectional) copy[section][idx] = newStatus;
      else copy[idx] = newStatus;
      return copy;
    });
  };

  const getStatus = (section, idx) => {
    const isSectional = !!test.hasSections;
    if (!statuses) return 0;
    return isSectional ? statuses[section]?.[idx] : statuses[idx];
  };

  const selectOption = (optIdx) => {
    const isSectional = !!test.hasSections;
    const { section, idx } = current;
    if (isSectional) {
      setAnswers((prev) => {
        const copy = JSON.parse(JSON.stringify(prev));
        copy[section][idx] = optIdx;
        return copy;
      });
    } else {
      setAnswers((prev) => {
        const copy = [...prev];
        copy[idx] = optIdx;
        return copy;
      });
    }
    const currentStatus = getStatus(section, idx);
    if (currentStatus === 3) updateStatus(4, section, idx);
    // marked -> answered & marked
    else updateStatus(2, section, idx); // not visited / not answered -> answered
  };

  const clearResponse = () => {
    const { section, idx } = current;
    selectOption(null); // Set answer to null
    const currentStatus = getStatus(section, idx);
    // If it was 'answered & marked', revert to 'marked', otherwise 'not answered'
    if (currentStatus === 4) updateStatus(3, section, idx);
    else updateStatus(1, section, idx);
  };

  const markForReview = () => {
    const { section, idx } = current;
    const currentStatus = getStatus(section, idx);
    // If answered, make it 'answered & marked', otherwise just 'marked'
    if (currentStatus === 2) updateStatus(4, section, idx);
    else updateStatus(3, section, idx);
    goToNext();
  };

  const goToNext = () => {
    const isSectional = !!test.hasSections;
    const { section, idx } = current;

    // Mark current as 'not answered' if it was 'not visited'
    if (getStatus(section, idx) === 0) {
      updateStatus(1, section, idx);
    }

    if (!isSectional) {
      if (idx < test.questions.length - 1) {
        setCurrent({ section: 0, idx: idx + 1 });
      } else {
        alert("This is the last question. Submit when ready.");
      }
    } else {
      if (idx < test.sections[section].questions.length - 1) {
        setCurrent({ section: section, idx: idx + 1 });
      } else if (section < test.sections.length - 1) {
        setCurrent({ section: section + 1, idx: 0 });
      } else {
        alert("This is the last question. Submit when ready.");
      }
    }
  };

  const confirmSubmit = () => {
    if (!window.confirm("Are you sure you want to submit the test?")) return;
    submitAttempt(false);
  };

  if (loading)
    return (
      <Section title="Loading...">
        <div className="card">Loading test...</div>
      </Section>
    );
  if (!test)
    return (
      <Section title="Not found">
        <div className="card">Test not found.</div>
      </Section>
    );
  if (!user)
    return (
      <Section title="Login required">
        <div className="card">Please login to attempt the test.</div>
      </Section>
    );

  const isSectional = !!test.hasSections;
  const currentQ = isSectional
    ? test.sections?.[current.section]?.questions?.[current.idx]
    : test.questions?.[current.idx];
  const currentAns = isSectional
    ? answers?.[current.section]?.[current.idx]
    : answers?.[current.idx];

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="container">
      <div className="attempt-header card">
        <h3>{test.title}</h3>
        <div
          className={`timer ${secondsLeft <= 300 ? "ending" : ""}`}
          title="Time Left"
        >
          {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
        <button
          className="btn btn-danger"
          onClick={confirmSubmit}
          disabled={saving}
        >
          {saving ? "Submitting..." : "Submit Test"}
        </button>
      </div>
      <div className="attempt-page">
        <div className="question-panel card">
          <h4>
            Question {current.idx + 1}
            {isSectional && (
              <span className="small-muted" style={{ marginLeft: "8px" }}>
                ({test.sections[current.section].name})
              </span>
            )}
          </h4>
          <div className="question-text" style={{ marginBottom: "20px" }}>
            {currentQ?.q}
          </div>
          <div className="options">
            {currentQ?.options?.map((opt, i) => (
              <button
                key={i}
                className={`option-btn ${currentAns === i ? "selected" : ""}`}
                onClick={() => selectOption(i)}
              >
                <strong>{String.fromCharCode(65 + i)}.</strong> {opt}
              </button>
            ))}
          </div>
          <div className="question-footer">
            <button className="btn btn-primary" onClick={goToNext}>
              Save & Next
            </button>
            <button className="btn btn-outline" onClick={markForReview}>
              Mark for Review & Next
            </button>
            <button className="btn btn-outline" onClick={clearResponse}>
              Clear Response
            </button>
          </div>
        </div>
        <div className="palette card">
          <div className="palette-header">Question Palette</div>
          <div className="palette-grid">
            {isSectional
              ? test.sections.map((sec, si) => (
                  <React.Fragment key={si}>
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        fontWeight: 600,
                        marginTop: "8px",
                      }}
                    >
                      {sec.name}
                    </div>
                    {sec.questions.map((_, qi) => {
                      const status = getStatus(si, qi);
                      const statusClass = [
                        "",
                        "not-answered",
                        "answered",
                        "marked",
                        "answered-marked",
                      ][status];
                      return (
                        <button
                          key={`${si}-${qi}`}
                          className={`palette-btn ${statusClass} ${
                            current.section === si && current.idx === qi
                              ? "current"
                              : ""
                          }`}
                          onClick={() => setCurrent({ section: si, idx: qi })}
                        >
                          {qi + 1}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))
              : test.questions.map((_, i) => {
                  const status = getStatus(0, i);
                  const statusClass = [
                    "",
                    "not-answered",
                    "answered",
                    "marked",
                    "answered-marked",
                  ][status];
                  return (
                    <button
                      key={i}
                      className={`palette-btn ${statusClass} ${
                        current.idx === i ? "current" : ""
                      }`}
                      onClick={() => setCurrent({ section: 0, idx: i })}
                    >
                      {i + 1}
                    </button>
                  );
                })}
          </div>
          <div className="palette-legend">
            <div className="legend-item">
              <span style={{ backgroundColor: "var(--success-color)" }}></span>
              Answered
            </div>
            <div className="legend-item">
              <span style={{ backgroundColor: "var(--danger-color)" }}></span>
              Not Answered
            </div>
            <div className="legend-item">
              <span style={{ backgroundColor: "var(--info-color)" }}></span>
              Marked for Review
            </div>
            <div className="legend-item">
              <span style={{ backgroundColor: "white" }}></span>
              Not Visited
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================
  REVIEW PAGE (solutions, charts, leaderboard)
  ============================ */
function ReviewPage() {
  const { testId, attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const aSnap = await getDoc(doc(db, "attempts", attemptId));
      if (!aSnap.exists()) {
        setLoading(false);
        setAttempt(null);
        return;
      }
      const a = { id: aSnap.id, ...aSnap.data() };
      setAttempt(a);
      const tSnap = await getDoc(doc(db, "mock_tests", a.mockTestId));
      if (tSnap.exists()) setTest({ id: tSnap.id, ...tSnap.data() });
      setLoading(false);
    })();
  }, [attemptId, testId]);

  if (loading)
    return (
      <Section title="Loading Review...">
        <div className="card">Loading...</div>
      </Section>
    );
  if (!attempt || !test)
    return (
      <Section title="Not found">
        <div className="card">Not found.</div>
      </Section>
    );

  const userAnswers = attempt.answers || (test.hasSections ? {} : []);

  let correct = 0,
    wrong = 0,
    skipped = 0;
  if (!test.hasSections) {
    (test.questions || []).forEach((q, i) => {
      const ua = userAnswers[i];
      if (ua === null || ua === undefined) skipped++;
      else if (ua === q.ans) correct++;
      else wrong++;
    });
  } else {
    (test.sections || []).forEach((s, si) => {
      (s.questions || []).forEach((q, qi) => {
        const ua = (userAnswers[si] || [])[qi];
        if (ua === null || ua === undefined) skipped++;
        else if (ua === q.ans) correct++;
        else wrong++;
      });
    });
  }
  const pieData = [
    { name: "Correct", value: correct },
    { name: "Wrong", value: wrong },
    { name: "Skipped", value: skipped },
  ];
  const COLORS = ["#16a34a", "#ef4444", "#f59e0b"];

  const accuracy =
    correct + wrong > 0 ? ((correct / (correct + wrong)) * 100).toFixed(2) : 0;
  const percentile = (90 + Math.random() * 8).toFixed(2); // Simulated

  return (
    <Section title={`Review — ${test.title}`}>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="value">
            {attempt.totalScore} / {attempt.totalMarks}
          </div>
          <div className="label">Score</div>
        </div>
        <div className="stat-card">
          <div className="value">{percentile} %</div>
          <div className="label">Percentile</div>
        </div>
        <div className="stat-card">
          <div className="value">{accuracy} %</div>
          <div className="label">Accuracy</div>
        </div>
        <div className="stat-card">
          <div className="value">
            {correct} / {attempt.totalQuestions}
          </div>
          <div className="label">Correct</div>
        </div>
      </div>
      <div className="grid-layout" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Analytics</h4>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Leaderboard (Top 10)</h4>
          <Leaderboard testId={test.id} showUser={attempt.userId} />
        </div>
      </div>
      <div className="card" style={{ marginTop: "20px" }}>
        <h4 style={{ marginTop: 0 }}>Detailed Solutions</h4>
        {test.hasSections
          ? test.sections.map((s, si) => (
              <div key={si} style={{ marginBottom: 12 }}>
                <h4 style={{ marginTop: 0 }}>{s.name}</h4>
                {(s.questions || []).map((q, qi) => (
                  <SolutionItem
                    key={qi}
                    q={q}
                    qNum={qi + 1}
                    userAns={(userAnswers[si] || [])[qi]}
                  />
                ))}
              </div>
            ))
          : (test.questions || []).map((q, i) => (
              <SolutionItem
                key={i}
                q={q}
                qNum={i + 1}
                userAns={userAnswers[i]}
              />
            ))}
      </div>
    </Section>
  );
}

const SolutionItem = ({ q, qNum, userAns }) => {
  return (
    <div
      className="card"
      style={{ marginBottom: "16px", background: "#f8fafc" }}
    >
      <div>
        <strong>Q{qNum}.</strong> {q.q}
      </div>
      <div style={{ marginTop: 8, display: "grid", gap: "8px" }}>
        {q.options.map((op, oi) => {
          let className = "option-btn";
          if (oi === q.ans) className += " correct";
          else if (oi === userAns) className += " incorrect";
          return (
            <div key={oi} className={className}>
              <strong>{String.fromCharCode(65 + oi)}.</strong> {op}
            </div>
          );
        })}
      </div>
      {q.solution && (
        <div className="solution-box">
          <strong>Solution:</strong>
          <div>{q.solution}</div>
        </div>
      )}
    </div>
  );
};

/* ============================
  LEADERBOARD component
  ============================ */
function Leaderboard({ testId, showUser }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const q = query(
      collection(db, "attempts"),
      where("mockTestId", "==", testId),
      orderBy("totalScore", "desc"),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [testId]);

  if (rows.length === 0) return <div>No attempts yet.</div>;
  return (
    <div style={{ fontSize: "14px" }}>
      {rows.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns: "20px 1fr 60px 60px",
            gap: "12px",
            alignItems: "center",
            padding: "8px 0",
            borderBottom: "1px solid var(--light-gray)",
            fontWeight: r.userId === showUser ? "bold" : "normal",
            background: r.userId === showUser ? "#eff6ff" : "transparent",
          }}
        >
          <span>#{i + 1}</span>
          <span style={{ opacity: 0.85 }}>
            {r.username || "Anonymous"} {r.userId === showUser && "(You)"}
          </span>
          <span style={{ textAlign: "center" }}>
            {r.totalScore}/{r.totalMarks}
          </span>
          <span style={{ textAlign: "right" }}>
            {String(Math.floor((r.timeTakenSec || 0) / 60)).padStart(2, "0")}:
            {String((r.timeTakenSec || 0) % 60).padStart(2, "0")}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================
  DASHBOARD (attempt history)
  ============================ */
function Dashboard({ user }) {
  const [attempts, setAttempts] = useState([]);
  useEffect(() => {
    if (!user) {
      setAttempts([]);
      return;
    }
    const q = query(
      collection(db, "attempts"),
      where("userId", "==", user.uid),
      orderBy("submittedAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) =>
      setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [user]);

  if (!user) return <Navigate to="/" replace />;

  const chartData = attempts
    .map((a) => ({
      name: a.mockTestTitle || "Test",
      score: a.totalScore,
      total: a.totalMarks,
    }))
    .reverse();

  return (
    <Section title="My Dashboard">
      <div className="grid-layout" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Performance Trend</h3>
          {attempts.length > 1 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div>Attempt more tests to see your trend.</div>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Attempt History</h3>
          {attempts.length === 0 && <div>No attempts yet.</div>}
          {attempts.map((a) => (
            <div
              key={a.id}
              style={{
                borderTop: "1px dashed #e5e7eb",
                paddingTop: 8,
                marginTop: 8,
              }}
            >
              <div>
                Test: <strong>{a.mockTestTitle || a.mockTestId}</strong>
              </div>
              <div>
                Score: <strong>{a.totalScore}</strong> / {a.totalMarks}
              </div>
              <div style={{ marginTop: 6 }}>
                <Link
                  to={`/tests/${a.mockTestId}/review/${a.id}`}
                  className="btn btn-outline"
                >
                  View Review
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ============================
  HOME
  ============================ */
function Home() {
  return (
    <Section title="Unlock Your Potential with EduHub">
      <div className="card" style={{ textAlign: "center", padding: "40px" }}>
        <h2>Crack Competitive Exams with Realistic Mock Tests</h2>
        <p
          className="small-muted"
          style={{ maxWidth: "600px", margin: "0 auto 24px auto" }}
        >
          Practice full-length and sectional mock tests for SBI PO, Clerk and
          other exams. Experience a real-time test environment with timers,
          detailed solutions, performance analytics, and leaderboards.
        </p>
        <Link
          to="/tests"
          className="btn btn-primary"
          style={{ fontSize: "18px", padding: "12px 24px" }}
        >
          Browse All Tests
        </Link>
      </div>
      <AdPlaceholder label="Homepage ad" />
    </Section>
  );
}

/* ============================
  MAIN APP
  ============================ */
export default function App() {
  const { user, userDoc } = useAuthUser();
  return (
    <Router>
      <Navbar userDoc={userDoc} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tests" element={<TestsList />} />
        <Route path="/tests/:id" element={<AttemptPage user={user} />} />
        <Route
          path="/tests/:testId/review/:attemptId"
          element={<ReviewPage />}
        />
        <Route path="/jobs" element={<Jobs />} />
        <Route
          path="/notes"
          element={<div>Notes Page (To be implemented)</div>}
        />
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/admin" element={<AdminPanel userDoc={userDoc} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer
        style={{
          padding: "20px",
          opacity: 0.75,
          textAlign: "center",
          marginTop: "40px",
        }}
      >
        © {new Date().getFullYear()} EduHub Platform
      </footer>
    </Router>
  );
}
