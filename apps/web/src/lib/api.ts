import type { User, RoomInfo, PublicRoomInfo, TranslationDirection, QRInfo } from './types';

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
    direction?: TranslationDirection;
    isPublic?: boolean;
  }) =>
    fetchApi<RoomInfo>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRoom: (id: string, data: {
    name?: string;
    direction?: TranslationDirection;
    isPublic?: boolean;
  }) =>
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

  getQRInfo: (id: string) =>
    fetchApi<QRInfo>(`/api/rooms/${id}/qr`),
};
