import { Module } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { StrategyController } from './strategy.controller';
import { MarketMakingStrategy } from './strategies/market-making.strategy';
import { ArbitrageStrategy } from './strategies/arbitrage.strategy';
import { StrategyRepository } from './strategy.repository';
import { OrderRepository } from './order.repository';
import { ExchangeModule } from '../exchange/exchange.module';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [ExchangeModule],
  controllers: [StrategyController],
  providers: [
    StrategyService,
    MarketMakingStrategy,
    ArbitrageStrategy,
    StrategyRepository,
    OrderRepository,
    RedisService,
  ],
  exports: [StrategyService],
})
export class StrategyModule {}