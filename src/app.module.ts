import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { StrategyModule } from './modules/strategy/strategy.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: redisStore,
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        ttl: 60 * 60 * 24, // 24 hours
      }),
    }),
    AuthModule,
    UserModule,
    ExchangeModule,
    StrategyModule,
    HealthModule,
  ],
})
export class AppModule {}