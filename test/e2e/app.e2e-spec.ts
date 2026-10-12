import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/models/prisma.service';
import { CacheService } from '@/services/cache.service';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cache: CacheService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
    cache = app.get<CacheService>(CacheService);
  });

  afterEach(async () => {
    cache.clear();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Routes', () => {
    it('/ (GET)', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
      });
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('/health (GET)', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
        info: {
          database: {
            status: 'up',
          },
        },
      });
    });
  });

  describe('Users Controller & Validation', () => {
    it('POST /users fails data validation on invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'not-an-email', name: 'Alice' })
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
      expect(JSON.stringify(res.body.message)).toContain('email');
    });

    it('POST /users creates user when validation passes', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'alice@example.com', name: 'Alice' })
        .expect(201);

      expect(res.body).toMatchObject({
        email: 'alice@example.com',
        name: 'Alice',
      });
      expect(res.body.id).toBeDefined();
    });

    it('POST /users rejects duplicate email with default Nest 409 format', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'duplicate@example.com', name: 'User 1' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'duplicate@example.com', name: 'User 2' })
        .expect(409);

      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        message: 'User with email "duplicate@example.com" already exists',
      });
    });

    it('GET /users/9999 returns default Nest 404 format', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/9999')
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: 'User with ID 9999 not found',
      });
    });
  });

  describe('Posts Controller & Model Relations', () => {
    it('creates post linked to user and retrieves with author relation', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'author@example.com', name: 'Author Name' })
        .expect(201);

      const authorId = userRes.body.id;

      const postRes = await request(app.getHttpServer())
        .post('/posts')
        .send({
          title: 'First Architecture Post',
          content: 'Learning organized NestJS structure',
          authorId,
          published: true,
        })
        .expect(201);

      expect(postRes.body).toMatchObject({
        title: 'First Architecture Post',
        authorId,
        published: true,
      });

      const postId = postRes.body.id;

      const getPostRes = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);

      expect(getPostRes.body.author.email).toBe('author@example.com');

      const getAuthorPosts = await request(app.getHttpServer())
        .get(`/posts/user/${authorId}`)
        .expect(200);

      expect(getAuthorPosts.body).toHaveLength(1);
      expect(getAuthorPosts.body[0].title).toBe('First Architecture Post');
    });
  });

  describe('Exceptions', () => {
    it('/not-found (GET) returns default NestJS 404 response', async () => {
      const res = await request(app.getHttpServer())
        .get('/not-found')
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: 'Cannot GET /not-found',
      });
    });
  });
});
