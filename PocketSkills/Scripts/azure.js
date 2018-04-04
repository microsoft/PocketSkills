// We use jQuery to make REST calls.  Be sure to load jQuery before invoking any of the methods here.

azure = {
    getTable: function getTable(sasUrl) {
        if (!sasUrl) {
            throw "Azure tables require a SAS URL.";
        }

        function query(filter, select, callback, extra) {
            if (typeof filter == "function" && typeof select == "undefined" && typeof callback == "undefined") {
                callback = filter;
                filter = undefined;
            }
            if (typeof select == "function" && typeof callback == "undefined") {
                callback = select;
                select = undefined;
            }

            var url = sasUrl.replace("?", "()?");
            if (typeof filter != "undefined") {
                url += "&$filter=" + encodeURIComponent(filter);
            }
            if (typeof select != "undefined") {
                url += "&$select=" + encodeURIComponent(select).replace(/%2C/g, ",");
            }
            if (typeof extra != "undefined") {
                url += "&" + extra;
            }

            if (azure.proxy) {
                url = azure.proxy + encodeURIComponent(url);
            }

            // https://docs.microsoft.com/en-us/rest/api/storageservices/fileservices/query-entities
            var deferred = $.Deferred();
            var ajax = $.ajax({
                url: url,
                contentType: "application/json",
                dataType: "json",
                headers: {
                    "Accept": "application/json;odata=nometadata",
                    "x-ms-version": "2013-08-15",
                    "MaxDataServiceVersion": "3.0;NetFx"
                },
                success: function (v, s, r) {
                    azure.debug && window.console && window.console.log && window.console.log("azure.js received " + (v.value && v.value.length) + " rows from " + url);
                    callback(v.value);

                    var pk = r.getResponseHeader('x-ms-continuation-NextPartitionKey');
                    var rk = r.getResponseHeader('x-ms-continuation-NextRowKey');
                    if (pk) {
                        deferred.notifyWith(this, [v.value, s, r]);
                        query(filter, select, callback, "NextPartitionKey=" + pk + (rk ? "&NextRowKey=" + rk : "")).then(deferred.resolve, deferred.reject, deferred.notify);
                    } else {
                        deferred.resolveWith(this, [v.value, s, r]);
                    }
                },
                error: function (r, s, e) {
                    window.console && window.console.log && window.console.log("azure.js error from " + url + ": " + s + ", " + e + ", " + JSON.stringify(r));
                    callback && callback(null, s, r, e);
                    deferred.rejectWith(this, [s, r, e]);
                }
            });
            return deferred.promise();
        }

        function get(partitionKey, rowKey, callback) {
            if (typeof rowKey == "function") {
                callback = rowKey;
                rowKey = partitionKey;
                partitionKey = ".";
            } else if (typeof rowKey == "undefined") {
                rowKey = partitionKey;
                partitionKey = ".";
            }

            var url = sasUrl.replace("?", "(PartitionKey='" + encodeURIComponent(partitionKey) + "',RowKey='" + encodeURIComponent(rowKey) + "')?");

            if (azure.proxy) {
                url = azure.proxy + encodeURIComponent(url);
            }

            return $.ajax({
                url: url,
                contentType: "application/json",
                dataType: "json",
                headers: {
                    "Accept": "application/json;odata=nometadata",
                    "x-ms-version": "2013-08-15",
                    "MaxDataServiceVersion": "3.0;NetFx"
                },
                success: callback,
                error: function (r, s, e) {
                    window.console && window.console.log && window.console.log("azure.js error from " + url + ": " + s + ", " + e + ", " + JSON.stringify(r));
                    callback && callback(null, s, r, e);
                }
            });
        }

        function send(type, entity, callback) {
            if (entity.PartitionKey) {
                if (typeof entity.PartitionKey != "string") {
                    entity.PartitionKey = String(entity.PartitionKey);
                }
            } else {
                entity.PartitionKey = ".";
            }
            if (entity.RowKey) {
                if (typeof entity.RowKey != "string") {
                    entity.RowKey = String(entity.RowKey);
                }
            } else {
                entity.RowKey = String(8640000000000000 - Date.now()) + Math.floor(Math.random() * 10000000000000000); // Padding with 16 random numbers since Date.now() can actually return the same value when called quickly.
            }

            var url = sasUrl;
            if (type != "POST") {
                url = url.replace("?", "(PartitionKey='" + encodeURIComponent(entity.PartitionKey) + "',RowKey='" + encodeURIComponent(entity.RowKey) + "')?");
            }

            if (azure.proxy) {
                url = azure.proxy + encodeURIComponent(url);
            }

            return $.ajax({
                url: url,
                type: type,
                data: JSON.stringify(entity),
                contentType: "application/json",
                dataType: "json",
                headers: {
                    "Accept": "application/json;odata=nometadata",
                    "x-ms-version": "2013-08-15",
                    "Prefer": "return-no-content",
                    "MaxDataServiceVersion": "3.0;NetFx"
                },
                success: callback,
                error: function (r, s, e) {
                    window.console && window.console.log && window.console.log("azure.js error from " + url + ": " + s + ", " + e + ", " + JSON.stringify(r));
                    callback && callback(null, s, r, e);
                }
            });
        }

        return {
            query: query,
            get: get,
            add: function (entity, callback) { send("POST", entity, callback); },
            save: function (entity, callback) { send("MERGE", entity, callback); },
            replace: function (entity, callback) { send("PUT", entity, callback); }
        };
    },

    // Optional proxy to use since some mobile browsers don't allow cross site ajax calls.
    proxy: undefined,

    // Keeps track of how many outstanding azure writes are being performed right now.
    outstandingWrites: 0,

    // Creates a poll that calls a callback ONCE when all writes are complete.
    onWritesComplete: function (callback) {
        function check() {
            if (azure.outstandingWrites <= 0) {
                callback();
            } else {
                setTimeout(check, 100);
            }
        }
        check();
    },

    // Registers a callback that's called when an error writing has occurred.
    // The callback is of the form:
    // azure.onError(function (table, occurances, message) {
    //      return whetherToRetry;
    // }
    onError: function (callback) {
        azure.errorCallbacks.push(callback);
    },

    errorCallbacks: [],

    // Resiliently writes a log-style message to an azure table with information about the current page and user agent etc.
    writeMessage: function writeMessage(table, partition, message, callback) {
        if (!table) {
            window.console && window.console.log && window.console.log("azure.js error: azure.writeMessage called an invalid table!");
            return;
        }

        azure.outstandingWrites++;
        var errors = arguments[4] || 0;

        azure.debug && window.console && window.console.log && window.console.log("azure.js writing log message: " + message);
        azure.debug && window.console && window.console.log && window.console.log("azure.js outstanding writes: " + azure.outstandingWrites);

        var request = table.add({
            PartitionKey: partition,
            Page: window.location.href,
            UserAgent: window.navigator.userAgent,
            ClientTime: Date(),
            ClientTimestamp: Date.now(),
            Message: message
        }, function (v, s, r, e) {
            azure.outstandingWrites--;
            if (v === null) {
                // Error writing data to Azure!
                errors++;
                var errorMessage = "azure.js " + errors.toOrdinalString() + " failure (" + JSON.stringify(s) + ", " + JSON.stringify(r) + ", " + JSON.stringify(e) + ") writing log message: " + message;
                azure.debug && window.console && window.console.log && window.console.log(errorMessage);

                var retry = azure.errorCallbacks.map(function (cb) { return cb(table, errors, errorMessage); }).some(function (r) { return r; });
                if (retry) {
                    writeMessage(table, partition, message, callback, errors);
                } else {
                    azure.debug && window.console && window.console.log && window.console.log("azure.js giving up writing log message.");
                    azure.debug && window.console && window.console.log && window.console.log("azure.js outstanding writes: " + azure.outstandingWrites);
                    callback && callback(v, s, r, e);
                }
            } else {
                azure.debug && window.console && window.console.log && window.console.log("azure.js writing log message.");
                azure.debug && window.console && window.console.log && window.console.log("azure.js outstanding writes: " + azure.outstandingWrites);
                callback && callback(v, s, r, e);
            }
        });

        return request;
    },

    // Resiliently writes some unstructured data to an azure table (with an optional specific row key instead of appending), prefixing any properties that conflict with azure property names.
    writeData: function writeData(table, partition, row, data, callback) {
        if (!table) {
            window.console && window.console.log && window.console.log("azure.js error: azure.writeData called with an invalid table!");
            return;
        }

        // Handle the case where row was omitted.
        if (typeof row == "object" && typeof callback == "undefined") {
            callback = data;
            data = row;
            row = undefined;
        }

        azure.outstandingWrites++;
        var errors = arguments[4] || 0;

        azure.debug && window.console && window.console.log && window.console.log("azure.js writing data: " + JSON.stringify(data));
        azure.debug && window.console && window.console.log && window.console.log("azure.js outstanding writes: " + azure.outstandingWrites);

        // Certain column names are used by the system.  If the user's data contains those fields then affix an underscore to the user's data.
        var request = table.add($.extend({}, data, {
            _PartitionKey: data.PartitionKey,
            _RowKey: data.RowKey,
            _Timestamp: data.Timestamp,
            PartitionKey: partition,
            RowKey: row,
        }), function (v, s, r, e) {
            azure.outstandingWrites--;
            if (v === null) {
                // Error writing data to Azure!
                errors++;
                var errorMessage = "azure.js " + errors.toOrdinalString() + " failure (" + JSON.stringify(s) + ", " + JSON.stringify(r) + ", " + JSON.stringify(e) + ") writing data: " + JSON.stringify(data);
                azure.debug && window.console && window.console.log && window.console.log(errorMessage);

                var retry = azure.errorCallbacks.map(function (cb) { return cb(table, errors, errorMessage); }).some(function (r) { return r; });
                if (retry) {
                    writeData(table, partition, data, callback, errors);
                } else {
                    azure.debug && window.console && window.console.log && window.console.log("azure.js giving up writing data.");
                    azure.debug && window.console && window.console.log && window.console.log("azure.js outstanding writes: " + azure.outstandingWrites);
                    callback && callback(v, s, r, e);
                }
            } else {
                azure.debug && window.console && window.console.log && window.console.log("azure.js writing data finished.");
                azure.debug && window.console && window.console.log && window.console.log("azure.js outstanding writes: " + azure.outstandingWrites);
                callback && callback(v, s, r, e);
            }
        });

        return request;
    }
};
