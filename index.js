const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
dotenv.config();

const fetch = (...args) =>
	import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = 3000;

// Logging Middleware
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
	const originalSend = res.send;
	res.send = function (body) {
		console.log(
			`[${new Date().toISOString()}] Response Headers:`,
			res.getHeaders()
		);
		return originalSend.call(this, body);
	};
	next();
});

// CORS Middleware
const allowedOrigins = [
	"http://localhost:5173",
	"https://king-eta-cyan.vercel.app",
	"https://kingrewardsroobet.vercel.app",
	"https://mister-tee.vercel.app/Leaderboards",
	"https://louiskhz.vercel.app",
	"https://tacopoju-dun.vercel.app",
	"https://luckyw.vercel.app",
	"https://www.luckywrewards.com"
];

app.use(
	cors({
		origin: function (origin, callback) {
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			} else {
				return callback(new Error("CORS policy: This origin is not allowed"));
			}
		},
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

app.use(express.json());

// ❌ REMOVED: MongoDB Connection
// ❌ REMOVED: mongoose
// ❌ REMOVED: User model
// ❌ REMOVED: SlotCall model

// Dummy data storage for users (temporary)
let users = [];

// Auth Routes
app.post("/api/auth/register", async (req, res) => {
	const { kickUsername, rainbetUsername, password, confirmPassword } = req.body;

	if (password !== confirmPassword) {
		return res.status(400).json({ message: "Passwords do not match." });
	}

	const existing = users.find(u => u.kickUsername === kickUsername);
	const existingRain = users.find(u => u.rainbetUsername === rainbetUsername);

	if (existing || existingRain)
		return res.status(400).json({ message: "Username already exists." });

	const hashed = await bcrypt.hash(password, 10);

	const newUser = {
		id: Date.now().toString(),
		kickUsername,
		rainbetUsername,
		password: hashed,
		role: "user",
	};

	users.push(newUser);

	res.status(201).json({ message: "User registered." });
});

app.post("/api/auth/login", async (req, res) => {
	const { kickUsername, password } = req.body;

	const user = users.find((u) => u.kickUsername === kickUsername);
	if (!user) return res.status(404).json({ message: "User not found." });

	const match = await bcrypt.compare(password, user.password);
	if (!match) return res.status(401).json({ message: "Invalid credentials." });

	const token = jwt.sign(
		{ id: user.id, role: user.role, kickUsername: user.kickUsername },
		process.env.JWT_SECRET,
		{ expiresIn: "7d" }
	);

	res.json({
		token,
		user: { id: user.id, kickUsername: user.kickUsername, role: user.role },
	});
});

// Routes that still exist
const slotCallRoutes = require("./routes/slotCallRoutes");
app.use("/api/slot-calls", slotCallRoutes);

// Affiliates Route
app.get("/api/affiliates", async (req, res) => {
	const { start_at, end_at } = req.query;

	if (!start_at || !end_at) {
		return res
			.status(400)
			.json({ error: "Missing start_at or end_at parameter" });
	}

	const url = `https://services.rainbet.com/v1/external/affiliates?start_at=${start_at}&end_at=${end_at}&key=${process.env.RAINBET_API_KEY}`;

	try {
		const response = await fetch(url);
		const content = await response.text();
		if (!response.ok) throw new Error(content);
		res.json(JSON.parse(content));
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch affiliates data" });
	}
});

const gwsRoutes = require("./routes/gwsRoutes");
app.use("/api/gws", gwsRoutes);

const leaderboardRoutes = require("./routes/leaderboard");
app.use("/api/leaderboard", leaderboardRoutes);

// Basic health check endpoint
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "OK",
		message: "Roobet Leaderboard API is running",
	});
});

// Start Server
app.listen(PORT, () =>
	console.log(`✅ Server is running at http://localhost:${PORT}`)
);
