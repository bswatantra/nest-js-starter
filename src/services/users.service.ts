import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService, handlePrismaError } from '@/models/prisma.service';
import { CACHE_KEYS, CacheService, normalizePagination } from './cache.service';
import type {
  UserModel,
  UserWithPostsModel,
  UserWithCountModel,
} from '@/models/user.model';
import type { CreateUserDto, UpdateUserDto } from '@/dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private readThrough<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    return this.cache ? this.cache.getOrSet(key, fetcher) : fetcher();
  }

  async create(createUserDto: CreateUserDto): Promise<UserModel> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          name: createUserDto.name,
        },
      });
      this.cache?.invalidatePrefix(CACHE_KEYS.USERS_LIST_PREFIX);
      this.cache?.set<UserWithPostsModel>(CACHE_KEYS.userId(user.id), {
        ...user,
        posts: [],
      });
      return user;
    } catch (error: unknown) {
      handlePrismaError(error, {
        conflict: `User with email "${createUserDto.email}" already exists`,
      });
    }
  }

  async findAll(
    page = 1,
    limit = 50,
    cursor?: number,
  ): Promise<UserWithCountModel[]> {
    const {
      page: safePage,
      limit: safeLimit,
      skip,
      cursor: safeCursor,
    } = normalizePagination(page, limit, cursor);

    return this.readThrough(
      CACHE_KEYS.userList(safePage, safeLimit, safeCursor),
      () =>
        this.prisma.user.findMany({
          skip,
          take: safeLimit,
          ...(safeCursor !== undefined ? { cursor: { id: safeCursor } } : {}),
          include: {
            _count: {
              select: { posts: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
    );
  }

  async findOne(id: number): Promise<UserWithPostsModel> {
    return this.readThrough(CACHE_KEYS.userId(id), async () => {
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

      return user;
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<UserModel> {
    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });
      this.cache?.delete(CACHE_KEYS.userId(id));
      this.cache?.invalidatePrefix(CACHE_KEYS.USERS_LIST_PREFIX);
      this.cache?.invalidatePrefix(CACHE_KEYS.POSTS_LIST_PREFIX);
      this.cache?.invalidatePrefix(CACHE_KEYS.POSTS_ID_PREFIX);
      return updated;
    } catch (error: unknown) {
      handlePrismaError(error, {
        notFound: `User with ID ${id} not found`,
        conflict: `Email "${String(updateUserDto.email)}" is already used by another user`,
      });
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    try {
      await this.prisma.user.delete({ where: { id } });
      this.cache?.delete(CACHE_KEYS.userId(id));
      this.cache?.invalidatePrefix(CACHE_KEYS.USERS_LIST_PREFIX);
      this.cache?.invalidatePrefix(CACHE_KEYS.POSTS_PREFIX);
      return { message: `User with ID ${id} successfully deleted` };
    } catch (error: unknown) {
      handlePrismaError(error, {
        notFound: `User with ID ${id} not found`,
      });
    }
  }
}
