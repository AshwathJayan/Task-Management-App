import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { io } from "socket.io-client";
import {
  CheckCircle2, Circle, Clock3, Filter, LogOut, Plus, Search,
  Pencil, Trash2, X, LayoutDashboard, ListTodo, CalendarDays
} from "lucide-react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const api = axios.create({ baseURL: API });

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));

  if (!token) {
    return <Auth onAuth={(data) => {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token); setUser(data.user);
    }} />;
  }

  return <Dashboard token={token} user={user} onLogout={() => {
    localStorage.clear(); setToken(null); setUser(null);
  }} />;
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const url = mode === "login" ? "/auth/login" : "/auth/register";
      const { data } = await api.post(url, form);
      onAuth(data);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand large">Task<span>Flow</span></div>
        <p className="muted">{mode === "login" ? "Welcome back. Let's get things done." : "Create your account and organize your work."}</p>
        <form onSubmit={submit}>
          {mode === "register" && <input placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />}
          <input type="email" placeholder="Email address" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required />
          <input type="password" placeholder="Password (6+ characters)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required minLength="6" />
          {error && <div className="error">{error}</div>}
          <button className="primary full" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="link-btn" onClick={()=>{setMode(mode==="login"?"register":"login");setError("")}}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function Dashboard({ token, user, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  async function load() {
    try {
      const { data } = await api.get("/tasks", { headers, params: { search, status, priority } });
      setTasks(data.tasks);
    } catch (e) { if (e.response?.status === 401) onLogout(); }
  }

  useEffect(() => { load(); }, [search, status, priority]);

  useEffect(() => {
    const socket = io(SOCKET);
    socket.emit("join-user", user.id);
    socket.on("task-created", t => setTasks(prev => prev.some(x=>x._id===t._id) ? prev : [t, ...prev]));
    socket.on("task-updated", t => setTasks(prev => prev.map(x=>x._id===t._id ? t : x)));
    socket.on("task-deleted", ({id}) => setTasks(prev => prev.filter(x=>x._id!==id)));
    return () => socket.disconnect();
  }, [user.id]);

  async function saveTask(payload) {
    try {
      if (editing) {
        const { data } = await api.put(`/tasks/${editing._id}`, payload, { headers });
        setTasks(prev => prev.map(t => t._id === data.task._id ? data.task : t));
        setToast("Task updated");
      } else {
        const { data } = await api.post("/tasks", payload, { headers });
        setTasks(prev => [data.task, ...prev]);
        setToast("Task created");
      }
      setShowForm(false); setEditing(null); setTimeout(()=>setToast(""), 1800);
    } catch (e) { setToast(e.response?.data?.message || "Could not save task"); }
  }

  async function removeTask(id) {
    if (!confirm("Delete this task?")) return;
    try {
      await api.delete(`/tasks/${id}`, { headers });
      setTasks(prev => prev.filter(t=>t._id!==id));
      setToast("Task deleted"); setTimeout(()=>setToast(""), 1800);
    } catch { setToast("Could not delete task"); }
  }

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter(t=>t.status==="todo").length,
    progress: tasks.filter(t=>t.status==="in-progress").length,
    completed: tasks.filter(t=>t.status==="completed").length
  }), [tasks]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Task<span>Flow</span></div>
        <div className="top-actions">
          <span className="welcome">Hi, {user.name}</span>
          <button className="icon-btn" title="Sign out" onClick={onLogout}><LogOut size={18}/></button>
        </div>
      </header>

      <main className="container">
        <div className="hero">
          <div>
            <p className="eyebrow">MY WORKSPACE</p>
            <h1>Task Dashboard</h1>
            <p className="muted">Plan, prioritize and track everything in one place.</p>
          </div>
          <button className="primary" onClick={()=>{setEditing(null);setShowForm(true)}}><Plus size={19}/> New task</button>
        </div>

        <section className="stats">
          <Stat icon={<ListTodo/>} label="Total tasks" value={stats.total}/>
          <Stat icon={<Circle/>} label="To do" value={stats.todo}/>
          <Stat icon={<Clock3/>} label="In progress" value={stats.progress}/>
          <Stat icon={<CheckCircle2/>} label="Completed" value={stats.completed}/>
        </section>

        <section className="toolbar">
          <div className="search"><Search size={18}/><input placeholder="Search tasks..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <div className="select-wrap"><Filter size={16}/><select value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">All status</option><option value="todo">To do</option><option value="in-progress">In progress</option><option value="completed">Completed</option>
          </select></div>
          <select value={priority} onChange={e=>setPriority(e.target.value)}>
            <option value="all">All priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </section>

        <section className="task-grid">
          {tasks.length === 0 ? (
            <div className="empty"><CheckCircle2 size={42}/><h3>No tasks found</h3><p>Create a task or change your filters.</p></div>
          ) : tasks.map(task => (
            <TaskCard key={task._id} task={task}
              onEdit={()=>{setEditing(task);setShowForm(true)}}
              onDelete={()=>removeTask(task._id)}
              onChangeStatus={async s => {
                const {data}=await api.put(`/tasks/${task._id}`,{status:s},{headers});
                setTasks(prev=>prev.map(t=>t._id===task._id?data.task:t));
              }}
            />
          ))}
        </section>
      </main>

      {showForm && <TaskModal task={editing} onClose={()=>{setShowForm(false);setEditing(null)}} onSave={saveTask}/>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Stat({icon,label,value}) {
  return <div className="stat"><div className="stat-icon">{icon}</div><div><div className="stat-value">{value}</div><div className="muted">{label}</div></div></div>
}

function TaskCard({task,onEdit,onDelete,onChangeStatus}) {
  return (
    <article className="task-card">
      <div className="task-head">
        <button className={`check ${task.status==="completed"?"done":""}`} onClick={()=>onChangeStatus(task.status==="completed"?"todo":"completed")}>
          {task.status==="completed" ? <CheckCircle2 size={22}/> : <Circle size={22}/>}
        </button>
        <div className="task-title-area"><h3 className={task.status==="completed"?"strike":""}>{task.title}</h3><span className={`badge ${task.priority}`}>{task.priority}</span></div>
        <div className="card-actions"><button onClick={onEdit}><Pencil size={17}/></button><button onClick={onDelete}><Trash2 size={17}/></button></div>
      </div>
      {task.description && <p className="description">{task.description}</p>}
      <div className="task-footer">
        <select value={task.status} onChange={e=>onChangeStatus(e.target.value)}>
          <option value="todo">To do</option><option value="in-progress">In progress</option><option value="completed">Completed</option>
        </select>
        {task.dueDate && <span className="due"><CalendarDays size={14}/>{new Date(task.dueDate).toLocaleDateString()}</span>}
      </div>
    </article>
  );
}

function TaskModal({task,onClose,onSave}) {
  const [form,setForm]=useState(task ? {
    title:task.title, description:task.description, status:task.status, priority:task.priority,
    dueDate:task.dueDate ? new Date(task.dueDate).toISOString().slice(0,10) : ""
  } : {title:"",description:"",status:"todo",priority:"medium",dueDate:""});
  return <div className="modal-backdrop">
    <div className="modal">
      <div className="modal-head"><div><p className="eyebrow">{task?"EDIT TASK":"NEW TASK"}</p><h2>{task?"Update task":"Create a task"}</h2></div><button onClick={onClose}><X/></button></div>
      <label>Title<input autoFocus value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Finish project report"/></label>
      <label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Add some details..."/></label>
      <div className="form-row"><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="todo">To do</option><option value="in-progress">In progress</option><option value="completed">Completed</option></select></label>
      <label>Priority<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div>
      <label>Due date<input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label>
      <div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={()=>onSave(form)} disabled={!form.title.trim()}>{task?"Save changes":"Create task"}</button></div>
    </div>
  </div>
}

createRoot(document.getElementById("root")).render(<App />);
