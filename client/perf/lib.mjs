import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PERF_DIR = dirname(fileURLToPath(import.meta.url));
export const CLIENT_DIR = resolve(PERF_DIR, "..");
export const REPO_DIR = resolve(CLIENT_DIR, "..");
export const OUT_DIR = resolve(REPO_DIR, "docs/perf");

export const API_URL = process.env.PERF_API_URL ?? "http://localhost:8080/query";
export const APP_URL = process.env.PERF_APP_URL ?? "http://localhost:4173";

export const CREDENTIALS = {
  email: process.env.PERF_EMAIL ?? "perf@local",
  password: process.env.PERF_PASSWORD ?? "perf-password-1",
};

const SESSION_FILE = resolve(PERF_DIR, "session.json");

export function ensureOutDir(sub = "") {
  const dir = sub ? resolve(OUT_DIR, sub) : OUT_DIR;
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readSession() {
  if (!existsSync(SESSION_FILE)) return null;
  return JSON.parse(readFileSync(SESSION_FILE, "utf8"));
}

export function writeSession(session) {
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2) + "\n");
}

export async function gql(query, variables, token) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  return body.data;
}

export async function authenticate() {
  const LOGIN = `mutation($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken refreshToken user { id email }
    }
  }`;
  const SIGNUP = `mutation($email: String!, $password: String!) {
    signup(email: $email, password: $password) {
      accessToken refreshToken user { id email }
    }
  }`;

  try {
    const data = await gql(LOGIN, CREDENTIALS);
    return data.login;
  } catch {
    const data = await gql(SIGNUP, CREDENTIALS);
    return data.signup;
  }
}

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Fixed-width base-62 counter with a "V" suffix: lexicographically increasing
// and never ending in "0", which the client's key validator rejects.
export function orderKeyAt(index) {
  let n = index;
  let out = "";
  for (let i = 0; i < 4; i++) {
    out = DIGITS[n % 62] + out;
    n = Math.floor(n / 62);
  }
  return out + "V";
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values, p) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

export function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
