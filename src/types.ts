import { UrlWithParsedQuery } from 'url';
import { Key } from 'path-to-regexp';

import Router6 from './Router6';

export type Query = UrlWithParsedQuery['query'];
export type RouteDefinition = {
  path: string;
  name: string;
  children?: RouteDefinition[];
  config?: { [key: string]: any };
};

export type ParsedRouteDefinition = RouteDefinition & {
  keys: Key[];
  pathRegexp: RegExp;
  children: ParsedRouteDefinition[];
};

export type RouteParams = { [key: string]: string | number | undefined };

export type Route = {
  state?: any;
  path: string;
  name: string;
  params: RouteParams;
  query: Query;
  config: { [key: string]: any };
};

export type RouteMiddlewareHandler = (
  { from, to, type }: { from: Route | null; to: Route; type: string },
  next: (e?: Error) => void,
) => void;

export type RouteMiddleware = (router: Router6) => RouteMiddlewareHandler;

export type RouteListener = ({
  from,
  to,
  type,
}: {
  from: Route | null;
  to: Route;
  type: string;
}) => void;

export type Options = {
  nameDelimiter?: string;
};
