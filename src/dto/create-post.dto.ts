import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePostDto {
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title must not be empty' })
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  title: string;

  @IsString({ message: 'Content must be a string' })
  @IsOptional()
  content?: string;

  @IsInt({ message: 'Author ID must be an integer' })
  @IsPositive({ message: 'Author ID must be a positive integer' })
  authorId: number;

  @IsBoolean({ message: 'Published must be a boolean' })
  @IsOptional()
  published?: boolean;
}

