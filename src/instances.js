
import {isString, isFunction, isObject, isEqual} from 'underscore';

let 

function Processor {
  constructor(CesiumGlobal, ViewerInstance){
    Cesium = CesiumGlobal;
    Viewer = ViewerInstance;
  }

  on(event, clb) {
    return new EventGroup().on(event, clb);
  }
};

export default Processor;





_.extend(core, {
        pick: null,
        events: {

        }
    });

    // get significant content from pick
    function gutPick(pick) {
        return pick && ((_.isObject(pick.id) && pick.id) || pick.primitive) || {};
    };

    // get pick (hope unique haha) identificator
    function pickID(pick){
        return pick && (_.isObject(pick.id) ? pick.id.id : pick.id)
    };
    // id comparison alias
    function eqlID(e1, e2){
        return pickID(e1) === pickID(e2);
    };

    // process listeners
    function processStack(pickObj, evt, ctx, args) {
        var stack = pickObj && pickObj._listeners;
        if (!stack) return;
        _.each(stack.on[evt], function(clb){ clb.apply(ctx, args) });
        _.each(stack.once[evt], function(clb){ clb.apply(ctx, args) });
        stack.once[evt] = [];
    };

    // handle cursor position
    function track(e){
        var pick = null;
        if (!core.drill) {
            pick = core.viewer.scene.pick(e.endPosition);
        } else {
            pick = core.viewer.scene.drillPick(core.cursor.offset());
            if (!pick.length) {
                pick = null;
            } else {
                pick = _.max(pick, function(p){
                    return (p.id || {}).zIndex || p.primitive.zIndex || 0;
                });
            }
        }

        core.cursor._offset = e.endPosition;

        if (!eqlID(pick, core.pick)) {
            if (core.pick) {
                processStack(gutPick(core.pick), 'MOUSE_LEAVE', core.pick, e);
                core.loop.off('_instanceFaceLoop');
                processFace();
            }

            if (pick) {
                var p = gutPick(pick);
                processStack(p, 'MOUSE_ENTER', pick, e);
                Core.loop(function _instanceFaceLoop(){
                    !_.isEqual(faceProps.prev, getFace(p)) && processFace(p);
                });
            }

            core.pick = pick;
        }
    };

    // manage coordinates & current item on cursor moving
    new Cesium.ScreenSpaceEventHandler(core.viewer.scene.canvas)
              .setInputAction(track, Cesium.ScreenSpaceEventType['MOUSE_MOVE']);


    // custom event system for cesium instances
    _.each([
        'Billboard',
        'Entity',
        'Model',
        'Primitive',
        'PointPrimitive'
    ], function(o){
        _.extend(Cesium[o].prototype, {
            on: function(event, clb, once){
                !this._listeners && (this._listeners = { on: {}, once: {} });
                var l = this._listeners[true === once ? 'once' : 'on'];
                !l[event] && (l[event] = []);
                l[event].push(clb);
                return this;
            },
            once: function(event, clb){
                return this.on(event, clb, true);
            },
            off: function(event, clbName){
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
            },
            extendWith: function(handler){
                var obj = handler.call(this, this);
                obj && _.extend(this, obj);
                return this;
            }
        });
    });