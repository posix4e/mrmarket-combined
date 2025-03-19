import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as ccxt from 'ccxt';
import { ExchangeApiKeyRepository } from './exchange-api-key.repository';
import { ExchangeBalanceRepository } from './exchange-balance.repository';
import { ExchangeApiKey, ExchangeBalance } from '../../interfaces/exchange.interface';
import { RedisService } from '../../utils/redis.service';

@Injectable()
export class ExchangeService {
  private readonly supportedExchanges = [
    'binance',
    'coinbase',
    'kraken',
    'kucoin',
    'bitfinex',
    'huobi',
    'okx',
  ];

  constructor(
    private readonly apiKeyRepository: ExchangeApiKeyRepository,
    private readonly balanceRepository: ExchangeBalanceRepository,
    private readonly redisService: RedisService,
  ) {}

  async getSupportedExchanges(): Promise<string[]> {
    return this.supportedExchanges;
  }

  async createApiKey(
    userId: string,
    exchangeName: string,
    apiKey: string,
    apiSecret: string,
    additionalParams?: Record<string, string>,
    isDefault = false,
  ): Promise<ExchangeApiKey> {
    // Validate exchange name
    if (!this.supportedExchanges.includes(exchangeName)) {
      throw new BadRequestException(`Exchange ${exchangeName} is not supported`);
    }

    // If this is the default key, make sure to unset any existing default
    if (isDefault) {
      const existingKeys = await this.apiKeyRepository.findByUserIdAndExchange(
        userId,
        exchangeName,
      );
      
      for (const key of existingKeys) {
        if (key.isDefault) {
          await this.apiKeyRepository.update(key.id, { isDefault: false });
        }
      }
    }

    // Create new API key
    const now = new Date();
    const apiKeyData: Omit<ExchangeApiKey, 'id'> = {
      userId,
      exchangeName,
      apiKey,
      apiSecret,
      additionalParams,
      isDefault,
      createdAt: now,
      updatedAt: now,
    };

    // Validate the API key by fetching balances
    try {
      const exchange = this.createExchangeInstance(
        exchangeName,
        apiKey,
        apiSecret,
        additionalParams,
      );
      
      await exchange.fetchBalance();
    } catch (error) {
      throw new BadRequestException(
        `Invalid API key or secret for ${exchangeName}: ${error.message}`,
      );
    }

    return this.apiKeyRepository.create(apiKeyData);
  }

  async getApiKeys(userId: string): Promise<ExchangeApiKey[]> {
    return this.apiKeyRepository.findBy('userId', userId);
  }

  async getApiKeysByExchange(
    userId: string,
    exchangeName: string,
  ): Promise<ExchangeApiKey[]> {
    return this.apiKeyRepository.findByUserIdAndExchange(userId, exchangeName);
  }

  async getApiKey(id: string): Promise<ExchangeApiKey> {
    const apiKey = await this.apiKeyRepository.findById(id);
    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }
    return apiKey;
  }

  async updateApiKey(
    id: string,
    data: Partial<ExchangeApiKey>,
  ): Promise<ExchangeApiKey> {
    const apiKey = await this.apiKeyRepository.findById(id);
    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    // If setting as default, unset any existing default
    if (data.isDefault) {
      const existingKeys = await this.apiKeyRepository.findByUserIdAndExchange(
        apiKey.userId,
        apiKey.exchangeName,
      );
      
      for (const key of existingKeys) {
        if (key.id !== id && key.isDefault) {
          await this.apiKeyRepository.update(key.id, { isDefault: false });
        }
      }
    }

    const updatedApiKey = await this.apiKeyRepository.update(id, {
      ...data,
      updatedAt: new Date(),
    });

    return updatedApiKey;
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const apiKey = await this.apiKeyRepository.findById(id);
    if (!apiKey) {
      throw new NotFoundException(`API key with ID ${id} not found`);
    }

    return this.apiKeyRepository.delete(id);
  }

  async fetchBalances(
    userId: string,
    exchangeName: string,
  ): Promise<ExchangeBalance[]> {
    const apiKey = await this.apiKeyRepository.findDefaultByUserIdAndExchange(
      userId,
      exchangeName,
    );
    
    if (!apiKey) {
      throw new NotFoundException(
        `No default API key found for ${exchangeName}`,
      );
    }

    try {
      const exchange = this.createExchangeInstance(
        exchangeName,
        apiKey.apiKey,
        apiKey.apiSecret,
        apiKey.additionalParams,
      );
      
      const balanceData = await exchange.fetchBalance();
      const balances: ExchangeBalance[] = [];
      
      for (const [currency, balance] of Object.entries(balanceData.total)) {
        if (balance > 0) {
          const exchangeBalance: ExchangeBalance = {
            userId,
            exchangeName,
            currency,
            free: balanceData.free[currency] || 0,
            used: balanceData.used[currency] || 0,
            total: balance,
            updatedAt: new Date(),
          };
          
          await this.balanceRepository.saveBalance(exchangeBalance);
          balances.push(exchangeBalance);
        }
      }
      
      return balances;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch balances from ${exchangeName}: ${error.message}`,
      );
    }
  }

  async getBalances(
    userId: string,
    exchangeName: string,
  ): Promise<ExchangeBalance[]> {
    return this.balanceRepository.getAllBalances(userId, exchangeName);
  }

  async getAllExchangeBalances(userId: string): Promise<Record<string, ExchangeBalance[]>> {
    const apiKeys = await this.apiKeyRepository.findBy('userId', userId);
    const uniqueExchanges = [...new Set(apiKeys.map(key => key.exchangeName))];
    
    const result: Record<string, ExchangeBalance[]> = {};
    
    for (const exchange of uniqueExchanges) {
      result[exchange] = await this.balanceRepository.getAllBalances(
        userId,
        exchange,
      );
    }
    
    return result;
  }

  createExchangeInstance(
    exchangeName: string,
    apiKey: string,
    apiSecret: string,
    additionalParams?: Record<string, string>,
  ): ccxt.Exchange {
    const exchangeClass = ccxt[exchangeName];
    
    if (!exchangeClass) {
      throw new BadRequestException(`Exchange ${exchangeName} is not supported`);
    }
    
    const options: any = {
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
    };
    
    if (additionalParams) {
      Object.assign(options, additionalParams);
    }
    
    return new exchangeClass(options);
  }

  async getExchangeInstance(
    userId: string,
    exchangeName: string,
  ): Promise<ccxt.Exchange> {
    const apiKey = await this.apiKeyRepository.findDefaultByUserIdAndExchange(
      userId,
      exchangeName,
    );
    
    if (!apiKey) {
      throw new NotFoundException(
        `No default API key found for ${exchangeName}`,
      );
    }
    
    return this.createExchangeInstance(
      exchangeName,
      apiKey.apiKey,
      apiKey.apiSecret,
      apiKey.additionalParams,
    );
  }

  async getSupportedSymbols(
    userId: string,
    exchangeName: string,
  ): Promise<string[]> {
    const cacheKey = `exchange:${exchangeName}:symbols`;
    const cachedSymbols = await this.redisService.get<string[]>(cacheKey);
    
    if (cachedSymbols) {
      return cachedSymbols;
    }
    
    try {
      const exchange = await this.getExchangeInstance(userId, exchangeName);
      const markets = await exchange.loadMarkets();
      const symbols = Object.keys(markets);
      
      // Cache for 1 hour
      await this.redisService.set(cacheKey, symbols, 3600);
      
      return symbols;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch symbols from ${exchangeName}: ${error.message}`,
      );
    }
  }

  async fetchTicker(
    userId: string,
    exchangeName: string,
    symbol: string,
  ): Promise<any> {
    try {
      const exchange = await this.getExchangeInstance(userId, exchangeName);
      return await exchange.fetchTicker(symbol);
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch ticker for ${symbol} from ${exchangeName}: ${error.message}`,
      );
    }
  }

  async fetchOrderBook(
    userId: string,
    exchangeName: string,
    symbol: string,
    limit?: number,
  ): Promise<any> {
    try {
      const exchange = await this.getExchangeInstance(userId, exchangeName);
      return await exchange.fetchOrderBook(symbol, limit);
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch order book for ${symbol} from ${exchangeName}: ${error.message}`,
      );
    }
  }
}