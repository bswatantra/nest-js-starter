import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePostDto {
  @IsString({ message: 'Title must be a string' })
  @IsNotEmpty({ message: 'Title must not be empty' })
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @IsString({ message: 'Content must be a string' })
  @IsOptional()
  @MaxLength(50000, { message: 'Content must not exceed 50000 characters' })
  content?: string;

  @IsInt({ message: 'Author ID must be an integer' })
  @IsPositive({ message: 'Author ID must be a positive integer' })
  authorId: number;

  @IsBoolean({ message: 'Published must be a boolean' })
  @IsOptional()
  published?: boolean;
}
