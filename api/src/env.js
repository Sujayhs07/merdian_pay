import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDir = path.join(__dirname, "..");

import fs from "node:fs";

// Load .env first
const envPath = path.join(envDir, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Then merge non-empty values from .env.local if present
const localPath = path.join(envDir, ".env.local");
if (fs.existsSync(localPath)) {
  try {
    const parsed = dotenv.parse(fs.readFileSync(localPath, "utf-8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined && value.trim() !== "") {
        process.env[key] = value.trim();
      }
    }
  } catch {
    // ignore
  }
}
