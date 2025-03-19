import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../utils/base.repository';
import { 
  BaseStrategy, 
  StrategyType, 
  MarketMakingStrategy, 
  ArbitrageStrategy,
  StrategyStatus
} from '../../interfaces/strategy.interface';
import { RedisService } from '../../utils/redis.service';

@Injectable()
export class StrategyRepository extends BaseRepository<BaseStrategy> {
  constructor(redisService: RedisService) {
    super(redisService, 'strategy');
  }

  async findByUserId(userId: string): Promise<BaseStrategy[]> {
    return this.findBy('userId', userId);
  }

  async findByUserIdAndType(
    userId: string,
    type: StrategyType,
  ): Promise<BaseStrategy[]> {
    const strategies = await this.findByUserId(userId);
    return strategies.filter(strategy => strategy.type === type);
  }

  async findActiveStrategies(): Promise<BaseStrategy[]> {
    const strategies = await this.findAll();
    return strategies.filter(strategy => strategy.status === StrategyStatus.RUNNING);
  }

  async findActiveMarketMakingStrategies(): Promise<MarketMakingStrategy[]> {
    const strategies = await this.findActiveStrategies();
    return strategies.filter(
      strategy => strategy.type === StrategyType.MARKET_MAKING,
    ) as MarketMakingStrategy[];
  }

  async findActiveArbitrageStrategies(): Promise<ArbitrageStrategy[]> {
    const strategies = await this.findActiveStrategies();
    return strategies.filter(
      strategy => strategy.type === StrategyType.ARBITRAGE,
    ) as ArbitrageStrategy[];
  }

  async updateStrategyStatus(
    id: string,
    status: StrategyStatus,
    pausedReason?: string,
  ): Promise<BaseStrategy | null> {
    const strategy = await this.findById(id);
    if (!strategy) return null;

    const updateData: Partial<BaseStrategy> = {
      status,
      updatedAt: new Date(),
    };

    if (pausedReason) {
      updateData.pausedReason = pausedReason;
    }

    return this.update(id, updateData);
  }

  async updateLastExecutionTime(id: string): Promise<BaseStrategy | null> {
    const strategy = await this.findById(id);
    if (!strategy) return null;

    return this.update(id, {
      lastExecutionAt: new Date(),
      updatedAt: new Date(),
    });
  }
}