import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdatePostDto {
  @IsString({ message: 'Title must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @IsString({ message: 'Content must be a string' })
  @IsOptional()
  @MaxLength(50000, { message: 'Content must not exceed 50000 characters' })
  content?: string;

  @IsBoolean({ message: 'Published must be a boolean' })
  @IsOptional()
  published?: boolean;
}
