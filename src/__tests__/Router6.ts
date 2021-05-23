import Router6 from '../index';
import {
  IllegalRouteParamsError,
  UnExistentRouteError,
  UnRegisteredPathError,
} from '../errors';

describe('Router6', () => {
  it('starts', async () => {
    const router = new Router6([{ path: '/', name: 'home' }]);

    expect(router.isStarted()).toBeFalsy();

    await router.start('/');

    expect(router.isStarted()).toBeTruthy();

    expect(router.currentRoute.path).toBe('/');
    expect(router.currentRoute.name).toBe('home');
  });

  it('getActiveRoutes', async () => {
    const router = new Router6([
      { path: '/', name: 'home' },
      {
        path: '/blog',
        name: 'blog',
        children: [{ name: 'article', path: '/:slug' }],
      },
    ]);

    await router.start('/blog/wow?a=1');

    expect(router.getActiveRoutes()).toEqual([
      {
        config: {},
        name: 'blog.article',
        params: {
          slug: 'wow',
        },
        path: '/blog/wow',
        query: { a: '1' },
      },
      {
        config: {},
        name: 'blog',
        params: {},
        path: '/blog',
        query: {},
      },
    ]);
  });

  describe('navigation', () => {
    it('navigates to same', async () => {
      const router = new Router6([{ path: '/', name: 'home' }]);

      await router.start('/');

      const home = router.currentRoute;

      await router.navigateToRoute('home');

      expect(home).toBe(router.currentRoute);

      await router.navigateToRoute('home', {}, { force: true });

      expect(home).not.toBe(router.currentRoute);
      expect(home).toEqual(router.currentRoute);
    });

    it('navigates to path', async () => {
      const router = new Router6([
        { path: '/', name: 'home' },
        {
          path: '/blog',
          name: 'blog',
          children: [{ name: 'article', path: '/:slug' }],
        },
      ]);

      await router.start('/');

      await router.navigateToPath('/blog');

      expect(router.currentRoute.path).toBe('/blog');
      expect(router.currentRoute.name).toBe('blog');

      await router.navigateToPath('/blog/wow?a=1');

      expect(router.currentRoute.name).toBe('blog.article');
      expect(router.currentRoute.path).toBe('/blog/wow');
      expect(router.currentRoute.query).toEqual({ a: '1' });

      expect(() => router.navigateToPath('/blog1/wow?a=1')).rejects.toThrow(
        new UnRegisteredPathError(
          'Path "/blog1/wow?a=1" does not match any existent route',
        ),
      );
    });

    it('navigates to route', async () => {
      const router = new Router6([
        { path: '/', name: 'home' },
        {
          path: '/blog',
          name: 'blog',
          children: [{ name: 'article', path: '/:slug' }],
        },
      ]);

      await router.start('/');
      await router.navigateToRoute('blog', {
        state: { a: 1 },
        query: { b: '2' },
      });

      expect(router.currentRoute).toBe(router.currentRoute); // the same

      expect(router.currentRoute.path).toBe('/blog');
      expect(router.currentRoute.name).toBe('blog');

      expect(async () => {
        await router.navigateToRoute('blog.article', {
          query: { b: '2' },
        });
      }).rejects.toThrow(
        new IllegalRouteParamsError('Expected "slug" to be a string'),
      );

      expect(async () => {
        await router.navigateToRoute('blog.article2', {
          query: { b: '2' },
          params: { slug: 'wow' },
        });
      }).rejects.toThrow(
        new UnExistentRouteError('Route "blog.article2" does not exist'),
      );

      await router.navigateToRoute('blog.article', {
        query: { b: '2' },
        params: { slug: 'wow' },
      });
      expect(router.currentRoute.name).toBe('blog.article');
      expect(router.currentRoute.path).toBe('/blog/wow');
      expect(router.currentRoute.query).toEqual({ b: '2' });
    });
  });

  it('findRoute', async () => {
    const router = new Router6([
      { path: '/', name: 'home' },
      { path: '/blog', name: 'blog' },
    ]);

    const blog = router.findRoute('blog');

    expect(blog.path).toBe('/blog');
    expect(blog.name).toBe('blog');
    expect(blog.params).toEqual({});

    expect(router.findRoute('blah')).toBeUndefined();

    expect(() => router.findRoute('blah', { strict: true })).toThrow(
      new UnExistentRouteError('Route "blah" does not exist'),
    );
  });

  describe('middleware', () => {
    it('use', async () => {
      const router = new Router6([
        { path: '/', name: 'home' },
        { path: '/blog', name: 'blog' },
      ]);

      const middlewareInner = jest.fn(({ to }, next, abort) => {
        next();
      });

      router.use(() => middlewareInner);

      await router.start('/');

      expect(middlewareInner).toHaveBeenCalledWith(
        {
          from: undefined,
          to: {
            params: {},
            config: {},
            name: 'home',
            path: '/',
            query: {},
            state: undefined,
          },
          type: 'push',
        },
        expect.any(Function),
        expect.any(Function),
      );

      middlewareInner.mockImplementation(({ from }, __, abort) => {
        abort(new Error('nope'));
      });
      let stopped = false;

      try {
        await router.navigateToRoute('blog');
      } catch (e) {
        stopped = true;
      }

      expect(stopped).toBe(true);
      expect(router.currentRoute.path).toBe('/');
      expect(router.currentRoute.name).toBe('home');
    });

    it('use koa-style', async () => {
      const router = new Router6([
        { path: '/', name: 'home' },
        { path: '/blog', name: 'blog' },
      ]);

      const fn = jest.fn();
      const middlewareInner = jest.fn(async ({ to }, next, abort) => {
        fn(await next());
      });
      const middlewareInner2 = jest.fn(({ to }, next, abort) => {
        return new Promise((r) => setTimeout(() => r(111), 200));
      });
      const middlewareInner3 = jest.fn(() => {});
      router.use(() => middlewareInner);
      router.use(() => middlewareInner2);
      router.use(() => middlewareInner3);

      await router.start('/');

      expect(fn).toHaveBeenCalledWith(111);
      // because dont have next call
      expect(middlewareInner3).not.toHaveBeenCalled();
    });
  });

  describe('listeners', () => {
    it('listen', async () => {
      const router = new Router6([
        { path: '/', name: 'home' },
        { path: '/blog', name: 'blog' },
        { path: '/terms', name: 'terms' },
      ]);
      const onStart = jest.fn();
      const onProgress = jest.fn();
      const onFinish = jest.fn();

      const unStart = router.listen('start', onStart);
      const unProgress = router.listen('progress', onProgress);
      const unFinish = router.listen('finish', onFinish);

      await router.start('/');

      const payload = {
        from: undefined,
        to: {
          config: {},
          name: 'home',
          params: {},
          path: '/',
          query: {},
          state: undefined,
        },
        type: 'push',
      };

      expect(onStart).toHaveBeenCalledWith(payload);
      // expect(onProgress).not.toHaveBeenCalled();
      expect(onFinish).toHaveBeenCalledWith(payload);

      router.use(() => (_, next) => next());

      await router.navigateToRoute('blog');

      const payload2 = {
        from: payload.to,
        to: {
          config: {},
          name: 'blog',
          params: {},
          path: '/blog',
          query: {},
          state: undefined,
        },
        type: 'push',
      };

      expect(onStart).toHaveBeenCalledWith(payload2);
      expect(onProgress).toHaveBeenCalledWith(payload2);
      expect(onFinish).toHaveBeenCalledWith(payload2);

      onStart.mockReset();
      onProgress.mockReset();
      onFinish.mockReset();

      unStart();
      unProgress();
      unFinish();

      await router.navigateToRoute('terms');

      expect(onStart).not.toHaveBeenCalledWith();
      expect(onProgress).not.toHaveBeenCalledWith();
      expect(onFinish).not.toHaveBeenCalledWith();
    });
  });
});
