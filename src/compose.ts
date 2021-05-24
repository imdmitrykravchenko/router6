const compose = (middleware, callback) => {
  return (payload) => {
    let index = -1;
    return run(0);

    function run(i) {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }

      index = i;

      let fn = middleware[i];

      if (!fn) {
        return Promise.resolve();
      }

      try {
        const abort = (e) => {
          throw e;
        };
        return Promise.resolve(fn(payload, run.bind(null, i + 1), abort)).then(
          (p) => {
            callback();
            return p;
          },
        );
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };
};

export default compose;
