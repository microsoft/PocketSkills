// Global functions.
function normalize(string) {
    var invalidCharacters = /(^[^_a-zA-Z]+)|[^_a-zA-Z0-9-]/g;
    return string && string.toLowerCase().replace(invalidCharacters, '');
}

// Additions to base javascript objects that should have been there originally and shouldn't be enumerable in for .. in .. blocks.
function defineProperty(on, name, value) {
    try {
        Object.defineProperty(on, name, {
            value: value,
            writable: true,
            configurable: true,
            enumerable: false
        });
    } catch (e) { // for browsers that don't support Object.defineProperty
        on[name] = value;
    }
}

defineProperty(Object, "values", function (obj) {
    return Object.keys(obj).map(function (key) {
        return obj[key];
    });
});

defineProperty(Object.prototype, "forEach", function (callback, thisArg) {
    var obj = this;
    if (obj instanceof jQuery) {
        return obj.each(function (i, e) {
            return callback.call(this, $(e), i, obj);
        });
    }

    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            callback.call(thisArg || obj[key], obj[key], key, obj);
        }
    }
});

defineProperty(Object.prototype, "filter", function (callback, thisArg) {
    var obj = this;
    var filtered = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (callback.call(thisArg || obj[key], obj[key], key, obj)) {
                filtered[key] = obj[key];
            }
        }
    }
    return filtered;
});

defineProperty(Object.prototype, "find", function (predicate, thisArg) {
    var obj = this;
    for (var key in obj) {
        if (obj.hasOwnProperty(key) &&
            predicate.call(thisArg || obj[key], obj[key], key, obj)) {
            return obj[key];
        }
    }
});

defineProperty(Array.prototype, 'shuffle', function shuffle() {
    var array = this;
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
});

defineProperty(Number.prototype, 'toOrdinalString', function () {
    var i = this,
        j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
});

defineProperty(Date.prototype, 'toLocalISOString', function () {
    var now = this,
        tzo = -now.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function (num) {
            var norm = Math.abs(Math.floor(num));
            return (norm < 10 ? '0' : '') + norm;
        };
    return now.getFullYear()
        + '-' + pad(now.getMonth() + 1)
        + '-' + pad(now.getDate())
        + 'T' + pad(now.getHours())
        + ':' + pad(now.getMinutes())
        + ':' + pad(now.getSeconds())
        + dif + pad(tzo / 60)
        + ':' + pad(tzo % 60);
});

// Avoid `console` errors in browsers that lack a console.
(function () {
    var method;
    var noop = function () { };
    var methods = [
        'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
        'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
        'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
        'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
    ];
    var length = methods.length;
    var console = (window.console = window.console || {});

    while (length--) {
        method = methods[length];

        // Only stub undefined methods.
        if (!console[method]) {
            console[method] = noop;
        }
    }
}());

// Polyfill String.startsWith for old Android browsers.
if (!String.prototype.startsWith) {
    Object.defineProperty(String.prototype, 'startsWith', {
        value: function (searchString, position) {
            position = position || 0;
            return this.substr(position, searchString.length) === searchString;
        },
        enumerable: false,
        configurable: false,
        writable: false
    });
}

if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value: function (predicate) {
            'use strict';
            if (this == null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return value;
                }
            }
            return undefined;
        },
        enumerable: false,
        configurable: false,
        writable: false
    });
}

if (!Array.prototype.findIndex) {
    Object.defineProperty(Array.prototype, 'findIndex', {
        value: function (predicate) {
            'use strict';
            if (this == null) {
                throw new TypeError('Array.prototype.findIndex called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return i;
                }
            }
            return -1;
        },
        enumerable: false,
        configurable: false,
        writable: false
    });
}

if (!Array.prototype.includes) {
    Object.defineProperty(Array.prototype, 'includes', {
        value: function (searchElement, fromIndex) {
            'use strict';
            if (this == null) {
                throw new TypeError('Array.prototype.includes called on null or undefined');
            }
            var o = Object(this);
            var len = o.length >>> 0;
            if (len === 0) {
                return false;
            }
            var n = fromIndex | 0;
            var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
            function sameValueZero(x, y) {
                return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
            }
            while (k < len) {
                if (sameValueZero(o[k], searchElement)) {
                    return true;
                }
                k++;
            }
            return false;
        },
        enumerable: false,
        configurable: false,
        writable: false
    });
}

if (!Array.prototype.map) {
    Object.defineProperty(Array.prototype, 'map', {
        value: function (callback) {
            var T, A, k;
            if (this == null) {
                throw new TypeError('Array.prototype.map called on null or undefined');
            }
            var O = Object(this);
            var len = O.length >>> 0;
            if (typeof callback !== 'function') {
                throw new TypeError(callback + ' is not a function');
            }
            if (arguments.length > 1) {
                T = arguments[1];
            }
            A = new Array(len);
            k = 0;
            while (k < len) {
                var kValue, mappedValue;
                if (k in O) {
                    kValue = O[k];
                    mappedValue = callback.call(T, kValue, k, O);
                    A[k] = mappedValue;
                }
                k++;
            }
            return A;
        },
        enumerable: false,
        configurable: false,
        writable: false
    });
}

if (!Number.parseInt) {
    Object.defineProperty(Number, 'parseInt', {
        value: parseInt,
        enumerable: false,
        configurable: false,
        writable: false
    });
}

if (!Number.parseFloat) {
    Object.defineProperty(Number, 'parseFloat', {
        value: parseFloat,
        enumerable: false,
        configurable: false,
        writable: false
    });
}

// Place any jQuery/helper plugins in here.
(function (jQuery) {
    var originalVal = jQuery.fn.val;
    jQuery.fn.val = function (value) {
        if (arguments.length > 0) {
            var result = originalVal.call(this, value);
            this.trigger("change");
            return result;
        } else {
            return originalVal.call(this);
        }
    };
})(jQuery);

(function (jQuery) {
    function stringify(obj, levels) {
        var t = typeof (obj);
        if (t != "object" || obj === null) {
            // simple data type
            if (t == "string") obj = '"' + obj.replace(/"/g, '\\\"') + '"';
            return String(obj);
        } else {
            // recurse array or object
            var n, v, json = [], arr = (obj && obj.constructor == Array);

            for (n in obj) {
                v = obj[n];
                t = typeof (v);
                if (obj.hasOwnProperty(n)) {
                    if (t == "string") {
                        v = '"' + v.replace(/"/g, '\\\"') + '"';
                    } else if (t == "object" && v !== null) {
                        v = levels === 0 ? String(v) : jQuery.stringify(v, levels - 1);
                    }
                    json.push((arr ? "" : '"' + n + '":') + String(v));
                }
            }

            return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
        }
    }

    function decycle(object, replacer) {
        "use strict";

        // Make a deep copy of an object or array, assuring that there is at most
        // one instance of each object or array in the resulting structure. The
        // duplicate references (which might be forming cycles) are replaced with
        // an object of the form

        //      {"$ref": PATH}

        // where the PATH is a JSONPath string that locates the first occurance.

        // So,
        //      var a = [];
        //      a[0] = a;
        //      return JSON.stringify(JSON.decycle(a));

        // produces the string '[{"$ref":"$"}]'.

        // If a replacer function is provided, then it will be called for each value.
        // A replacer function receives a value and returns a replacement value.

        // JSONPath is used to locate the unique object. $ indicates the top level of
        // the object or array. [NUMBER] or [STRING] indicates a child element or
        // property.

        var objects = [];   // Keep a reference to each unique object or array
        var paths = [];     // Keep the path to each unique object or array

        return (function derez(value, path) {

            // The derez function recurses through the object, producing the deep copy.

            var i;          // The loop counter
            var nu;         // The new object or array

            // If a replacer function was provided, then call it to get a replacement value.

            if (replacer !== undefined) {
                value = replacer(value);
            }

            // typeof null === "object", so go on if this value is really an object but not
            // one of the weird builtin objects.

            if (
                typeof value === "object" && value !== null &&
                !(value instanceof Boolean) &&
                !(value instanceof Date) &&
                !(value instanceof Number) &&
                !(value instanceof RegExp) &&
                !(value instanceof String)
            ) {

                // If the value is an object or array, look to see if we have already
                // encountered it. If so, return a {"$ref":PATH} object. This is a hard
                // linear search that will get slower as the number of unique objects grows.
                // Someday, this should be replaced with an ES6 WeakMap.

                i = objects.indexOf(value);
                if (i >= 0) {
                    return { $ref: paths[i] };
                }

                // Otherwise, accumulate the unique value and its path.

                objects.push(value);
                paths.push(path);

                // If it is an array, replicate the array.

                if (Array.isArray(value)) {
                    nu = [];
                    value.forEach(function (element, i) {
                        nu[i] = derez(element, path + "[" + i + "]");
                    });
                } else {

                    // If it is an object, replicate the object.

                    nu = {};
                    Object.keys(value).forEach(function (name) {
                        nu[name] = derez(
                            value[name],
                            path + "[" + JSON.stringify(name) + "]"
                        );
                    });
                }
                return nu;
            }
            return value;
        }(object, "$"));
    }

    jQuery.extend({
        stringify: function (obj, levels) {
            return stringify(decycle(obj, function (o) {
                if (typeof o == "function") {
                    return "function " + o.name + "(...)"
                } else if (o instanceof Node) {
                    return o.toString();
                } else {
                    return o;
                }
            }), levels);
        }
    });
})(jQuery);