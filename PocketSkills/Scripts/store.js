/// <reference path="azure.js" />

// This object manages the Media Store screen.
function Store(element, data) {
    'use strict';

    if (!this instanceof Store)
        return new Store(element, data);
    var _this = this;

    _this.$root = $('<div>').addClass('store').appendTo(element); // The root element in the HTML
    _this.data = data; // The user's data and responses to questions
    _this.library = new Content('MediaLibrary');

    $(_this.data).on('loaded change', _this.update);

    _this.$search = $('<input type="text">').addClass('search').attr('placeholder', "Search for Content").appendTo(_this.$root).on('change keyup', function () {
        _this.search = _this.$search.val().toLowerCase();
        _this.update();
    });

    _this.$filter = $('<div>').addClass('filter').appendTo(_this.$root);
    [['Store', 'purchasable'], ['Purchased', 'purchased']].forEach(function (choice) {
        var $label = $('<label class="selectable">').html(choice[0]).appendTo(_this.$filter);
        var $input = $('<input type="radio" name="storefilter">').val(choice[1]).prependTo($label);
        _this.$filter.on('change', function () {
            $label.toggleClass('selected', $input.is(':checked'));
        });
    });

    _this.$filter.on('change', function () {
        _this.filter = _this.$filter.find(':checked').val();
        _this.update();
    });

    _this.$list = $('<div>').addClass('list').appendTo(_this.$root);

    function ancestry(item) {
        var parent = _this.library.get(item.Parent);
        return parent ? ancestry(parent) + " " + (parent.Title || parent.ID) : "";
    }

    $(_this.library).on('loaded', function () {
        var i = 0;

        _this.library.forEach(function (item) {
            if (!item.ID) {
                log("WARNING: Skipping MediaLibrary item with no ID.");
                return;
            }

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

                if (item.StoreCost) {
                    var $cost = $('<div>').addClass('item-cost')
                        .append($('<div>').addClass('sparkle'))
                        .append($('<div>').addClass('points').text(item.StoreCost))
                        .appendTo($label);
                }
            }

            i++;
        });

        for (var j = 0; j < i; j++) {
            var $hack = $('<div>').addClass('spacer').appendTo(_this.$list);
        }

        _this.loaded = new Date();
        $(_this).triggerHandler('loaded');
        _this.update();
    });

    // Loads the list of store from the Content Worksheet via Azure.
    _this.load = function (sas) {
        return _this.library.load(sas);
    }

    $(_this.data).on('change', function () {
        _this.update();
    });

    var showingItem;

    _this.openItem = function (item) {
        if (showingItem != item) {
            if (showingItem) {
                _this.closeItem();
            }

            var type = normalize(String(item.Type));
            var content = item.File;

            if (!content) {
                alert("No file given for item '" + item.ID + "'");
                return false;
            }

            var $viewer = $('<div>').addClass('item-viewer').addClass(type).attr('id', item.ID).appendTo(_this.$root);

            if (item.Thumbnail) {
                var src = _this.data.evaluateText(item.Thumbnail);
                if (!src.startsWith('http')) {
                    src = window.server.mediaLocation + src;
                }
                $viewer.append($('<img>').addClass('item-thumbnail').attr('src', src));
            }

            if (item.Parent) {
                var $ancestry = $('<div>').addClass('item-ancestry').html(ancestry(item)).appendTo($viewer);
            }

            var $title = $('<div>').addClass('item-title').html(item.Title).appendTo($viewer);

            if (item.StoreCost) {
                var $cost = $('<div>').addClass('item-cost')
                    .append($('<div>').addClass('sparkle'))
                    .append($('<div>').addClass('points').text(item.StoreCost))
                    .appendTo($viewer);

                if (_this.data.get('Points') >= item.StoreCost && _this.data.get(item.ID) != 'Purchased') {
                    $('#mainFooter').addClass('showSparkles');
                } else {
                    $('#mainFooter').addClass('showDisabledSparkles');
                }
            }

            if (item.Type) {
                var $type = $('<div>').addClass('item-type').text(item.Type).appendTo($viewer);
            }

            if (item.Description) {
                var $description = $('<div>').addClass('item-description').html(item.Description).appendTo($viewer);
            }

            $(window).trigger('contextChanged', ['StoreItem', item, false]);

            _this.$list.hide();
            showingItem = item;
        }
        return showingItem;
    };

    _this.closeItem = function () {
        _this.$root.children('.item-viewer').remove();
        _this.$list.show();
        showingItem = null;
        $('#mainFooter').removeClass('showSparkles showDisabledSparkles');
        $(window).trigger('contextChanged', ['Store', null, false]);
    }

    $(element).on('sparkles', function () {
        if (showingItem) {
            if (!showingItem.StoreCost || _this.data.get(showingItem.ID) == 'Purchased') {
                alert("You already own this item.");
            } else if (_this.data.get('Points') >= showingItem.StoreCost) {
                window.score(-showingItem.StoreCost);
                _this.data.set(showingItem.ID, 'Purchased');
                _this.data.set(showingItem.ID + '_Purchased', Date());
                $('#mainFooter').removeClass('showSparkles');
                $('#mainFooter').addClass('showDisabledSparkles');
                alert("Purchase Successful");
            } else {
                alert("Sorry, you don't have enough to purchase this item yet.");
            }
        }
    });

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
        _this.$list.find('.item').hide();
        _this.$list.find('.item').each(function () {
            var $item = $(this);
            var item = _this.library.get(this.id);
            $item.toggleClass('disabled', item.AvailableCondition && !_this.data.evaluateExpression(item.AvailableCondition));

            var purchased = _this.data.get(this.id) == 'Purchased';
            $item.toggleClass('purchased', purchased);

            if (!_this.filter || $item.hasClass(_this.filter)) {
                if (!_this.search || ~item.Title.toLowerCase().indexOf(_this.search)) {
                    $item.show(); // Show this row
                    $item.find('.item').show(); // Show all the children
                    $item.parentsUntil(_this.$list).show(); // Show all the parents
                }
            }
        });
    }

    _this.$filter.find('input').first().attr('checked', true).change();
}
