const compose = (middleware, callback) => {
  return (payload) => {
    let index = -1;
    return Promise.resolve(0).then(run);

    function run(i, err = null) {
      if (err) {
        return Promise.reject(err);
      }
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }

      index = i;

      let fn = middleware[i];

      if (!fn) {
        return Promise.resolve();
      }

      return Promise.resolve()
        .then(() => fn(payload, run.bind(null, i + 1)))
        .then((p) => {
          callback();
          return p;
        });
    }
  };
};

export default compose;
