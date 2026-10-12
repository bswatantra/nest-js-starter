import type { Post as PrismaPost, User as PrismaUser } from '@prisma/client';

export type PostModel = PrismaPost;

export type PostWithAuthorModel = PrismaPost & {
  author: PrismaUser;
};

export type PostWithAuthorSummaryModel = PrismaPost & {
  author: Pick<PrismaUser, 'id' | 'name' | 'email'>;
};
