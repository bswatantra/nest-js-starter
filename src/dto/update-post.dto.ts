import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePostDto {
  @IsString({ message: 'Title must be a string' })
  @IsOptional()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  title?: string;

  @IsString({ message: 'Content must be a string' })
  @IsOptional()
  content?: string;

  @IsBoolean({ message: 'Published must be a boolean' })
  @IsOptional()
  published?: boolean;
}
