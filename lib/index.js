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
		var allImages = [];

		var promises = [];
		promises.push(getMedia(_findCameraRollAlbum(albums)));
		promises.push(getMedia(_findAppSavedAlbum(albums)));

		return Promise.all(promises);
	}).then(function (result) {
		return flattenAndSort(result);
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

// flatten an array of arrays into a single array, then sort by date added
var flattenAndSort = function flatten(array) {
	var flattened = array.reduce(function (a, b) {
		return a.concat(b);
	}, []);
	flattened.sort(function (a, b) {
		return b.date_added - a.date_added;
	});
	return flattened;
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

var _findAppSavedAlbum = function _findAppSavedAlbum(albums) {
	var isAppSavedAlbum = albums.find(function (album) {
		return album.type === 'PHAssetCollectionSubtypeAny';
	});
	if (isAppSavedAlbum) {
		return null;
	}

	var androidAppSavedAlbum = albums.find(function (album) {
		return album.title === 'Pictures';
	});
	if (androidAppSavedAlbum) {
		return androidAppSavedAlbum;
	}

	throw new Error('Can\'t find App album. Available albums: ' + JSON.stringify(albums));
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
		if (!album) {
			return resolve([]);
		}
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