import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ROUTES } from '@/routes/app.routes';
import { UsersService } from '@/services/users.service';
import { CreateUserDto, UpdateUserDto } from '@/dto';
import type {
  UserModel,
  UserWithPostsModel,
  UserWithCountModel,
} from '@/models/user.model';

@Controller(ROUTES.USERS.ROOT)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<UserModel> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<UserWithCountModel[]> {
    return this.usersService.findAll(page, limit);
  }

  @Get(ROUTES.USERS.BY_ID)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserWithPostsModel> {
    return this.usersService.findOne(id);
  }

  @Patch(ROUTES.USERS.BY_ID)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserModel> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(ROUTES.USERS.BY_ID)
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    return this.usersService.remove(id);
  }
}
