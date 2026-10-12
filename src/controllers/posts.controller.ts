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
import { PostsService } from '@/services/posts.service';
import { CreatePostDto, UpdatePostDto } from '@/dto';
import type {
  PostModel,
  PostWithAuthorModel,
  PostWithAuthorSummaryModel,
} from '@/models/post.model';

@Controller(ROUTES.POSTS.ROOT)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createPostDto: CreatePostDto,
  ): Promise<PostWithAuthorModel> {
    return this.postsService.create(createPostDto);
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: number,
  ): Promise<PostWithAuthorSummaryModel[]> {
    return this.postsService.findAll(page, limit, cursor);
  }

  @Get(ROUTES.POSTS.BY_USER)
  async findByAuthor(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<PostModel[]> {
    return this.postsService.findByAuthor(userId);
  }

  @Get(ROUTES.POSTS.BY_ID)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostWithAuthorModel> {
    return this.postsService.findOne(id);
  }

  @Patch(ROUTES.POSTS.BY_ID)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
  ): Promise<PostWithAuthorModel> {
    return this.postsService.update(id, updatePostDto);
  }

  @Delete(ROUTES.POSTS.BY_ID)
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    return this.postsService.remove(id);
  }
}
