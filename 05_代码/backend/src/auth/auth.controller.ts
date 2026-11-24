import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, Public } from '../common/decorators';
import { AuthService } from './auth.service';
import { LoginDto, SendCodeDto } from './dtos';

/** G1 认证（3 端点） */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('send-code')
  @HttpCode(200)
  @ApiOperation({ summary: '发送验证码（60s 频控）' })
  sendCode(@Body() dto: SendCodeDto): { cooldown: number } {
    return this.auth.sendCode(dto.phone);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '验证码登录，签发 7 天 JWT' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.phone, dto.code);
  }

  @Get('me')
  @ApiOperation({ summary: '当前用户（手机号脱敏）' })
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }
}
