import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../utils/base.repository';
import { Order, TradeSideType } from '../../interfaces/strategy.interface';
import { RedisService } from '../../utils/redis.service';

@Injectable()
export class OrderRepository extends BaseRepository<Order> {
  constructor(redisService: RedisService) {
    super(redisService, 'order');
  }

  async findByUserId(userId: string): Promise<Order[]> {
    return this.findBy('userId', userId);
  }

  async findByStrategyId(strategyId: string): Promise<Order[]> {
    return this.findBy('strategyId', strategyId);
  }

  async findByUserIdAndExchange(
    userId: string,
    exchangeName: string,
  ): Promise<Order[]> {
    const orders = await this.findByUserId(userId);
    return orders.filter(order => order.exchangeName === exchangeName);
  }

  async findByUserIdAndSymbol(
    userId: string,
    symbol: string,
  ): Promise<Order[]> {
    const orders = await this.findByUserId(userId);
    return orders.filter(order => order.symbol === symbol);
  }

  async findByExchangeAndSymbol(
    exchangeName: string,
    symbol: string,
  ): Promise<Order[]> {
    const orders = await this.findAll();
    return orders.filter(
      order => order.exchangeName === exchangeName && order.symbol === symbol,
    );
  }

  async findOpenOrders(userId: string): Promise<Order[]> {
    const orders = await this.findByUserId(userId);
    return orders.filter(order => order.status === 'open');
  }

  async findOpenOrdersByExchangeAndSymbol(
    exchangeName: string,
    symbol: string,
  ): Promise<Order[]> {
    const orders = await this.findByExchangeAndSymbol(exchangeName, symbol);
    return orders.filter(order => order.status === 'open');
  }
}