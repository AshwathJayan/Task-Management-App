import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "http://localhost:5173" }
});

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  status: { type: String, enum: ["todo", "in-progress", "completed"], default: "todo" },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  dueDate: { type: Date, default: null }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Task = mongoose.model("Task", taskSchema);

function makeToken(user) {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required" });
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).id;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "All fields are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "Email already registered" });

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hash });
    res.status(201).json({
      token: makeToken(user),
      user: { id: user._id, name: user.name, email: user.email }
    });
    } catch (e) {
    console.error("REGISTRATION ERROR:", e);
    res.status(500).json({ message: "Registration failed", error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user || !(await bcrypt.compare(password || "", user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({
      token: makeToken(user),
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch {
    res.status(500).json({ message: "Login failed" });
  }
});

app.get("/api/auth/me", auth, async (req, res) => {
  const user = await User.findById(req.userId).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user: { id: user._id, name: user.name, email: user.email } });
});

app.get("/api/tasks", auth, async (req, res) => {
  const { status, priority, search } = req.query;
  const filter = { userId: req.userId };
  if (status && status !== "all") filter.status = status;
  if (priority && priority !== "all") filter.priority = priority;
  if (search) filter.$or = [
    { title: { $regex: search, $options: "i" } },
    { description: { $regex: search, $options: "i" } }
  ];
  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  res.json({ tasks });
});

app.post("/api/tasks", auth, async (req, res) => {
  try {
    const { title, description, status, priority, dueDate } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
    const task = await Task.create({
      userId: req.userId,
      title: title.trim(),
      description: description || "",
      status: status || "todo",
      priority: priority || "medium",
      dueDate: dueDate || null
    });
    io.to(req.userId).emit("task-created", task);
    res.status(201).json({ task });
  } catch {
    res.status(500).json({ message: "Could not create task" });
  }
});

app.put("/api/tasks/:id", auth, async (req, res) => {
  try {
    const allowed = ["title", "description", "status", "priority", "dueDate"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: "Task not found" });
    io.to(req.userId).emit("task-updated", task);
    res.json({ task });
  } catch {
    res.status(500).json({ message: "Could not update task" });
  }
});

app.delete("/api/tasks/:id", auth, async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!task) return res.status(404).json({ message: "Task not found" });
  io.to(req.userId).emit("task-deleted", { id: req.params.id });
  res.json({ message: "Task deleted" });
});

io.on("connection", socket => {
  socket.on("join-user", userId => {
    if (typeof userId === "string") socket.join(userId);
  });
});

const port = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/task_manager")
  .then(() => server.listen(port, () => console.log(`API running on http://localhost:${port}`)))
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
