import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

function bearer(h?: string) {
  if (!h) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1];
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login') login(@Body() body: object) { return this.auth.login(body); }
  @Post('register') register(@Body() body: object) { return this.auth.register(body); }
  @Post('logout') logout(@Headers('authorization') auth?: string) { return this.auth.logout(bearer(auth)); }
  @Get('me') me(@Headers('authorization') auth?: string) { return this.auth.me(bearer(auth)); }
  @Post('email/verify/request') requestEmailVerify(@Headers('authorization') auth?: string) {
    return this.auth.requestEmailVerification(bearer(auth));
  }
  @Post('email/verify/confirm') confirmEmailVerify(@Body() body: object) {
    return this.auth.confirmEmailVerification(body);
  }
  @Post('password/reset/request') requestPasswordReset(@Body() body: object) {
    return this.auth.requestPasswordReset(body);
  }
  @Post('password/reset/confirm') confirmPasswordReset(@Body() body: object) {
    return this.auth.confirmPasswordReset(body);
  }
}
