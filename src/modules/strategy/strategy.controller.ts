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
import { StrategyService } from './strategy.service';
import { 
  BaseStrategy, 
  MarketMakingStrategy, 
  ArbitrageStrategy,
  Order
} from '../../interfaces/strategy.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../../interfaces/user.interface';

@Controller('strategies')
@UseGuards(JwtAuthGuard)
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get()
  async getAllStrategies(@CurrentUser() user: User): Promise<BaseStrategy[]> {
    return this.strategyService.getAllStrategies(user.id);
  }

  @Get(':id')
  async getStrategyById(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<BaseStrategy> {
    const strategy = await this.strategyService.getStrategyById(id);
    
    if (strategy.userId !== user.id) {
      throw new ForbiddenException('You can only view your own strategies');
    }
    
    return strategy;
  }

  @Post('market-making')
  async createMarketMakingStrategy(
    @CurrentUser() user: User,
    @Body() createStrategyDto: Omit<MarketMakingStrategy, 'id' | 'type' | 'status' | 'createdAt' | 'updatedAt' | 'userId'>,
  ): Promise<MarketMakingStrategy> {
    return this.strategyService.createMarketMakingStrategy(user.id, createStrategyDto);
  }

  @Post('arbitrage')
  async createArbitrageStrategy(
    @CurrentUser() user: User,
    @Body() createStrategyDto: Omit<ArbitrageStrategy, 'id' | 'type' | 'status' | 'createdAt' | 'updatedAt' | 'userId'>,
  ): Promise<ArbitrageStrategy> {
    return this.strategyService.createArbitrageStrategy(user.id, createStrategyDto);
  }

  @Put(':id')
  async updateStrategy(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateStrategyDto: Partial<BaseStrategy>,
  ): Promise<BaseStrategy> {
    const strategy = await this.strategyService.getStrategyById(id);
    
    if (strategy.userId !== user.id) {
      throw new ForbiddenException('You can only update your own strategies');
    }
    
    return this.strategyService.updateStrategy(id, updateStrategyDto);
  }

  @Post(':id/pause')
  async pauseStrategy(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ): Promise<BaseStrategy> {
    const strategy = await this.strategyService.getStrategyById(id);
    
    if (strategy.userId !== user.id) {
      throw new ForbiddenException('You can only pause your own strategies');
    }
    
    return this.strategyService.pauseStrategy(id, body.reason);
  }

  @Post(':id/resume')
  async resumeStrategy(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<BaseStrategy> {
    const strategy = await this.strategyService.getStrategyById(id);
    
    if (strategy.userId !== user.id) {
      throw new ForbiddenException('You can only resume your own strategies');
    }
    
    return this.strategyService.resumeStrategy(id);
  }

  @Post(':id/stop')
  async stopStrategy(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<BaseStrategy> {
    const strategy = await this.strategyService.getStrategyById(id);
    
    if (strategy.userId !== user.id) {
      throw new ForbiddenException('You can only stop your own strategies');
    }
    
    return this.strategyService.stopStrategy(id);
  }

  @Delete(':id')
  async deleteStrategy(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const strategy = await this.strategyService.getStrategyById(id);
    
    if (strategy.userId !== user.id) {
      throw new ForbiddenException('You can only delete your own strategies');
    }
    
    const deleted = await this.strategyService.deleteStrategy(id);
    return { success: deleted };
  }

  @Get('orders')
  async getOrders(
    @CurrentUser() user: User,
    @Query('strategyId') strategyId?: string,
  ): Promise<Order[]> {
    if (strategyId) {
      const strategy = await this.strategyService.getStrategyById(strategyId);
      if (strategy.userId !== user.id) {
        throw new ForbiddenException('You can only view orders for your own strategies');
      }
    }
    
    return this.strategyService.getOrders(user.id, strategyId);
  }

  @Delete('orders/:id')
  async cancelOrder(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const order = await this.strategyService.getOrders(user.id);
    const targetOrder = order.find(o => o.id === id);
    
    if (!targetOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    
    const canceled = await this.strategyService.cancelOrder(id);
    return { success: canceled };
  }
}