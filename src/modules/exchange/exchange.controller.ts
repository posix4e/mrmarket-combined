import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExchangeService } from './exchange.service';
import { ExchangeApiKey, ExchangeBalance } from '../../interfaces/exchange.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../../interfaces/user.interface';

@Controller('exchanges')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get('supported')
  async getSupportedExchanges(): Promise<string[]> {
    return this.exchangeService.getSupportedExchanges();
  }

  @Get('api-keys')
  async getApiKeys(@CurrentUser() user: User): Promise<ExchangeApiKey[]> {
    return this.exchangeService.getApiKeys(user.id);
  }

  @Get('api-keys/:exchangeName')
  async getApiKeysByExchange(
    @CurrentUser() user: User,
    @Param('exchangeName') exchangeName: string,
  ): Promise<ExchangeApiKey[]> {
    return this.exchangeService.getApiKeysByExchange(user.id, exchangeName);
  }

  @Post('api-keys')
  async createApiKey(
    @CurrentUser() user: User,
    @Body() createApiKeyDto: {
      exchangeName: string;
      apiKey: string;
      apiSecret: string;
      additionalParams?: Record<string, string>;
      isDefault?: boolean;
    },
  ): Promise<ExchangeApiKey> {
    return this.exchangeService.createApiKey(
      user.id,
      createApiKeyDto.exchangeName,
      createApiKeyDto.apiKey,
      createApiKeyDto.apiSecret,
      createApiKeyDto.additionalParams,
      createApiKeyDto.isDefault,
    );
  }

  @Put('api-keys/:id')
  async updateApiKey(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateApiKeyDto: Partial<ExchangeApiKey>,
  ): Promise<ExchangeApiKey> {
    const apiKey = await this.exchangeService.getApiKey(id);
    
    if (apiKey.userId !== user.id) {
      throw new ForbiddenException('You can only update your own API keys');
    }
    
    return this.exchangeService.updateApiKey(id, updateApiKeyDto);
  }

  @Delete('api-keys/:id')
  async deleteApiKey(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const apiKey = await this.exchangeService.getApiKey(id);
    
    if (apiKey.userId !== user.id) {
      throw new ForbiddenException('You can only delete your own API keys');
    }
    
    const deleted = await this.exchangeService.deleteApiKey(id);
    return { success: deleted };
  }

  @Get('balances')
  async getAllBalances(
    @CurrentUser() user: User,
  ): Promise<Record<string, ExchangeBalance[]>> {
    return this.exchangeService.getAllExchangeBalances(user.id);
  }

  @Get('balances/:exchangeName')
  async getBalances(
    @CurrentUser() user: User,
    @Param('exchangeName') exchangeName: string,
  ): Promise<ExchangeBalance[]> {
    return this.exchangeService.getBalances(user.id, exchangeName);
  }

  @Post('balances/:exchangeName/refresh')
  async refreshBalances(
    @CurrentUser() user: User,
    @Param('exchangeName') exchangeName: string,
  ): Promise<ExchangeBalance[]> {
    return this.exchangeService.fetchBalances(user.id, exchangeName);
  }

  @Get(':exchangeName/symbols')
  async getSupportedSymbols(
    @CurrentUser() user: User,
    @Param('exchangeName') exchangeName: string,
  ): Promise<string[]> {
    return this.exchangeService.getSupportedSymbols(user.id, exchangeName);
  }

  @Get(':exchangeName/ticker')
  async getTicker(
    @CurrentUser() user: User,
    @Param('exchangeName') exchangeName: string,
    @Query('symbol') symbol: string,
  ): Promise<any> {
    return this.exchangeService.fetchTicker(user.id, exchangeName, symbol);
  }

  @Get(':exchangeName/orderbook')
  async getOrderBook(
    @CurrentUser() user: User,
    @Param('exchangeName') exchangeName: string,
    @Query('symbol') symbol: string,
    @Query('limit') limit?: number,
  ): Promise<any> {
    return this.exchangeService.fetchOrderBook(user.id, exchangeName, symbol, limit);
  }
}