// App.js
import React, { useCallback, useEffect, useRef, useState } from "react"; // Added useCallback
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
  Small mobile-first styles
  ============================ */
const mobileWrap = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 14,
  fontFamily: "Inter, Roboto, system-ui, -apple-system, sans-serif",
  color: "#111827",
};
const card = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  boxSizing: "border-box",
};
const btn = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "#0f172a",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};
const btnGhost = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #e5e7eb",
  cursor: "pointer",
};
const input = {
  width: "100%",
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  marginBottom: 10,
  boxSizing: "border-box",
};
const smallMuted = { fontSize: 12, color: "#6b7280" };

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
        border: "1px dashed #e5e7eb",
        padding: 8,
        borderRadius: 8,
        textAlign: "center",
        margin: "10px 0",
        background: "#fff",
      }}
    >
      <small style={{ color: "#6b7280" }}>{label} — AdSense placeholder</small>
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
  Handles both sectional and non-sectional
  Returns totals and sectionScores array
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

  if (!hasSections) {
    return { totalScore, totalMarks, totalQuestions, sectionScores: [] };
  } else {
    return { totalScore, totalMarks, totalQuestions, sectionScores };
  }
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
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          ...mobileWrap,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link to="/" style={{ textDecoration: "none", color: "#0f172a" }}>
          <strong style={{ fontSize: 18 }}>SBI Prep • EduHub</strong>
        </Link>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <Link to="/tests" style={{ ...btnGhost, padding: "8px 10px" }}>
            Tests
          </Link>
          <Link to="/jobs" style={{ ...btnGhost, padding: "8px 10px" }}>
            Jobs
          </Link>
          <Link to="/notes" style={{ ...btnGhost, padding: "8px 10px" }}>
            Notes
          </Link>
          <Link to="/dashboard" style={{ ...btnGhost, padding: "8px 10px" }}>
            Dashboard
          </Link>
          {userDoc?.role === "admin" && (
            <Link to="/admin" style={{ ...btnGhost, padding: "8px 10px" }}>
              Admin
            </Link>
          )}
          {!userDoc ? (
            <button onClick={login} style={btn}>
              Login
            </button>
          ) : (
            <button onClick={logout} style={btn}>
              Logout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================
  SECTION wrapper component
  ============================ */
function Section({ title, actions, children }) {
  useEffect(() => {
    if (title) document.title = `${title} — SBI Prep`;
  }, [title]);

  return (
    <section style={{ ...mobileWrap, paddingTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        {actions}
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
        <div style={card}>
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
            style={tab === "tests" ? btn : btnGhost}
            onClick={() => setTab("tests")}
          >
            Mock Tests
          </button>
          <button
            style={tab === "jobs" ? btn : btnGhost}
            onClick={() => setTab("jobs")}
          >
            Jobs
          </button>
          <button
            style={tab === "notes" ? btn : btnGhost}
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>
          {editingId ? "Edit Test" : "Create Mock Test"}
        </h3>
        <input
          style={input}
          value={form.title}
          placeholder="Title"
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          style={{ ...input, minHeight: 80 }}
          value={form.description}
          placeholder="Description"
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...input, flex: 1 }}
            type="number"
            min={5}
            max={180}
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
            placeholder="Duration (minutes)"
          />
          <select
            style={{ ...input, width: 160 }}
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
              <button style={btn} onClick={addSection}>
                + Add Section
              </button>
              <button style={btnGhost} onClick={importJSON}>
                Import Questions JSON
              </button>
            </div>
            {(form.sections || []).map((s, si) => (
              <div key={si} style={{ ...card, marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    style={{ ...input, marginBottom: 0 }}
                    value={s.name}
                    onChange={(e) => {
                      const c = JSON.parse(JSON.stringify(form));
                      c.sections[si].name = e.target.value;
                      setForm(c);
                    }}
                  />
                  <button
                    style={btnGhost}
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
                  <div key={qi} style={{ ...card, marginTop: 8 }}>
                    <input
                      style={input}
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
                        style={input}
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
                      style={{ ...input, minHeight: 60 }}
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
                        style={{ ...input, flex: 1 }}
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
                        style={{ ...input, width: 100 }}
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
                        style={btnGhost}
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
                  <button style={btn} onClick={() => addQToSection(si)}>
                    + Add Question
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button style={btn} onClick={addFlatQuestion}>
                + Add Question
              </button>
              <button style={btnGhost} onClick={importJSON}>
                Import Questions JSON
              </button>
            </div>
            {(form.questions || []).map((q, qi) => (
              <div key={qi} style={{ ...card, marginBottom: 8 }}>
                <input
                  style={input}
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
                    style={input}
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
                  style={{ ...input, minHeight: 60 }}
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
                    style={{ ...input, flex: 1 }}
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
                    style={{ ...input, width: 100 }}
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
                    style={btnGhost}
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

        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onClick={save}>
            {editingId ? "Save Changes" : "Create Test"}
          </button>
          {editingId && (
            <button
              style={btnGhost}
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

      <div style={card}>
        <h4 style={{ marginTop: 0 }}>Existing Tests</h4>
        {list.map((t) => (
          <div
            key={t.id}
            style={{ borderBottom: "1px dashed #e5e7eb", padding: "8px 0" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{t.title}</strong>
                <div style={smallMuted}>
                  {t.totalQuestions || t.questions?.length || 0} Q •{" "}
                  {t.duration} min • {t.difficulty}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btnGhost} onClick={() => edit(t)}>
                  Edit
                </button>
                <button style={btnGhost} onClick={() => remove(t.id)}>
                  Delete
                </button>
                <Link to={`/tests/${t.id}`} style={btnGhost}>
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
    <div style={{ display: "grid", gap: 12 }}>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{editing ? "Edit Job" : "Post Job"}</h3>
        <input
          style={input}
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          style={input}
          placeholder="Department"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
        />
        <input
          style={input}
          placeholder="State"
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
        />
        <label style={smallMuted}>Last Date</label>
        <input
          style={input}
          type="date"
          value={form.lastDate}
          onChange={(e) => setForm({ ...form, lastDate: e.target.value })}
        />
        <input
          style={input}
          placeholder="Eligibility"
          value={form.eligibility}
          onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
        />
        <input
          style={input}
          placeholder="Apply Link"
          value={form.applyLink}
          onChange={(e) => setForm({ ...form, applyLink: e.target.value })}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn} onClick={save}>
            {editing ? "Save" : "Post"}
          </button>
          {editing && (
            <button
              style={btnGhost}
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

      <div style={card}>
        <h4 style={{ marginTop: 0 }}>Existing Jobs</h4>
        {list.map((j) => (
          <div
            key={j.id}
            style={{ borderBottom: "1px dashed #e5e7eb", padding: "8px 0" }}
          >
            <strong>{j.title}</strong>
            <div style={smallMuted}>
              {j.department} • {j.state || "—"} • Last: {j.lastDate || "—"}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button style={btnGhost} onClick={() => edit(j)}>
                Edit
              </button>
              <button style={btnGhost} onClick={() => remove(j.id)}>
                Delete
              </button>
              <a
                href={j.applyLink}
                rel="noreferrer"
                target="_blank"
                style={btnGhost}
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
  ADMIN: Notes (upload)
  ============================ */
function AdminNotes() {
  const initial = {
    title: "",
    exam: "SBI",
    subject: "",
    topic: "",
    description: "",
    fileUrl: "",
    fileName: "",
  };
  const [form, setForm] = useState(initial);
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "notes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  const onFile = async (f) => {
    if (!f) return;
    setUploading(true);
    try {
      const ext = f.name.split(".").pop();
      const key = `notes/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const r = ref(storage, key);
      await uploadBytes(r, f);
      const url = await getDownloadURL(r);
      setForm((s) => ({ ...s, fileUrl: url, fileName: f.name }));
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title || !form.fileUrl) {
      alert("Title and file required");
      return;
    }
    const payload = { ...form, downloads: 0, createdAt: serverTimestamp() };
    try {
      if (editing) {
        await updateDoc(doc(db, "notes", editing), payload);
        setEditing(null);
      } else await addDoc(collection(db, "notes"), payload);
      setForm(initial);
    } catch (e) {
      console.error(e);
      alert("Failed");
    }
  };
  const edit = (n) => {
    setEditing(n.id);
    setForm({
      title: n.title,
      exam: n.exam,
      subject: n.subject,
      topic: n.topic,
      description: n.description,
      fileUrl: n.fileUrl,
      fileName: n.fileName,
    });
  };
  const remove = async (id) => {
    if (!window.confirm("Delete note?")) return;
    await deleteDoc(doc(db, "notes", id));
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>
          {editing ? "Edit Note" : "Upload Note"}
        </h3>
        <input
          style={input}
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...input, flex: 1 }}
            placeholder="Exam"
            value={form.exam}
            onChange={(e) => setForm({ ...form, exam: e.target.value })}
          />
          <input
            style={{ ...input, flex: 1 }}
            placeholder="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </div>
        <input
          style={input}
          placeholder="Topic"
          value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })}
        />
        <textarea
          style={{ ...input, minHeight: 80 }}
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {uploading ? (
            <small>Uploading…</small>
          ) : form.fileName ? (
            <small>{form.fileName}</small>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={btn} onClick={save}>
            {editing ? "Save" : "Upload"}
          </button>
          {editing && (
            <button
              style={btnGhost}
              onClick={() => {
                setEditing(null);
                setForm(initial);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div style={card}>
        <h4 style={{ marginTop: 0 }}>Existing Notes</h4>
        {list.map((n) => (
          <div
            key={n.id}
            style={{ borderBottom: "1px dashed #e5e7eb", padding: "8px 0" }}
          >
            <strong>{n.title}</strong>
            <div style={smallMuted}>
              {n.exam} • {n.subject} • {n.topic} • Downloads: {n.downloads || 0}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button style={btnGhost} onClick={() => edit(n)}>
                Edit
              </button>
              <button style={btnGhost} onClick={() => remove(n.id)}>
                Delete
              </button>
              <a
                href={n.fileUrl}
                target="_blank"
                rel="noreferrer"
                style={btnGhost}
              >
                View
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
        <Link to="/dashboard" style={btnGhost}>
          My Dashboard
        </Link>
      }
    >
      <AdPlaceholder label="Top banner ad" />
      <div style={{ display: "grid", gap: 12 }}>
        {list.map((t) => (
          <Link
            key={t.id}
            to={`/tests/${t.id}`}
            style={{ textDecoration: "none", color: "#111827" }}
          >
            <div style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ marginTop: 0 }}>{t.title}</h3>
                  <div style={smallMuted}>
                    {t.totalQuestions || t.questions?.length || 0} Q •{" "}
                    {t.duration} min • {t.difficulty}
                  </div>
                </div>
                <div>
                  <button style={btn}>Start</button>
                </div>
              </div>
              <p style={{ marginTop: 8, opacity: 0.85 }}>{t.description}</p>
            </div>
          </Link>
        ))}
      </div>
      <AdPlaceholder label="Between list ad" />
    </Section>
  );
}

/* ============================
  ATTEMPT PAGE
  dynamic for sectional / non-sectional
  timer, auto-save, auto-submit, mark, navigator
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
  const [marked, setMarked] = useState({});
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);

  const LS_KEY = `attempt_${id}`;

  const submitAttempt = useCallback(
    async (auto = false) => {
      if (!test || !user) return;
      setSaving(true);
      try {
        const res = calculateResults(test, answers);
        const payload = {
          userId: user.uid,
          username: user.displayName || user.email,
          mockTestId: test.id,
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
    [answers, LS_KEY, navigate, secondsLeft, test, user]
  );

  const autoSubmit = useCallback(async () => {
    await submitAttempt(true);
  }, [submitAttempt]);

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
            setMarked(parsed.marked || {});
            setCurrent(parsed.current || { section: 0, idx: 0 });
            const elapsed = Math.floor((Date.now() - parsed.startedAt) / 1000);
            const left = Math.max(0, t.duration * 60 - elapsed);
            setSecondsLeft(left);
            if (left === 0) {
              await autoSubmit();
            }
            return;
          }
        } catch (e) {
          /* ignore */
        }
      }

      const now = Date.now();
      setStartedAt(now);
      if (!t.hasSections) {
        setAnswers(Array((t.questions || []).length).fill(null));
      } else {
        const obj = {};
        (t.sections || []).forEach(
          (s, si) => (obj[si] = Array((s.questions || []).length).fill(null))
        );
        setAnswers(obj);
      }
      setSecondsLeft(t.duration * 60);
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          testId: id,
          startedAt: now,
          answers: !t.hasSections
            ? Array((t.questions || []).length).fill(null)
            : {},
          current: { section: 0, idx: 0 },
          marked: {},
        })
      );
    })();
  }, [id, LS_KEY, autoSubmit]);

  const handleAutoSubmit = useCallback(() => submitAttempt(true), [submitAttempt]);

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
        JSON.stringify({ testId: id, startedAt, answers, current, marked })
      );
    }, 8000);
    return () => clearInterval(iv);
  }, [answers, current, marked, test, startedAt, id, LS_KEY]);

  if (loading)
    return (
      <Section title="Loading...">
        <div style={card}>Loading test...</div>
      </Section>
    );
  if (!test)
    return (
      <Section title="Not found">
        <div style={card}>Test not found.</div>
      </Section>
    );
  if (!user)
    return (
      <Section title="Login required">
        <div style={card}>Please login to attempt the test.</div>
      </Section>
    );

  const isSectional = !!test.hasSections;

  const getCurrentQuestion = () => {
    if (!isSectional) return test.questions[current.idx];
    return (test.sections[current.section].questions || [])[current.idx];
  };

  const selectOption = (o) => {
    if (!isSectional) {
      const a = [...answers];
      a[current.idx] = o;
      setAnswers(a);
    } else {
      const copy = JSON.parse(JSON.stringify(answers));
      copy[current.section][current.idx] = o;
      setAnswers(copy);
    }
  };

  const toggleMark = () => {
    const key = `${current.section}_${current.idx}`;
    const copy = { ...marked };
    if (copy[key]) delete copy[key];
    else copy[key] = true;
    setMarked(copy);
  };

  const confirmSubmit = () => {
    if (!window.confirm("Submit test now?")) return;
    submitAttempt(false);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const Navigator = () => {
    if (!isSectional) {
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(answers || []).map((a, i) => (
            <button
              key={i}
              onClick={() => setCurrent({ section: 0, idx: i })}
              style={{
                ...btnGhost,
                width: 40,
                padding: "8px 6px",
                borderColor:
                  current.idx === i
                    ? "#0f172a"
                    : a !== null
                    ? "#16a34a"
                    : "#e5e7eb",
                background:
                  current.idx === i
                    ? "#f3f4f6"
                    : a !== null
                    ? "#eaffea"
                    : "#fff",
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      );
    } else {
      return (
        <div>
          {(test.sections || []).map((s, si) => (
            <div key={si} style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong>{s.name}</strong>
                <div style={smallMuted}>{(s.questions || []).length} Q</div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                {(s.questions || []).map((q, qi) => (
                  <button
                    key={qi}
                    onClick={() => setCurrent({ section: si, idx: qi })}
                    style={{
                      ...btnGhost,
                      width: 40,
                      padding: "8px 6px",
                      borderColor:
                        current.section === si && current.idx === qi
                          ? "#0f172a"
                          : answers?.[si]?.[qi] !== null
                          ? "#16a34a"
                          : "#e5e7eb",
                      background:
                        current.section === si && current.idx === qi
                          ? "#f3f4f6"
                          : answers?.[si]?.[qi] !== null
                          ? "#eaffea"
                          : "#fff",
                    }}
                  >
                    {qi + 1}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <Section
      title={test.title}
      actions={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: secondsLeft <= 300 ? "#ef4444" : "#16a34a",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          <div
            style={{
              width: 120,
              height: 8,
              background: "#f3f4f6",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(
                      ((test.duration * 60 - secondsLeft) /
                        (test.duration * 60)) *
                        100
                    )
                  )
                )}%`,
                height: 8,
                background: "#0f172a",
              }}
            />
          </div>
          <button style={btnGhost} onClick={toggleMark}>
            Mark
          </button>
          <button style={btn} onClick={confirmSubmit} disabled={saving}>
            {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>
                Q {isSectional ? `${current.idx + 1}` : `${current.idx + 1}`}
              </strong>{" "}
              <span style={smallMuted}>
                {isSectional ? test.sections[current.section]?.name : ""}
              </span>
            </div>
            <div style={smallMuted}>Marked: {Object.keys(marked).length}</div>
          </div>
          <div style={{ marginTop: 8 }}>{getCurrentQuestion()?.q}</div>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {getCurrentQuestion()?.options?.map((op, oi) => {
              const chosen = isSectional
                ? answers?.[current.section]?.[current.idx]
                : answers?.[current.idx];
              const active = chosen === oi;
              return (
                <button
                  key={oi}
                  onClick={() => selectOption(oi)}
                  style={{
                    textAlign: "left",
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    background: active ? "#e6ffed" : "#fff",
                  }}
                >
                  <strong style={{ marginRight: 8 }}>
                    {String.fromCharCode(65 + oi)}.
                  </strong>{" "}
                  {op}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              style={btnGhost}
              onClick={() => {
                if (isSectional) {
                  if (current.idx > 0)
                    setCurrent((c) => ({ ...c, idx: c.idx - 1 }));
                  else if (current.section > 0) {
                    const prev = current.section - 1;
                    setCurrent({
                      section: prev,
                      idx: (test.sections[prev].questions || []).length - 1,
                    });
                  }
                } else {
                  setCurrent((c) => ({ ...c, idx: Math.max(0, c.idx - 1) }));
                }
              }}
            >
              Previous
            </button>

            {isSectional ? (
              current.idx <
              test.sections[current.section].questions.length - 1 ? (
                <button
                  style={btn}
                  onClick={() => setCurrent((c) => ({ ...c, idx: c.idx + 1 }))}
                >
                  Next
                </button>
              ) : (
                <button
                  style={btn}
                  onClick={() => {
                    let moved = false;
                    for (
                      let s = current.section + 1;
                      s < test.sections.length;
                      s++
                    ) {
                      if ((test.sections[s].questions || []).length > 0) {
                        setCurrent({ section: s, idx: 0 });
                        moved = true;
                        break;
                      }
                    }
                    if (!moved) alert("End of test. Submit when ready.");
                  }}
                >
                  Next Section
                </button>
              )
            ) : current.idx < test.questions.length - 1 ? (
              <button
                style={btn}
                onClick={() => setCurrent((c) => ({ ...c, idx: c.idx + 1 }))}
              >
                Next
              </button>
            ) : (
              <button style={btn} onClick={confirmSubmit}>
                Submit
              </button>
            )}
          </div>
        </div>

        <div style={card}>
          <h4 style={{ marginTop: 0 }}>Navigator</h4>
          <Navigator />
        </div>

        <div style={card}>
          <h4 style={{ marginTop: 0 }}>Marked Questions</h4>
          {Object.keys(marked).length === 0 ? (
            <div>No marked questions</div>
          ) : (
            Object.keys(marked).map((k) => {
              const [si, qi] = k.split("_").map(Number);
              return (
                <button
                  key={k}
                  style={{ ...btnGhost, marginRight: 6, marginTop: 6 }}
                  onClick={() => setCurrent({ section: si, idx: qi })}
                >
                  Go Q{qi + 1} (S{si + 1})
                </button>
              );
            })
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <small style={smallMuted}>
            Autosaves every 8s. Timer will continue if you refresh the page.
          </small>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={btnGhost}
              onClick={() => {
                localStorage.setItem(
                  LS_KEY,
                  JSON.stringify({
                    testId: id,
                    startedAt,
                    answers,
                    current,
                    marked,
                  })
                );
                alert("Saved locally");
              }}
            >
              Save Locally
            </button>
            <button
              style={btnGhost}
              onClick={() => {
                localStorage.removeItem(LS_KEY);
                alert("Local draft cleared");
              }}
            >
              Clear Draft
            </button>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <AdPlaceholder label="Inline ad (after questions)" />
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 10,
          background: "#ffffff",
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          gap: 8,
          justifyContent: "center",
        }}
      >
        <button
          style={{ ...btnGhost, width: 120 }}
          onClick={() => {
            toggleMark();
          }}
        >
          {marked[`${current.section}_${current.idx}`] ? "Unmark" : "Mark"}
        </button>
        <button style={{ ...btn, width: 120 }} onClick={confirmSubmit}>
          {saving ? "Submitting..." : "Submit"}
        </button>
      </div>
    </Section>
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
      <Section title="Loading...">
        <div style={card}>Loading...</div>
      </Section>
    );
  if (!attempt || !test)
    return (
      <Section title="Not found">
        <div style={card}>Not found.</div>
      </Section>
    );

  const userAnswers = attempt.answers || (test.hasSections ? {} : []);
  const res = calculateResults(test, userAnswers);

  // FIX: Removed unused 'correct' variable
  let corr = 0,
    wr = 0,
    sk = 0;
  if (!test.hasSections) {
    (test.questions || []).forEach((q, i) => {
      const ua = userAnswers[i];
      if (ua === null || ua === undefined) sk++;
      else if (ua === q.ans) corr++;
      else wr++;
    });
  } else {
    (test.sections || []).forEach((s, si) => {
      (s.questions || []).forEach((q, qi) => {
        const ua = (userAnswers[si] || [])[qi];
        if (ua === null || ua === undefined) sk++;
        else if (ua === q.ans) corr++;
        else wr++;
      });
    });
  }
  const pieData = [
    { name: "Correct", value: corr },
    { name: "Wrong", value: wr },
    { name: "Skipped", value: sk },
  ];
  const COLORS = ["#16a34a", "#ef4444", "#f59e0b"];

  return (
    <Section title={`Review — ${test.title}`}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>
            Score: {attempt.totalScore} / {attempt.totalMarks || res.totalMarks}
          </h3>
          <div>
            Time:{" "}
            {String(Math.floor((attempt.timeTakenSec || 0) / 60)).padStart(
              2,
              "0"
            )}
            :{String((attempt.timeTakenSec || 0) % 60).padStart(2, "0")}
          </div>
          <div style={{ marginTop: 8 }}>
            <AdPlaceholder label="Result page ad" />
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <h4 style={{ marginTop: 0 }}>Analytics</h4>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={70}
                    label
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {res.sectionScores.length > 0 && (
              <div style={{ height: 240, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={
                      attempt.sectionScores && attempt.sectionScores.length
                        ? attempt.sectionScores
                        : res.sectionScores
                    }
                  >
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="score" fill="#2563eb" />
                    <Bar dataKey="marks" fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div style={card}>
            <h4 style={{ marginTop: 0 }}>Leaderboard (Top 10)</h4>
            <Leaderboard testId={test.id} showUser={attempt.userId} />
          </div>

          <div style={card}>
            <h4 style={{ marginTop: 0 }}>Detailed Solutions</h4>
            {!test.hasSections
              ? (test.questions || []).map((q, i) => {
                  const ua = (userAnswers || [])[i];
                  const ok = ua === q.ans;
                  return (
                    <div key={i} style={{ ...card, marginBottom: 8 }}>
                      <div>
                        <strong>Q{i + 1}.</strong> {q.q}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        {q.options.map((op, oi) => (
                          <div
                            key={oi}
                            style={{
                              padding: 8,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              background:
                                oi === q.ans
                                  ? "#ecfdf5"
                                  : oi === ua
                                  ? "#fff1f2"
                                  : "#fff",
                              marginBottom: 6,
                            }}
                          >
                            <strong>{String.fromCharCode(65 + oi)}.</strong>{" "}
                            {op}
                          </div>
                        ))}
                      </div>
                      <div style={{ color: ok ? "#16a34a" : "#ef4444" }}>
                        {ok
                          ? "Correct"
                          : `Incorrect — Correct: ${String.fromCharCode(
                              65 + q.ans
                            )}`}
                      </div>
                      {q.solution && (
                        <div
                          style={{
                            marginTop: 8,
                            background: "#f8fafc",
                            padding: 10,
                            borderRadius: 8,
                          }}
                        >
                          <strong>Solution:</strong>
                          <div>{q.solution}</div>
                        </div>
                      )}
                    </div>
                  );
                })
              : test.sections.map((s, si) => (
                  <div key={si} style={{ marginBottom: 12 }}>
                    <h4 style={{ marginTop: 0 }}>{s.name}</h4>
                    {(s.questions || []).map((q, qi) => {
                      const ua = (userAnswers[si] || [])[qi];
                      const ok = ua === q.ans;
                      return (
                        <div key={qi} style={{ ...card, marginBottom: 8 }}>
                          <div>
                            <strong>Q{qi + 1}.</strong> {q.q}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {q.options.map((op, oi) => (
                              <div
                                key={oi}
                                style={{
                                  padding: 8,
                                  borderRadius: 8,
                                  border: "1px solid #e5e7eb",
                                  background:
                                    oi === q.ans
                                      ? "#ecfdf5"
                                      : oi === ua
                                      ? "#fff1f2"
                                      : "#fff",
                                  marginBottom: 6,
                                }}
                              >
                                <strong>{String.fromCharCode(65 + oi)}.</strong>{" "}
                                {op}
                              </div>
                            ))}
                          </div>
                          <div style={{ color: ok ? "#16a34a" : "#ef4444" }}>
                            {ok
                              ? "Correct"
                              : `Incorrect — Correct: ${String.fromCharCode(
                                  65 + q.ans
                                )}`}
                          </div>
                          {q.solution && (
                            <div
                              style={{
                                marginTop: 8,
                                background: "#f8fafc",
                                padding: 10,
                                borderRadius: 8,
                              }}
                            >
                              <strong>Solution:</strong>
                              <div>{q.solution}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

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
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) =>
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [testId]);

  if (rows.length === 0) return <div>No attempts yet.</div>;
  return (
    <div>
      {rows.map((r, i) => (
        <div
          key={r.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 0",
            borderBottom: "1px dashed #f1f5f9",
          }}
        >
          <div>
            #{i + 1} {r.userId === showUser ? "(You)" : ""}
          </div>
          <div style={{ opacity: 0.85 }}>{r.username || r.userId}</div>
          <div>
            {r.totalScore} / {r.totalMarks || r.totalQuestions}
          </div>
          <div>
            {String(Math.floor((r.timeTakenSec || 0) / 60)).padStart(2, "0")}:
            {String((r.timeTakenSec || 0) % 60).padStart(2, "0")}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================
  JOBS page
  ============================ */
function Jobs() {
  const [list, setList] = useState([]);
  const [qText, setQText] = useState("");
  const [dept, setDept] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useState("latest");

  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  const filtered = list
    .filter((j) =>
      qText ? j.title?.toLowerCase().includes(qText.toLowerCase()) : true
    )
    .filter((j) =>
      dept
        ? (j.department || "").toLowerCase().includes(dept.toLowerCase())
        : true
    )
    .filter((j) =>
      state ? (j.state || "").toLowerCase().includes(state.toLowerCase()) : true
    )
    .sort((a, b) => {
      if (sort === "closing") {
        const ad = a.lastDate ? new Date(a.lastDate).getTime() : Infinity;
        const bd = b.lastDate ? new Date(b.lastDate).getTime() : Infinity;
        return ad - bd;
      }
      return 0;
    });

  return (
    <Section title="Jobs">
      <div style={card}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
          }}
        >
          <input
            style={input}
            placeholder="Search title..."
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />
          <input
            style={input}
            placeholder="Department"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          />
          <input
            style={input}
            placeholder="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <select
            style={input}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="latest">Latest</option>
            <option value="closing">Closing Soon</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((j) => (
          <div key={j.id} style={card}>
            <h3 style={{ marginTop: 0 }}>{j.title}</h3>
            <div style={smallMuted}>
              {j.department} • {j.state || "—"}
            </div>
            {j.lastDate && (
              <div style={{ marginTop: 6 }}>Last Date: {j.lastDate}</div>
            )}
            <div style={{ marginTop: 8 }}>
              <strong>Eligibility:</strong> {j.eligibility}
            </div>
            <a
              href={j.applyLink}
              rel="noreferrer"
              target="_blank"
              style={{ ...btnGhost, marginTop: 8, display: "inline-block" }}
            >
              Apply
            </a>
          </div>
        ))}
        {filtered.length === 0 && <div>No jobs found.</div>}
      </div>
      <AdPlaceholder label="Jobs page ad" />
    </Section>
  );
}

/* ============================
  NOTES page (preview + download)
  ============================ */
function Notes() {
  const [list, setList] = useState([]);
  const [exam, setExam] = useState("");
  const [subject, setSubject] = useState("");
  const [qText, setQText] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "notes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) =>
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  const filtered = list
    .filter((n) =>
      exam ? (n.exam || "").toLowerCase().includes(exam.toLowerCase()) : true
    )
    .filter((n) =>
      subject
        ? (n.subject || "").toLowerCase().includes(subject.toLowerCase())
        : true
    )
    .filter((n) =>
      qText ? (n.title || "").toLowerCase().includes(qText.toLowerCase()) : true
    );

  const incDownload = async (note) => {
    try {
      await updateDoc(doc(db, "notes", note.id), {
        downloads: (note.downloads || 0) + 1,
      });
    } catch (e) {
      /* ignore */
    }
    window.open(note.fileUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Section title="Study Notes">
      <div style={card}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...input, flex: 1 }}
            placeholder="Exam (e.g., SBI)"
            value={exam}
            onChange={(e) => setExam(e.target.value)}
          />
          <input
            style={{ ...input, flex: 1 }}
            placeholder="Subject (e.g., Quant)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <input
          style={input}
          placeholder="Search title..."
          value={qText}
          onChange={(e) => setQText(e.target.value)}
        />
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((n) => (
          <div key={n.id} style={card}>
            <h3 style={{ marginTop: 0 }}>{n.title}</h3>
            <div style={smallMuted}>
              {n.exam} • {n.subject} • {n.topic}
            </div>
            {n.description && (
              <div style={{ marginTop: 6 }}>{n.description}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={btnGhost} onClick={() => setPreview(n)}>
                Preview
              </button>
              <button style={btn} onClick={() => incDownload(n)}>
                Download ({n.downloads || 0})
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div>No notes found.</div>}
      </div>

      {preview && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>Preview: {preview.title}</strong>
            <button style={btnGhost} onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
          {preview.fileUrl?.toLowerCase().endsWith(".pdf") ? (
            <iframe
              title="preview"
              src={preview.fileUrl}
              style={{ width: "100%", height: 560, border: 0, marginTop: 8 }}
            />
          ) : (
            <div style={{ marginTop: 8 }}>
              Preview not supported: download to view.
            </div>
          )}
        </div>
      )}
    </Section>
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

  return (
    <Section title="My Dashboard">
      <div style={card}>
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
              Test: <code>{a.mockTestId}</code>
            </div>
            <div>
              Score: <strong>{a.totalScore}</strong> /{" "}
              {a.totalMarks || a.totalQuestions}
            </div>
            <div>
              Time:{" "}
              {String(Math.floor((a.timeTakenSec || 0) / 60)).padStart(2, "0")}:
              {String((a.timeTakenSec || 0) % 60).padStart(2, "0")}
            </div>
            <div style={{ marginTop: 6 }}>
              <Link
                to={`/tests/${a.mockTestId}/review/${a.id}`}
                style={btnGhost}
              >
                View Review
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============================
  HOME
  ============================ */
function Home() {
  return (
    <Section
      title="Crack SBI Exams with Structured Mock Tests"
      actions={
        <Link to="/tests" style={btnGhost}>
          Browse Tests
        </Link>
      }
    >
      <div style={card}>
        <p>
          Practice full-length and sectional mock tests for SBI PO, Clerk and
          other exams. Timer, solutions, analytics, leaderboards — mobile
          friendly.
        </p>
        <ul>
          <li>Admin can create sectional or flat tests with solutions</li>
          <li>
            Students can attempt tests, view solutions, and check leaderboards
          </li>
        </ul>
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
        <Route path="/notes" element={<Notes />} />
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/admin" element={<AdminPanel userDoc={userDoc} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer
        style={{
          ...mobileWrap,
          padding: 14,
          opacity: 0.75,
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()} SBI Prep — EduHub
      </footer>
    </Router>
  );
}