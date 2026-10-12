import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '@/controllers/users.controller';
import { UsersService } from '@/services/users.service';

describe('UsersController', () => {
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
});
