/// <reference path="azure.js" />

Data.writeClearsToAzure = true; // Whether to write nulls to Azure when clearing variables (for example when going through a conversation a 2nd time and clearing the old values as we go).
Data.logEvalsToConsole = false; // Whether to write all evaluation diagnostic messages to console.log().
Data.logToConsole = false; // Whether to write storage diagnostic messages to console.log().
Settings.logToConsole = false; // Whether to write settings diagnostic messages to console.log().
Content.logToConsole = false; // Whether to write content diagnostic messages to console.log().

// Loads content from Azure that was imported from the Content Worksheet.
function Content(name) {
    'use strict';

    if (!this instanceof Content)
        return new Content(name);
    var _this = this;

    _this.cache = {}; // Instance variable cache of values set/loaded so far during this session.

    _this.get = function (id) {
        var value = _this.cache[id];
        return value; // TODO: Do something if we are still waiting for Azure.
    }

    _this.load = function (sas) {
        _this.table = azure.getTable(sas);

        var deferred = $.Deferred();

        _this.table.get(name, 'Latest', function (row, error, _, status) {
            if (row) {
                var partitionKey = row.ID;

                if (Content.logToConsole) {
                    console.log("Loading Content for '" + name + "': " + partitionKey);
                }

                _this.table.query("PartitionKey eq '" + partitionKey + "'", function (rows, error, _, status) {
                    if (rows) {
                        rows.forEach(function (row) {
                            _this.cache[row.ID || row.RowKey] = row;
                        });
                    } else {
                        log("Error loading content for '" + name + "':\n" + status + "\n" + (error || {}).responseText);
                        throw error;
                    }
                }).done(function () {
                    _this.loaded = new Date();
                    if (Content.logToConsole) {
                        console.log("Content for '" + name + "' Loaded on " + _this.loaded);
                    }
                    $(_this).triggerHandler('loaded');
                }).then(deferred.resolve, deferred.reject, deferred.notify);
            } else {
                log("Error loading latest partition key for '" + name + "':\n" + status + "\n" + (error || {}).responseText);
                throw error;
            }
        }).fail(deferred.reject);

        return deferred.promise();
    }
}

// Manages settings that have default values imported from the Content Worksheet.
function Settings() {
    'use strict';

    if (!this instanceof Settings)
        return new Settings();
    var _this = this;

    _this.cache = {}; // Instance variable cache of values set/loaded so far during this session.

    _this.get = function (id) {
        var value = _this.cache[id];
        if (Settings.logToConsole) {
            console.log("Getting setting '" + id + "': '" + value + "'.");
        }
        return value; // TODO: Do something if we are still waiting for Azure.
    }

    _this.set = function (id, value) {
        if (Settings.logToConsole) {
            console.log("Setting setting '" + id + "' to '" + value + "'.");
        }

        _this[id] = value; // Backwards compatibility.
        _this.cache[id] = value;

        $(_this).triggerHandler('change', id);
    }

    // Asynchronously loads settings from azure table storage.
    _this.load = function (sas) {
        _this.table = azure.getTable(sas);

        var deferred = $.Deferred();

        _this.table.get('Settings', 'Latest', function (row, error, _, status) {
            if (row) {
                var partitionKey = row.ID;

                if (Settings.logToConsole) {
                    console.log("Loading Settings: " + partitionKey);
                }

                _this.table.query("PartitionKey eq '" + partitionKey + "'", function (settings, error, _, status) {
                    if (settings) {
                        settings.forEach(function (setting) {
                            _this[setting.Setting] = setting.Value; // Backwards compatibility.
                            _this.cache[setting.Setting] = setting.Value;
                            $(_this).triggerHandler('change', setting.Setting);
                        });
                    } else {
                        log("Error loading settings:\n" + status + "\n" + (error || {}).responseText);
                    }
                }).done(function () {
                    _this.loaded = new Date();
                    if (Settings.logToConsole) {
                        console.log("Settings Loaded on " + _this.loaded);
                    }
                    $(_this).triggerHandler('loaded');
                }).then(deferred.resolve, deferred.reject, deferred.notify);
            } else {
                log("Error loading latest partition key for settings:\n" + status + "\n" + (error || {}).responseText);
                throw error;
            }
        }).fail(deferred.reject);

        return deferred.promise();
    }
}

// Manages frequently-changing Name/Value pairs such as responses in line-by-line conversations and in other areas of the app.
function Data() {
    'use strict';

    if (!this instanceof Data)
        return new Data();
    var _this = this;

    _this.cache = {}; // Instance variable cache of values set/loaded so far during this session.
    _this.cacheTimes = {}; // Timestamps of the last known cached values.

    _this.get = function (id) {
        var value = _this.cache[id];
        if (Data.logToConsole) {
            console.log("Getting variable '" + id + "': '" + value + "'.");
        }
        return value; // TODO: Do something if we are still waiting for Azure.
    }

    _this.set = function (id, value) {
        if (Data.logToConsole) {
            console.log("Setting variable '" + id + "' to '" + value + "'.");
        }

        var timestamp = Date.now();
        _this.cache[id] = value;
        _this.cacheTimes[id] = timestamp;
        _this.setAzure(id, value, timestamp);

        $(_this).triggerHandler('change', id);
    }

    _this.clear = function (id) {
        // Only do something if the variable exists.
        var value = _this.cache[id];
        if (value != null) {
            if (Data.logToConsole) {
                console.log("Clearing variable '" + id + "'.  (Was: '" + value + "')");
            }

            // TODO: Decide whether this should just clear the local memory's value for the variable,
            // or whether it should also write a new null entry to Azure.
            // If it write a new null entry to Azure then it's a little misleading since the user didn't actually "set" it to null, 
            // but if we don't write a new null entry to Azure then when the app is reloaded then it will contain the old value.
            if (Data.writeClearsToAzure) {
                _this.set(id, null);
            } else {
                _this.cache[id] = undefined;
                _this.cacheTimes[id] = undefined;
                $(_this).triggerHandler('change', id);
            }
        }
    }

    _this.setAzure = function (id, value, timestamp) {
        timestamp = timestamp || Date.now();
        if (_this.table) {
            var data = {
                ID: id,
                Value: value,
                ClientTime: Date(),
                ClientTimestamp: timestamp
            };
            azure.writeData(_this.table, _this.user, data);
        }
    }

    _this.load = function (sas, user) {
        _this.table = azure.getTable(sas);
        _this.user = user;

        return _this.table.query(function (rows, error, _, status) {
            if (rows) {
                if (Data.logToConsole) {
                    console.log("Data received " + rows.length + " rows from Azure.");
                }

                // Now load the new data.
                rows.forEach(function (row) {
                    // Check if the timestamp in Azure is greater than the locally stored value (which is true when we don't have a locally stored value, or if they used another client recently).
                    if (!(_this.cacheTimes[row.ID] >= row.ClientTimestamp)) {
                        if (Data.logToConsole) {
                            console.log("Data loading value for '" + row.ID + "': '" + row.Value + "'");
                        }

                        _this.cache[row.ID] = row.Value;
                        _this.cacheTimes[row.ID] = +row.ClientTimestamp;
                        $(_this).triggerHandler('change', row.ID);
                    }
                });
            } else {
                log("Error loading data:\n" + status + "\n" + (error || {}).responseText);
                throw error;
            }
        }).done(function () {
            _this.loaded = new Date();
            if (Data.logToConsole) {
                console.log("Data Loaded on " + _this.loaded);
            }
            $(_this).triggerHandler('loaded');
        });
    }

    _this.evaluateText = function (text, data) {
        return text && String(text).replace(/\$\{(.*?)\}/g, function (match, expr) {
            return _this.evaluateExpression(expr, data) || "";
        }).replace(/\[(.*?)\]/g, function (match, name) {
            return (data && data[name]) || _this.get(name);
        });
    }

    _this.evaluateExpression = function (expr, data) {
        return evalWith($.extend({}, _this.cache, data), expr);
    }

}

// Define 'forEach' over the storage types.
[Content, Settings, Data].forEach(function forEach(type) {
    defineProperty(type.prototype, "forEach", function (callback) {
        var obj = this.cache;
        for (var key in obj) {
            callback.call(obj[key], obj[key], key, obj);
        }
    });
});

// Just a little utility function to get a range of values between two values.
function range(from, to, step) {
    from = Number(from);
    to = Number(to);
    if (!step) {
        step = from < to ? 1 : -1;
    }
    var result = [];
    result.push(from);
    while (from != to) {
        from += step;
        result.push(from);
    }
    return result;
}

// Evaluates an expression within the context of the given object.
function evalWith(data, code) {
    if (!code) {
        return code;
    }
    if (!evalWith.undefineds) {
        evalWith.undefineds = {};
    }
    try {
        var result = eval('with (evalWith.undefineds) { with (data) {' + code + '} }');
        if (typeof result != "string" && typeof result != "number" && typeof result != "boolean") {
            // Don't return anything other than primitive types.
            result = null;
        }
        if (Data.logEvalsToConsole) {
            console.log("Evaluating: " + code + " ==> " + result);
        }
    } catch (e) {
        if (Data.logEvalsToConsole) {
            console.log("Evaluating: " + code + ": " + e);
        }
        if (e instanceof ReferenceError) {
            // TODO: Verify that this works with other browsers too.
            var match = e.message.match(/(.+) is not defined/) // Android, Chrome
                || e.message.match(/'(.+)' is undefined/) // Edge, Internet Explorer
                || e.message.match(/Can't find variable: (.+)/); // iOS, Safari
            if (match) {
                evalWith.undefineds[match[1]] = undefined;
                return evalWith(data, code);
            } else {
                alert(e.message);
            }
        } else {
            alert('Bad expresion in the content worksheet: ' + code + '\n' + e);
        }
    }
    return result;
}