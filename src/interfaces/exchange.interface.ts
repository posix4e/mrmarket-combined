export interface ExchangeApiKey {
  id: string;
  userId: string;
  exchangeName: string;
  apiKey: string;
  apiSecret: string;
  additionalParams?: Record<string, string>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExchangeBalance {
  userId: string;
  exchangeName: string;
  currency: string;
  free: number;
  used: number;
  total: number;
  updatedAt: Date;
}