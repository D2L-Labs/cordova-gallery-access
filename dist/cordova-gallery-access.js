require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

/**
 * Helper module to ensure that certain permissions are granted by the user.
 * This requires (cordova-plugin-android-permission)[https://github.com/NeoLSN/cordova-plugin-android-permission]
 * to be installed for Android 6 permission checks.
 */

var Permission = {
	GET_ALBUMS: 'get-album'
};

/**
 * Ensure that the user granted a specific permission.
 * @param  {string} permission
 *         Permission that should be granted
 * @return {Promise}
 *         Resolves if the permission was granted. Rejects if the permission
 *         was not granted.
 */
function ensurePermission(permission) {
	if (!window.cordova || !window.cordova.plugins || !window.cordova.plugins.permissions) {
		// Assume the permission is there if not Android 6 permission system
		return Promise.resolve();
	}

	var devicePermission = void 0;
	switch (permission) {
		case Permission.GET_ALBUMS:
			devicePermission = window.cordova.plugins.permissions.READ_EXTERNAL_STORAGE;
			break;
		default:
			throw new Error('Unsupported permission ' + permission + '.');
	}

	return hasPermission(devicePermission).then(function (status) {
		if (status.hasPermission) {
			return true;
		}

		return requestPermission(devicePermission);
	});
}

function hasPermission(permission) {
	return new Promise(function (resolve, reject) {
		window.cordova.plugins.permissions.hasPermission(permission, function (status) {
			return resolve(status);
		}, function (e) {
			return reject(e);
		});
	});
}

function requestPermission(permission) {
	return new Promise(function (resolve, reject) {
		window.cordova.plugins.permissions.requestPermission(permission, function (status) {
			if (status.hasPermission) {
				resolve(status);
			} else {
				reject(status);
			}
		}, function (e) {
			return reject(e);
		});
	});
}

module.exports = {
	ensurePermission: ensurePermission,
	Permission: Permission
};
},{}],"cordova-gallery-access":[function(require,module,exports){
'use strict';

var permissionsChecker = require('./permissions-checker.js');

/**
 * Loads the most recent items from the Camera Roll
 * @param  {Number} [start=0]
 *         Index to start retrieving items for
 * @param  {Number} [count=5]
 *         Maxmimum number of returned items
 * @return {Promise}
 *         Promise that will return all items once it resolves
 */
var load = function load() {
	var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
	    _ref$start = _ref.start,
	    start = _ref$start === undefined ? 0 : _ref$start,
	    _ref$count = _ref.count,
	    count = _ref$count === undefined ? 5 : _ref$count;

	if (!window.galleryAPI) {
		throw new Error('Gallery API is not available. Add https://github.com/SuryaL/cordova-gallery-api.git to your config.xml.');
	}

	return permissionsChecker.ensurePermission(permissionsChecker.Permission.GET_ALBUMS).then(function () {
		return getAlbums();
	}).then(function (albums) {
		var album = _findCameraRollAlbum(albums);

		return getMedia(album);
	}).then(function (items) {
		// Limit number of items for which the data is looked up (because
		// it's expensive)
		var limitedItems = items.slice(start, start + count);

		// Enrich items with their thumbnail
		var promises = limitedItems.map(function (item) {
			return getMediaThumbnail(item);
		});

		return Promise.all(promises);
	});
};

/**
 * Finds in the list of available albums the one pointing to the device camera:
 * - iOS: type is "PHAssetCollectionSubtypeSmartAlbumUserLibrary"
 * - Android: title is "Camera"
 * @param  {Array} albums List of all available albums
 * @return {Object}       Album representing the Camera Roll
 */
var _findCameraRollAlbum = function _findCameraRollAlbum(albums) {
	var isCameraRollAlbum = albums.find(function (album) {
		return album.type === 'PHAssetCollectionSubtypeSmartAlbumUserLibrary';
	});
	if (isCameraRollAlbum) {
		return isCameraRollAlbum;
	}

	var androidCameraRollAlbum = albums.find(function (album) {
		return album.title === 'Camera';
	});
	if (androidCameraRollAlbum) {
		return androidCameraRollAlbum;
	}

	throw new Error('Can\'t find Camera Roll album. Available albums: ' + JSON.stringify(albums));
};
var getAlbums = function getAlbums() {
	return new Promise(function (resolve, reject) {
		window.galleryAPI.getAlbums(function (albums) {
			return resolve(albums);
		}, function (e) {
			return reject('Failed to get albums: ' + e);
		});
	});
};
var getMedia = function getMedia(album) {
	return new Promise(function (resolve, reject) {
		window.galleryAPI.getMedia(album, function (items) {
			return resolve(items);
		}, function (e) {
			return reject('Failed to load items for album ' + album.id + ': ' + e);
		});
	});
};
var getMediaThumbnail = function getMediaThumbnail(item) {
	return new Promise(function (resolve, reject) {
		window.galleryAPI.getMediaThumbnail(item, function (enrichedItem) {
			return resolve(enrichedItem);
		}, function (e) {
			return reject('Failed to load thumbnail for item ' + item.id + ': ' + e);
		});
	});
};

/**
 * Gets the filepath to the high quality version of the mediaitem
 * @param  {Object} item Media item for which the HQ version should be looked up
 * @return {String}      Path to the HQ version of the mediaitem
 */
var getHQImageData = function getHQImageData(item) {
	return new Promise(function (resolve, reject) {
		window.galleryAPI.getHQImageData(item, function (hqFilePath) {
			return resolve('file://' + hqFilePath);
		}, function (e) {
			return reject('Failed to load HQ image data for item ' + item.id + ': ' + e);
		});
	});
};

/**
 * Gets a reference to a local file
 * @param  {String} filePath Path of the to be loaded file
 * @return {Object}
 */
var getFile = function getFile(filePath) {
	return resolveLocalFileSystemURL(filePath).then(function (fileEntry) {
		return enrichFileSize(fileEntry);
	});
};
/**
 * Resolve the fileEntry for a path
 * @param  {String} filePath Path
 * @return {FileEntry}       Resolved fileEntry
 */
var resolveLocalFileSystemURL = function resolveLocalFileSystemURL(filePath) {
	return new Promise(function (resolve, reject) {
		window.resolveLocalFileSystemURL(filePath, function (fileEntry) {
			return resolve(fileEntry);
		}, function (e) {
			return reject('Failed to resolve URL for path ' + filePath + ': ' + JSON.stringify(e));
		});
	});
};
/**
 * Adds the size to the file entry by resolving the file entry
 * @param  {FileEntry} fileEntry File entry to be resolved
 * @return {FileEntry}           File entry with the size field
 */
var enrichFileSize = function enrichFileSize(fileEntry) {
	return new Promise(function (resolve, reject) {
		fileEntry.file(function (file) {
			fileEntry.size = file.size;
			resolve(fileEntry);
		}, function (e) {
			return reject('Failed to resolve file entry ' + fileEntry + ': ' + JSON.stringify(e));
		});
	});
};

/**
 * Checks if all required libaries are available to load galley items. Use this
 * check to verify if the app runs in a Cordova environment.
 * @return {Boolean} True if items can be loaded from the gallery
 */
var isSupported = function isSupported() {
	return Boolean(window.galleryAPI);
};

module.exports = {
	load: load,
	getHQImageData: getHQImageData,
	getFile: getFile,
	isSupported: isSupported,

	// Visible for testing
	_findCameraRollAlbum: _findCameraRollAlbum
};
},{"./permissions-checker.js":1}]},{},[]);
