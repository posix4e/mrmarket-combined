import { Injectable, Logger } from '@nestjs/common';
import { ExchangeService } from '../../exchange/exchange.service';
import { 
  ArbitrageStrategy as ArbitrageStrategyType,
  TradeSideType
} from '../../../interfaces/strategy.interface';

@Injectable()
export class ArbitrageStrategy {
  private readonly logger = new Logger(ArbitrageStrategy.name);

  constructor(private readonly exchangeService: ExchangeService) {}

  async execute(strategy: ArbitrageStrategyType): Promise<void> {
    this.logger.debug(`Executing arbitrage strategy ${strategy.id}`);
    
    const {
      userId,
      sourceExchangeName,
      targetExchangeName,
      symbol,
      minProfitPercentage,
      maxOrderAmount,
    } = strategy;

    // Get price data from both exchanges
    const sourceExchange = await this.exchangeService.getExchangeInstance(userId, sourceExchangeName);
    const targetExchange = await this.exchangeService.getExchangeInstance(userId, targetExchangeName);
    
    const sourceTicker = await sourceExchange.fetchTicker(symbol);
    const targetTicker = await targetExchange.fetchTicker(symbol);
    
    const sourceBid = sourceTicker.bid;
    const sourceAsk = sourceTicker.ask;
    const targetBid = targetTicker.bid;
    const targetAsk = targetTicker.ask;
    
    // Check for arbitrage opportunities
    
    // Opportunity 1: Buy on source, sell on target
    const profit1Percentage = ((targetBid / sourceAsk) - 1) * 100;
    
    if (profit1Percentage >= minProfitPercentage) {
      this.logger.debug(
        `Arbitrage opportunity found: Buy on ${sourceExchangeName} at ${sourceAsk}, sell on ${targetExchangeName} at ${targetBid}, profit: ${profit1Percentage.toFixed(2)}%`,
      );
      
      // Calculate order amount based on available balances
      const orderAmount = await this.calculateOrderAmount(
        userId,
        sourceExchangeName,
        targetExchangeName,
        symbol,
        maxOrderAmount,
      );
      
      if (orderAmount > 0) {
        // Execute arbitrage
        await this.executeArbitrage(
          userId,
          sourceExchangeName,
          targetExchangeName,
          symbol,
          orderAmount,
          TradeSideType.BUY,
          TradeSideType.SELL,
          sourceAsk,
          targetBid,
          strategy.id,
        );
      } else {
        this.logger.debug(`Insufficient balance for arbitrage`);
      }
    }
    
    // Opportunity 2: Buy on target, sell on source
    const profit2Percentage = ((sourceBid / targetAsk) - 1) * 100;
    
    if (profit2Percentage >= minProfitPercentage) {
      this.logger.debug(
        `Arbitrage opportunity found: Buy on ${targetExchangeName} at ${targetAsk}, sell on ${sourceExchangeName} at ${sourceBid}, profit: ${profit2Percentage.toFixed(2)}%`,
      );
      
      // Calculate order amount based on available balances
      const orderAmount = await this.calculateOrderAmount(
        userId,
        targetExchangeName,
        sourceExchangeName,
        symbol,
        maxOrderAmount,
      );
      
      if (orderAmount > 0) {
        // Execute arbitrage
        await this.executeArbitrage(
          userId,
          targetExchangeName,
          sourceExchangeName,
          symbol,
          orderAmount,
          TradeSideType.BUY,
          TradeSideType.SELL,
          targetAsk,
          sourceBid,
          strategy.id,
        );
      } else {
        this.logger.debug(`Insufficient balance for arbitrage`);
      }
    }
    
    if (profit1Percentage < minProfitPercentage && profit2Percentage < minProfitPercentage) {
      this.logger.debug(`No arbitrage opportunities found above ${minProfitPercentage}% profit threshold`);
    }
  }

  private async calculateOrderAmount(
    userId: string,
    buyExchangeName: string,
    sellExchangeName: string,
    symbol: string,
    maxOrderAmount: number,
  ): Promise<number> {
    try {
      // Parse the symbol to get the base and quote currencies
      const [base, quote] = symbol.split('/');
      
      // Get balances from both exchanges
      const buyExchangeBalances = await this.exchangeService.getBalances(userId, buyExchangeName);
      const sellExchangeBalances = await this.exchangeService.getBalances(userId, sellExchangeName);
      
      // Find the quote currency balance on the buy exchange
      const quoteBalance = buyExchangeBalances.find(b => b.currency === quote);
      const quoteAvailable = quoteBalance ? quoteBalance.free : 0;
      
      // Find the base currency balance on the sell exchange
      const baseBalance = sellExchangeBalances.find(b => b.currency === base);
      const baseAvailable = baseBalance ? baseBalance.free : 0;
      
      // Get current price to convert quote to base
      const buyExchange = await this.exchangeService.getExchangeInstance(userId, buyExchangeName);
      const ticker = await buyExchange.fetchTicker(symbol);
      const price = ticker.ask;
      
      // Calculate maximum possible order amount based on available balances
      const maxFromQuote = quoteAvailable / price;
      const maxFromBase = baseAvailable;
      
      // Use the smaller of the two maximums
      let orderAmount = Math.min(maxFromQuote, maxFromBase);
      
      // Cap at the maximum order amount specified in the strategy
      orderAmount = Math.min(orderAmount, maxOrderAmount);
      
      // Apply a small buffer to account for price fluctuations (95% of calculated amount)
      orderAmount = orderAmount * 0.95;
      
      return orderAmount;
    } catch (error) {
      this.logger.error(`Failed to calculate order amount: ${error.message}`);
      return 0;
    }
  }

  private async executeArbitrage(
    userId: string,
    buyExchangeName: string,
    sellExchangeName: string,
    symbol: string,
    amount: number,
    buySide: TradeSideType,
    sellSide: TradeSideType,
    buyPrice: number,
    sellPrice: number,
    strategyId: string,
  ): Promise<void> {
    try {
      // Get exchange instances
      const buyExchange = await this.exchangeService.getExchangeInstance(userId, buyExchangeName);
      const sellExchange = await this.exchangeService.getExchangeInstance(userId, sellExchangeName);
      
      // Adjust amount to exchange precision
      const adjustedAmount = this.amountToPrecision(buyExchange, symbol, amount);
      
      // Place buy order
      this.logger.debug(`Placing ${buySide} order for ${adjustedAmount} ${symbol} at ${buyPrice} on ${buyExchangeName}`);
      const buyOrder = await buyExchange.createMarketOrder(symbol, buySide, parseFloat(adjustedAmount));
      
      // Place sell order
      this.logger.debug(`Placing ${sellSide} order for ${adjustedAmount} ${symbol} at ${sellPrice} on ${sellExchangeName}`);
      const sellOrder = await sellExchange.createMarketOrder(symbol, sellSide, parseFloat(adjustedAmount));
      
      this.logger.debug(`Arbitrage executed successfully`);
      
      // Calculate profit
      const buyTotal = buyOrder.cost;
      const sellTotal = sellOrder.cost;
      const profit = sellTotal - buyTotal;
      const profitPercentage = (profit / buyTotal) * 100;
      
      this.logger.debug(`Arbitrage profit: ${profit.toFixed(8)} (${profitPercentage.toFixed(2)}%)`);
    } catch (error) {
      this.logger.error(`Failed to execute arbitrage: ${error.message}`);
      throw error;
    }
  }

  private amountToPrecision(
    exchange: any,
    symbol: string,
    amount: number,
  ): string {
    if (!exchange.markets || !exchange.markets[symbol]) {
      return amount.toString();
    }
    
    const precision = exchange.markets[symbol].precision?.amount || 8;
    return amount.toFixed(precision);
  }
}