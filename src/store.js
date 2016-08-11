
export defaut class CallbackStore {
  constructor(){
    this.store = new Map();
    this._nonExistentEventSet = new Set();
  }

  get(event) {
    return this.store.get(event) || this._nonExistentEventSet;
  }

  put(event, callback) {
    if (!this.store.has(event))
      this.store.set(event, new Set());
    return this.store.get(event).add(callback);
  }

  clear(event, callbackName) {
    this.store.forEach(ev => {
      if (undefined === event || ev === event) {
        if (undefined === callbackName) {
          ev.clear();
        } else {
          ev.forEach(clb => {
            callbackName === clb.name && ev.delete(clb);
          });
        }
      }
    });
    (undefined === event) && this.store.clear();
  }
};
