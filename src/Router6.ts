import {
  IllegalRouteParamsError,
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

  start(path: string) {
    return this.navigateToPath(path).then(() => {
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
              meta?.path ||
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
      meta,
    }: { type?: string; state?: any; meta?: any } = {},
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
      { type },
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
    nameOrRoute: string | Route,
    {
      path,
      params,
      query,
      state,
      meta,
    }: {
      params?: RouteParams;
      query?: Query;
      state?: any;
      meta?: any;
      path?: string;
    } = {},
    {
      type = 'push',
      force = false,
    }: {
      type?: string;
      force?: boolean;
    } = {},
  ) {
    const isName = typeof nameOrRoute === 'string';

    let name: string = isName
      ? (nameOrRoute as string)
      : (nameOrRoute as Route).name;
    let to: Route = isName ? null : (nameOrRoute as Route);

    try {
      to =
        to ||
        this.findRoute(name, { params, query, state, meta, strict: true });
    } catch (e) {
      return Promise.reject(e);
    }

    if (path) {
      to.path = path;
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

    return compose(this.middleware, () => callListeners('progress'))(payload)
      .then(() => {
        if (payload.type === 'push') {
          this.stack = [...this.stack, Object.seal(payload.to)];
        }
        if (payload.type === 'replace') {
          this.stack = [...this.stack.slice(0, -1), Object.seal(payload.to)];
        }
        if (payload.type === 'pop') {
          this.stack = this.stack.slice(0, -1);
        }
        callListeners('finish');
      })
      .then(() => this.currentRoute);
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
