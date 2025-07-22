import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import errorHandler from "./middlewares/errorHandler.js";
import dotenv from "dotenv";
import methodOverride from 'method-override';
// Load environment variables before anything else
dotenv.config();


const requiredEnvVars = [
  // 'CLOUDINARY_CLOUD_NAME',
  // 'CLOUDINARY_API_KEY',
  // 'CLOUDINARY_API_SECRET'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});
// Import routes
import routes from "./routes/index.js";

// Create Express app
const app = express();

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Enable CORS for frontend
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://farm-ferry-admin.vercel.app',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:3006',
  ],
  credentials: true
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(express.static(join(__dirname, "public")));
app.use(methodOverride('_method'));

// Log incoming requests for debugging
app.use((req, res, next) => {
  console.log('Incoming:', req.method, req.originalUrl);
  next();
});
// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "FarmFerry API is running"
  });
});

// API Routes
app.use("/api/v1", routes);

// 404 Route
app.all("*", (req, res) => {
  res.status(404).json({
    status: "fail",
    message: `Can't find ${req.originalUrl} on this server!`
  });
});

// Error handling middleware
app.use(errorHandler);

export { app };
