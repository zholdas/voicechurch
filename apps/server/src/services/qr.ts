import { config } from '../config.js';

export interface QRCreateResponse {
  status: 'Success' | 'error';
  qr_id?: string;
  message?: string;
}

export interface QRInfoResponse {
  status: 'Success' | 'error';
  qr_id?: string;
  name?: string;
  target_url?: string;
  image_url?: string;
  type?: string;
  scan_count?: number;
  message?: string;
}

export interface QRWebhookPayload {
  qr_id: string;
  name: string;
  image_url: string;
  type: string;
  target_url: string;
}

export interface QRUpdateResponse {
  status: 'Success' | 'error';
  message?: string;
}

export interface QRDeleteResponse {
  status: 'Success' | 'error';
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
    return !!this.apiKey && !!this.webhookUrl;
  }

  private async postRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('QRMapper API key or webhook URL not configured');
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

  private async getRequest<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('QRMapper API key not configured');
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QRMapper API error: ${response.status} ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async createQR(targetUrl: string, name: string): Promise<QRCreateResponse> {
    return this.postRequest<QRCreateResponse>('/qr_create', {
      name,
      target_url: targetUrl,
      webhook_url: this.webhookUrl,
    });
  }

  async getQRInfo(qrId: string): Promise<QRInfoResponse> {
    return this.getRequest<QRInfoResponse>('/qr_info', { qr_id: qrId });
  }

  async updateQR(qrId: string, targetUrl?: string, name?: string): Promise<QRUpdateResponse> {
    const body: Record<string, unknown> = { qr_id: qrId };

    if (targetUrl) {
      body.target_url = targetUrl;
    }

    if (name) {
      body.name = name;
    }

    return this.postRequest<QRUpdateResponse>('/qr_update', body);
  }

  async deleteQR(qrId: string): Promise<QRDeleteResponse> {
    return this.postRequest<QRDeleteResponse>('/qr_delete', { qr_id: qrId });
  }

  async getQRList(): Promise<{ status: string; qr_codes?: QRInfoResponse[] }> {
    return this.getRequest('/qr_list', {});
  }
}

export const qrMapperService = new QRMapperService();
