
import {isString, isFunction} from 'underscore';
import CallbackStore from './store';
import InstancesEvents from './instances';

const CSM_EVENTS = new Set([
        'LEFT_CLICK', 'LEFT_DOUBLE_CLICK', 'LEFT_DOWN', 'LEFT_UP', 'MOUSE_MOVE',
        'RIGHT_CLICK', 'RIGHT_DOUBLE_CLICK', 'RIGHT_DOWN', 'RIGHT_UP', 'WHEEL'
      ])
    , CAM_EVENTS = new Set([
        'CAMERA_START', 'CAMERA_MOVE', 'CAMERA_STOP'
      ])
    , SCN_EVENTS = new Map([
        ['BEFORE_RENDER', 'preRender'],
        ['AFTER_RENDER', 'postRender'],
        ['MORPH_START', 'morphStart'],
        ['MORPH_COMPLETE', 'morphComplete']
      ])
    ;

const clbIdProp = Symbol('callbackID');

let Cesium = null
  , Viewer = null
  , clbIdGen = 0
  , camMove = false
  ;

let csmCallbacks = new CallbackStore()
  , camCallbacks = new CallbackStore()
  , scnCallbacks = new CallbackStore()
  , storesMap = {
      CSM_EVENTS: csmCallbacks,
      CAM_EVENTS: camCallbacks,
      SCN_EVENTS: scnCallbacks
    }
  ;


/* ---------- */


function isOff(m) {
  throw new Error(`Group of handlers is disabled, '${m}' method could no longer be used`);
};

class EventGroup {
  constructor(){
    this._ids = new Set();
  }

  on(event, clb) {
    if (!isString(event) || !isFunction(clb)) {
      console.error('Invalid params');
      return this;
    }

    let store = null;

    for (let events in storesMap) {
      if (events.has(event)) {
        store = storesMap[events];
        break;
      }
    }

    if (!store) {
      console.error(`Unknown event: ${event}`);
    } else {
      clb[clbIdProp] = clbIdGen++;
      store.put(event, clb);
      this._ids.add(clbIdGen);
    }

    return this;
  }

  off() {
    for (let events in storesMap) {
      let store = storesMap[events];
      store.forEach(clbs => {
        clbs.forEach(clb => {
          this._ids.has(clb[clbIdProp]) && clbs.delete(clb);
        });
      });
    }

    this._ids.clear();
    for (let m of ['on', 'off'])
      this[m] = isOff.bind(this, m);

    return null;
  }
};


/* ---------- */

let instance = null;

export default class Events {
  constructor(CesiumGlobal, ViewerInstance) {
    if (!!instance)
      return instance;

    Cesium = CesiumGlobal;
    Viewer = ViewerInstance;

    let IE = InstancesEvents.init(Cesium, Viewer);

    this.drill = IE.drill;

    CSM_EVENTS.forEach(event => {
      csmCallbacks.store.set(event, new Set());
      new Cesium
            .ScreenSpaceEventHandler(Viewer.scene.canvas)
            .setInputAction((...args) => {
              csmCallbacks.get(event).forEach(clb => clb.apply(Viewer, args));
              IE.processEvent(event, args);
            }, Cesium.ScreenSpaceEventType[event]);
    });

    CAM_EVENTS.forEach(event => {
      camCallbacks.store.set(event, new Set());
    });
    with (Viewer.camera) {
      moveStart.addEventListener((...args) => {
        camCallbacks.get('CAMERA_START').forEach(clb => clb.apply(Viewer, args));
        camMove = true;
      });
      moveEnd.addEventListener((...args) => {
        camMove = false;
        camCallbacks.get('CAMERA_STOP').forEach(clb => clb.apply(Viewer, args));
      });
    }
    function camLoop() {
      camMove && camCallbacks.get('CAMERA_MOVE').forEach(clb => clb.call(Viewer));
      Cesium.requestAnimationFrame(loop);
    };
    camLoop();

    SCN_EVENTS.forEach((alias, event) => {
      scnCallbacks.store.set(alias, new Set());
      Viewer.scene[event]
            .addEventListener((...args) => {
              this.forEach(clb => clb.apply(Viewer, args));
            }, scnCallbacks.get(alias));
    });
  }

  on(event, clb) {
    return new EventGroup().on(event, clb);
  }
};
