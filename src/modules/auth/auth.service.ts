import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { User, UserRole } from '../../interfaces/user.interface';
import { RedisService } from '../../utils/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    // For admin user, check against environment variables
    if (username === this.configService.get<string>('ADMIN_USERNAME')) {
      const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
      if (this.comparePasswords(password, adminPassword)) {
        // Create admin user if it doesn't exist
        let adminUser = await this.userService.findByUsername(username);
        if (!adminUser) {
          adminUser = await this.userService.create({
            username,
            role: UserRole.ADMIN,
            fullName: 'Administrator',
          });
        }
        return adminUser;
      }
      return null;
    }

    // For regular users
    const user = await this.userService.findByUsername(username);
    if (!user) return null;

    const passwordHash = await this.redisService.get<string>(`user:${user.id}:password`);
    if (!passwordHash) return null;

    if (this.comparePasswords(password, passwordHash)) {
      return user;
    }
    
    return null;
  }

  async login(user: User) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
      },
    };
  }

  async register(username: string, password: string, fullName?: string): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userService.findByUsername(username);
    if (existingUser) {
      throw new UnauthorizedException('Username already exists');
    }

    // Create new user
    const user = await this.userService.create({
      username,
      role: UserRole.USER,
      fullName,
    });

    // Store password hash
    const passwordHash = this.hashPassword(password);
    await this.redisService.set(`user:${user.id}:password`, passwordHash);

    return user;
  }

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
      .toString('hex');
    return `${salt}:${hash}`;
  }

  private comparePasswords(password: string, storedPassword: string): boolean {
    // For admin user, direct comparison if no salt is present
    if (!storedPassword.includes(':')) {
      return password === storedPassword;
    }

    // For hashed passwords
    const [salt, hash] = storedPassword.split(':');
    const calculatedHash = crypto
      .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
      .toString('hex');
    return hash === calculatedHash;
  }
}