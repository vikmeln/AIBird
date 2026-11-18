export interface BirdPrediction {
  birdName: string;
  confidence: number;
  rank: number;
}

export interface BirdInfo {
  englishName?: string;
  ukrainianName?: string;
  scientificName?: string;
  description?: string;
}

export interface BirdAnalysis {
  id: number;
  fileName: string;
  status: string;
  createdAt?: string;
  analysisDate?: string | null;
  predictions?: BirdPrediction[];
  birdInfo?: BirdInfo | null;
}

export interface Attempts {
  freeAttemptsUsed?: number;
  freeAttemptsLeft?: number;
  paidAttemptsLeft?: number;
}

export interface LoginResponse {
  token?: string;
  accessToken?: string;
  jwtToken?: string;
}

export interface AdminUser {
  id: number;
  email: string;
  freeAttemptsUsed: number;
  paidAttemptsLeft: number;
}

export interface Payment {
  id: number;
  userId: number;
  walletAddress: string;
  transactionHash: string;
  chainId: number;
  attemptsAdded: number;
  paidAt: string;
}

export interface BirdAnalysis {
  id: number;
  userId?: number;
  fileName: string;
  status: string;
  createdAt?: string;
  analysisDate?: string | null;
  predictions?: BirdPrediction[];
  birdInfo?: BirdInfo | null;
}

export interface PaymentInfo {
  userId: number;
  contractAddress: string;
  chainId: number;
  priceEth: string;
  attempts: number;
}
