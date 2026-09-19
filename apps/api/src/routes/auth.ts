import type { FastifyInstance, FastifyReply } from 'fastify';
import { loginSchema, registerSchema, type ConsentPurpose } from '@makaan/core';
import type { Deps } from '../deps';
import { parseOrThrow } from '../lib/http';
import { failure } from '../lib/errors';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { SESSION_COOKIE, createSession, sessionCookieOptions } from '../auth/sessions';
import { requireUser } from './helpers';

const CONSENT_PURPOSES: ConsentPurpose[] = ['service', 'evidence_retention', 'ai_processing'];

export function registerAuthRoutes(app: FastifyInstance, deps: Deps): void {
  const cookieOptions = sessionCookieOptions(deps.config.isProduction, deps.config.sessionTtlMs);

  async function startSession(reply: FastifyReply, userId: string): Promise<{ csrfToken: string }> {
    const { token, record } = createSession(
      userId,
      deps.config.SESSION_SECRET,
      deps.config.sessionTtlMs,
    );
    await deps.store.createSession(record);
    reply.setCookie(SESSION_COOKIE, token, cookieOptions);
    return { csrfToken: record.csrfToken };
  }

  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = parseOrThrow(registerSchema, request.body);
      const existing = await deps.store.getUserByEmail(input.email);
      if (existing) {
        throw failure.conflict('An account with this email already exists.');
      }
      const passwordHash = await hashPassword(input.password);
      const user = await deps.store.createUser({
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash,
      });
      for (const purpose of CONSENT_PURPOSES) {
        await deps.store.upsertConsent(user.id, purpose, Boolean(input.consent[purpose]));
      }
      await deps.store.appendAudit({
        actorId: user.id,
        tenancyId: null,
        action: 'auth.registered',
        metadata: { role: user.role },
      });
      const { csrfToken } = await startSession(reply, user.id);
      return reply.status(201).send({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        csrfToken,
      });
    },
  );

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = parseOrThrow(loginSchema, request.body);
      const user = await deps.store.getUserByEmail(input.email);
      const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
      if (!user || !valid) {
        throw failure.unauthenticated('Email or password is incorrect.');
      }
      await deps.store.appendAudit({ actorId: user.id, tenancyId: null, action: 'auth.login' });
      const { csrfToken } = await startSession(reply, user.id);
      return reply.send({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        csrfToken,
      });
    },
  );

  app.post('/api/auth/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
    requireUser(request);
    if (request.sessionTokenHash) {
      await deps.store.deleteSession(request.sessionTokenHash);
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.send({ ok: true });
  });

  app.get('/api/auth/session', async (request, reply) => {
    return reply.send({
      user: request.sessionUser,
      csrfToken: request.csrfToken,
    });
  });
}
