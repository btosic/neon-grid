import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * REST route guard — validates Bearer JWT in Authorization header.
 */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {}
