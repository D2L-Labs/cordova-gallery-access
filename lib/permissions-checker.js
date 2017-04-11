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