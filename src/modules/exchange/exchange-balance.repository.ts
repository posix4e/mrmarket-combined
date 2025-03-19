import { Injectable } from '@nestjs/common';
import { RedisService } from '../../utils/redis.service';
import { ExchangeBalance } from '../../interfaces/exchange.interface';

@Injectable()
export class ExchangeBalanceRepository {
  private readonly prefix = 'exchange_balance';

  constructor(private readonly redisService: RedisService) {}

  private getKey(userId: string, exchangeName: string, currency: string): string {
    return `${this.prefix}:${userId}:${exchangeName}:${currency}`;
  }

  private getUserExchangeKey(userId: string, exchangeName: string): string {
    return `${this.prefix}:${userId}:${exchangeName}`;
  }

  async saveBalance(balance: ExchangeBalance): Promise<void> {
    const key = this.getKey(
      balance.userId,
      balance.exchangeName,
      balance.currency,
    );
    
    await this.redisService.set(key, balance);
    
    // Add to the set of currencies for this user and exchange
    const userExchangeKey = this.getUserExchangeKey(
      balance.userId,
      balance.exchangeName,
    );
    
    await this.redisService.sadd(userExchangeKey, balance.currency);
  }

  async getBalance(
    userId: string,
    exchangeName: string,
    currency: string,
  ): Promise<ExchangeBalance | null> {
    const key = this.getKey(userId, exchangeName, currency);
    return this.redisService.get<ExchangeBalance>(key);
  }

  async getAllBalances(
    userId: string,
    exchangeName: string,
  ): Promise<ExchangeBalance[]> {
    const userExchangeKey = this.getUserExchangeKey(userId, exchangeName);
    const currencies = await this.redisService.smembers(userExchangeKey);
    
    const balances: ExchangeBalance[] = [];
    for (const currency of currencies) {
      const balance = await this.getBalance(userId, exchangeName, currency);
      if (balance) {
        balances.push(balance);
      }
    }
    
    return balances;
  }

  async deleteBalance(
    userId: string,
    exchangeName: string,
    currency: string,
  ): Promise<void> {
    const key = this.getKey(userId, exchangeName, currency);
    await this.redisService.del(key);
    
    // Remove from the set of currencies
    const userExchangeKey = this.getUserExchangeKey(userId, exchangeName);
    await this.redisService.srem(userExchangeKey, currency);
  }

  async deleteAllBalances(userId: string, exchangeName: string): Promise<void> {
    const userExchangeKey = this.getUserExchangeKey(userId, exchangeName);
    const currencies = await this.redisService.smembers(userExchangeKey);
    
    for (const currency of currencies) {
      await this.deleteBalance(userId, exchangeName, currency);
    }
    
    await this.redisService.del(userExchangeKey);
  }
}