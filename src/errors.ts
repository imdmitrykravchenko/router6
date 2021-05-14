class NavigationError extends Error {
  code: number;
  meta?: { path?: string; route?: string };
}

export class NotFoundError extends NavigationError {
  constructor(message: string) {
    super(message);
    this.code = 404;
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
  constructor(message: string, { route }: { route: string }) {
    super(message);
    this.code = 302;
    this.meta = { route };
  }
}

export type RoutingError =
  | NotFoundError
  | ForbiddenError
  | InternalServerError
  | Redirect;

export class IllegalRouteParamsError extends Error {}
export class UnExistentRouteError extends Error {}
export class UnRegisteredPathError extends Error {}

export const isRoutingError = (e) => e instanceof NavigationError;
