import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import request from 'supertest';
import type { App } from 'supertest/types';
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
    app.use(helmet());
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

  describe('Health Routes & Security Headers', () => {
    it('/ (GET) returns ping and Helmet security headers', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.body).toMatchObject({
        status: 'ok',
      });
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('/health (GET) returns Terminus DB liveness check', async () => {
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
    it('POST /users fails data validation on invalid email or unknown fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'not-an-email', name: 'Alice' })
        .expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
      expect(JSON.stringify(res.body.message)).toContain('email');

      const extraFieldRes = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'valid@example.com', name: 'Alice', role: 'admin' })
        .expect(400);

      expect(extraFieldRes.body.statusCode).toBe(400);
    });

    it('POST /users creates user and supports offset & cursor pagination on GET /users', async () => {
      const u1 = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'alice@example.com', name: 'Alice' })
        .expect(201);

      const u2 = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'bob@example.com', name: 'Bob' })
        .expect(201);

      expect(u1.body.id).toBeDefined();
      expect(u2.body.id).toBeDefined();

      const listRes = await request(app.getHttpServer())
        .get('/users?page=1&limit=10')
        .expect(200);
      expect(listRes.body).toHaveLength(2);

      const firstItemId = Number(listRes.body[0].id);
      const cursorRes = await request(app.getHttpServer())
        .get(`/users?cursor=${firstItemId}&limit=10`)
        .expect(200);
      expect(cursorRes.body).toHaveLength(1);
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

    it('PATCH /users/:id and DELETE /users/:id update, delete, and handle 404s', async () => {
      const created = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'update@example.com', name: 'Before' })
        .expect(201);

      const userId = Number(created.body.id);

      const updated = await request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .send({ name: 'After' })
        .expect(200);
      expect(updated.body.name).toBe('After');

      await request(app.getHttpServer())
        .patch('/users/999999')
        .send({ name: 'Ghost' })
        .expect(404);

      const deleted = await request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .expect(200);
      expect(deleted.body.message).toContain('successfully deleted');

      await request(app.getHttpServer()).delete('/users/999999').expect(404);
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
    it('creates, paginates (offset & cursor), updates, and deletes posts with author relation', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'author@example.com', name: 'Author Name' })
        .expect(201);

      const authorId = Number(userRes.body.id);

      const postRes1 = await request(app.getHttpServer())
        .post('/posts')
        .send({
          title: 'First Architecture Post',
          content: 'Learning organized NestJS structure',
          authorId,
          published: true,
        })
        .expect(201);

      const postRes2 = await request(app.getHttpServer())
        .post('/posts')
        .send({
          title: 'Second Post',
          content: 'Testing cursor pagination',
          authorId,
          published: false,
        })
        .expect(201);

      const postId = Number(postRes1.body.id);
      expect(postRes2.body.id).toBeDefined();

      const allPosts = await request(app.getHttpServer())
        .get('/posts?page=1&limit=10')
        .expect(200);
      expect(allPosts.body).toHaveLength(2);

      const firstPostId = Number(allPosts.body[0].id);
      const cursorPosts = await request(app.getHttpServer())
        .get(`/posts?cursor=${firstPostId}&limit=10`)
        .expect(200);
      expect(cursorPosts.body).toHaveLength(1);

      const getPostRes = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);
      expect(getPostRes.body.author.email).toBe('author@example.com');

      const getAuthorPosts = await request(app.getHttpServer())
        .get(`/posts/user/${authorId}`)
        .expect(200);
      expect(getAuthorPosts.body).toHaveLength(2);

      const patchedPost = await request(app.getHttpServer())
        .patch(`/posts/${postId}`)
        .send({ title: 'Updated Title', published: false })
        .expect(200);
      expect(patchedPost.body.title).toBe('Updated Title');

      await request(app.getHttpServer()).delete(`/posts/${postId}`).expect(200);

      await request(app.getHttpServer()).get(`/posts/${postId}`).expect(404);
    });

    it('POST /posts with non-existent authorId returns 404 Not Found', async () => {
      const res = await request(app.getHttpServer())
        .post('/posts')
        .send({
          title: 'Orphan Post',
          content: 'No author',
          authorId: 999999,
        })
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: 'Author with ID 999999 not found',
      });
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
