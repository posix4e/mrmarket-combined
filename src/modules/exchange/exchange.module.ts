import { Module } from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { ExchangeController } from './exchange.controller';
import { ExchangeApiKeyRepository } from './exchange-api-key.repository';
import { ExchangeBalanceRepository } from './exchange-balance.repository';
import { RedisService } from '../../utils/redis.service';

@Module({
  controllers: [ExchangeController],
  providers: [
    ExchangeService,
    ExchangeApiKeyRepository,
    ExchangeBalanceRepository,
    RedisService,
  ],
  exports: [ExchangeService],
})
export class ExchangeModule {}