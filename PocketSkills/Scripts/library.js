/// <reference path="jquery-3.1.1.js" />
/// <reference path="azure.js" />

// This object manages the Media Library screen.
function Library(element, data) {
    'use strict';

    if (!this instanceof Library)
        return new Library(element, data);
    var _this = this;

    _this.$root = $('<div>').addClass('library').appendTo(element); // The root element in the HTML
    _this.data = data; // The user's data and responses to questions
    _this.library = new Content('MediaLibrary');

    $(_this.data).on('loaded change', _this.update);

    _this.$search = $('<input type="text">').addClass('search').attr('placeholder', "Search for Content").appendTo(_this.$root).on('change keyup', function () {
        var search = $(this).val().toLowerCase();
        if (!search) {
            _this.$list.find('.item').show();
        } else {
            _this.$list.find('.item').hide();
            _this.$list.find('.item').each(function () {
                var item = _this.library.get(this.id);
                if (!search || ~item.Title.toLowerCase().indexOf(search)) {
                    $(this).show(); // Show this row
                    $(this).find('.item').show(); // Show all the children
                    $(this).parentsUntil(_this.$list).show(); // Show all the parents
                }
            });
        }
    });

    _this.$list = $('<div>').addClass('list').appendTo(_this.$root);

    $(_this.library).on('loaded', function () {
        function ancestry(item) {
            var parent = _this.library.get(item.Parent);
            return parent ? ancestry(parent) + " " + (parent.Title || parent.ID) : "";
        }

        _this.library.forEach(function (item) {
            // Create a new item in the list.
            var $item = $('<div>').addClass('item').attr('id', item.ID).addClass(item.Type).toggleClass('purchasable', !!item.StoreCost).appendTo(_this.$list).click(function () {
                if (item.Type) {
                    location.hash += '/' + this.id;
                }
            });

            if (item.Type) {
                var $content = $('<div>').addClass('item-content').appendTo($item);
                if (item.Thumbnail) {
                    var src = _this.data.evaluateText(item.Thumbnail);
                    if (!src.startsWith('http')) {
                        src = window.server.mediaLocation + src;
                    }
                    $content.append($('<div>').addClass('item-thumbnail').append($('<img>').attr('src', src)));
                }
                var $label = $('<div>').addClass('item-label').appendTo($content);
                if (item.Parent) {
                    var $ancestry = $('<div>').addClass('item-ancestry').html(ancestry(item)).appendTo($label);
                }
                var $title = $('<div>').addClass('item-title').html(item.Title || ("No description for " + item.ID + ")")).appendTo($label);
            }

            var $parent = _this.$list.find('#' + item.Parent);
            if (!$parent.length) {
                $parent = _this.$list;
            }
            $item.appendTo($parent);
        });
        _this.loaded = new Date();
        $(_this).triggerHandler('loaded');
        _this.update();
    });

    // Loads the list of library from the Content Worksheet via Azure.
    _this.load = function (sas) {
        return _this.library.load(sas);
    }

    $(_this.data).on('change', function () {
        _this.update();
    });

    var showingItem;

    _this.openItem = function (item) {
        function checkEnabled(item) {
            if (item.AvailableCondition && !_this.data.evaluateExpression(item.AvailableCondition)) {
                return false;
            }
            var parent = _this.library.get(item.Parent);
            return !parent || checkEnabled(parent);
        }

        function checkPurchased(item) {
            if (item.StoreCost && _this.data.get(item.ID) != 'Purchased') {
                return false;
            }
            var parent = _this.library.get(item.Parent);
            return !parent || checkEnabled(parent);
        }

        if (showingItem != item) {
            if (showingItem) {
                _this.closeItem();
            }

            if (!checkEnabled(item))
            {
                alert("Sorry, " + item.Title + " is not unlocked yet.");
                history.back();
                return;
            }

            if (!checkPurchased(item)) {
                location.replace(location.href.replace('Library', 'Store'));
                return;
            }

            var type = normalize(String(item.Type));
            var content = item.File;

            if (!content) {
                alert("No file given for item '" + item.ID + "'");
                return false;
            }

            var $viewer = $('<div>').addClass('item-viewer').addClass(type).attr('id', item.ID).appendTo(_this.$root);
            var $title = $('<h3>').addClass('item-title').html(item.Title).appendTo($viewer);

            $viewer.id = String(item.ID);

            switch (type) {
                case 'video':
                    var src = content;
                    if (!src.startsWith('http')) {
                        src = window.server.mediaLocation + src;
                    }

                    var $video = $('<video autoplay preload="auto" controls>').addClass('item-content').appendTo($viewer);

                    // Prevent mass numbers of events when seeking etc.
                    var throttleEvents = {};
                    $video.on('loadstart loadeddata canplay playing pause seeked stalled suspend ended abort error volumechange', function (ev) {
                        if (!throttleEvents[ev.type] || Date.now() - throttleEvents[ev.type] > 100) {
                            log("Video: " + $viewer.id + " (" + ev.target.currentSrc + "): " + ev.type + "@" + ev.target.currentTime + " (" + Math.round(ev.target.currentTime * 100 / ev.target.duration) + "%)");
                        }
                        throttleEvents[ev.type] = Date.now();
                    });

                    $video.on('error', function () {
                        $video.replaceWith(content);
                    });

                    var started = Date.now();

                    $video.on('ended', function (ev) {
                        log("Elapsed: " + $viewer.id + " ('" + content + "'): " + (Date.now() - started) + "ms");

                        _this.data.set($viewer.id, 'Watched');
                        _this.data.set($viewer.id + '_Watched', Date());
                    });

                    $video.attr('src', src);
                    break;

                case 'audio':
                    var src = content;
                    if (!src.startsWith('http')) {
                        src = window.server.mediaLocation + src;
                    }

                    var $audio = $('<audio autoplay preload="auto" controls>').addClass('item-content').appendTo($viewer);

                    // Prevent mass numbers of events when seeking etc.
                    var throttleEvents = {};
                    $audio.on('loadstart loadeddata canplay playing pause seeked stalled suspend ended abort error volumechange', function (ev) {
                        if (!throttleEvents[ev.type] || Date.now() - throttleEvents[ev.type] > 100) {
                            log("Audio: " + $viewer.id + " (" + ev.target.currentSrc + "): " + ev.type + "@" + ev.target.currentTime + " (" + Math.round(ev.target.currentTime * 100 / ev.target.duration) + "%)");
                        }
                        throttleEvents[ev.type] = Date.now();
                    });

                    $audio.on('error', function () {
                        $audio.replaceWith(content);
                    });

                    var started = Date.now();

                    $audio.on('ended', function (ev) {
                        log("Elapsed: " + $viewer.id + " ('" + content + "'): " + (Date.now() - started) + "ms");

                        _this.data.set($viewer.id, 'Listened');
                        _this.data.set($viewer.id + '_Listened', Date());
                    });

                    $audio.attr('src', src);

                    break;
            }

            _this.$list.hide();
            showingItem = item;
        }
        return showingItem;
    };

    _this.closeItem = function () {
        _this.$root.children('.item-viewer').remove();
        _this.$list.show();
        showingItem = null;
    }

    $(element).on('route', function (ev, path) {
        var id = path.match(/\/?(.*)/)[1];
        if (id) {
            if (_this.loaded) {
                var item = _this.library.get(id);
                if (item) {
                    _this.openItem(item);
                } else {
                    alert('Unknown item: ' + id);
                    location.hash = location.hash.split('/')[0];
                }
            } else {
                $(_this).one('loaded', route.bind(this, ev, path));
            }
        } else {
            _this.closeItem();
        }
    });

    _this.update = function () {
        _this.$list.find('.item').each(function () {
            if (this.id) {
                var item = _this.library.get(this.id);
                $(this).toggleClass('disabled', !!(item.AvailableCondition && !_this.data.evaluateExpression(item.AvailableCondition)));
                $(this).toggleClass('purchased', _this.data.get(item.ID) == 'Purchased');
            }
        });
    }
}
