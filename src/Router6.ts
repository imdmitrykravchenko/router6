import {
  isRoutingError,
  IllegalRouteParamsError,
  NavigationError,
  UnExistentRouteError,
  UnRegisteredPathError,
} from './errors';
import { compile } from 'path-to-regexp';
import shallowEqual from 'shallowequal';
import url from 'url';
import {
  Query,
  Route,
  RouteDefinition,
  RouteMiddleware,
  RouteParams,
  ParsedRouteDefinition,
  Options,
  RouteListener,
  RouteMiddlewareHandler,
} from './types';
import { parseDefinition, flatten } from './utils';
import compose from './compose';

class Router6 {
  routes: ParsedRouteDefinition[];
  private stack: Route[];
  private options: Options;

  private listeners: {
    handler: RouteListener;
    event: 'start' | 'finish' | 'progress';
  }[];
  private middleware: RouteMiddlewareHandler[];

  private navigation: string;
  private started: boolean;

  constructor(
    routes: RouteDefinition[],
    { nameDelimiter = '.' }: Options = {},
  ) {
    this.stack = [];
    this.listeners = [];
    this.middleware = [];
    this.started = false;
    this.navigation = null;
    this.routes = routes.map(parseDefinition());
    this.options = { nameDelimiter };
    this.getActiveRoutes = this.getActiveRoutes.bind(this);
  }

  get currentRoute(): Route | undefined {
    const stackLength = this.stack.length;

    return stackLength === 0 ? undefined : this.stack[stackLength - 1];
  }

  get previousRoute(): Route | undefined {
    const stackLength = this.stack.length;

    return stackLength < 2 ? undefined : this.stack[stackLength - 2];
  }

  set error(error: NavigationError) {
    this.navigateToRoute(
      String(error.code),
      { meta: error.meta, state: { message: error.message } },
      { type: 'replace' },
    );
  }

  start(path: string, error?: any) {
    return this.navigateToPath(path, { error }).then(() => {
      this.started = true;

      return this.currentRoute;
    });
  }

  isStarted() {
    return this.started;
  }

  findRoute(
    name: string,
    {
      params = {},
      query = {},
      state,
      meta,
      strict = false,
    }: {
      params?: RouteParams;
      query?: Query;
      state?: any;
      meta?: any;
      strict?: boolean;
    } = {},
  ) {
    const nameParts = name.split(this.options.nameDelimiter);

    let scope = this.routes;
    const routeNameSegments = [];
    const routePathSegments = [];
    let to: Route;

    for (let i = 0; i < nameParts.length; i++) {
      const currentRoute = scope.find(({ name }) => name === nameParts[i]);

      if (!currentRoute && strict) {
        throw new UnExistentRouteError(`Route "${name}" does not exist`);
      }

      if (i === nameParts.length - 1) {
        try {
          to = {
            state,
            query,
            params,
            config: currentRoute.config,
            name: [...routeNameSegments, currentRoute.name].join(
              this.options.nameDelimiter,
            ),
            path:
              (meta && meta.path) ||
              compile([...routePathSegments, currentRoute.path].join(''))(
                params,
              ),
          };
        } catch (e) {
          if (strict) {
            throw new IllegalRouteParamsError(e.message);
          }
        }
        break;
      } else {
        routeNameSegments.push(currentRoute.name);
        routePathSegments.push(currentRoute.path);
        scope = currentRoute.children;
      }
    }

    return to;
  }

  private get routesList(): ParsedRouteDefinition[] {
    return this.routes.reduce(
      flatten({ path: '', name: '' }, this.options.nameDelimiter),
      [],
    );
  }

  private getRouteParams(
    { pathRegexp, keys }: ParsedRouteDefinition,
    path: string,
  ) {
    const [_, ...matches] = path.match(pathRegexp);

    return keys.reduce(
      (result, { name }, index) => ({ ...result, [name]: matches[index] }),
      {},
    );
  }

  matchPath(href: string): null | Route {
    const { pathname, query } = url.parse(href, true);
    const routesList = this.routesList;

    for (let i = 0; i < routesList.length; i++) {
      const route = routesList[i];

      if (route.pathRegexp.test(pathname)) {
        return {
          query,
          path: pathname,
          name: route.name,
          config: route.config,
          params: this.getRouteParams(route, pathname),
        };
      }
    }

    return null;
  }

  getParentRoute(route: Route) {
    const parentRouteName = route.name
      .split(this.options.nameDelimiter)
      .slice(0, -1)
      .join(this.options.nameDelimiter);

    return this.routesList.find(({ name }) => name === parentRouteName);
  }

  getActiveRoutes() {
    const currentRoute = this.currentRoute;
    const { params } = currentRoute;
    const routes = [currentRoute];

    while (true) {
      const parentRoute = this.getParentRoute(routes[routes.length - 1]);

      if (!parentRoute) {
        break;
      }

      routes.push(
        this.findRoute(parentRoute.name, {
          params: parentRoute.keys.reduce(
            (result, { name }) => ({ ...result, [name]: params[name] }),
            {},
          ),
        }),
      );
    }

    return routes;
  }

  navigateToPath(
    path: string,
    {
      type = 'push',
      state,
      error,
      meta,
    }: { type?: string; error?: any; state?: any; meta?: any } = {},
  ) {
    const route = this.matchPath(path);

    if (!route) {
      return Promise.reject(
        new UnRegisteredPathError(
          `Path "${path}" does not match any existent route`,
        ),
      );
    }

    return this.navigateToRoute(
      route.name,
      {
        state,
        meta,
        params: route.params,
        query: route.query,
      },
      { type, error },
    );
  }

  areRoutesEqual(routeA: Route, routeB: Route) {
    return (
      routeA === routeB ||
      (typeof routeA === typeof routeB &&
        routeA.name === routeB.name &&
        shallowEqual(routeA.params, routeB.params) &&
        shallowEqual(routeA.query, routeB.query))
    );
  }

  update() {
    const currentRoute = this.currentRoute;

    return this.navigateToRoute(
      currentRoute.name,
      {
        params: currentRoute.params,
        query: currentRoute.query,
        state: currentRoute.state,
      },
      { type: 'replace', force: true },
    );
  }

  navigateToRoute(
    name: string,
    {
      params,
      query,
      state,
      meta,
    }: { params?: RouteParams; query?: Query; state?: any; meta?: any } = {},
    {
      type = 'push',
      error,
      force = false,
    }: { type?: string; error?: any; force?: boolean } = {},
  ) {
    let to: Route;

    try {
      to = this.findRoute(name, { params, query, state, meta, strict: true });
    } catch (e) {
      return Promise.reject(e);
    }

    const payload = {
      from: this.currentRoute,
      to,
      type,
    };

    if (!force && this.areRoutesEqual(payload.from, payload.to)) {
      return Promise.resolve(this.currentRoute);
    }
    const currentNavigation = `${Date.now()}${name}`;

    this.navigation = currentNavigation;

    const callListeners = (event) => {
      this.listeners
        .filter((listener) => listener.event === event)
        .forEach(({ handler }) => handler(payload));
    };

    callListeners('start');

    return (
      error
        ? Promise.reject(error)
        : new Promise((resolve, reject) =>
            compose(this.middleware, () => callListeners('progress'))(
              payload,
              resolve,
              reject,
            ).then(resolve, reject),
          )
    )
      .catch((e) => {
        if (isRoutingError(e)) {
          payload.to.error = e;
          return;
        }
        throw e;
      })
      .then(() => {
        if (type === 'push') {
          this.stack = [...this.stack, Object.freeze(payload.to)];
        }
        if (type === 'replace') {
          this.stack = [...this.stack.slice(0, -1), Object.freeze(payload.to)];
        }
        if (type === 'pop') {
          this.stack = this.stack.slice(0, -1);
        }
        callListeners('finish');
      })
      .then(() => {
        const route = this.currentRoute;

        if (route.error) {
          if (route.error.meta.route) {
            return this.navigateToRoute(
              route.error.meta.route,
              {},
              { type: 'replace' },
            );
          }
          return this.navigateToRoute(
            String(route.error.code),
            {
              meta: { path: route.path.replace('/', '') },
              state: { message: route.error.message },
            },
            { type: 'replace' },
          );
        }

        return route;
      });
  }

  listen(event: 'start' | 'progress' | 'finish', handler: RouteListener) {
    this.listeners.push({ event, handler });

    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener.handler !== handler,
      );
    };
  }

  use(middleware: RouteMiddleware) {
    this.middleware.push(middleware(this));
    return this;
  }
}

export default Router6;
