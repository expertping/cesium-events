
export defaut class CallbackStore {
  constructor(){
    this.store = new Map();
    this._nonExistentEventSet = new Set();
  }

  get(event){
    return this.store.get(event) || this._nonExistentEventSet;
  }

  put(event, callback){
    if (!this.store.has(event))
      this.store.set(event, new Set());
    return this.store.get(event).add(callback);
  }

  clear(event, callbackName) {
    this.store.forEach(event => {
      event.clear();
    });
    this.store.clear();
  }
};

// var self = this._listeners,
//     t = 0;                      // clear all
// _.isString(event) && (t = 1);   // clear by event name
// _.isString(clbName) && (t = 2); // clear by function name (if exists)

// _.each(['on', 'once'], function(l){
//     _.each(self[l], function(clbs, evt){
//         if (0 === t)
//             self[l][evt] = [];
//         else if (1 === t)
//             evt === event && (self[l][evt] = []);
//         else
//             evt === event && (self[l][evt] = _.filter(clbs, function(clb){
//                 return clb.name !== clbName;
//             }));
//     });
// });
