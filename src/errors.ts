export class IllegalRouteParamsError extends Error {}

// http-errors compatible 404
class NotFoundError extends Error {
  statusCode = 404;
  status = 404;
  expose = true;
}

export class UnExistentRouteError extends NotFoundError {}
export class UnRegisteredPathError extends NotFoundError {}
