import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { UsersController } from '@/controllers/users.controller';
import { UsersService } from '@/services/users.service';
import { handlePrismaError } from '@/models/prisma.service';

describe('UsersController & Error Handling', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
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

  it('should create a user', async () => {
    const dto = { email: 'test@example.com', name: 'Test User' };
    const expected = {
      id: 1,
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUsersService.create.mockResolvedValue(expected);

    const result = await controller.create(dto);
    expect(result).toEqual(expected);
    expect(mockUsersService.create).toHaveBeenCalledWith(dto);
  });

  it('should get a user by id', async () => {
    const expected = { id: 1, email: 'test@example.com', name: 'Test User' };
    mockUsersService.findOne.mockResolvedValue(expected);

    const result = await controller.findOne(1);
    expect(result).toEqual(expected);
    expect(mockUsersService.findOne).toHaveBeenCalledWith(1);
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
