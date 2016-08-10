
import {isString, isFunction, isObject, isEqual, max} from 'underscore';
import CallbackStore from './store';

const lsnProp = Symbol('instanceListeners');

let Cesium = null
  , Scene = null;

let Handler = {
  classes: [
    'Billboard',
    'Entity',
    'Model',
    'Primitive'
  ],
  pointer: {
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
  },

  pick: null,
  _drill: false,

  get drill(){
    return this._drill;
  },
  set drill(v){
    this._drill = !!v;
  },

  init(CesiumGlobal, ViewerInstance) {
    Cesium = CesiumGlobal;
    Scene = ViewerInstance.scene;

    new Cesium
          .ScreenSpaceEventHandler(Scene.canvas)
          .setInputAction(this.track.bind(this), Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    for (let cl of classes) {
      Object.assign(Cesium[cl].prototype), {
        [lsnProp]: null,
        on(event, clb, once){
          !this[lsnProp] && (this[lsnProp] = {
            on: new CallbackStore(),
            once: new CallbackStore()
          });
          var store = this[lsnProp][true === once ? 'once' : 'on'];
          store.put(event, clb);
          return this;
        },
        once(event, clb){
          return this.on(event, clb, true);
        },
        off(event, name){
          for (let t of ['once', 'on']){
            this[lsnProp][t].clear(event, name);
          }
          return this;
        }
      };
    }

    return this;
  },

  processEvent(event, args){
    processStack(gutPick(this.pick), event, this.pick, args);
  },

  track(e){
    this.pointer.offset = e.endPosition;
    let pick = null,
        pointer = this.pointer;

    if (!this.drill) {
      pick = Scene.pick(pointer.offset);
    } else {
      pick = Scene.drillPick(pointer.offset);
      if (!pick.length) {
        pick = null;
      } else {
        pick = max(pick, p =>
          (p.id || {}).zIndex || p.primitive.zIndex || 0
        );
      }
    }

    if (!eqlID(pick, this.pick)) {
      Object.assign(e, { pointer });
      this.pick && processStack(gutPick(this.pick), 'MOUSE_LEAVE', this.pick, [e]);
      pick && processStack(gutPick(pick), 'MOUSE_ENTER', pick, [e]);
    }

    this.pick = pick;
  }
};

function processStack(pickObj, evt, ctx, args) {
  let stack = pickObj && pickObj[lsnProp];
  if (!stack) return;

  for (let t of ['once', 'on']){
    var clbs = stack[t].get(evt);
    clbs.forEach(clb => { clb.apply(ctx, args) });
  }

  stack.once.clear();
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

export default Handler;
