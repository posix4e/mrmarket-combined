export enum StrategyType {
  MARKET_MAKING = 'market_making',
  ARBITRAGE = 'arbitrage',
}

export enum StrategyStatus {
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  DELETED = 'deleted',
}

export enum PriceSourceType {
  TICKER = 'ticker',
  ORDERBOOK = 'orderbook',
  LAST_TRADE = 'last_trade',
}

export enum AmountChangeType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum TradeSideType {
  BUY = 'buy',
  SELL = 'sell',
}

export interface BaseStrategy {
  id: string;
  userId: string;
  type: StrategyType;
  status: StrategyStatus;
  createdAt: Date;
  updatedAt: Date;
  lastExecutionAt?: Date;
  pausedReason?: string;
}

export interface MarketMakingStrategy extends BaseStrategy {
  type: StrategyType.MARKET_MAKING;
  exchangeName: string;
  oracleExchangeName?: string;
  sideA: string;
  sideB: string;
  startPrice: number;
  bidSpread: number;
  askSpread: number;
  orderAmount: number;
  checkIntervalSeconds: number;
  numberOfLayers: number;
  priceSourceType: PriceSourceType;
  amountChangePerLayer: number;
  amountChangeType: AmountChangeType;
  ceilingPrice?: number;
  floorPrice?: number;
}

export interface ArbitrageStrategy extends BaseStrategy {
  type: StrategyType.ARBITRAGE;
  sourceExchangeName: string;
  targetExchangeName: string;
  symbol: string;
  minProfitPercentage: number;
  maxOrderAmount: number;
  checkIntervalSeconds: number;
}

export interface OrderDetail {
  buyPrice: number;
  sellPrice: number;
  currentOrderAmount: number;
  shouldBuy: boolean;
  shouldSell: boolean;
}

export interface PlaceOrderParams {
  userId: string;
  exchangeName: string;
  pair: string;
  side: TradeSideType;
  amount: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  strategyId?: string;
  exchangeName: string;
  symbol: string;
  orderId: string;
  side: TradeSideType;
  type: string;
  amount: number;
  price: number;
  status: string;
  filled: number;
  cost: number;
  fee?: {
    currency: string;
    cost: number;
  };
  createdAt: Date;
  updatedAt: Date;
}