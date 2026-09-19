import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { AppError } from './lib/errors';
import { attachAuth } from './auth/plugin';
import type { Deps } from './deps';
import { registerHealthRoutes } from './routes/health';
import { registerAuthRoutes } from './routes/auth';
import { registerPropertyRoutes } from './routes/properties';
import { registerTenancyRoutes } from './routes/tenancies';
import { registerMeRoutes } from './routes/me';

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: deps.config.LOG_LEVEL,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-csrf-token"]'],
    },
    trustProxy: deps.config.isProduction,
    bodyLimit: 64 * 1024,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: deps.config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: false });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: [],
  });
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4 },
  });

  attachAuth(app, { store: deps.store, config: deps.config });

  registerHealthRoutes(app, deps);
  registerAuthRoutes(app, deps);
  registerPropertyRoutes(app, deps);
  registerTenancyRoutes(app, deps);
  registerMeRoutes(app, deps);

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `No route for ${request.method} ${request.url}` },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 500;
    if (statusCode === 429) {
      reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests.' } });
      return;
    }
    if (statusCode >= 400 && statusCode < 500 && Number.isFinite(statusCode)) {
      const message = error instanceof Error ? error.message : 'Invalid request';
      reply.status(statusCode).send({
        error: { code: 'VALIDATION_ERROR', message },
      });
      return;
    }
    request.log.error({ err: error }, 'unhandled error');
    reply.status(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
  });

  return app;
}
