import type { User as PrismaUser, Post as PrismaPost } from '@prisma/client';

export type UserModel = PrismaUser;

export type UserWithPostsModel = PrismaUser & {
  posts: PrismaPost[];
};

export type UserWithCountModel = PrismaUser & {
  _count: {
    posts: number;
  };
};
