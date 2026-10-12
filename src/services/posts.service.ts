import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/models/prisma.service';
import { CacheService } from './cache.service';
import type {
  PostModel,
  PostWithAuthorModel,
  PostWithAuthorSummaryModel,
} from '@/models/post.model';
import type { CreatePostDto, UpdatePostDto } from '@/dto';

@Injectable()
export class PostsService {
  private static readonly CACHE_LIST_PREFIX = 'posts:list:';
  private static readonly CACHE_ID_PREFIX = 'posts:id:';
  private static readonly CACHE_AUTHOR_PREFIX = 'posts:author:';

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private invalidateAuthorAndListCaches(authorId?: number): void {
    this.cache?.invalidatePrefix(PostsService.CACHE_LIST_PREFIX);
    this.cache?.invalidatePrefix('users:list:');
    if (authorId !== undefined) {
      this.cache?.delete(`${PostsService.CACHE_AUTHOR_PREFIX}${authorId}`);
      this.cache?.delete(`users:id:${authorId}`);
    } else {
      this.cache?.invalidatePrefix(PostsService.CACHE_AUTHOR_PREFIX);
      this.cache?.invalidatePrefix('users:id:');
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
      this.cache?.set(`${PostsService.CACHE_ID_PREFIX}${post.id}`, post);
      return post;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException(
          `Author with ID ${createPostDto.authorId} not found`,
        );
      }
      throw error;
    }
  }

  async findAll(page = 1, limit = 50): Promise<PostWithAuthorSummaryModel[]> {
    const cacheKey = `${PostsService.CACHE_LIST_PREFIX}${page}:${limit}`;
    const cached = this.cache?.get<PostWithAuthorSummaryModel[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const skip = Math.max(0, (page - 1) * limit);
    const posts = await this.prisma.post.findMany({
      skip,
      take: limit,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    this.cache?.set(cacheKey, posts);
    return posts;
  }

  async findOne(id: number): Promise<PostWithAuthorModel> {
    const cacheKey = `${PostsService.CACHE_ID_PREFIX}${id}`;
    const cached = this.cache?.get<PostWithAuthorModel>(cacheKey);
    if (cached) {
      return cached;
    }

    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: true,
      },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${id} not found`);
    }

    this.cache?.set(cacheKey, post);
    return post;
  }

  async findByAuthor(authorId: number): Promise<PostModel[]> {
    const cacheKey = `${PostsService.CACHE_AUTHOR_PREFIX}${authorId}`;
    const cached = this.cache?.get<PostModel[]>(cacheKey);
    if (cached) {
      return cached;
    }

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

    this.cache?.set(cacheKey, authorWithPosts.posts);
    return authorWithPosts.posts;
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
      this.cache?.set(`${PostsService.CACHE_ID_PREFIX}${id}`, updated);
      return updated;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Post with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    try {
      const deleted = await this.prisma.post.delete({ where: { id } });
      this.cache?.delete(`${PostsService.CACHE_ID_PREFIX}${id}`);
      this.invalidateAuthorAndListCaches(deleted.authorId);
      return { message: `Post with ID ${id} successfully deleted` };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Post with ID ${id} not found`);
      }
      throw error;
    }
  }
}
