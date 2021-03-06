'use strict';

let ObjectId = require('mongodb').ObjectId;
let Promise = require('es6-promise').Promise;

let dbClient = require('../helpers/db');
let validators = require('../helpers/validators');
let chart = require('./chart');

const COLLECTION = dbClient.COLLECTION.CHART_SET;
const RESOURCE_NAME = 'chart-set';


/**
 * Get all chart sets.
 *
 * @method
 * @param {Object} params URL query parameters.
 * @param {string} [params.query] Query for find operation.
 * @param {Array<Array<string>>} [params.sort] Set to sort the documents
 *                                             coming back from the query.
 * @param {number} [params.skip] Set to skip N documents ahead in your
 *                               query (useful for pagination).
 * @param {number} [params.limit] Sets the limit of documents returned in
 *                                the query.
 * @returns {Promise} A promise will be resolved with new created chart set.
 *                    Or rejected with defined errors.
 */
exports.list = function (params) {
  let query = {};

  params = params || {};

  if (params.query) {
    query["$text"] = {
      "$search": params.query
    };

    delete params.query;
  }

  return dbClient.connect().then(function (db) {

    return db
      .collection(COLLECTION)
      .find(query, false, params)
      .toArray();
  });
};


/**
 * Get a single chart set.
 *
 * @method
 * @param {string} id The chart set '_id' property.
 * @returns {Promise} A promise will be resolved with the found chart set.
 *                    Or rejected with defined errors.
 */
exports.get = function (id) {
  if (!ObjectId.isValid(id)) {
    return Promise.reject({
      status: 422,
      errors: [{
        "resource": "chart-sets",
        "field": "_id",
        "code": "invalid"
      }]
    });
  }

  return dbClient.connect().then(function (db) {

    return db
      .collection(COLLECTION)
      .find({ "_id": ObjectId(id) })
      .limit(1)
      .toArray()
      .then(function (docs) {
        if (!docs.length) {
          return Promise.reject({
            status: 404
          });
        }

        let promiseQueue = [];

        docs[0].charts.forEach(function (chartId, index) {
          promiseQueue.push(chart.get(chartId));
        });

        return Promise.all(promiseQueue)
          .then(function (result) {
            docs[0].charts = [];

            result.forEach(function (chart) {
              docs[0].charts.push(chart[0]);
            });

            return docs[0];
          });
      });
  });
};


/**
 * Create a new chart set.
 *
 * @method
 * @param {Object} data The new chart set object.
 * @param {?string} [data.title=null] The chart set title.
 * @param {?string} [data.description=null] The chart set description.
 * @param {Array} [data.charts] The charts' ids belong to this chart set.
 * @returns {Promise} A promise will be resolved with new created chart set.
 *                    Or rejected with defined errors.
 */
exports.create = function (data) {
  // chart set schema
  let schema = {
    resourceName: RESOURCE_NAME,
    title: null,
    description: null,
    charts: [],
    createdAt: null,
    updatedAt: null
  };

  if (validators.isString(data.title)) {
    schema.title = data.title;
  }

  if (validators.isValidDescription(data.description)) {
    schema.description = data.description;
  }

  if (validators.isValidChartIds(data.charts)) {
    schema.charts = data.charts;

  } else {
    return Promise.reject({
      status: 422,
      errors: [{
        "resource": "chart-sets",
        "field": "charts",
        "code": "invalid"
      }]
    });
  }

  schema.createdAt = schema.updatedAt = new Date().toISOString();

  return dbClient.connect().then(function (db) {

    return db
      .collection(COLLECTION)
      .insertOne(schema)
      .then(function (result) {
        return result.ops[0];
      });
  });
};


/**
 * Update a single chart set.
 *
 * @method
 * @param {string} id The chart set '_id' property.
 * @param {Object} data The updated chart set data object.
 * @param {?string} [data.title] The chart set description field.
 * @param {?string} [data.description] The chart set description field.
 * @param {Array} [data.charts] The chart set charts field.
 * @returns {Promise} A promise will be resolved with the updated chart set.
 *                    Or rejected with defined errors.
 */
exports.update = function (id, data) {
  if (!ObjectId.isValid(id)) {
    return Promise.reject({
      status: 422,
      errors: [{
        "resource": "chart-sets",
        "field": "_id",
        "code": "invalid"
      }]
    });
  }

  let fields = ['title', 'description', 'charts'];
  let updateData = {
    updatedAt: new Date().toISOString()
  };

  fields.forEach(function (field) {
    if (validators.isDefined(data[field])) {
      updateData[field] = data[field];
    }
  });

  return dbClient.connect().then(function (db) {

    return db
      .collection(COLLECTION)
      .findOneAndUpdate({
        _id: ObjectId(id)
      }, {
        $set: updateData
      }, {
        // When false, returns the updated document rather than
        // the original.
        returnOriginal: false
      })
      .then(function (result) {
        if (result.value === null) {
          return Promise.reject({
            status: 404
          });

        } else {
          return result.value;
        }
      });
  });
};


/**
 * Delete a single chart set.
 *
 * @method
 * @param {string} id The chart set '_id' property.
 * @returns {Promise} A promise will be resolved when delete successfully.
 *                    Or rejected with defined errors.
 */
exports.delete = function (id) {
  if (!ObjectId.isValid(id)) {
    return Promise.reject({
      status: 422,
      errors: [{
        "resource": "chart-sets",
        "field": "_id",
        "code": "invalid"
      }]
    });
  }

  return dbClient.connect().then(function (db) {

    return db
      .collection(COLLECTION)
      .deleteOne({ _id: ObjectId(id) })
      .then(function (result) {
        if (result.deletedCount === 0) {
          return Promise.reject({
            status: 404
          });

        } else {
          return result;
        }
      });
  });
};


/**
 * Delete all chart sets.
 *
 * @method
 * @returns {Promise} A promise will be resolved when delete successfully.
 *                    Or rejected when error occurred.
 */
exports.deleteAll = function () {
  return dbClient.connect().then(function (db) {

    return db
      .collection(COLLECTION)
      .deleteMany();
  });
};


/**
 * Delete chart in all chart sets.
 *
 * @method
 * @param {string} id The chart '_id' property.
 * @returns {Promise} A promise will be resolved when delete successfully.
 *                    Or rejected when error occurred.
 */
exports.deleteChartInChartSets = function (id) {
  if (!ObjectId.isValid(id)) {
    return Promise.reject({
      status: 422,
      errors: [{
        "resource": "charts",
        "field": "_id",
        "code": "invalid"
      }]
    });
  }

  return dbClient.connect().then(function (db) {

    return db
      .collection(COLLECTION)
      .updateMany({
        "charts": id
      }, {
        $pullAll: {
          "charts": [id]
        },
        $set: {
          updatedAt: new Date().toISOString()
        }
      });
  });
};
