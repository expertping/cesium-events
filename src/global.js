
import {isString, isFunction} from 'underscore';
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

const requestAnimationFrame = function(callback){
        return (window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame)(callback);
      }
    , cancelAnimationFrame = function(t){
        return (window.cancelRequestAnimationFrame || window.mozCancelRequestAnimationFrame || window.webkitCancelRequestAnimationFrame)(t);
      }
    ;

const clbIdProp = Symbol('callbackID');


/* ---------- */


let clbIdGen = 0
  , camMove = false
  ;

let Cesium = null
  , Viewer = null
  ;


/* ---------- */


class CallbackStore {
  constructor(){
    this.store = new Map();
  }

  get(event){
    return this.store.get(event);
  }

  put(event, callback){
    if (!this.store.has(event))
      this.store.set(event, new Set());
    return this.store.get(event).add(callback);
  }
};

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


function isOff(m){
  throw new Error(`Group of handlers is disabled, '${m}' method could no longer be used`);
};

class EventGroup {
  constructor(){
    this._ids = new Set();
  }

  on(event, clb) {
    if (!isString(event) || !isFunction(clb)){
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

  off(){
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

let instance = null
  , useDrill = null;

class Handler {
  constructor(CesiumGlobal, ViewerInstance){
    if (!!instance)
      return instance;

    Cesium = CesiumGlobal;
    Viewer = ViewerInstance;

    useDrill = InstancesEvents(Cesium, Viewer);
  }

  on(event, clb) {
    return new EventGroup().on(event, clb);
  }

  get drill(){
    return useDrill();
  }
  set drill(v){
    return useDrill(v);
  }
};

export default Handler;


    // init cesium scrren handlers
    _.each(csmEvents, function(event){
        core.events._csmCallbacks[event] = [];
        new Cesium.ScreenSpaceEventHandler(core.viewer.scene.canvas).setInputAction(function() {
            var args = arguments;
            // general callbacks
            _.each(core.events._csmCallbacks[event], function(clb){ clb.apply(core, args) });
            // current pick callbacks
            processStack(gutPick(core.pick), event, core.pick, args);
        }, Cesium.ScreenSpaceEventType[event]);
    });

    // init camera events
    _.each(camEvents, function(event){
        core.events._camCallbacks[event] = [];
    });
    core.viewer.camera.moveStart.addEventListener(function(){
        _.each(core.events._camCallbacks['CAMERA_START'], function(clb){ clb.call(core) });
        core.events._camMove = true;
    });
    core.viewer.camera.moveEnd.addEventListener(function(){
        core.events._camMove = false;
        _.each(core.events._camCallbacks['CAMERA_STOP'], function(clb){ clb.call(core) });
    });

    // init cesium scene handlers
    _.each(scnEvents, function(event, alias){
        core.events._scnCallbacks[alias] = [];
        core.viewer.scene[event].addEventListener(function() {
            var args = arguments;
            _.each(this, function(clb){ clb.apply(core, args) });
        }, core.events._scnCallbacks[alias]);
    });

    function loop(){
        core.events._camMove && _.each(core.events._camCallbacks['CAMERA_MOVE'], function(clb){ clb.call(core) });

        core.requestAnimationFrame(loop);
    };
    loop();

    return core;
