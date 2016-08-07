
  const CSM_EVENTS = [
          'LEFT_CLICK', 'LEFT_DOUBLE_CLICK', 'LEFT_DOWN', 'LEFT_UP', 'MOUSE_MOVE',
          'RIGHT_CLICK', 'RIGHT_DOUBLE_CLICK', 'RIGHT_DOWN', 'RIGHT_UP', 'WHEEL'
        ]
      , CAM_EVENTS = [
          'CAMERA_START', 'CAMERA_MOVE', 'CAMERA_STOP'
        ]
      , SCN_EVENTS = {
          'BEFORE_RENDER' : 'preRender',
          'AFTER_RENDER'  : 'postRender',
          'MORPH_START'   : 'morphStart',
          'MORPH_COMPLETE': 'morphComplete'
        };

  let clbID = 0;

  class Events(CesiumGlobal, ViewerInstance) {
    this._csmCallbacks = {};
    this._scnCallbacks = {};
    this._camMove = false;
    this._camCallbacks = {};

    on(event, clb) => {
      if (!_.isString(event) || !_.isFunction(clb)){
        console.error('Invalid params');
        return this;
      }
      clb._id = clbID++;

      let start_group = !('_group' in this)
        , push = true;

      if (_.contains(this._csmEvents, event)) {
        this._csmCallbacks[event].push(clb);
      } else if (_.contains(this._camEvents, event)) {
        this._camCallbacks[event].push(clb);
      } else if (event in this._scnEvents) {
        this._scnCallbacks[event].push(clb);
      } else if (event in this._kbrdEvents) {
        var code = this._kbrdEvents[event],
        clbs = this._kbrdCallbacks;
        !clbs[code] && (clbs[code] = []);
        clbs[code].push(clb);
      } else if (event === 'UNLOAD') {
        push = false;
      $(window).bind('beforeunload', clb);
      } else {
        push = false;
      console.error('Unknown Core.event: ' + event);
      }

      if (start_group) {
        var group = _.extend({}, this, { _group: [] });
        push && group._group.push(clb._id);
        group.off = function(){
        var self = this;
        _.each(['_csmCallbacks', '_camCallbacks', '_kbrdCallbacks', '_scnCallbacks'], function(list){
        for (var evt in self[list]) {
        self[list][evt] = _.filter(self[list][evt], function(clb){
            return !~self._group.indexOf(clb._id);
        });
        }
        });
        this.off = null;
        this.on = null;
        return null;
        }.bind(group);

        return group;
      } else {
        push && this._group.push(clb._id);
        return this;
      }
    };


  };

    var core = _.extend({}, config.directConfig, {
            cursor: {
                _offset: null,
                offset: function (){
                    return this._offset;
                },
                cartesian: function(){
                    return this._offset && core.viewer.camera.pickEllipsoid(this._offset);
                },
                degrees: function(){
                    var cartesian = this.cartesian(),
                        radians = cartesian && Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian);
                    return radians && [Cesium.Math.toDegrees(radians.longitude), Cesium.Math.toDegrees(radians.latitude)];
                }
            },
            requestAnimationFrame: function(callback){
                return (window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame)(callback);
            },
            cancelAnimationFrame: function(t){
                return (window.cancelRequestAnimationFrame || window.mozCancelRequestAnimationFrame || window.webkitCancelRequestAnimationFrame)(t);
            },
            newTabUrl: function(url){
                if (_.isString(url)) {
                    var link = $('<a>', { target: '_blank', href: url })[0].click();
                    delete link;
                }
                return this;
            }
        }, Events);

    _.extend(core.viewer, {
        ssccToggle: function(a){
            var sscc = core.viewer.scene.screenSpaceCameraController;
            sscc.enableRotate = a & (1 << 0);
            sscc.enableTranslate = a & (1 << 1);
            sscc.enableZoom = a & (1 << 2);
        },
        isPointVisible: function(point){
            if (!point) return false;
            var position = this.camera.position,
                direction = Cesium.Cartesian3.subtract(point, position, new Cesium.Cartesian3()),
                ray = new Cesium.Ray(position, direction),
                intersection = Cesium.IntersectionTests.rayEllipsoid(ray, this.scene.globe.ellipsoid),
                start = Cesium.Ray.getPoint(ray, intersection.start),
                stop = Cesium.Ray.getPoint(ray, intersection.stop);
            return Cesium.Cartesian3.distance(point, start) < Cesium.Cartesian3.distance(point, stop);
        }
    });

    // CORE EVENTS



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
    $(window).on('resize', function(){
        _.each(core.events._camCallbacks['CAMERA_MOVE'], function(clb){ clb.call(core) });
    });

    // init cesium scene handlers
    _.each(scnEvents, function(event, alias){
        core.events._scnCallbacks[alias] = [];
        core.viewer.scene[event].addEventListener(function() {
            var args = arguments;
            _.each(this, function(clb){ clb.apply(core, args) });
        }, core.events._scnCallbacks[alias]);
    });

    // init keyboard events
    $(document).on('keyup', function(e){
        var code = e.keyCode;
        _.each(core.events._kbrdCallbacks[code], function(clb){ clb.call(core, e) });
    });

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

    function loop(){
        core.events._camMove && _.each(core.events._camCallbacks['CAMERA_MOVE'], function(clb){ clb.call(core) });

        core.requestAnimationFrame(loop);
    };
    loop();

    return core;

});
