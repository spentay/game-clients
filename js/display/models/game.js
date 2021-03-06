'use strict';
/*jshint bitwise: false*/
var _ = require('underscore'),
	ModelExtension = require('../../extensions/model'),
	MapsCollection = require('../collections/maps'),
	EntitiesCollection = require('../collections/entities'),
	CameraModel = require('./camera'),
	ControlsModel = require('./controls'),
	ImagesCollection = require('../collections/images'),
	// NpcModel = require('./npc'),
	// TilesetsCollection = require('../collections/tilesets'),
	PlayerModel = require('./player'),
	canvasUtils =require('../../utils/canvas'),
	ticker = require('../ticker'),

    GameModel = ModelExtension.extend({

    	acceptedParams: ['socket', 'cameraModel'],

		isReady: false,

		ticker: ticker.initialize(),

		initialize: function() {
			var cameraModel = this.getCameraModel(),
				playerModel = this.getPlayerModel(),
				entitiesCollection = this.getEntitiesCollection();

			entitiesCollection.add(playerModel);

			this.setSocketEvents();

			this.set('controllerUrl', 'bit.ly/rpg-control');

			this._super.apply(this, arguments);

			this.on('change:token', this.setUrl);


			// window.entitiesCollection = entitiesCollection;
			// window.mapsCollection = mapsCollection;
			// window.game = this;
			// window.playerModel = playerModel;

			cameraModel.setTarget(playerModel);

			var playerDeferred = new $.Deferred(),
				mapDeferred = new $.Deferred(),
				currentMap = this.getCurrentMap();

			$.when(playerDeferred, mapDeferred).then(this.ready.bind(this));

			if (currentMap.isReady) {
				mapDeferred.resolve();
			} else {
				this.listenToOnce(currentMap, 'ready', mapDeferred.resolve);
			}

			if (playerModel.isReady) {
				playerDeferred.resolve();
			} else {
				this.listenToOnce(playerModel, 'ready', playerDeferred.resolve);
			}

		},

		setCurrentMap: function () {
			var map = this.getCurrentMap();

			this.getPlayerModel().setMap(map);
			this.getCameraModel().setMap(map);
			if (this.started) {
				map.activate();
			}

		},

		onReady: function () {
			this.start();
		},

		start: function () {
			if (!this.started) {
				this.started = true;
				this.listenTo(this.getMapsCollection(), 'changed:currentMap', this.setCurrentMap);
				this.setCurrentMap();
			}
		},

		listenForReady: function (items) {
			var count = items.length;

			_.each(items, function (item) {
				if (item.isReady) {
					count -= 1;
						if (count <= 0) {
							this.ready();
						}
				} else {
					this.listenToOnce(item, 'ready', function () {
						count -= 1;
						if (count >= 0) {
							this.ready();
						}
					});
				}
			}, this);
		},

		getImagesCollection: function () {
			return this.imagesCollection || this.setImagesCollection.apply(this, arguments);
		},

		setImagesCollection: function () {
			this.imagesCollection = new ImagesCollection();

			return this.imagesCollection;
		},

		getControlsModel: function () {
			return this.controlsModel || this.setControlsModel.apply(this, arguments);
		},

		setControlsModel: function (data) {
			this.controlsModel = new ControlsModel(data, {
				socket: this.socket
			});

			return this.controlsModel;
		},

		getEntitiesCollection: function () {
			return this.entitiesCollection || this.setEntitiesCollection();
		},

		setEntitiesCollection: function () {
			this.entitiesCollection = new EntitiesCollection();

			return this.entitiesCollection;
		},

		getPlayerModel: function () {
			return this.playerModel || this.setPlayerModel.apply(this, arguments);
		},

		setPlayerModel: function (data) {
			data = data || window.initialData.player;

			this.playerModel = new PlayerModel(data, {
				controlsModel: this.getControlsModel(),
				imagesCollection: this.getImagesCollection(),
				gameModel: this,
				socket: this.socket
			});

			return this.playerModel;
		},

		getMapsCollection: function () {
			return this.mapsCollection || this.setMapsCollection.apply(this, arguments);
		},

		setMapsCollection: function (data, options) {
			data = data || window.initialData.map;
			options = _.extend({}, options, {
				defaultMap: data.defaultMap,
				entitiesCollection: this.getEntitiesCollection(),
				imagesCollection: this.getImagesCollection(),
				cameraModel: this.getCameraModel()
			});

			this.mapsCollection = new MapsCollection(data.maps, options);

			return this.mapsCollection;
		},

		getCameraModel: function () {
			return this.cameraModel || this.setCameraModel();
		},

		setCameraModel: function () {
			var width = this.get('width'),
				height = this.get('height');

			this.cameraModel = new CameraModel({
				deadzone: {
					x: width / 2,
					y: height / 2
				}
			}, {
				gameModel: this,
				width: width,
				height: height,
				deadzone: {
					x: width / 2,
					y: height / 2
				}
			});

			return this.cameraModel;
		},

		setSocketEvents: function () {
			this.socket.on('token generated', this.setToken.bind(this));

			this.socket.emit('display initialize');
			this.socket.emit('request token');
		},

		setToken: function (data) {
			this.set('token', data.token);
		},

		setUrl: function () {
			var url = window.location.origin + '/controller/' + this.get('token');
			this.set('url', url);
		},

		getCurrentMap: function () {
			return this.getMapsCollection().getCurrentMap();
		},

		tick: function () {
			var mapsCollection = this.getMapsCollection(),
				// currentMap = mapsCollection.getCurrentMap(),
				context = canvasUtils.getContext('base'),
				entities = this.getEntitiesCollection(),
				camera = this.getCameraModel(),
				quedMap = mapsCollection.quedMap;

			if (quedMap) {
				mapsCollection.setCurrentMap(quedMap);
				// quedMap.activate();
			}

			entities.updateEach();

			camera.update();

            context.clearRect(0, 0, this.attributes.width, this.attributes.height);
            context.save();

            context.translate(this.cameraModel.x, this.cameraModel.y);

			entities.drawEach(context);

            context.restore();
		}
    });

module.exports = GameModel;