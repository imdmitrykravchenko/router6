import { Route } from './types';

export class NavigationError extends Error {
  code: number;
  meta?: { path?: string; route?: string | Route };
  constructor(message: string) {
    super(message);
    // because of https://github.com/Microsoft/TypeScript/wiki/FAQ#why-doesnt-extending-built-ins-like-error-array-and-map-work
    Object.setPrototypeOf(this, NavigationError.prototype);
  }
}

export class NotFoundError extends NavigationError {
  constructor(message: string, { route }: { route?: string } = {}) {
    super(message);
    this.code = 404;

    if (route) {
      this.meta = { route };
    }
  }
}

export class ForbiddenError extends NavigationError {
  constructor(message: string, { route }: { route?: string } = {}) {
    super(message);
    this.code = 403;

    if (route) {
      this.meta = { route };
    }
  }
}

export class InternalServerError extends NavigationError {
  constructor(message: string) {
    super(message);
    this.code = 500;
  }
}

export class Redirect extends NavigationError {
  constructor(
    message: string,
    { route, path }: { route?: string | Route; path?: string },
  ) {
    super(message);

    this.code = 302;
    this.meta = { route, path };
  }
}

export class IllegalRouteParamsError extends Error {}
export class UnExistentRouteError extends Error {}
export class UnRegisteredPathError extends Error {}

export const isRoutingError = (e) => e && [404, 302, 403].includes(e.code);
