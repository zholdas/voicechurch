import type { User, RoomInfo, PublicRoomInfo, LanguageCode, QRInfo } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper for API requests
async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth API
export const authApi = {
  getMe: () => fetchApi<User>('/auth/me'),

  logout: () =>
    fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }),

  getGoogleAuthUrl: () => `${API_URL}/auth/google`,
};

// Rooms API
export const roomsApi = {
  getPublicRooms: () => fetchApi<PublicRoomInfo[]>('/api/rooms/public'),

  getMyRooms: () => fetchApi<RoomInfo[]>('/api/rooms/my'),

  getRoom: (slug: string) => fetchApi<RoomInfo>(`/api/rooms/${slug}`),

  createRoom: (data: {
    name: string;
    slug: string;
    sourceLanguage?: LanguageCode;
    targetLanguage?: LanguageCode;
    isPublic?: boolean;
  }) =>
    fetchApi<RoomInfo>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRoom: (
    id: string,
    data: {
      name?: string;
      sourceLanguage?: LanguageCode;
      targetLanguage?: LanguageCode;
      isPublic?: boolean;
    }
  ) =>
    fetchApi<RoomInfo>(`/api/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteRoom: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/rooms/${id}`, {
      method: 'DELETE',
    }),

  generateQR: (id: string) =>
    fetchApi<QRInfo>(`/api/rooms/${id}/qr`, {
      method: 'POST',
    }),

  getQRInfo: (id: string) => fetchApi<QRInfo>(`/api/rooms/${id}/qr`),
};

// Billing types
export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  maxListeners: number;
  maxLanguages: number;
  minutesPerMonth: number;
}

export interface SubscriptionInfo {
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none';
  billingPeriod?: 'monthly' | 'yearly';
  currentPeriodEnd?: number;
  stripeCustomerId?: string;
  canStartTrial?: boolean;
  trialEndsAt?: number | null;
  plan: {
    id: string;
    name: string;
    maxListeners: number;
    maxLanguages: number;
    minutesPerMonth: number;
  } | null;
  usage: {
    minutesUsed: number;
    minutesRemaining: number;
    minutesLimit: number;
    percentUsed: number;
  } | null;
}

export interface BroadcastLog {
  id: string;
  roomId: string;
  roomName: string;
  startedAt: number;
  endedAt: number | null;
  durationMinutes: number | null;
  peakListeners: number;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface BroadcastsResponse {
  broadcasts: BroadcastLog[];
  total: number;
  limit: number;
  offset: number;
}

// Billing API
export const billingApi = {
  // Get all available plans
  getPlans: () => fetchApi<{ plans: Plan[] }>('/api/billing/plans'),

  // Get current subscription and usage info
  getSubscription: () => fetchApi<SubscriptionInfo>('/api/billing/subscription'),

  // Create checkout session for new subscription
  createCheckout: (planId: string, billingPeriod: 'monthly' | 'yearly') =>
    fetchApi<{ checkoutUrl: string; withTrial?: boolean }>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId, billingPeriod }),
    }),

  // Create portal session for managing subscription
  createPortal: () =>
    fetchApi<{ portalUrl: string }>('/api/billing/portal', {
      method: 'POST',
    }),

  // Get broadcast history
  getBroadcasts: (limit = 20, offset = 0) =>
    fetchApi<BroadcastsResponse>(`/api/billing/broadcasts?limit=${limit}&offset=${offset}`),

  // Check if billing is configured
  getStatus: () => fetchApi<{ configured: boolean }>('/api/billing/status'),
};
