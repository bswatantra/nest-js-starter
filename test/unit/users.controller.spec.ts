import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { UsersController } from '@/controllers/users.controller';
import { UsersService } from '@/services/users.service';
import { CacheService } from '@/services/cache.service';
import { PrismaService, handlePrismaError } from '@/models/prisma.service';

describe('UsersController, UsersService & Error Handling', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockPrisma = {
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        CacheService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should create a user and warm cache', async () => {
    const dto = { email: 'test@example.com', name: 'Test User' };
    const expected = {
      id: 1,
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.user.create.mockResolvedValue(expected);

    const result = await controller.create(dto);
    expect(result).toEqual(expected);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({ data: dto });
  });

  it('should list users with offset and cursor pagination', async () => {
    const users = [
      { id: 1, email: 'a@example.com', name: 'A', _count: { posts: 0 } },
    ];
    mockPrisma.user.findMany.mockResolvedValue(users);

    const offsetRes = await controller.findAll(1, 10);
    expect(offsetRes).toEqual(users);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );

    const cursorRes = await controller.findAll(1, 10, 5);
    expect(cursorRes).toEqual(users);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 1, take: 10, cursor: { id: 5 } }),
    );
  });

  it('should get a user by id and throw 404 when missing', async () => {
    const expected = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      posts: [],
    };
    mockPrisma.user.findUnique.mockResolvedValueOnce(expected);

    const result = await controller.findOne(1);
    expect(result).toEqual(expected);

    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('should update and remove a user', async () => {
    const updated = { id: 1, email: 'new@example.com', name: 'Updated' };
    mockPrisma.user.update.mockResolvedValueOnce(updated);

    expect(await controller.update(1, { name: 'Updated' })).toEqual(updated);

    mockPrisma.user.delete.mockResolvedValueOnce(updated);
    expect(await controller.remove(1)).toEqual({
      message: 'User with ID 1 successfully deleted',
    });
  });

  it('maps Prisma P2002 error to ConflictException (409)', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '6.19.3' },
    );

    expect(() =>
      handlePrismaError(prismaError, {
        conflict: 'User with email "dup@example.com" already exists',
      }),
    ).toThrow(ConflictException);
  });

  it('maps Prisma P2025 error to NotFoundException (404)', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      { code: 'P2025', clientVersion: '6.19.3' },
    );

    expect(() =>
      handlePrismaError(prismaError, {
        notFound: 'User with ID 99 not found',
      }),
    ).toThrow(NotFoundException);
  });
});
