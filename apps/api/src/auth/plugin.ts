import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SessionUser } from '@makaan/core';
import type { Config } from '../config';
import type { Store } from '../db/store';
import { failure } from '../lib/errors';
import { hashSessionToken } from './passwords';
import { SESSION_COOKIE } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: SessionUser | null;
    sessionTokenHash: string | null;
    csrfToken: string | null;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyCsrf: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Attaches the resolved session to every request, then exposes two
 * pre-handlers: authenticate and verifyCsrf.
 */
export function attachAuth(app: FastifyInstance, deps: { store: Store; config: Config }): void {
  app.decorateRequest('sessionUser', null);
  app.decorateRequest('sessionTokenHash', null);
  app.decorateRequest('csrfToken', null);

  app.addHook('onRequest', async (request) => {
    const cookie = request.cookies?.[SESSION_COOKIE];
    if (!cookie) return;

    const tokenHash = hashSessionToken(cookie, deps.config.SESSION_SECRET);
    const session = await deps.store.getSession(tokenHash);
    if (!session) return;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await deps.store.deleteSession(tokenHash);
      return;
    }

    const user = await deps.store.getUserById(session.userId);
    if (!user) {
      await deps.store.deleteSession(tokenHash);
      return;
    }

    request.sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    request.sessionTokenHash = tokenHash;
    request.csrfToken = session.csrfToken;

    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    if (remaining < deps.config.sessionTtlMs / 2) {
      const nextExpiry = new Date(Date.now() + deps.config.sessionTtlMs).toISOString();
      await deps.store.touchSession(tokenHash, nextExpiry);
    }
  });

  app.decorate('authenticate', async (request: FastifyRequest) => {
    if (!request.sessionUser) {
      throw failure.unauthenticated();
    }
  });

  app.decorate('verifyCsrf', async (request: FastifyRequest) => {
    if (SAFE_METHODS.has(request.method)) return;
    const provided = request.headers['x-csrf-token'];
    if (typeof provided !== 'string' || provided.length === 0) {
      throw failure.forbidden('Missing CSRF token.');
    }
    if (!request.csrfToken || provided !== request.csrfToken) {
      throw failure.forbidden('Invalid CSRF token.');
    }
  });
}
