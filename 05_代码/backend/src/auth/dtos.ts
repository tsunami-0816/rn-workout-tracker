import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** 手机号正则：边界输入拦截的第一道（架构 §8） */
export const PHONE_REGEX = /^1[3-9]\d{9}$/;

export class SendCodeDto {
  @ApiProperty({ example: '13900139000', description: '11 位中国大陆手机号' })
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone 必须是合法手机号' })
  phone!: string;
}

export class LoginDto {
  @ApiProperty({ example: '13900139000' })
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone 必须是合法手机号' })
  phone!: string;

  @ApiProperty({ example: '123456', description: '6 位演示验证码' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code 必须是 6 位数字' })
  code!: string;
}
