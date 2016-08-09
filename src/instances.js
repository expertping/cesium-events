
import {isString, isFunction, isObject, isEqual, max} from 'underscore';

const lsnProp = Symbol('instanceListeners');

let Cesium = null
  , Scene = null
  , useDrill = false,
  , pick = null;

let pointer = {
      offset: null,
      get cartesian(){
        return this.offset && Scene.camera.pickEllipsoid(this.offset);
      },
      get cartographic(){
        var crt = this.cartesian;
        return crt && Cesium.Ellipsoid.WGS84.cartesianToCartographic(crt);
      },
      get degrees(){
        var radians = this.cartographic;
        return radians && [
          Cesium.Math.toDegrees(radians.longitude),
          Cesium.Math.toDegrees(radians.latitude)
        ];
      }
    };

let classes = [
      'Billboard',
      'Entity',
      'Model',
      'Primitive'
    ];

function Handler(CesiumGlobal, ViewerInstance) {
  Cesium = CesiumGlobal;
  Scene = ViewerInstance.scene;

  new Cesium
        .ScreenSpaceEventHandler(Scene.canvas)
        .setInputAction(track, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  for (let cl of classes) {
    Object.assign(Cesium[cl].prototype), {
      [lsnProp]: {
        on:
      },
      on(event, clb, once){
        !this[lsnProp] && (this[lsnProp] = { on: {}, once: {} });
        var l = this._listeners[true === once ? 'once' : 'on'];
        !l[event] && (l[event] = []);
        l[event].push(clb);
        return this;
      },
      once(event, clb){
        return this.on(event, clb, true);
      },
      off(event, clbName){
          var self = this._listeners,
              t = 0;                      // clear all
          _.isString(event) && (t = 1);   // clear by event name
          _.isString(clbName) && (t = 2); // clear by function name (if exists)

          _.each(['on', 'once'], function(l){
              _.each(self[l], function(clbs, evt){
                  if (0 === t)
                      self[l][evt] = [];
                  else if (1 === t)
                      evt === event && (self[l][evt] = []);
                  else
                      evt === event && (self[l][evt] = _.filter(clbs, function(clb){
                          return clb.name !== clbName;
                      }));
              });
          });

          return this;
      }
    });
  }

  return function drillToggle(v){
    if (!v) return useDrill;
    return useDrill = !!v;
  }
};

function gutPick(pick) {
  return pick && ((isObject(pick.id) && pick.id) || pick.primitive) || {};
};

function pickID(pick){
  return pick && (isObject(pick.id) ? pick.id.id : pick.id)
};

function eqlID(e1, e2){
  return pickID(e1) === pickID(e2);
};

function processStack(pickObj, evt, ctx, args) {
  let stack = pickObj && pickObj[lsnProp];
  if (!stack) return;

  for (let t of ['once', 'on']){
    var clbs = stack[t].get(evt);
    clbs &&
  }
  _.each(stack.on[evt], function(clb){ clb.apply(ctx, args) });
  _.each(stack.once[evt], function(clb){ clb.apply(ctx, args) });
  stack.once[evt] = [];
};

function track(e){
  pointer.offset = e.endPosition;
  let newPick = null;

  if (!useDrill) {
    newPick = Scene.pick(pointer.offset);
  } else {
    newPick = Scene.drillPick(pointer.offset);
    if (!newPick.length) {
      newPick = null;
    } else {
      newPick = max(newPick, p =>
        (p.id || {}).zIndex || p.primitive.zIndex || 0
      );
    }
  }

  if (!eqlID(newPick, pick)) {
    Object.assign(e, { pointer });
    pick && processStack(gutPick(pick), 'MOUSE_LEAVE', pick, [e]);
    newPick && processStack(gutPick(newPick), 'MOUSE_ENTER', newPick, [e]);
  }

  pick = newPick;
};

export default Handler;
