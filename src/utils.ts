import { pathToRegexp } from 'path-to-regexp';
import { RouteDefinition, ParsedRouteDefinition } from './types';

export const flatten =
  (parent, nameDelimiter) =>
  (result, { path, name, children = [], ...rest }) =>
    children.reduce(flatten({ path, name }, nameDelimiter), [
      ...result,
      {
        path: [parent.path, path].join(''),
        name: [parent.name, name].filter(Boolean).join(nameDelimiter),
        children,
        ...rest,
      },
    ]);

export const parseDefinition =
  (rootPath = '') =>
  ({
    path,
    name,
    config = {},
    children = [],
  }: RouteDefinition): ParsedRouteDefinition => {
    const keys = [];

    return {
      path,
      name,
      config,
      keys,
      children: children.map(parseDefinition(`${rootPath}${path}`)),
      pathRegexp: pathToRegexp(`${rootPath}${path}`, keys),
    };
  };
