import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PostsController } from '@/controllers/posts.controller';
import { PostsService } from '@/services/posts.service';
import { handlePrismaError } from '@/models/prisma.service';

describe('PostsController & Error Handling', () => {
  let controller: PostsController;
  let service: PostsService;

  const mockPostsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    findByAuthor: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: mockPostsService,
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
    };

    mockPostsService.create.mockResolvedValue(expected);

    const result = await controller.create(dto);
    expect(result).toEqual(expected);
    expect(mockPostsService.create).toHaveBeenCalledWith(dto);
  });

  it('should get posts by author', async () => {
    const expected = [{ id: 1, title: 'New Post', authorId: 1 }];
    mockPostsService.findByAuthor.mockResolvedValue(expected);

    const result = await controller.findByAuthor(1);
    expect(result).toEqual(expected);
    expect(mockPostsService.findByAuthor).toHaveBeenCalledWith(1);
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
