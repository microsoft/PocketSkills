/// <reference path="azure.js" />

// Debug/configurable settings:
Conversation.superSpeed = false; // Whether to have instant typing.

function Conversation(element, data, module) {
    'use strict';

    if (!this instanceof Conversation)
        return new Conversation(element, data);
    var _this = this;

    _this.$root = $('<div>').addClass('conversation').appendTo(element); // The root element in the HTML
    _this.$root.parent().addClass('scrollabley');
    _this.data = data;
    _this.content = new Content(module);

    _this.lines = []; // Contains each ordered line of the conversation.
    _this.lineIndex = -1; // The last line that's been displayed.
    _this.loaded = null; // Keeps track of whether we have loaded data or not.

    $(_this.content).on('loaded', function () {
        _this.lines = [];
        _this.content.forEach(function (line) {
            _this.lines.push(line);
        });
        _this.lineIndex = -1;
        _this.loaded = new Date();
        $(_this).triggerHandler('loaded');
        _this.update();
    });

    _this.agentTypingDuration = Conversation.superSpeed ? 1 : 2000; // Show the typing bubble for the agent for at least this long to make it seem like a real person typing. (2000 is good)
    _this.switchSidesDelay = Conversation.superSpeed ? 1 : 1000; // The amount of time to wait between switching to the user's possible response bubbles. (1000 is good)
    _this.betweenBubbleDelay = Conversation.superSpeed ? 1 : 1000; // The minimum amount of time to wait before showing a new bubble. (1000 is good)
    _this.autoScrollDuration = Conversation.superSpeed ? 1 : 100; // The duration of the animation when scrolling new bubbles into view. (100 is good)

    function applySettings() {
        settings.forEach(function (value, setting) {
            if (!Conversation.superSpeed) {
                switch (setting) {
                    case 'AgentTypingDuration': _this.agentTypingDuration = +value; break;
                    case 'SwitchSidesDelay': _this.switchSidesDelay = +value; break;
                    case 'BetweenBubbleDelay': _this.betweenBubbleDelay = +value; break;
                    case 'AutoScrollDuration': _this.autoScrollDuration = +value; break;
                }
            }
        });
    }
    applySettings();
    $(window.settings).on('change', applySettings);

    _this.$lastBubble = null; // Store the last bubble shown.
    _this.$typingBubble = null; // Store a reference to the typing bubble.

    // Asynchronously loads content for this conversation from azure table storage.
    _this.load = function (sas) {
        _this.content.load(sas);
    }

    // Resets the conversation script so that next time it runs it will start from the top.
    _this.reset = function () {
        _this.clear();
        _this.lineIndex = -1;
    }

    // Starts the conversation script from the top.
    _this.restart = function () {
        _this.reset();
        _this.start();
    }

    // Starts the conversation script where it left off.
    _this.start = function () {
        _this.started = true;
        _this.update();
    }

    // Stops/pauses the conversation script.
    _this.stop = function () {
        _this.started = false;
        _this.update();
    }

    // Shows a typing bubble.
    _this.showTypingBubble = function (speaker) {
        if (!_this.$typingBubble && $(_this).triggerHandler('typing', speaker) !== false) {
            var $bubble = $('<label>');
            $bubble.addClass('bubble');

            $bubble.text("...");
            $bubble.isPrompt = false;
            $bubble.addClass('typing');
            $bubble.addClass(speaker);
            $bubble.speaker = speaker;
            if (!_this.$lastBubble || speaker != _this.$lastBubble.speaker) {
                $bubble.addClass('pic');
            }

            _this.$root.append($bubble);
            _this.scrollDown();
            $bubble.shown = Date.now();

            _this.$typingBubble = $bubble;
        }
        return _this.$typingBubble;
    }

    // Removes the typing bubble if it exists.
    _this.removeTypingBubble = function () {
        if (_this.$typingBubble) {
            _this.$typingBubble.remove();
            delete _this.$typingBubble;
        }
    }

    // Shows a line of the script.  Any animations are controlled by styles elsewhere.
    _this.showLineBubble = function (line, speaker) {
        // Notify event handlers that we are about to show a line.
        $(_this).triggerHandler('line', line)

        // First see if we need to replace the typing bubble or create a new one.
        var $bubble;
        if (_this.$typingBubble) {
            if (_this.$typingBubble.hasClass(speaker)) {
                // The bubble is currently being shown for this speaker, so just replace it inline.
                $bubble = _this.$typingBubble;
                $bubble.removeClass('typing');
            } else {
                // The bubble is being shown for the other speaker, so remove it.
                _this.removeTypingBubble();
            }
            delete _this.$typingBubble; // There will no longer be a typing bubble now since we are showing a real line.
        }

        if (!$bubble) {
            $bubble = $('<label>');
            $bubble.addClass('bubble');
            _this.$root.append($bubble);
        }

        // Replace variables and expressions in the line's content.
        var content = _this.data.evaluateText(line.Content);
        if (content != line.Content) {
            log("Evaluated: " + line.ID + " ('" + line.Content + "'): '" + content + "'");
            _this.data.set(line.ID + '_Eval', content);
        }

        // Keep track of the speaker and ID and group internally.
        $bubble.speaker = speaker;
        $bubble.id = String(line.ID);
        $bubble.type = normalize(String(line.Type));

        if (!_this.$lastBubble) {
            $bubble.group = $bubble.id;
        } else if ($bubble.speaker == _this.$lastBubble.speaker) {
            $bubble.group = _this.$lastBubble.group;
        } else { // The speakers changed.  User bubbles set the Group to the agent's last bubble ID to make the spreadsheet and data values easier to follow.
            $bubble.group = ($bubble.speaker == 'user' ? _this.$lastBubble.id : $bubble.id);
        }

        // Add classes for the speaker and group.  (We aren't adding a class for the ID since it would conflict with the classes for the groups).
        $bubble.addClass($bubble.speaker);
        $bubble.addClass($bubble.group);
        if ($bubble.type && $bubble.type !== 'undefined') {
            $bubble.addClass($bubble.type);
        }

        // Also add a custom group attribute to the bubble (for the submit functionality).
        $bubble.attr('group', $bubble.group);

        switch ($bubble.type) {
            case 'textbox':
            case 'opentext':
                // This bubble allows the user to tap on it to enter free text.
                $bubble.isPrompt = true;
                $bubble.addClass('prompt');
                $bubble.addClass('pic');
                $bubble.addClass('right');

                var $span = $('<span>');
                $span.attr('contenteditable', true);
                $span.html(content);
                $span.addClass('placeholder');
                $bubble.addClass('selectable');

                $bubble.append($span);

                $bubble.on('click', function () {
                    if ($span.hasClass('placeholder')) {
                        $span.html('&nbsp;');
                        $span.removeClass('placeholder');
                        $bubble.addClass('selected');
                    }
                });
                $span.on('keydown', function (ev) {
                    if (ev.which == 13) {
                        ev.preventDefault();
                        $span.blur();
                    } else if ($span.hasClass('placeholder')) {
                        $span.html('');
                        $span.removeClass('placeholder');
                        $bubble.addClass('selected');
                    }
                });
                $span.on('blur', function (ev) {
                    window.getSelection().removeAllRanges(); // Workaround for webkit bug where content is still editable but no more keydowns fire on Enter.
                    if (!$span.hasClass('placeholder')) {
                        log("Entered: " + $bubble.id + " ('" + content + "'): '" + $span.text() + "'.");

                        if ($.trim($span.text())) {
                            // Save the response.
                            _this.data.set($bubble.id, $.trim($span.text()));

                            // Set the bubble to submitted.
                            $span.attr('contenteditable', false);
                            $bubble.addClass('submitted');
                            $bubble.submitted = true;

                            _this.awardPoints(line);

                            _this.update();
                        } else {
                            $span.html(content);
                            $span.addClass('placeholder');
                            $bubble.removeClass('selected');
                        }
                    }
                });

                $span.focus(); // This doesn't work on mobiles but it does on desktops.

                break;

            case 'singleselect':
            case 'multiselect':
                // This bubble allows the user to tap on it to select it (like a checkbox).
                $bubble.addClass('selectable');

                $bubble.attr('for', $bubble.id);
                var $input = $('<input>').attr('type', $bubble.type == 'singleselect' ? 'radio' : 'checkbox').attr('id', $bubble.id).attr('name', $bubble.group).val($bubble.id).hide();

                $bubble.html(content);
                $bubble.prepend($input);

                // Make all bubbles in the same group the same width.
                /* Not needed if we're just aligning to the left of the agent's bubbles in the stylesheet.
                var widest = 0;
                $('.' + $bubble.group).each(function () {
                    widest = Math.max(widest, $(this).width());
                }).width(widest);
                */

                var pointsAwarded = false;

                $bubble.on('change', function (ev) {
                    log(($input.is(':checked') ? 'Selected' : 'Deselected') + ": " + $bubble.id + " ('" + content + "')");

                    _this.data.set($bubble.id, $input.is(':checked') ? 'Selected' : null);
                    $bubble.toggleClass('selected', $input.is(':checked'));

                    // For single selects (radio buttons) we need to manually reset the unchecked ones since the change event doesn't fire for those.
                    _this.$root.find('.selected > input[name="' + $bubble.group + '"]:not(:checked)').forEach(function () {
                        var id = $(this).attr('id');
                        _this.data.set(id, null);
                        $(this).parent().removeClass('selected');
                    });

                    // Set the combined value of the parent group ID.
                    _this.data.set($bubble.group, _this.$root.find('input[name="' + $bubble.group + '"]:checked').map(function () {
                        return $(this).val();
                    }).get().join());

                    // TODO: Don't award the points until after the bubble has been submitted.
                    if (!pointsAwarded) {
                        _this.awardPoints(line);
                        pointsAwarded = true;
                    }
                });

                break;

            case 'skillselect':
                // This bubble allows the user to tap on it to go to a skill.
                $bubble.addClass('selectable');

                $bubble.attr('for', $bubble.id);
                var $input = $('<input type="radio">').attr('id', $bubble.id).attr('name', $bubble.group).val($bubble.id).hide();

                if (line.Icon) {
                    var src = _this.data.evaluateText(line.Icon);
                    if (!src.startsWith('http')) {
                        src = window.server.mediaLocation + src;
                    }
                    $bubble.append($('<img>').attr('src', src));
                }

                $bubble.append($('<h4>').html(content));
                $bubble.append($('<div>').append(
                    $('<span class="points">').text(_this.data.evaluateExpression(line.Points)),
                    $('<span class="pointIcon">')
                ));
                $bubble.append($('<clearfix>'));
                $bubble.prepend($input);

                // Make all bubbles in the same group the same width.
                /* Not needed if we're just aligning to the left of the agent's bubbles in the stylesheet.
                var widest = 0;
                $('.' + $bubble.group).each(function () {
                    widest = Math.max(widest, $(this).width());
                }).width(widest);
                */

                $bubble.on('change', function (ev) {
                    var target = _this.data.evaluateText(line.Target);
                    log(($input.is(':checked') ? 'Selected' : 'Deselected') + ": " + $bubble.id + " ('" + content + "'): " + target);

                    _this.data.set($bubble.id, $input.is(':checked') ? 'Selected' : 'Deselected');
                    _this.data.set($bubble.group, _this.$root.find('input[name="' + $bubble.group + '"]:checked').map(function () {
                        return $(this).val();
                    }).get().join());
                    $bubble.toggleClass('selected', $input.is(':checked'));

                    // Immediately go to the target.
                    $bubble.addClass('submitted');
                    $bubble.siblings('[group="' + $bubble.group + '"]').addClass('submitted');

                    // Note that we don't actually award the points associated with the Skill Select line, since those are just the *possible* points.
                    // The actual points will be awareded by the line(s) after the skill is completed.
                    _this.goto(target);
                });

                break;

            case 'slider':
                $bubble.addClass('selectable');

                var $input = $('<input type="range">').attr('id', $bubble.id).attr('name', $bubble.group).attr('min', 0).attr('max', 100).val(50).appendTo($bubble);
                var $labels = $('<div>').addClass('sliderLabels').appendTo($bubble);

                var choices = content.split('/');
                choices.forEach(function (choice) {
                    $('<div>').html(choice).appendTo($labels);
                });

                var pointsAwarded = false;

                $input.on('change', function (ev) {
                    log("Moved Slider: " + $bubble.id + " ('" + content + "'): " + $input.val());

                    _this.data.set($bubble.id, $input.val());

                    if (!pointsAwarded) {
                        _this.awardPoints(line);
                        pointsAwarded = true;
                    }
                    _this.update();
                });

                break;

            case 'calendar':
                $bubble.addClass('right');
                $bubble.addClass('pic');
                $bubble.addClass('selectable');

                $bubble.isPrompt = true;
                $bubble.addClass('prompt');

                var $input = $('<div type="date">').attr('id', $bubble.id).attr('name', $bubble.group).datepicker().appendTo($bubble);

                $input.on('change', function (ev) {
                    if (!$bubble.submitted) { // This handler actually gets called twice - once from the jqueryui datepicker and one from our .val() plugin.
                        log("Picked Date: " + $bubble.id + " ('" + content + "'): " + $input.val());

                        _this.data.set($bubble.id, $input.val());
                        azure.getTable(window.server.SAS_calendar).add({
                            PartitionKey: window.server.userID,
                            ID: $bubble.id,
                            Date: $input.val(),
                            Content: content
                        });

                        $bubble.addClass('submitted');
                        $bubble.submitted = true;

                        _this.awardPoints(line);

                        _this.update();
                    }
                });

                break;

            case 'likertscale':
                // This isn't actually a bubble - it's a horizontal scrolling set of buttons.
                $bubble.removeClass('bubble');

                $bubble.isPrompt = true;
                $bubble.addClass('prompt');

                // This control lets the user potentially scroll it left and right if it doesn't fit on the screen.
                $bubble.addClass('horizontalScroll');

                var numericRegex = /(\d+)\s*(?:-|through)\s*(\d+)/; // For example 1-10 or 1 - 7.
                var labeledRegex = /(\d+)\s*\(([^\)]+)\)/g; // For example 1 (Low) 2 (Med) 3 (High)
                var choices = [];

                var match = content.match(numericRegex);
                if (match) {
                    range(match[1], match[2]).forEach(function (val) {
                        choices.push({ val: val, label: val });
                    });
                } else if (content.match(labeledRegex)) {
                    while (match = labeledRegex.exec(content)) {
                        choices.push({ val: match[1], label: match[2] });
                    }
                }

                choices.forEach(function (choice) {
                    var $input = $('<input type="radio">').attr('id', $bubble.id + choice.val).attr('name', $bubble.group).val(choice.val).hide();
                    var $label = $('<label class="selectable">').attr('for', $bubble.id + choice.val).html(choice.label);
                    $bubble.append($input);
                    $bubble.append($label);

                    $input.on('change', function (ev) {
                        log(($input.is(':checked') ? 'Selected' : 'Deselected') + ": " + $bubble.id + " ('" + content + "'): '" + choice.val + "' ('" + choice.label + "')");

                        if ($input.is(':checked')) {
                            $bubble.children().removeClass('selected');
                            $label.addClass('selected');

                            _this.data.set($bubble.id, choice.val);

                            $bubble.addClass('submitted');
                            $bubble.submitted = true;

                            _this.awardPoints(line);
                        }
                        _this.update();
                    });
                });

                $bubble.scrollLeft(($bubble[0].scrollWidth - $bubble.width()) / 2); // Scroll to center of buttons.

                break;

            case 'radiobutton':
                // This isn't actually a bubble - it's a set of buttons that look like individual bubbles.
                $bubble.removeClass('bubble');
                $bubble.addClass('pic');

                $bubble.isPrompt = true;
                $bubble.addClass('prompt');

                var choices = content.split('/');

                choices.forEach(function (choice) {
                    var $input = $('<input type="radio">').attr('id', $bubble.id + choice).attr('name', $bubble.group).val(choice).hide();
                    var $label = $('<label class="user pic bubble selectable">').attr('for', $bubble.id + choice).html(choice);
                    $bubble.append($input);
                    $bubble.append($label);

                    $input.on('change', function (ev) {
                        log(($input.is(':checked') ? 'Selected' : 'Deselected') + ": " + $bubble.id + " ('" + content + "'): '" + choice + "'");

                        if ($input.is(':checked')) {
                            $bubble.children().removeClass('selected');
                            $label.addClass('selected');

                            _this.data.set($bubble.id, choice);

                            $bubble.addClass('submitted');
                            $bubble.submitted = true;

                            _this.awardPoints(line);
                        }
                        _this.update();
                    });
                });

                break;

            case 'audio':
                // This bubble requires the user to listen to an audio clip to go to the next step.
                $bubble.isPrompt = true;
                $bubble.addClass('prompt');

                var src = content;
                if (!src.startsWith('http')) {
                    src = window.server.mediaLocation + src;
                }

                var $audio = $('<audio preload="auto" controls>').appendTo($bubble);

                // Prevent mass numbers of events when seeking etc.
                var throttleEvents = {};
                $audio.on('loadstart loadeddata canplay playing pause seeked stalled suspend ended abort error volumechange', function (ev) {
                    if (!throttleEvents[ev.type] || Date.now() - throttleEvents[ev.type] > 100) {
                        log("Audio: " + $bubble.id + " (" + ev.target.currentSrc + "): " + ev.type + "@" + ev.target.currentTime + " (" + Math.round(ev.target.currentTime * 100 / ev.target.duration) + "%)");
                    }
                    throttleEvents[ev.type] = Date.now();
                });

                $audio.on('error', function () {
                    $audio.replaceWith(content);
                    _this.scrollDown();
                });

                var pointsAwarded = false;

                var started = Date.now();

                $audio.on('ended', function (ev) {
                    log("Elapsed: " + $bubble.id + " ('" + content + "'): " + (Date.now() - started) + "ms");

                    $bubble.submitted = true;

                    _this.data.set($bubble.id, 'Listened');
                    _this.data.set($bubble.id + '_Listened', Date());

                    if (!pointsAwarded) {
                        _this.awardPoints(line);
                        pointsAwarded = true;
                    }

                    _this.update();
                });

                $audio.attr('src', src);

                break;

            case 'video':
                // This bubble requires the user to watch a video to go to the next step.
                $bubble.isPrompt = true;
                $bubble.addClass('prompt');

                var src = content;
                if (!src.startsWith('http')) {
                    src = window.server.mediaLocation + src;
                }

                var $video = $('<video preload="auto" controls>').appendTo($bubble);

                // Prevent mass numbers of events when seeking etc.
                var throttleEvents = {};
                $video.on('loadstart loadeddata canplay playing pause seeked stalled suspend ended abort error volumechange', function (ev) {
                    if (!throttleEvents[ev.type] || Date.now() - throttleEvents[ev.type] > 100) {
                        log("Video: " + $bubble.id + " (" + ev.target.currentSrc + "): " + ev.type + "@" + ev.target.currentTime + " (" + Math.round(ev.target.currentTime * 100 / ev.target.duration) + "%)");
                    }
                    throttleEvents[ev.type] = Date.now();
                });

                $video.on('error', function () {
                    $video.replaceWith(content);
                    _this.scrollDown();
                });

                var pointsAwarded = false;

                var started = Date.now();

                $video.on('ended', function (ev) {
                    log("Elapsed: " + $bubble.id + " ('" + content + "'): " + (Date.now() - started) + "ms");

                    $bubble.submitted = true;

                    _this.data.set($bubble.id, 'Watched');
                    _this.data.set($bubble.id + '_Watched', Date());

                    if (!pointsAwarded) {
                        _this.awardPoints(line);
                        pointsAwarded = true;
                    }

                    _this.update();
                });

                $video.attr('src', src);

                // Allow them to keep going immediately if they've watched it before.
                if (_this.data.get($bubble.id + '_Watched')) {
                    $bubble.submitted = true;
                }
                break;

            case 'image':
                // This is simply an image in a bubble.
                var src = content;
                if (!src.startsWith('http')) {
                    src = window.server.mediaLocation + src;
                }

                log("Image: " + $bubble.id + " (" + src + ")");

                var $img = $('<img>').appendTo($bubble);

                $img.on('load', function () {
                    _this.scrollDown();
                })

                $img.on('error', function () {
                    log("Replacing: " + $bubble.id + " (" + src + "): '" + content + "'");

                    $img.replaceWith(content);
                    _this.scrollDown();
                });

                $img.attr('src', src);

                var started = Date.now();

                if (line.Duration) {
                    $bubble.isPrompt = true;

                    setTimeout(function () {
                        log("Elapsed: " + $bubble.id + " ('" + content + "'): " + (Date.now() - started) + "ms");

                        $bubble.submitted = true;

                        _this.data.set($bubble.id, 'Seen');

                        _this.awardPoints(line);

                        _this.update();
                    }, Conversation.superSpeed ? 1000 : +_this.data.evaluateExpression(line.Duration) * 1000);
                } else {
                    _this.data.set($bubble.id, 'Shown');
                    _this.awardPoints(line);
                }
                break;

            case 'fullscreen':
                // This is full-screen content without a bubble.
                $bubble.isPrompt = true;
                $bubble.remove();

                var $overlay = $('#mainOverlay').show(); // .addClass('show');
                // HACK: For some reason the slow opacity transition won't take effect if calling addClass('show') immediately after the .show().  Maybe because of the display: none?
                setTimeout(function () {
                    $overlay.addClass('show');
                });

                // We start off assuming it's an image if it has an extension.  If it's text or HTML then it will be replaced in the error callback when the image fails to resolve.
                if (/\....$/.test(content)) {
                    var src = content;
                    if (!src.startsWith('http')) {
                        src = window.server.mediaLocation + src;
                    }

                    log("Fullscreen: " + $bubble.id + " (" + src + ")");

                    var $content = $('<img width="100%">').appendTo($overlay).show().addClass('show');

                    $content.on('error', function () {
                        log("Replacing: " + $bubble.id + " (" + src + "): '" + content + "'");

                        $content.remove();
                        $content = $('<h1>').html(content).appendTo($overlay).show().addClass('show');
                    });

                    $content.attr('src', src);
                } else {
                    // Just text content (or a blank screen if the content is empty.
                    log("Fullscreen: " + $bubble.id + (content ? " ('" + content + "')" : ""));

                    $content = $('<h1>').html(content).appendTo($overlay).show().addClass('show');
                }

                var started = Date.now();

                var dismiss = function () {
                    log("Elapsed: " + $bubble.id + (content ? " ('" + content + "'): " : ": ") + (Date.now() - started) + "ms");

                    $overlay.removeClass('show');
                    $content.removeClass('show');

                    _this.data.set($bubble.id, 'Seen');
                    $bubble.submitted = true;

                    _this.awardPoints(line);

                    _this.update();

                    setTimeout(function () {
                        $content.remove();
                        // HACK: Need to manually show and hide the overlay because it interferes with scrolling on old Android browsers even if pointer-events: none.
                        if ($overlay.children().length <= 1) {
                            $overlay.hide();
                        }
                    }, 5000); // This should be sometime after the opacity transition duration in the CSS so that we don't remove it until it's disappeared.

                    $('#mainOverlay').off('click', dismiss);
                }

                if (line.Duration) {
                    setTimeout(dismiss, Conversation.superSpeed ? 1000 : +_this.data.evaluateExpression(line.Duration) * 1000);
                } else {
                    $('#mainOverlay').on('click', dismiss);
                }

                break;

            case 'continue':
            case 'submit':
                // This bubble allows the user to tap on it to submit their data and go to the next step.
                if (content) {
                    $bubble.isPrompt = true;
                    $bubble.addClass('prompt');
                    $bubble.addClass('submit');
                    $bubble.addClass('pic');
                    $bubble.addClass('selectable');

                    $bubble.html(content);
                    $bubble.prepend($('<span class="submitDecorator">'));

                    // If this isn't following a justified element, right-align it.
                    if (!_this.$lastBubble ||
                        _this.$lastBubble.speaker != $bubble.speaker ||
                        _this.$lastBubble.hasClass('right')) {
                        $bubble.addClass('right');
                    }

                    $bubble.on('click', function (ev) {
                        var approved = $(_this).triggerHandler($bubble.type, [line, $bubble]) !== false;
                        if (approved) {
                            log("Submitted: " + $bubble.id + " ('" + content + "')");

                            $bubble.addClass('submitted selected');
                            $bubble.siblings('[group="' + $bubble.group + '"]').addClass('submitted');
                            $bubble.submitted = true;

                            _this.data.set($bubble.id, 'Clicked');

                            _this.awardPoints(line);

                            if ($bubble.type == 'submit') {
                                _this.clear();
                            }

                            _this.update();
                        }
                    });
                } else {
                    $(_this).triggerHandler($bubble.type, [line, $bubble]);
                    _this.awardPoints(line);

                    if ($bubble.type == 'submit') {
                        _this.clear();
                    }
                }
                break;

            case 'goto':
                // This bubble allows the user to tap on it to submit their data and go to the next step.
                var target = _this.data.evaluateText(line.Target);
                if (content) {
                    $bubble.addClass('submit'); // Just because we don't have another style designed for gotos.
                    $bubble.addClass('pic');

                    $bubble.html(content);
                    $bubble.prepend($('<span class="submitDecorator">'));

                    $bubble.on('click', function (ev) {
                        log("Goto: " + $bubble.id + " ('" + content + "'): " + target);

                        $bubble.addClass('submitted');
                        $bubble.siblings('[group="' + $bubble.group + '"]').addClass('submitted');
                        $bubble.submitted = true;

                        _this.data.set($bubble.id, 'Clicked');

                        _this.awardPoints(line);

                        _this.goto(target);
                    });
                } else {
                    log("Goto: " + $bubble.id + ": " + target);

                    $bubble.remove();
                    _this.awardPoints(line);
                    _this.goto(target);
                    return null;
                }
                break;

            case 'wait':
                log("Wait: " + $bubble.id + (content ? " ('" + content + "')" : ""));

                // This bubble is like a prompt but the user can't actually interact with it.
                $bubble.isPrompt = true;

                if (content) {
                    $bubble.html(content);
                } else {
                    $bubble.remove();
                }

                var started = Date.now();

                if (line.Duration) {
                    setTimeout(function () {
                        log("Elapsed: " + $bubble.id + (content ? " ('" + content + "'): " : ": ") + (Date.now() - started) + "ms");

                        $bubble.submitted = true;

                        _this.data.set($bubble.id, 'Waited');

                        _this.awardPoints(line);

                        _this.update();
                    }, Conversation.superSpeed ? 1000 : +_this.data.evaluateExpression(line.Duration) * 1000);
                } else {
                    _this.awardPoints(line);
                }
                break;

            case '':
            case null:
            case 'null':
            case undefined:
            case 'undefined':
                // Just a regular text bubble.
                log("Agent: " + $bubble.id + " ('" + content + "')");

                $bubble.html(content);
                _this.awardPoints(line);

                // Highlight any mentioned items.
                $(window).triggerHandler('showtext', content);
                break;

            default:
                // Unknown types.
                log("Unknown: " + $bubble.id + " ('" + content + "'): '" + line.Type + "'");
                $bubble.html('<h1>[' + line.Type + ']</h1>' + content);
                _this.awardPoints(line);
                break;
        }

        if (line.Sound) {
            $bubble.on('click', function () {
                var src = _this.data.evaluateText(line.Sound);
                if (src != line.Sound) {
                    _this.data.set(line.ID + '_EvalSound', src);
                }
                if (!src.startsWith('http')) {
                    src = window.server.mediaLocation + src;
                }

                var sound = document.createElement('audio');

                $(sound).on('loadstart loadeddata canplay playing pause seeked stalled suspend ended abort error volumechange', function (ev) {
                    log("Sound: " + $bubble.id + " (" + ev.target.currentSrc + "): " + ev.type + "@" + ev.target.currentTime + " (" + Math.round(ev.target.currentTime * 100 / ev.target.duration) + "%)");
                });

                sound.setAttribute('src', src);
                sound.play();
                sound.addEventListener('play', function () {
                    if (Conversation.superSpeed || line.Duration) {
                        setTimeout(function () {
                            sound.pause();
                            $bubble.triggerHandler('ended');
                        }, Conversation.superSpeed ? 1000 : +_this.data.evaluateExpression(line.Duration) * 1000);
                    }
                });
                sound.addEventListener('ended', function () {
                    $bubble.triggerHandler('ended');
                });
            });
        }

        // Check the enable condition to see whether we can enable this bubble or not.
        if (line.EnableCondition) {
            var checkEnableCondition = function () {
                // If it's already submitted then don't change its state anymore.
                if (!$bubble.hasClass('submitted')) {
                    var disable = !_this.data.evaluateExpression(line.EnableCondition);
                    if (disable != $bubble.hasClass('disabled')) {
                        log((disable ? 'Disabled' : 'Enabled') + ": " + $bubble.id + " ('" + content + "')");
                        $bubble.toggleClass('disabled', disable);
                    }
                } else {
                    _this.$root.off('change', checkEnableCondition);
                }
            }
            _this.$root.on('change', checkEnableCondition);
            checkEnableCondition();
        }

        _this.scrollDown();
        $bubble.shown = Date.now();

        return $bubble;
    }

    // Called whenever the script or data has changed or timers have ticked.
    _this.update = function () {
        if (!_this.started) {
            return false; // The conversation hasn't been started yet.
        }

        // If we're sitting at an unsubmitted prompt then just keep sitting there.
        if (_this.$lastBubble && _this.$lastBubble.isPrompt && !_this.$lastBubble.submitted) {
            return false; // Nothing updated for this update.
        }

        // If we just showed the typing bubble then let it sit for the minimum amount of time to make it look "real".
        if (_this.$typingBubble) {
            var elapsed = Date.now() - _this.$typingBubble.shown;
            if (elapsed < _this.agentTypingDuration) {
                window.setTimeout(_this.update, _this.agentTypingDuration - elapsed);
                return false; // Nothing updated for this update.
            }
        }

        // See if there are new lines available.
        var nextLine = null;
        if (_this.loaded) {
            nextLine = _this.lineIndex + 1 < _this.lines.length ? _this.lines[_this.lineIndex + 1] : null;

            // If all the content has already been loaded and there are no more lines to show then return null.
            if (nextLine == null) {
                $(_this).triggerHandler('end');
                return null; // No more content; nothing else to do.
            }
        }

        // Otherwise, if we don't have a next line but the content is still being loaded then show a typing bubble.
        if (nextLine == null) {
            _this.showTypingBubble('agent'); // It may be that the next line is for the user, but since we don't know then just pretend the agent is typing.
            window.setTimeout(_this.update, _this.agentTypingDuration);
            return true; // We updated the screen.
        }

        // Then, check to see if it has a condition to show it and if so make sure it passes.
        if (nextLine.ShowCondition) {
            if (!_this.data.evaluateExpression(nextLine.ShowCondition)) {
                _this.data.clear(nextLine.ID); // Clear the data for this line since the user didn't have a chance to respond to it.
                _this.lineIndex++;
                return _this.update();
            }
        }

        // Ok, we have a next line to show.  Now determine who's line it is.
        var nextSpeaker = nextLine.Type ? 'user' : 'agent'; // Currently this is the way it is in the excel spreadsheet.

        // Make sure we've waited a while between bubbles to make the chat seem more real.
        // But don't pause between Full Screen "bubbles".
        if (_this.$lastBubble && !(_this.$lastBubble.type == 'fullscreen' && normalize(nextLine.Type) == 'fullscreen')) {
            var elapsed = Date.now() - _this.$lastBubble.shown;
            if (_this.$lastBubble.speaker != nextSpeaker) {
                if (elapsed < _this.switchSidesDelay) {
                    window.setTimeout(_this.update, _this.switchSidesDelay - elapsed);
                    return false; // Nothing updated for this update.
                }
            } else {
                // Wait the minimum amount of time between bubbles.
                if (elapsed < _this.betweenBubbleDelay) {
                    window.setTimeout(_this.update, _this.betweenBubbleDelay - elapsed);
                    return false; // Nothing updated for this update.
                }

            }
        }

        // If the speaker is the agent, we always show a typing bubble for a while first to make it look like she's typing.
        if (nextSpeaker == 'agent') {
            if (!_this.$typingBubble) {
                _this.showTypingBubble(nextSpeaker);
                window.setTimeout(_this.update, _this.agentTypingDuration);
                return true; // We updated the screen.
            }
        }

        // Ok, we have a next line.  First, clear out any preexisting response stored for its ID.
        _this.data.clear(nextLine.ID);

        // Ok, we've made sure bubbles are (still) being shown if they need to at this point, so now we've verified that we're ready to actually show the next line.
        var $newBubble = _this.showLineBubble(nextLine, nextSpeaker);
        if ($newBubble) {
            _this.$lastBubble = $newBubble;
            _this.lineIndex++;
        }

        // Update again after this.
        setTimeout(_this.update);

        return $newBubble;
    }

    // Scrolls the conversation down to the bottom.
    _this.scrollDown = function () {
        _this.$root.parent().animate({
            scrollTop: _this.$root.height()
        }, _this.autoScrollDuration);
    }

    // Clears the conversation. Call goto or start to restart it.
    _this.clear = function () {
        _this.$root.empty();
        _this.$typingBubble = null;
        _this.$lastBubble = null;
    }

    // Goes to a specific line in the conversation.
    _this.goto = function (line) {
        // If we're immediately jumping to a line but we haven't loaded our lines yet then postpone the jump until after we're done.
        if (!_this.loaded) {
            $(_this).on('loaded', function () {
                _this.goto(line);
            });
            return;
        }
        var targetIndex =
            typeof line == 'number' ? line :
            typeof line == 'string' ? _this.lines.findIndex(function (l) { return l.ID.toLowerCase() == line.toLowerCase(); }) :
            _this.lines.indexOf(line);

        if (targetIndex < _this.lineIndex) {
            // If we show the same bubbles more than once we run into problems with IDs and such.
            // A brute force way to get around that is to always have to clear the screen when we go backwards.
            _this.clear();
        } else if (targetIndex == _this.lineIndex) {
            // We're already there.  Nothing to do.
            return;
        }

        _this.lineIndex = targetIndex - 1; // The update() will actually increment this to the next index since lineIndex represents the 'current' index.
        // BUG: If we skipped over some 'submits' or 'continues' then the dots at the bottom won't match up.
        _this.removeTypingBubble();
        _this.$lastBubble = null;

        _this.update();
    }

    // Awards any points associated with the given line.
    _this.awardPoints = function (line) {
        var points = +_this.data.evaluateExpression(line.Points);
        if (points) {
            var suffix = '_Points';
            var currentLinePoints = _this.data.get(line.ID + suffix);
            _this.data.set(line.ID + suffix, +currentLinePoints + points);

            line.awardedPoints = true;

            $(_this).triggerHandler('scored', points);
        }
    }

    var avatar = _this.data.get('Avatar');
    _this.$root.addClass(avatar);
    $(_this.data).on('change loaded', function (e, id) {
        if (e.type == 'loaded' || id == 'Avatar') {
            _this.$root.removeClass(avatar);
            avatar = _this.data.get('Avatar');
            _this.$root.addClass(avatar);
        }
    });
}
