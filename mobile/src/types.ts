export interface LoginResponse {
  token: string;
  role: string;
}

export interface UserSession {
  token: string;
  role: string;
  email: string;
}

export interface Attempts {
  freeAttemptsLeft: number;
  paidAttemptsLeft: number;
}

export interface BirdAnalysis {
  id: number;
  status: string;
  createdAt?: string;
  predictions?: Record<string, unknown>[];
  birdInfo?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface AnalyzeResponse {
  id: number;
  status: string;
}
