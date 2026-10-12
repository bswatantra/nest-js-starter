import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, handlePrismaError } from '@/models/prisma.service';
import { CACHE_KEYS, CacheService, normalizePagination } from './cache.service';
import type {
  PostModel,
  PostWithAuthorModel,
  PostWithAuthorSummaryModel,
} from '@/models/post.model';
import type { CreatePostDto, UpdatePostDto } from '@/dto';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private readThrough<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    return this.cache ? this.cache.getOrSet(key, fetcher) : fetcher();
  }

  private invalidateAuthorAndListCaches(authorId?: number): void {
    this.cache?.invalidatePrefix(CACHE_KEYS.POSTS_LIST_PREFIX);
    this.cache?.invalidatePrefix(CACHE_KEYS.USERS_LIST_PREFIX);
    if (authorId !== undefined) {
      this.cache?.delete(CACHE_KEYS.postByAuthor(authorId));
      this.cache?.delete(CACHE_KEYS.userId(authorId));
    } else {
      this.cache?.invalidatePrefix(CACHE_KEYS.POSTS_AUTHOR_PREFIX);
      this.cache?.invalidatePrefix(CACHE_KEYS.USERS_ID_PREFIX);
    }
  }

  async create(createPostDto: CreatePostDto): Promise<PostWithAuthorModel> {
    try {
      const post = await this.prisma.post.create({
        data: {
          title: createPostDto.title,
          content: createPostDto.content,
          published: createPostDto.published ?? false,
          authorId: createPostDto.authorId,
        },
        include: {
          author: true,
        },
      });
      this.invalidateAuthorAndListCaches(post.authorId);
      this.cache?.set(CACHE_KEYS.postId(post.id), post);
      return post;
    } catch (error: unknown) {
      handlePrismaError(error, {
        foreignKeyNotFound: `Author with ID ${createPostDto.authorId} not found`,
      });
    }
  }

  async findAll(page = 1, limit = 50): Promise<PostWithAuthorSummaryModel[]> {
    const {
      page: safePage,
      limit: safeLimit,
      skip,
    } = normalizePagination(page, limit);

    return this.readThrough(CACHE_KEYS.postList(safePage, safeLimit), () =>
      this.prisma.post.findMany({
        skip,
        take: safeLimit,
        include: {
          author: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(id: number): Promise<PostWithAuthorModel> {
    return this.readThrough(CACHE_KEYS.postId(id), async () => {
      const post = await this.prisma.post.findUnique({
        where: { id },
        include: {
          author: true,
        },
      });

      if (!post) {
        throw new NotFoundException(`Post with ID ${id} not found`);
      }

      return post;
    });
  }

  async findByAuthor(authorId: number): Promise<PostModel[]> {
    return this.readThrough(CACHE_KEYS.postByAuthor(authorId), async () => {
      const authorWithPosts = await this.prisma.user.findUnique({
        where: { id: authorId },
        select: {
          posts: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!authorWithPosts) {
        throw new NotFoundException(`Author with ID ${authorId} not found`);
      }

      return authorWithPosts.posts;
    });
  }

  async update(
    id: number,
    updatePostDto: UpdatePostDto,
  ): Promise<PostWithAuthorModel> {
    const data: Prisma.PostUpdateInput = {};
    if (updatePostDto.title !== undefined) data.title = updatePostDto.title;
    if (updatePostDto.content !== undefined)
      data.content = updatePostDto.content;
    if (updatePostDto.published !== undefined)
      data.published = updatePostDto.published;

    try {
      const updated = await this.prisma.post.update({
        where: { id },
        data,
        include: {
          author: true,
        },
      });
      this.invalidateAuthorAndListCaches(updated.authorId);
      this.cache?.set(CACHE_KEYS.postId(id), updated);
      return updated;
    } catch (error: unknown) {
      handlePrismaError(error, {
        notFound: `Post with ID ${id} not found`,
      });
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    try {
      const deleted = await this.prisma.post.delete({ where: { id } });
      this.cache?.delete(CACHE_KEYS.postId(id));
      this.invalidateAuthorAndListCaches(deleted.authorId);
      return { message: `Post with ID ${id} successfully deleted` };
    } catch (error: unknown) {
      handlePrismaError(error, {
        notFound: `Post with ID ${id} not found`,
      });
    }
  }
}
