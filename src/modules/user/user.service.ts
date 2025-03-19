import { Injectable } from '@nestjs/common';
import { User, UserRole } from '../../interfaces/user.interface';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async create(userData: {
    username: string;
    role: UserRole;
    fullName?: string;
    email?: string;
  }): Promise<User> {
    const now = new Date();
    
    return this.userRepository.create({
      ...userData,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    const updatedData = {
      ...userData,
      updatedAt: new Date(),
    };
    
    return this.userRepository.update(id, updatedData);
  }

  async delete(id: string): Promise<boolean> {
    return this.userRepository.delete(id);
  }
}