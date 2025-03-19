# MrMarket Combined

A simplified, combined version of Mr. Market and Trading Strategy Evaluator, using Redis for data storage.

## Features

- User authentication and management
- Exchange API key management
- Market making strategies
- Arbitrage strategies
- Real-time market data
- Order management
- Balance tracking

## Technology Stack

- NestJS (TypeScript)
- Redis for data storage
- CCXT for exchange integrations
- Socket.IO for real-time updates

## Getting Started

### Prerequisites

- Node.js (v16+)
- Redis

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the example environment file:
   ```
   cp .env.example .env
   ```
4. Update the environment variables in the `.env` file
5. Start the application:
   ```
   npm run start:dev
   ```

### Using Docker

You can also run the application using Docker:

```
docker-compose up -d
```

## API Endpoints

### Authentication

- `POST /auth/login` - Login
- `POST /auth/register` - Register a new user

### Users

- `GET /users/profile` - Get current user profile
- `PUT /users/:id` - Update user

### Exchanges

- `GET /exchanges/supported` - Get supported exchanges
- `GET /exchanges/api-keys` - Get user's API keys
- `POST /exchanges/api-keys` - Add a new API key
- `PUT /exchanges/api-keys/:id` - Update an API key
- `DELETE /exchanges/api-keys/:id` - Delete an API key
- `GET /exchanges/balances` - Get all balances
- `GET /exchanges/balances/:exchangeName` - Get balances for a specific exchange
- `POST /exchanges/balances/:exchangeName/refresh` - Refresh balances
- `GET /exchanges/:exchangeName/symbols` - Get supported symbols
- `GET /exchanges/:exchangeName/ticker` - Get ticker data
- `GET /exchanges/:exchangeName/orderbook` - Get orderbook data

### Strategies

- `GET /strategies` - Get all strategies
- `GET /strategies/:id` - Get a specific strategy
- `POST /strategies/market-making` - Create a market making strategy
- `POST /strategies/arbitrage` - Create an arbitrage strategy
- `PUT /strategies/:id` - Update a strategy
- `POST /strategies/:id/pause` - Pause a strategy
- `POST /strategies/:id/resume` - Resume a strategy
- `POST /strategies/:id/stop` - Stop a strategy
- `DELETE /strategies/:id` - Delete a strategy
- `GET /strategies/orders` - Get all orders
- `DELETE /strategies/orders/:id` - Cancel an order

### Health

- `GET /health` - Check application health

## Architecture

This application follows a modular architecture with clear separation of concerns:

- **Modules**: Each feature is encapsulated in its own module
- **Services**: Business logic is contained in services
- **Controllers**: Handle HTTP requests and responses
- **Repositories**: Data access layer using Redis
- **Interfaces**: Define data structures and types

## Redis Data Structure

The application uses Redis as its primary data store with the following key patterns:

- `user:{id}` - User data
- `user:{id}:password` - Hashed password
- `exchange_api_key:{id}` - Exchange API key data
- `exchange_balance:{userId}:{exchangeName}:{currency}` - Balance data
- `strategy:{id}` - Strategy data
- `order:{id}` - Order data

## License

This project is licensed under the MIT License - see the LICENSE file for details.