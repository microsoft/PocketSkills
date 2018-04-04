/// <reference path="azure.js" />
/// <reference path="conversation.js" />

// Debug/configurable settings:
DiaryCards.showAllItems = false; // Whether to show all items even if their ShowConditions are false.

// This object manages the DiaryCards screen and the content inside the diary card based on the items in the content worksheet's 'DiaryCard' tab.
function DiaryCards(element, data) {
    'use strict';

    if (!this instanceof DiaryCards)
        return new DiaryCards(element, data);
    var _this = this;

    _this.$root = $('<div>').addClass('diarycards').appendTo(element); // The root element in the HTML
    _this.data = data; // The user's data and responses to questions
    _this.cards = {}; // Contains each card in the list.
    _this.content = new Content('DiaryCard'); // Contains the diary card items.

    // There is no search feature in the design yet.
    //_this.$search = $('<input type="text">').addClass('search').attr('placeholder', "Search for Cards").appendTo(_this.$root).on('change keyup', function () {
    //    var search = $(this).val().toLowerCase();
    //    _this.$cards.children().each(function () {
    //        var card = _this.cards[this.id];
    //        if (!search || ~(card.Title || "Untitled Diary Card").toLowerCase().indexOf(search)) {
    //            $(this).show();
    //        } else {
    //            $(this).hide();
    //        }
    //    });
    //});
    _this.$cards = $('<div>').addClass('cards').appendTo(_this.$root);

    $(_this.content).on('loaded', function () {
        _this.items = [];
        _this.content.forEach(function (row) {
            _this.items.push(row);
        });
        _this.cards.forEach(function (card) {
            updateCardView(card);
        });
        _this.loaded = new Date();
        $(_this).triggerHandler('loaded');
    });

    $(_this.data).on('change', function (ev, id) {
        if (_this.showingCard) {
            updateCardView(_this.showingCard);
        }
    });

    // Loads all previous cards into the list.
    _this.load = function (sas, contentSAS, user) {
        _this.table = azure.getTable(sas);
        _this.content.load(contentSAS);
        _this.user = user;

        return _this.table.query(function (rows, error, _, status) {
            if (rows) {
                // Now load the new data.
                rows.reverse().forEach(function (row) {
                    delete row.PartitionKey;
                    delete row.RowKey;
                    delete row.Timestamp;
                    _this.addCard(row);
                });
            } else {
                log("Error loading diary cards from azure storage:\n" + status + "\n" + (error || {}).responseText);
                throw error;
            }
        }).done(function () {
            _this.loaded = new Date();
            if (Data.logToConsole) {
                console.log("DiaryCards Loaded on " + _this.loaded);
            }
            $(_this).triggerHandler('loaded');
        });
    }

    // Adds a previously created card to the list.
    _this.addCard = function (card) {
        // Remove any previous item in the list for the card.
        _this.$cards.find('#' + card.ID + '.card').parent().remove();

        delete card.IsNew;

        if (!card.Deleted) {
            // Create a spacer at the bottom to make the flex wrapper keep all items the same size.
            var $spacer = $('<div>').addClass('spacer').appendTo(_this.$cards);

            // Create a new item in the list.
            var $container = $('<div>').addClass('card-container').insertBefore(_this.$cards.children('.spacer').first());

            var $card = generateCardView(card, 'thumbnail').appendTo($container).click(function () {
                if (!showingDeletes) {
                    location.hash += '/' + this.id;
                } else {
                    $selectorInput.prop('checked', !$selectorInput.prop('checked'));
                    $selectorInput.trigger('change');
                }
            });
            var $selector = $('<label>').addClass('card-selector').appendTo($card);
            var $selectorInput = $('<input type="checkbox">').appendTo($selector).change(function () {
                $card.toggleClass('selected', this.checked);
            });
            updateCardView(card);
        }

        _this.cards[card.ID] = card;

        return $card;
    }

    // Generates the elements for a card, in either 'full' (editor) size or thumbnail size.
    function generateCardView(card, size) {
        var $card = $('<div>').addClass('card').addClass(size || 'full').attr('id', card.ID);

        if (size == 'thumbnail') {
            var $bars = $('<div>').addClass('bars').appendTo($card);
            var $divider = $('<div>').addClass('divider').appendTo($card);
            var $date = $('<div>').addClass('date').appendTo($card);
        } else if (size == 'full') {
            var $items = $('<div>').addClass('items').appendTo($card);
            var $lastItem = null;
            var addedDate = false;
            _this.items.forEach(function (item) {
                var type = normalize(String(item.Type));
                var label = _this.data.evaluateText(item.Label);

                // Determine what's the next thing to show.
                switch (type) {
                    case 'header':
                        var $item = $('<div>').appendTo($items);
                        var $container = $('<div>').addClass('flex').appendTo($item);
                        var $header = $('<h4>').html(label).appendTo($container);
                        if (!addedDate) {
                            var $date = $('<div>').addClass('date').text(new Date().toDateString()).appendTo($container);
                            addedDate = true;
                        }
                        var $hr = $('<hr>').appendTo($item);
                        break;

                    case 'duration':
                        var $item = $('<div>').addClass('field').addClass('flex').appendTo($items);
                        var $field = $('<input type="hidden">').attr('name', item.ID).val(card[item.ID]).appendTo($item);
                        var $label = $('<label>').html(label).appendTo($item);
                        var $value = $('<div>').addClass('value').appendTo($item);

                        $field.on('change', function () {
                            var value = $field.val() || null;
                            if (card.values[item.ID] != value) {
                                card.values[item.ID] = value;
                                card.hasChanges = true;
                            }

                            value = Number.parseInt(value);
                            var hours = Math.floor(value / 60);
                            var minutes = value % 60;
                            if (Number.isNaN(hours) && Number.isNaN(minutes)) {
                                $value.text(null);
                            } else {
                                $value.text((hours > 0 ? (hours + " hours ") : "") + minutes + " minutes");
                            }
                        });

                        $field.trigger('change');

                        $item.on('selected', function () {
                            var value = Number.parseInt($field.val());
                            var hours = Math.floor(value / 60);
                            var minutes = value % 60;

                            var $flex = $('<div>').addClass('flex').appendTo(_this.$popup);
                            var $hours = $('<select>').addClass('value').attr('id', item.ID + 'Hours').appendTo($flex);
                            var $blank = $('<option disabled selected>').appendTo($hours);
                            for (var i = 0; i < 24; i++) {
                                var $option = $('<option>').attr('value', i).text(i).appendTo($hours);
                                if (i == hours) {
                                    $option.attr('selected', true);
                                }
                            }
                            $('<label>').attr('for', item.ID + 'Hours').text("hours").appendTo($flex);

                            var $minutes = $('<select>').addClass('value').attr('id', item.ID + 'Minutes').appendTo($flex);
                            var $blank = $('<option disabled selected>').appendTo($minutes);
                            for (var i = 0; i < 60; i++) {
                                var $option = $('<option>').attr('value', i).text(i).appendTo($minutes);
                                if (i == minutes) {
                                    $option.attr('selected', true);
                                }
                            }
                            $('<label>').attr('for', item.ID + 'Minutes').text("minutes").appendTo($flex);

                            $hours.add($minutes).on('change', function () {
                                var hours = Number.parseInt($hours.val());
                                var minutes = Number.parseInt($minutes.val());
                                if (Number.isNaN(hours) && Number.isNaN(minutes)) {
                                    $field.val(null);
                                } else {
                                    $field.val(+$hours.val() * 60 + +$minutes.val());
                                }
                            });
                        });
                        break;

                    case 'yesno':
                        var $item = $('<div>').addClass('field').addClass('flex').appendTo($items);
                        var $field = $('<input type="hidden">').attr('name', item.ID).val(card[item.ID]).appendTo($item);
                        var $label = $('<label>').html(label).appendTo($item);
                        var $value = $('<div>').addClass('value').appendTo($item);

                        $field.on('change', function () {
                            var value = $field.val() || null;
                            if (card.values[item.ID] != value) {
                                card.values[item.ID] = value;
                                card.hasChanges = true;
                            }

                            $value.text(value);
                        });

                        $field.trigger('change');

                        $item.on('selected', function () {
                            var $flex = $('<div>').addClass('flex').appendTo(_this.$popup);
                            ['Yes', 'No'].forEach(function (choice) {
                                var $input = $('<input type="radio">').attr('id', item.ID + choice).attr('name', item.ID).val(choice).attr('checked', $field.val() == choice).hide();
                                var $label = $('<label>').attr('for', item.ID + choice).html(choice);
                                $flex.append($input);
                                $flex.append($label);

                                $input.on('change', function (ev) {
                                    $field.val(choice);
                                });
                            });
                        });
                        break;

                    default:
                        var numericRegex = /(\d+)\s*(?:-|through)\s*(\d+)/; // For example 1-10 or 1 - 7.
                        var labeledRegex = /(\d+)\s*\(([^\)]+)\)/g; // For example 1 (Low) 2 (Med) 3 (High)
                        var choices = [];

                        var match = String(item.Type).match(numericRegex);
                        if (match) {
                            range(match[1], match[2]).forEach(function (val) {
                                choices.push({ val: val, label: val });
                            });
                        } else if (String(item.Type).match(labeledRegex)) {
                            while (match = labeledRegex.exec(item.Type)) {
                                choices.push({ val: match[1], label: match[2] });
                            }
                        }

                        if (choices.length) {
                            type = 'range';
                            var $container = ($lastItem != null && $lastItem.type == 'range') ? $lastItem.parent() : $('<div>').addClass('split').appendTo($items);
                            var $item = $('<div>').addClass('field').addClass('flex').appendTo($container);
                            var $field = $('<input type="hidden">').attr('name', item.ID).val(card[item.ID]).appendTo($item);
                            var $label = $('<label>').html(label).appendTo($item);
                            var $value = $('<div>').addClass('value').addClass('rangeValue').appendTo($item).wrap('<div>');

                            $field.on('change', function () {
                                var value = $field.val() || null;
                                if (card.values[item.ID] != value) {
                                    card.values[item.ID] = value;
                                    card.hasChanges = true;
                                }

                                var choice = choices.find(function (c) { return c.val == value; });
                                $value.html(choice ? choice.label : "&nbsp;");
                            });

                            $field.trigger('change');

                            $item.on('selected', function () {
                                var $slider = $('<div>').appendTo(_this.$popup);

                                // This control lets the user potentially scroll it left and right if it doesn't fit on the screen.
                                $slider.addClass('horizontalScroll');

                                choices.forEach(function (choice) {
                                    var $input = $('<input type="radio">').attr('id', item.ID + choice.val).attr('name', item.ID).val(choice.val).attr('checked', $field.val() == choice.val).hide();
                                    var $label = $('<label>').addClass('rangeValue').attr('for', item.ID + choice.val).html(choice.label);
                                    $slider.append($input);
                                    $slider.append($label);

                                    $input.on('change', function (ev) {
                                        $field.val(choice.val);
                                    });
                                });

                                // Don't make the slider jump around each time they go to a new field.
                                $slider.on('scroll', function () {
                                    _this.$popup.lastSliderScroll = $slider.scrollLeft();
                                })
                                $slider.scrollLeft(_this.$popup.lastSliderScroll != undefined ? _this.$popup.lastSliderScroll : ($slider[0].scrollWidth - $slider.width()) / 2); // Scroll to center of buttons.
                            });

                        } else {
                            var $item = $('<p>').html(label).appendTo($items);
                        }
                }

                $item.on('change', function () {
                    if (item.ContactCondition && _this.data.evaluateExpression(item.ContactCondition, card.values)) {
                        location.replace('/#Contact');
                    }
                });

                $item.attr('id', item.ID);
                $item.addClass(type);
                $item.type = type;
                $item.item = item;

                $lastItem = $item;
            });
        }

        $card.on('change', function () {
            updateCardView(card);
        });

        return $card;
    }

    // Updates the visual card with the latest data/content.
    function updateCardView(card) {
        // Look at values currently being edited if any.
        card = card.values || card;

        var $thumbnails = $('#' + card.ID + '.thumbnail');
        var $fulls = $('#' + card.ID + '.full');

        $thumbnails.find('.date').text(card.Modified);

        if (_this.items) {
            var $bars = $thumbnails.find('.bars');

            $bars.empty();

            _this.items.forEach(function (item) {
                if (item.ThumbnailColor) {
                    $('<div>').addClass('bar').append($('<div>').css('background-color', item.ThumbnailColor).css('height', card[item.ID] + '0%')).appendTo($bars);
                }

                var $item = $fulls.find('#' + item.ID);
                if ($item.length > 0) {
                    if (DiaryCards.showAllItems || !item.ShowCondition || _this.data.evaluateExpression(item.ShowCondition, card)) {
                        $item.show();
                        ['Good', 'Bad', 'Ok'].forEach(function (condition) {
                            if (item[condition + 'Condition']) {
                                $item.toggleClass(condition, _this.data.evaluateExpression(item[condition + 'Condition'], card));
                            }
                        });
                    } else {
                        $item.hide();
                    }
                }
            });
        }
    }

    // Creates a new card, with an optional initial title, and opens it.
    _this.createCard = function () {
        var time = new Date();
        var card = {
            ID: +time,
            Created: timeString(time),
            Modified: timeString(time),
            IsNew: true
        };

        _this.cards[card.ID] = card;
        location.hash += '/' + card.ID;
    }

    _this.openCard = function (card) {
        if (_this.showingCard != card) {
            if (_this.showingCard) {
                _this.closeCard();
            }

            card.values = Object.create(card); // Contains the current values being shown on the screen (but not saved to the actual card yet).

            // Generate the full editor.
            _this.$editor = $('<div>').addClass('card-editor').attr('id', card.ID + 'editor').appendTo(_this.$root);
            //var $title = $('<input type="text">').addClass('card-title').attr('placeholder', "Untitled Diary Card").val(card.Title).appendTo(_this.$editor);
            //var $date = $('<div>').addClass('card-date').text(card.Modified).appendTo(_this.$editor);
            var $card = generateCardView(card, 'full').appendTo(_this.$editor).on('click', function (e) {
                _this.selectItem($(e.target).closest('.field'));
            });

            _this.$cards.hide();
            $('#mainFooter').removeClass('showNew showDelete');
            $('#mainFooter').addClass('showSave');

            _this.showingCard = card;
            updateCardView(card);
        }

        $(window).trigger('contextChanged', ['DiaryCard', _this.showingCard.values]);
        return _this.showingCard;
    };

    _this.selectItem = function (item) {
        if (_this.$editor) {
            _this.$editor.find('.selected').removeClass('selected');
            var $card = _this.$editor.children('.card');

            if (item instanceof jQuery) {
                var $item = item;
                item = _this.items.find(function (i) { return i.ID == $item.attr('id'); });
            } else if (item) {
                var $item = _this.$editor.find('#' + item.ID);
            }

            if ($item && $item.length) {
                log("Selected diary card item '" + item.ID + "' ('" + item.Label + "')");

                if (!_this.$popup) {
                    // This is the popup when selecting/editing a value.
                    _this.$popup = $('<div>').addClass('popup').hide().appendTo(_this.$editor);
                    _this.$popup.slideDown({ // Actually slides up since we're flexed to the bottom.
                        step: function (now, tween) {
                            if (tween.prop == 'height' && tween.pos > 0) {
                                var overlap = ($item.offset().top + $item.height() + peek) - $(this).offset().top;
                                if (overlap > 0) {
                                    // Push the item up to keep it in view...
                                    var scrollTop = $card.scrollTop() + Math.min(overlap, $item.position().top);
                                    $card.scrollTop(scrollTop);
                                }
                            }
                        }
                    });

                    $('#mainFooter').addClass('showLav');
                } else {
                    _this.$popup.empty();
                }

                var label = _this.data.evaluateText(item.Label);
                var description = _this.data.evaluateText(item.Description);

                var $header = $('<label>').addClass('header').html(label).appendTo(_this.$popup);
                var $description = $('<p>').addClass('description').html(description).appendTo(_this.$popup);
                $('#navLabel').html(label);

                $item.addClass('selected');
                $item.triggerHandler('selected');

                var peek = 20;
                var underlap = -($item.position().top - peek);
                var overlap = ($item.offset().top + $item.height() + peek) - (_this.$popup.offset().top || Infinity);
                if (underlap > 0) {
                    // Scroll the item down into view...
                    $card.animate({
                        scrollTop: $card.scrollTop() - underlap
                    }, _this.autoScrollDuration);
                } else if (overlap > 0) {
                    // Scroll the item up into view...
                    $card.animate({
                        scrollTop: $card.scrollTop() + overlap
                    }, _this.autoScrollDuration);
                }

                if (!history.state) {
                    history.pushState(item.ID, null, null);
                } else {
                    history.replaceState(item.ID, null, null);
                }

                $(window).trigger('contextChanged', ['DiaryCard' + item.ID, _this.showingCard.values]);
            } else if (_this.$popup) {
                log("Deselecting diary card items.");

                _this.$popup.slideUp(_this.$popup.remove.bind(_this.$popup)); // Actually slides down since we're flexed to the bottom.
                _this.$popup = null;
                $('#mainFooter').removeClass('showLav');

                $(window).trigger('contextChanged', ['DiaryCard', _this.showingCard.values]);
            }

            return $item;
        }
    }

    _this.closeCard = function () {
        _this.$cards.show();

        if (_this.$editor) {
            _this.$editor.remove();
            _this.$editor = null;
        }

        if (_this.$popup) {
            _this.$popup.remove();
            _this.$popup = null;
        }

        if (_this.showingCard) {
            delete _this.showingCard.hasChanges;
            delete _this.showingCard.values;
            updateCardView(_this.showingCard);
            _this.showingCard = null;
        }

        $('#mainFooter').removeClass('showSave');
        $('#mainFooter').addClass('showDelete');
        if (!showingDeletes) {
            $('#mainFooter').addClass('showNew');
        }

        $(window).trigger('contextChanged', 'DiaryCards');
    }

    $(element).on('showing', function () {
        if (!_this.showingCard) {
            $('#mainFooter').addClass('showDelete');
            if (!showingDeletes) {
                $('#mainFooter').addClass('showNew');
            }
        } else {
            $('#mainFooter').addClass('showSave');
        }
    });

    var showingDeletes = false;

    function showDeletes() {
        if (!showingDeletes) {
            _this.$cards.addClass('showDelete');
            $('#mainFooter').removeClass('showNew');
            showingDeletes = true;
        }
    }

    function hideDeletes() {
        if (showingDeletes) {
            _this.$cards.find('.card-selector input').prop('checked', false); // Uncheck all the boxes.
            _this.$cards.find('.card-selector input').change(); // Let event handlers see that the boxes have been unchecked.
            _this.$cards.removeClass('showDelete'); // Hide the selectors
            $('#mainFooter').addClass('showNew'); // Put the New button back.
            showingDeletes = false;
        }
    }

    function deleteSelected() {
        _this.$cards.find('.card.selected').each(function () {
            var $card = $(this);
            var card = _this.cards[this.id];
            card.Deleted = timeString();
            azure.writeData(_this.table, _this.user, card, function done(result, status, response, error) {
                if (error != undefined) {
                    if (confirm("Unable to delete Diary Card " + card.ID + ": " + status + " " + error + ". \nPress OK to retry, or Cancel to ignore.")) {
                        azure.writeData(_this.table, _this.user, card, done);
                    }
                } else {
                    $card.parent().remove();
                }
            });
        });
    }

    $(element).on('delete', function () {
        if (!showingDeletes) {
            showDeletes();
            history.pushState('delete', null, null);
        } else {
            deleteSelected();
            history.back(); // This will remove the UI.
        }
    });

    $(element).on('new', function () {
        _this.createCard();
    });

    $(element).on('save', function () {
        var card = _this.showingCard;
        if (card && card.hasChanges) {
            card.Modified = timeString();
            $.extend(card, card.values);
            delete card.values;
            delete card.hasChanges;
            azure.writeData(_this.table, _this.user, card, function done(result, status, response, error) {
                if (error != undefined) {
                    if (confirm("Unable to save Diary Card: " + status + " " + error + ". \nPress OK to retry, or Cancel to ignore.")) {
                        azure.writeData(_this.table, _this.user, card, done);
                    } else {
                        history.back();
                    }
                } else {
                    if (card.IsNew) {
                        data.set('DiaryCard', card.ID);
                        if (settings['DiaryCardSavePoints'] > 0) {
                            score(settings['DiaryCardSavePoints'], 'DiaryCard');
                        }
                    }
                    _this.addCard(card);
                    history.back();
                }
            });
        } else {
            history.back();
        }
    });

    $(element).on('route', function (ev, path) {
        var parts = path.match(/\/?([^\/]*)/);
        var card = parts[1];
        var item = parts[2];
        if (card && card != 'delete') {
            if (_this.loaded) {
                if (_this.cards[card]) {
                    _this.openCard(_this.cards[card]);
                    if (_this.$editor) {
                        _this.selectItem(_this.$editor.find(function (i) { return i.ID == item; }));
                    }
                } else {
                    alert('Unknown diary card: ' + card);
                    location.hash = location.hash.split('/')[0];
                }
            } else {
                $(_this).one('loaded', route.bind(this, ev, path));
            }
        } else {
            _this.closeCard();
            if (card == 'delete') {
                showDeletes();
            } else {
                hideDeletes();
            }
        }
    });

    $('#navLeft').on('click', function () {
        if (_this.$editor) {
            var $fields = _this.$editor.find('.field:visible');
            _this.selectItem($fields.eq(($fields.index(_this.$editor.find('.selected')) - 1) % $fields.length));
        }
    });

    $('#navRight').on('click', function () {
        if (_this.$editor) {
            var $fields = _this.$editor.find('.field:visible');
            _this.selectItem($fields.eq(($fields.index(_this.$editor.find('.selected')) + 1) % $fields.length));
        }
    });

    $('#navDone').on('click', function () {
        history.back();
    });

    function timeString(time) {
        time = time || new Date();
        return time.toLocaleDateString() + " " + time.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric' });
    }
}
