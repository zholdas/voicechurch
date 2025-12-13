import { config } from '../config.js';

export interface QRCreateResponse {
  status: 'success' | 'error';
  qr_id?: string;
  message?: string;
}

export interface QRInfoResponse {
  status: 'success' | 'error';
  qr_id?: string;
  destination_url?: string;
  qr_image_url?: string;
  scan_count?: number;
  message?: string;
}

export interface QRUpdateResponse {
  status: 'success' | 'error';
  message?: string;
}

export interface QRDeleteResponse {
  status: 'success' | 'error';
  message?: string;
}

class QRMapperService {
  private apiKey: string;
  private baseUrl: string;
  private webhookUrl: string;

  constructor() {
    this.apiKey = config.qrMapper.apiKey;
    this.baseUrl = config.qrMapper.baseUrl;
    this.webhookUrl = config.qrMapper.webhookUrl;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private async request<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('QRMapper API key not configured');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QRMapper API error: ${response.status} ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async createQR(destinationUrl: string, name?: string): Promise<QRCreateResponse> {
    const body: Record<string, unknown> = {
      destination_url: destinationUrl,
    };

    if (name) {
      body.name = name;
    }

    if (this.webhookUrl) {
      body.webhook_url = this.webhookUrl;
    }

    return this.request<QRCreateResponse>('/qr_create', body);
  }

  async getQRInfo(qrId: string): Promise<QRInfoResponse> {
    return this.request<QRInfoResponse>('/qr_info', { qr_id: qrId });
  }

  async updateQR(qrId: string, destinationUrl?: string, name?: string): Promise<QRUpdateResponse> {
    const body: Record<string, unknown> = { qr_id: qrId };

    if (destinationUrl) {
      body.destination_url = destinationUrl;
    }

    if (name) {
      body.name = name;
    }

    return this.request<QRUpdateResponse>('/qr_update', body);
  }

  async deleteQR(qrId: string): Promise<QRDeleteResponse> {
    return this.request<QRDeleteResponse>('/qr_delete', { qr_id: qrId });
  }

  async getQRList(): Promise<{ status: string; qr_codes?: QRInfoResponse[] }> {
    return this.request('/qr_list', {});
  }
}

export const qrMapperService = new QRMapperService();
