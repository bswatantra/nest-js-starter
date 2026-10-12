import {
  Injectable,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/models/prisma.service';
import { CacheService } from './cache.service';
import type {
  UserModel,
  UserWithPostsModel,
  UserWithCountModel,
} from '@/models/user.model';
import type { CreateUserDto, UpdateUserDto } from '@/dto';

@Injectable()
export class UsersService {
  private static readonly CACHE_LIST_PREFIX = 'users:list:';
  private static readonly CACHE_ID_PREFIX = 'users:id:';

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserModel> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          name: createUserDto.name,
        },
      });
      this.cache?.invalidatePrefix(UsersService.CACHE_LIST_PREFIX);
      this.cache?.set<UserWithPostsModel>(
        `${UsersService.CACHE_ID_PREFIX}${user.id}`,
        { ...user, posts: [] },
      );
      return user;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `User with email "${createUserDto.email}" already exists`,
        );
      }
      throw error;
    }
  }

  async findAll(page = 1, limit = 50): Promise<UserWithCountModel[]> {
    const cacheKey = `${UsersService.CACHE_LIST_PREFIX}${page}:${limit}`;
    const cached = this.cache?.get<UserWithCountModel[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const skip = Math.max(0, (page - 1) * limit);
    const users = await this.prisma.user.findMany({
      skip,
      take: limit,
      include: {
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    this.cache?.set(cacheKey, users);
    return users;
  }

  async findOne(id: number): Promise<UserWithPostsModel> {
    const cacheKey = `${UsersService.CACHE_ID_PREFIX}${id}`;
    const cached = this.cache?.get<UserWithPostsModel>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        posts: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.cache?.set(cacheKey, user);
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<UserModel> {
    const data: Prisma.UserUpdateInput = {};
    if (updateUserDto.email !== undefined) data.email = updateUserDto.email;
    if (updateUserDto.name !== undefined) data.name = updateUserDto.name;

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data,
      });
      this.cache?.delete(`${UsersService.CACHE_ID_PREFIX}${id}`);
      this.cache?.invalidatePrefix(UsersService.CACHE_LIST_PREFIX);
      this.cache?.invalidatePrefix('posts:list:');
      this.cache?.invalidatePrefix('posts:id:');
      return updated;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`User with ID ${id} not found`);
        }
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Email "${updateUserDto.email}" is already used by another user`,
          );
        }
      }
      throw error;
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    try {
      await this.prisma.user.delete({ where: { id } });
      this.cache?.delete(`${UsersService.CACHE_ID_PREFIX}${id}`);
      this.cache?.invalidatePrefix(UsersService.CACHE_LIST_PREFIX);
      this.cache?.invalidatePrefix('posts:');
      return { message: `User with ID ${id} successfully deleted` };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw error;
    }
  }
}
