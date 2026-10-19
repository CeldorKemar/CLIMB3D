import 'reflect-metadata';
import { Body, Catch, Controller, Get, HttpException, Inject, Module, Param, Post, Put, Req, Res, BadRequestException, ForbiddenException, ServiceUnavailableException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express, { type Request, type Response } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { sceneSchema } from '@climbed/contracts';
import { validateScene } from '@climbed/geometry';
import { databaseUrl, production, SESSION_COOKIE } from './config.ts';
import { PostgresRepository, REPOSITORY, type ClimbedRepository, type AuthSession } from './repository.ts';

const loginBody = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).strict();
const saveBody = z.object({ scene: sceneSchema, expectedRevision: z.number().int().positive() }).strict();
const requestId = z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const reserveBody = z.object({ sceneRevision: z.number().int().positive(), requestId, wallIds: z.array(z.string().min(1).max(100)).min(1).max(100).optional() }).strict();
const actionBody = z.object({ action: z.enum(['withdraw', 'install', 'request_return', 'return', 'cancel']), requestId }).strict();

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ message: 'Données invalides.', details: result.error.flatten() });
  return result.data;
}

@Catch()
class SafeExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      response.status(error.getStatus()).json(typeof body === 'string' ? { message: body } : body);
    } else response.status(500).json({ message: 'Erreur interne. Réessayez ou contactez le responsable.', code: 'INTERNAL' });
  }
}

@Controller('api/v1')
class ApiController {
  private readonly loginAttempts = new Map<string, { count: number; until: number }>();
  constructor(@Inject(REPOSITORY) private readonly repository: ClimbedRepository) {}

  @Get('health') async health() {
    try { return await this.repository.health(); }
    catch { throw new ServiceUnavailableException('Service temporairement indisponible.'); }
  }

  private async authenticate(request: Request, csrf = false): Promise<AuthSession> {
    const cookie = request.headers.cookie?.split(';').map(p => p.trim()).find(p => p.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1) ?? '';
    const session = await this.repository.session(cookie);
    if (csrf) {
      const supplied = request.header('x-csrf-token') ?? '';
      const a = Buffer.from(supplied), b = Buffer.from(session.csrfToken);
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenException('Jeton CSRF requis.');
    }
    return session;
  }

  @Post('auth/login')
  async login(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Body() body: unknown) {
    const input = parse(loginBody, body);
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    let attempt = this.loginAttempts.get(key);
    if (!attempt || attempt.until < now) { attempt = { count: 0, until: now + 60_000 }; this.loginAttempts.set(key, attempt); }
    if (++attempt.count > 20) throw new HttpException('Trop de tentatives ; réessayez dans une minute.', 429);
    if (this.loginAttempts.size > 1000) for (const [key, value] of this.loginAttempts) if (value.until < now) this.loginAttempts.delete(key);
    const result = await this.repository.login(input.email, input.password);
    response.cookie(SESSION_COOKIE, result.token, { httpOnly: true, sameSite: 'lax', secure: production(), maxAge: 12 * 60 * 60 * 1000, path: '/api/v1' });
    return result.bootstrap;
  }
  @Get('auth/session') async session(@Req() request: Request) { return this.repository.bootstrap(await this.authenticate(request)); }
  @Post('auth/logout') async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.repository.logout(await this.authenticate(request, true));
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: production(), path: '/api/v1' });
    return { message: 'Session fermée.' };
  }
  @Get('rooms/:id') async room(@Req() request: Request, @Param('id') id: string) { return this.repository.room(await this.authenticate(request), id); }
  @Put('rooms/:id/scene') async save(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    const session = await this.authenticate(request, true);
    const input = parse(saveBody, body);
    const issues = validateScene(input.scene);
    if (issues.length) throw new BadRequestException({ message: 'Géométrie ou références invalides.', details: issues });
    return this.repository.save(session, id, input.scene, input.expectedRevision);
  }
  @Post('rooms/:id/reservations') async reserve(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    const session = await this.authenticate(request, true);
    const input = parse(reserveBody, body);
    if (input.wallIds && new Set(input.wallIds).size !== input.wallIds.length) throw new BadRequestException('Pans dupliqués dans le périmètre.');
    return this.repository.reserve(session, id, input.sceneRevision, input.requestId, input.wallIds);
  }
  @Post('rooms/:id/reservations/:reservationId/actions') async action(@Req() request: Request, @Param('id') id: string, @Param('reservationId') reservationId: string, @Body() body: unknown) {
    const session = await this.authenticate(request, true);
    const input = parse(actionBody, body);
    return this.repository.action(session, id, reservationId, input.action, input.requestId);
  }
}

@Module({
  controllers: [ApiController],
  providers: [{ provide: REPOSITORY, useFactory: async () => {
    const pool = new Pool({ connectionString: databaseUrl(), max: 10 });
    try {
      await pool.query('SELECT 1 FROM schema_migrations LIMIT 1');
      if (production()) {
        const fixtures = await pool.query("SELECT 1 FROM app_users WHERE email LIKE '%@climbed.local' LIMIT 1");
        if (fixtures.rowCount) throw new Error('Démarrage production interdit avec les comptes de démonstration.');
      }
      return new PostgresRepository(pool);
    } catch (error) { await pool.end(); throw error; }
  } }],
})
class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'], bodyParser: false });
  app.use(express.json({ limit: '5mb' }));
  app.use((request: Request, response: Response, next: () => void) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Frame-Options', 'DENY');
    if (request.path.startsWith('/api/')) response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useGlobalFilters(new SafeExceptionFilter());
  const webDirectory = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  if (existsSync(webDirectory)) app.use(express.static(webDirectory, { index: 'index.html' }));
  app.enableShutdownHooks();
  return app;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const app = await createApp();
    const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
    await app.listen(port, process.env.API_HOST ?? '127.0.0.1');
    console.log(`Climbed API prête sur le port ${port}.`);
  } catch { console.error('Démarrage API impossible ; vérifier la configuration et PostgreSQL.'); process.exitCode = 1; }
}
