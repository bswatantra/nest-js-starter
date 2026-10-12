import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PostsController } from '@/controllers/posts.controller';
import { PostsService } from '@/services/posts.service';
import { CacheService } from '@/services/cache.service';
import { PrismaService, handlePrismaError } from '@/models/prisma.service';

describe('PostsController, PostsService & Error Handling', () => {
  let controller: PostsController;
  let service: PostsService;

  const mockPrisma = {
    post: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        PostsService,
        CacheService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    controller = module.get<PostsController>(PostsController);
    service = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should create a post', async () => {
    const dto = {
      title: 'New Post',
      content: 'Content',
      authorId: 1,
      published: true,
    };
    const expected = {
      id: 1,
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: 1, email: 'a@example.com', name: 'A' },
    };

    mockPrisma.post.create.mockResolvedValue(expected);

    const result = await controller.create(dto);
    expect(result).toEqual(expected);
  });

  it('should list posts with offset and cursor pagination', async () => {
    const posts = [{ id: 1, title: 'Post 1', authorId: 1 }];
    mockPrisma.post.findMany.mockResolvedValue(posts);

    expect(await controller.findAll(1, 10)).toEqual(posts);
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );

    expect(await controller.findAll(1, 10, 7)).toEqual(posts);
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, take: 10, cursor: { id: 7 } }),
    );
  });

  it('should get a post by id and throw 404 when missing', async () => {
    const post = { id: 1, title: 'New Post', authorId: 1 };
    mockPrisma.post.findUnique.mockResolvedValueOnce(post);
    expect(await controller.findOne(1)).toEqual(post);

    mockPrisma.post.findUnique.mockResolvedValueOnce(null);
    await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should get posts by author and throw 404 when author missing', async () => {
    const expected = [{ id: 1, title: 'New Post', authorId: 1 }];
    mockPrisma.user.findUnique.mockResolvedValueOnce({ posts: expected });

    const result = await controller.findByAuthor(1);
    expect(result).toEqual(expected);

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(controller.findByAuthor(999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update and remove a post', async () => {
    const updated = { id: 1, title: 'Updated', authorId: 1 };
    mockPrisma.post.update.mockResolvedValueOnce(updated);
    expect(await controller.update(1, { title: 'Updated' })).toEqual(updated);

    mockPrisma.post.delete.mockResolvedValueOnce(updated);
    expect(await controller.remove(1)).toEqual({
      message: 'Post with ID 1 successfully deleted',
    });
  });

  it('maps Prisma P2003 foreign key error to NotFoundException (404)', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint failed',
      { code: 'P2003', clientVersion: '6.19.3' },
    );

    expect(() =>
      handlePrismaError(prismaError, {
        foreignKeyNotFound: 'Author with ID 42 not found',
      }),
    ).toThrow(NotFoundException);
  });
});
