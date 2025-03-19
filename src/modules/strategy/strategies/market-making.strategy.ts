import { Injectable, Logger } from '@nestjs/common';
import { ExchangeService } from '../../exchange/exchange.service';
import { 
  MarketMakingStrategy as MarketMakingStrategyType,
  OrderDetail,
  TradeSideType,
  PriceSourceType,
  AmountChangeType
} from '../../../interfaces/strategy.interface';
import * as ccxt from 'ccxt';

@Injectable()
export class MarketMakingStrategy {
  private readonly logger = new Logger(MarketMakingStrategy.name);

  constructor(private readonly exchangeService: ExchangeService) {}

  async execute(strategy: MarketMakingStrategyType): Promise<void> {
    this.logger.debug(`Executing market making strategy ${strategy.id}`);
    
    const {
      userId,
      exchangeName,
      oracleExchangeName,
      sideA,
      sideB,
      bidSpread,
      askSpread,
      orderAmount,
      numberOfLayers,
      priceSourceType,
      amountChangePerLayer,
      amountChangeType,
      ceilingPrice,
      floorPrice,
    } = strategy;

    const pair = `${sideA}/${sideB}`;

    // Cancel existing orders
    await this.cancelExistingOrders(userId, exchangeName, pair);

    // Get price source
    const priceSource = await this.getPriceSource(
      userId,
      oracleExchangeName || exchangeName,
      pair,
      priceSourceType,
    );

    // Calculate order details
    const orderDetails = this.calculateOrderDetails(
      orderAmount,
      numberOfLayers,
      amountChangeType,
      amountChangePerLayer,
      bidSpread,
      askSpread,
      priceSource,
      ceilingPrice,
      floorPrice,
    );

    // Place orders
    const exchange = await this.exchangeService.getExchangeInstance(userId, exchangeName);
    
    for (const detail of orderDetails) {
      const adjustedAmount = this.amountToPrecision(exchange, pair, detail.currentOrderAmount);
      
      // Place buy order
      if (detail.shouldBuy) {
        const adjustedPrice = this.priceToPrecision(exchange, pair, detail.buyPrice);
        await this.placeOrder(userId, exchangeName, pair, TradeSideType.BUY, 
          parseFloat(adjustedAmount), parseFloat(adjustedPrice), strategy.id);
      } else {
        this.logger.debug(
          `Skipping buy order for ${pair} as price source ${priceSource} is above the ceiling price ${ceilingPrice}.`,
        );
      }

      // Place sell order
      if (detail.shouldSell) {
        const adjustedPrice = this.priceToPrecision(exchange, pair, detail.sellPrice);
        await this.placeOrder(userId, exchangeName, pair, TradeSideType.SELL, 
          parseFloat(adjustedAmount), parseFloat(adjustedPrice), strategy.id);
      } else {
        this.logger.debug(
          `Skipping sell order for ${pair} as price source ${priceSource} is below the floor price ${floorPrice}.`,
        );
      }
    }
  }

  private async cancelExistingOrders(
    userId: string,
    exchangeName: string,
    symbol: string,
  ): Promise<void> {
    try {
      const exchange = await this.exchangeService.getExchangeInstance(userId, exchangeName);
      const openOrders = await exchange.fetchOpenOrders(symbol);
      
      for (const order of openOrders) {
        await exchange.cancelOrder(order.id, symbol);
      }
      
      this.logger.debug(
        `Cancelled ${openOrders.length} open orders for ${symbol} on ${exchangeName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to cancel existing orders for ${symbol} on ${exchangeName}: ${error.message}`,
      );
      throw error;
    }
  }

  private async getPriceSource(
    userId: string,
    exchangeName: string,
    symbol: string,
    priceSourceType: PriceSourceType,
  ): Promise<number> {
    try {
      const exchange = await this.exchangeService.getExchangeInstance(userId, exchangeName);
      
      switch (priceSourceType) {
        case PriceSourceType.TICKER: {
          const ticker = await exchange.fetchTicker(symbol);
          return ticker.last;
        }
        case PriceSourceType.ORDERBOOK: {
          const orderbook = await exchange.fetchOrderBook(symbol);
          const bid = orderbook.bids[0][0];
          const ask = orderbook.asks[0][0];
          return (bid + ask) / 2;
        }
        case PriceSourceType.LAST_TRADE: {
          const trades = await exchange.fetchTrades(symbol, undefined, 1);
          return trades[0].price;
        }
        default:
          throw new Error(`Unsupported price source type: ${priceSourceType}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to get price source for ${symbol} on ${exchangeName}: ${error.message}`,
      );
      throw error;
    }
  }

  private calculateOrderDetails(
    orderAmount: number,
    numberOfLayers: number,
    amountChangeType: AmountChangeType,
    amountChangePerLayer: number,
    bidSpread: number,
    askSpread: number,
    priceSource: number,
    ceilingPrice?: number,
    floorPrice?: number,
  ): OrderDetail[] {
    const orderDetails: OrderDetail[] = [];
    
    for (let i = 0; i < numberOfLayers; i++) {
      let currentOrderAmount = orderAmount;
      
      if (i > 0) {
        if (amountChangeType === AmountChangeType.PERCENTAGE) {
          currentOrderAmount = orderAmount * Math.pow(1 + amountChangePerLayer / 100, i);
        } else {
          currentOrderAmount = orderAmount + amountChangePerLayer * i;
        }
      }
      
      const layerBidSpread = bidSpread * (i + 1);
      const layerAskSpread = askSpread * (i + 1);
      
      const buyPrice = priceSource * (1 - layerBidSpread / 100);
      const sellPrice = priceSource * (1 + layerAskSpread / 100);
      
      const shouldBuy = ceilingPrice ? buyPrice <= ceilingPrice : true;
      const shouldSell = floorPrice ? sellPrice >= floorPrice : true;
      
      orderDetails.push({
        buyPrice,
        sellPrice,
        currentOrderAmount,
        shouldBuy,
        shouldSell,
      });
    }
    
    return orderDetails;
  }

  private async placeOrder(
    userId: string,
    exchangeName: string,
    symbol: string,
    side: TradeSideType,
    amount: number,
    price: number,
    strategyId: string,
  ): Promise<void> {
    try {
      const exchange = await this.exchangeService.getExchangeInstance(userId, exchangeName);
      await exchange.createLimitOrder(symbol, side, amount, price);
      
      this.logger.debug(
        `Placed ${side} order for ${amount} ${symbol} at ${price} on ${exchangeName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to place ${side} order for ${symbol} on ${exchangeName}: ${error.message}`,
      );
      throw error;
    }
  }

  private amountToPrecision(
    exchange: ccxt.Exchange,
    symbol: string,
    amount: number,
  ): string {
    if (!exchange.markets || !exchange.markets[symbol]) {
      return amount.toString();
    }
    
    const precision = exchange.markets[symbol].precision?.amount || 8;
    return amount.toFixed(precision);
  }

  private priceToPrecision(
    exchange: ccxt.Exchange,
    symbol: string,
    price: number,
  ): string {
    if (!exchange.markets || !exchange.markets[symbol]) {
      return price.toString();
    }
    
    const precision = exchange.markets[symbol].precision?.price || 8;
    return price.toFixed(precision);
  }
}