import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { StrategyRepository } from './strategy.repository';
import { OrderRepository } from './order.repository';
import { ExchangeService } from '../exchange/exchange.service';
import { 
  BaseStrategy, 
  StrategyType, 
  StrategyStatus,
  MarketMakingStrategy,
  ArbitrageStrategy,
  Order,
  TradeSideType,
  PlaceOrderParams
} from '../../interfaces/strategy.interface';
import { MarketMakingStrategy as MarketMakingStrategyService } from './strategies/market-making.strategy';
import { ArbitrageStrategy as ArbitrageStrategyService } from './strategies/arbitrage.strategy';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class StrategyService {
  constructor(
    private readonly strategyRepository: StrategyRepository,
    private readonly orderRepository: OrderRepository,
    private readonly exchangeService: ExchangeService,
    private readonly marketMakingStrategy: MarketMakingStrategyService,
    private readonly arbitrageStrategy: ArbitrageStrategyService,
  ) {}

  async getAllStrategies(userId: string): Promise<BaseStrategy[]> {
    return this.strategyRepository.findByUserId(userId);
  }

  async getStrategyById(id: string): Promise<BaseStrategy> {
    const strategy = await this.strategyRepository.findById(id);
    if (!strategy) {
      throw new NotFoundException(`Strategy with ID ${id} not found`);
    }
    return strategy;
  }

  async createMarketMakingStrategy(
    userId: string,
    data: Omit<MarketMakingStrategy, 'id' | 'type' | 'status' | 'createdAt' | 'updatedAt'>,
  ): Promise<MarketMakingStrategy> {
    // Validate exchange
    const supportedExchanges = await this.exchangeService.getSupportedExchanges();
    if (!supportedExchanges.includes(data.exchangeName)) {
      throw new BadRequestException(`Exchange ${data.exchangeName} is not supported`);
    }

    // Validate oracle exchange if provided
    if (data.oracleExchangeName && !supportedExchanges.includes(data.oracleExchangeName)) {
      throw new BadRequestException(`Oracle exchange ${data.oracleExchangeName} is not supported`);
    }

    // Validate API key exists
    const apiKeys = await this.exchangeService.getApiKeysByExchange(userId, data.exchangeName);
    if (apiKeys.length === 0) {
      throw new BadRequestException(`No API key found for ${data.exchangeName}`);
    }

    // Validate symbol
    try {
      const symbols = await this.exchangeService.getSupportedSymbols(userId, data.exchangeName);
      const symbol = `${data.sideA}/${data.sideB}`;
      if (!symbols.includes(symbol)) {
        throw new BadRequestException(`Symbol ${symbol} is not supported on ${data.exchangeName}`);
      }
    } catch (error) {
      throw new BadRequestException(`Failed to validate symbol: ${error.message}`);
    }

    const now = new Date();
    const strategy = await this.strategyRepository.create({
      ...data,
      userId,
      type: StrategyType.MARKET_MAKING,
      status: StrategyStatus.RUNNING,
      createdAt: now,
      updatedAt: now,
    }) as MarketMakingStrategy;

    return strategy;
  }

  async createArbitrageStrategy(
    userId: string,
    data: Omit<ArbitrageStrategy, 'id' | 'type' | 'status' | 'createdAt' | 'updatedAt'>,
  ): Promise<ArbitrageStrategy> {
    // Validate exchanges
    const supportedExchanges = await this.exchangeService.getSupportedExchanges();
    if (!supportedExchanges.includes(data.sourceExchangeName)) {
      throw new BadRequestException(`Source exchange ${data.sourceExchangeName} is not supported`);
    }
    if (!supportedExchanges.includes(data.targetExchangeName)) {
      throw new BadRequestException(`Target exchange ${data.targetExchangeName} is not supported`);
    }

    // Validate API keys exist
    const sourceApiKeys = await this.exchangeService.getApiKeysByExchange(userId, data.sourceExchangeName);
    if (sourceApiKeys.length === 0) {
      throw new BadRequestException(`No API key found for ${data.sourceExchangeName}`);
    }
    const targetApiKeys = await this.exchangeService.getApiKeysByExchange(userId, data.targetExchangeName);
    if (targetApiKeys.length === 0) {
      throw new BadRequestException(`No API key found for ${data.targetExchangeName}`);
    }

    // Validate symbol
    try {
      const sourceSymbols = await this.exchangeService.getSupportedSymbols(userId, data.sourceExchangeName);
      if (!sourceSymbols.includes(data.symbol)) {
        throw new BadRequestException(`Symbol ${data.symbol} is not supported on ${data.sourceExchangeName}`);
      }
      
      const targetSymbols = await this.exchangeService.getSupportedSymbols(userId, data.targetExchangeName);
      if (!targetSymbols.includes(data.symbol)) {
        throw new BadRequestException(`Symbol ${data.symbol} is not supported on ${data.targetExchangeName}`);
      }
    } catch (error) {
      throw new BadRequestException(`Failed to validate symbol: ${error.message}`);
    }

    const now = new Date();
    const strategy = await this.strategyRepository.create({
      ...data,
      userId,
      type: StrategyType.ARBITRAGE,
      status: StrategyStatus.RUNNING,
      createdAt: now,
      updatedAt: now,
    }) as ArbitrageStrategy;

    return strategy;
  }

  async updateStrategy(
    id: string,
    data: Partial<BaseStrategy>,
  ): Promise<BaseStrategy> {
    const strategy = await this.strategyRepository.findById(id);
    if (!strategy) {
      throw new NotFoundException(`Strategy with ID ${id} not found`);
    }

    // Don't allow changing the type
    if (data.type && data.type !== strategy.type) {
      throw new BadRequestException('Cannot change strategy type');
    }

    const updatedStrategy = await this.strategyRepository.update(id, {
      ...data,
      updatedAt: new Date(),
    });

    return updatedStrategy;
  }

  async pauseStrategy(id: string, reason?: string): Promise<BaseStrategy> {
    const strategy = await this.strategyRepository.findById(id);
    if (!strategy) {
      throw new NotFoundException(`Strategy with ID ${id} not found`);
    }

    if (strategy.status !== StrategyStatus.RUNNING) {
      throw new BadRequestException(`Strategy is not running`);
    }

    const updatedStrategy = await this.strategyRepository.updateStrategyStatus(
      id,
      StrategyStatus.PAUSED,
      reason || 'Manually paused',
    );

    return updatedStrategy;
  }

  async resumeStrategy(id: string): Promise<BaseStrategy> {
    const strategy = await this.strategyRepository.findById(id);
    if (!strategy) {
      throw new NotFoundException(`Strategy with ID ${id} not found`);
    }

    if (strategy.status !== StrategyStatus.PAUSED) {
      throw new BadRequestException(`Strategy is not paused`);
    }

    const updatedStrategy = await this.strategyRepository.updateStrategyStatus(
      id,
      StrategyStatus.RUNNING,
    );

    return updatedStrategy;
  }

  async stopStrategy(id: string): Promise<BaseStrategy> {
    const strategy = await this.strategyRepository.findById(id);
    if (!strategy) {
      throw new NotFoundException(`Strategy with ID ${id} not found`);
    }

    if (strategy.status === StrategyStatus.STOPPED) {
      throw new BadRequestException(`Strategy is already stopped`);
    }

    // Cancel all open orders for this strategy
    await this.cancelAllOrders(id);

    const updatedStrategy = await this.strategyRepository.updateStrategyStatus(
      id,
      StrategyStatus.STOPPED,
    );

    return updatedStrategy;
  }

  async deleteStrategy(id: string): Promise<boolean> {
    const strategy = await this.strategyRepository.findById(id);
    if (!strategy) {
      throw new NotFoundException(`Strategy with ID ${id} not found`);
    }

    // Cancel all open orders for this strategy
    await this.cancelAllOrders(id);

    return this.strategyRepository.delete(id);
  }

  async getOrders(userId: string, strategyId?: string): Promise<Order[]> {
    if (strategyId) {
      return this.orderRepository.findByStrategyId(strategyId);
    }
    return this.orderRepository.findByUserId(userId);
  }

  async placeOrder(params: PlaceOrderParams): Promise<Order> {
    const { userId, exchangeName, pair, side, amount, price } = params;
    
    try {
      const exchange = await this.exchangeService.getExchangeInstance(userId, exchangeName);
      const orderResult = await exchange.createLimitOrder(pair, side, amount, price);
      
      const now = new Date();
      const order: Omit<Order, 'id'> = {
        userId,
        strategyId: params['strategyId'],
        exchangeName,
        symbol: pair,
        orderId: orderResult.id,
        side,
        type: 'limit',
        amount,
        price,
        status: orderResult.status || 'open',
        filled: orderResult.filled || 0,
        cost: orderResult.cost || 0,
        fee: orderResult.fee,
        createdAt: now,
        updatedAt: now,
      };
      
      return this.orderRepository.create(order);
    } catch (error) {
      throw new BadRequestException(`Failed to place order: ${error.message}`);
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.status !== 'open') {
      throw new BadRequestException(`Order is not open`);
    }

    try {
      const exchange = await this.exchangeService.getExchangeInstance(
        order.userId,
        order.exchangeName,
      );
      
      await exchange.cancelOrder(order.orderId, order.symbol);
      
      await this.orderRepository.update(orderId, {
        status: 'canceled',
        updatedAt: new Date(),
      });
      
      return true;
    } catch (error) {
      throw new BadRequestException(`Failed to cancel order: ${error.message}`);
    }
  }

  async cancelAllOrders(strategyId: string): Promise<number> {
    const strategy = await this.strategyRepository.findById(strategyId);
    if (!strategy) {
      throw new NotFoundException(`Strategy with ID ${strategyId} not found`);
    }

    const orders = await this.orderRepository.findByStrategyId(strategyId);
    const openOrders = orders.filter(order => order.status === 'open');
    
    let canceledCount = 0;
    for (const order of openOrders) {
      try {
        await this.cancelOrder(order.id);
        canceledCount++;
      } catch (error) {
        console.error(`Failed to cancel order ${order.id}: ${error.message}`);
      }
    }
    
    return canceledCount;
  }

  @Cron('*/10 * * * * *') // Run every 10 seconds
  async executeStrategies() {
    // Execute market making strategies
    const marketMakingStrategies = await this.strategyRepository.findActiveMarketMakingStrategies();
    for (const strategy of marketMakingStrategies) {
      try {
        const shouldExecute = this.shouldExecuteStrategy(strategy);
        if (shouldExecute) {
          await this.marketMakingStrategy.execute(strategy);
          await this.strategyRepository.updateLastExecutionTime(strategy.id);
        }
      } catch (error) {
        console.error(`Error executing market making strategy ${strategy.id}: ${error.message}`);
        await this.strategyRepository.updateStrategyStatus(
          strategy.id,
          StrategyStatus.PAUSED,
          `Error: ${error.message}`,
        );
      }
    }

    // Execute arbitrage strategies
    const arbitrageStrategies = await this.strategyRepository.findActiveArbitrageStrategies();
    for (const strategy of arbitrageStrategies) {
      try {
        const shouldExecute = this.shouldExecuteStrategy(strategy);
        if (shouldExecute) {
          await this.arbitrageStrategy.execute(strategy);
          await this.strategyRepository.updateLastExecutionTime(strategy.id);
        }
      } catch (error) {
        console.error(`Error executing arbitrage strategy ${strategy.id}: ${error.message}`);
        await this.strategyRepository.updateStrategyStatus(
          strategy.id,
          StrategyStatus.PAUSED,
          `Error: ${error.message}`,
        );
      }
    }
  }

  private shouldExecuteStrategy(strategy: BaseStrategy): boolean {
    if (!strategy.lastExecutionAt) {
      return true;
    }

    let checkIntervalSeconds: number;
    
    if (strategy.type === StrategyType.MARKET_MAKING) {
      checkIntervalSeconds = (strategy as MarketMakingStrategy).checkIntervalSeconds;
    } else if (strategy.type === StrategyType.ARBITRAGE) {
      checkIntervalSeconds = (strategy as ArbitrageStrategy).checkIntervalSeconds;
    } else {
      return false;
    }

    const nextExecutionTime = new Date(
      strategy.lastExecutionAt.getTime() + checkIntervalSeconds * 1000,
    );
    
    return new Date() >= nextExecutionTime;
  }
}