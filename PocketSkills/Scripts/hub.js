/// <reference path="azure.js" />

// Debug/configurable settings:
Hub.hideRootBlade = false; // Whether to hide the root blade when another blade is selected.
Hub.hideActivityBlade = true; // Whether to hide the last blade when the user goes into an activity (like a game or conversation).
Hub.allowAllSections = false; // Whether to allow the user to select all sections even if they're locked/unavailable.

// This object manages the content inside the hub based on the layout in the content worksheet's 'Hub' tab.
function Hub(element, data) {
    'use strict';

    if (!this instanceof Hub)
        return new Hub(element, data);
    var _this = this;

    _this.$root = $(element).addClass('hub'); // The root element in the HTML
    _this.data = data; // The user's data and responses to questions
    _this.content = new Content('Modules');

    _this.modules = {}; // All of the modules in the hub.
    _this.loaded = null; // Keeps track of whether we have loaded data or not.

    $(_this.content).on('loaded', function () {
        _this.content.forEach(function (row) {
            _this.modules[row.ID] = row;
            _this.modules[row.ID].children = [];

            if (row.Parent) {
                if (_this.modules[row.Parent]) {
                    _this.modules[row.Parent].children.push(row);
                } else {
                    alert("Couldn't find parent module '" + row.Parent + "' of '" + row.ID + "'")
                }
            }
        });
        _this.loaded = new Date();
        $(_this).triggerHandler('loaded');
        _this.update();
    });

    _this.backs = []; // A stack of functions to run when the user presses the back button.

    // Add the initial My Hub blade.
    _this.$blades = $('<div id="blades">').appendTo(_this.$root);
    _this.$rootBlade = $('<div id="rootBlade" class="blade" style="overflow: hidden"><div class="sections"><div class="section"><div id="Hub_Title" class="title">Loading Your Hub...</div></div></div></div>').appendTo(_this.$blades);

    // Asynchronously loads content for the hub from azure table storage.
    _this.load = function (sas) {
        _this.contentSAS = sas;
        return _this.content.load(sas);
    }

    // Called whenever the script or data have changed or timers have ticked.
    $(_this).on('update', function () {
        if (_this.$blades.children().length == 1 && _this.modules['Hub']) {
            _this.addBlade(_this.modules['Hub']);
        }
    });

    // Adds a blade for the given module.
    _this.addBlade = function (module) {
        var $parentBlade;
        if (module.Parent) {
            $parentBlade = _this.$blades.children('#' + module.Parent);
        } else {
            $parentBlade = _this.$rootBlade;
        }

        // Close the parent blade and add the styles of the selected item (to set its color etc.)
        $parentBlade.addClass('closed');
        $parentBlade.addClass(_this.getModuleStateClasses(module));

        // Called whenever the script or data have changed or timers have ticked.
        $(_this).on('update', function () {
            if ($blade.prev().is($parentBlade)) {
                $parentBlade.removeClass(_this.getElementStateClasses($parentBlade));
                $parentBlade.addClass(_this.getModuleStateClasses(module));
            }
        });

        // Find the text label for this module in the parent and set its state to selected.
        var $title = $parentBlade.find('#' + module.ID + "_Title");
        $title.html(module.Content); // Make sure the text has the latest content. (This is really only used to replace Loading...)
        $title.addClass('selected');

        var $bladesToHide = $();

        // Determine which blades we need to hide (we may add to this later depending on what type of blade we're adding).
        if (Hub.hideRootBlade) {
            if (_this.$blades.length == 1) {
                $bladesToHide = _this.$rootBlade; // Hide the "My Hub" blade the first time we're adding a new blade.
            }
        }

        // Now we can finally create the new blade.
        var $blade = $('<div class="blade">').attr('id', module.ID);

        // Determine what's the next thing to show.
        switch (module.Type) {
            case 'Module':
                var $sections = $('<div class="sections">').appendTo($blade);
                module.children.forEach(function (child) {
                    var $section = $('<div class="section">').attr('id', child.ID + '_Section').appendTo($sections);
                    var $shaker = $('<div class="shake">').appendTo($section);
                    var $title = $('<div class="title">').attr('id', child.ID + '_Title').html(child.Content).appendTo($shaker);
                    var $exercises = $('<div>').addClass('exercises').appendTo($section);

                    $section.on('click', function (e) {
                        if (!$blade.hasClass('closed')) {
                            if (Hub.allowAllSections || $section.hasClass('Available')) {
                                if (location.hash) {
                                    location.hash = location.hash + '/' + child.ID;
                                } else {
                                    location.hash = child.ID;
                                }
                            } else {
                                $shaker.effect('shake', { distance: 10 });
                            }
                            return false;
                        }
                    });

                    $(_this).on('update', function () {
                        $section.prop('class', 'section');
                        $section.addClass(_this.getModuleStateClasses(child));

                        if (child.Type == 'Skill') {
                            $exercises.empty();
                            var earned = _this.data.get(child.ID + '_Points') || 0;
                            if (earned) {
                                $exercises.append(
                                    $('<span>').text('Earned '),
                                    $('<span class="points">').text(earned),
                                    $('<span class="pointIcon">')
                                );
                            }
                        }
                    });
                });
                break;

            case 'Conversation':
            case 'Skill':
                var conversation = new Conversation($blade, _this.data, module.ID);
                conversation.load(_this.contentSAS);

                var $prev = $blade.prev();
                if (Hub.hideActivityBlade) {
                    $bladesToHide = $bladesToHide.add($parentBlade);
                }
                $bladesToHide = $bladesToHide.add($parentBlade.prevUntil('.hidden'));

                var checkPoints = [];
                var checkPoint = 0;
                $('#navDots').empty();

                $(conversation).on('loaded', function () {
                    var nextIsCheckpoint = true;
                    conversation.lines.forEach(function (line) {
                        if (!history.state) {
                            history.replaceState(line.ID, null, null);
                            _this.checkpoint = line.ID;
                        }
                        if (nextIsCheckpoint) {
                            $('#navDots').append($('<span class="navDot">').attr('id', line.ID + '_Dot'));
                            checkPoints.push(line);
                            nextIsCheckpoint = false;
                        }
                        if (line.Type && line.Type.match(/submit/i)) {
                            nextIsCheckpoint = true;
                        }
                    });
                    $('#navDots').children().first().addClass('active');
                });

                $(conversation).on('submit', function () {
                    var $activeDot = $('#navDots').children('#' + checkPoints[checkPoint].ID + "_Dot");
                    $activeDot.removeClass('active').addClass('submitted');
                    if (conversation.lineIndex + 1 < conversation.lines.length) {
                        var $nextDot = $activeDot.next();
                        $nextDot.addClass('active');
                        checkPoint++;
                        history.pushState(checkPoints[checkPoint].ID, null, null);
                        _this.checkpoint = checkPoints[checkPoint].ID;
                        _this.addBack(function () {
                            $nextDot.removeClass('active');
                            $activeDot.removeClass('submitted').addClass('active');
                            checkPoint--;
                            conversation.clear();
                            conversation.goto(checkPoints[checkPoint]);
                            _this.checkpoint = checkPoints[checkPoint].ID;
                        });
                    }
                });

                $(conversation).on('scored', function (e, points) {
                    window.score(points, module.ID);
                });

                var moduleWasSatisfied = _this.isSatisfied(module);

                $(conversation).on('end', function () {
                    // Remove the checkpoint backs.
                    _this.backs.length -= checkPoint;
                    history.go(-checkPoint - 1);

                    // BUG: Because we're allowing the user to go forward and back, 
                    // but we're not updating the checkpoint and dots when they go forward,
                    // they will be further along in the window.history timeline path than they are in the _this.backs and checkPoint timeline,
                    // so this will take them somewhere still within the conversation history.

                    // See if they newly satisfied any modules, and if so reward them the points.
                    _this.modules.forEach(function (module) {
                        if (module.Points && _this.isSatisfied(module) && !_this.data.get(module.ID + '_Satisfied')) {
                            _this.data.set(module.ID + '_Satisfied', Date());
                            window.score(module.Points, module.ID);
                        }
                    });
                });

                conversation.start();

                $('#mainFooter').addClass('showNav');
                break;

            default:
                $blade.html("Sorry, I don't know how to handle '" + module.Type + "'s");
        }

        $bladesToHide.addClass('hidden');
        _this.$blades.append($blade);
        var previousModule = _this.module;
        _this.module = module;
        _this.conversation = conversation;

        if (!$parentBlade.is(_this.$rootBlade)) {
            _this.addBack(function () {
                // Remove this blade and restore the parent's state when the user goes back.
                // Remove all child-specific styles from the parent.
                $parentBlade.prop('class').split(/\s+/).forEach(function (c) {
                    if (c != 'blade') {
                        $parentBlade.removeClass(c);
                    }
                });

                $parentBlade.nextAll().remove();
                $bladesToHide.removeClass('hidden');

                $title.removeClass('selected');

                $('#mainFooter').removeClass('showNav');

                _this.module = previousModule;
                _this.conversation = null;
                _this.checkpoint = null;

                $(_this).triggerHandler('moduleChanged', previousModule);
                $(_this).triggerHandler('bladeChanged', $parentBlade);
            });
        }

        $(_this).triggerHandler('moduleChanged', module);
        $(_this).triggerHandler('bladeChanged', $blade);

        _this.update();

        return $blade;
    }

    // Adds a function that should be run when the user navigates back in the history.
    _this.addBack = function (callback) {
        _this.backs.push(callback);
    }

    // Tapping a closed blade should always go up a level. This is usually the same as pressing the back button but might not be if they came to the hub via a direct URL (hash).
    _this.$root.on('click', '.blade.closed', function () {
        var path = '';
        for (var module = _this.modules[_this.module.Parent]; module && module.ID != 'Hub'; module = _this.modules[module.Parent]) {
            if (path) {
                path = module.ID + '/' + path;
            } else {
                path = module.ID;
            }
        }
        location.hash = path;
    });

    // Handle what happens when the user navigates in the hub.
    $(element).on('route', function (ev, path) {
        if (!_this.loaded) {
            alert("'Unable to route to '" + path + "' because hub modules are not loaded yet.");
            return false;
        }

        // We could be navigating from any given module/conversation to any other module/conversation.
        // First determine the ancestry of the target path. 
        if (!path) {
            path = 'Hub';
        }

        var targetPieces = path.toLowerCase().match(/[^/]+/g);
        var targetModules = targetPieces.map(function (piece) {
            return _this.modules.find(function (m) {
                return piece == m.ID.toLowerCase();
            });
        });

        if (!targetModules[0]) {
            alert("Invalid path: " + path);
            return false;
        }

        // Support navigating to modules that don't have a parent in the hub.
        if (!targetModules[0].Parent && targetModules[0].ID != "Hub") {
            targetModules[0].Parent = "Hub";
        }

        // Add any further ancestors that weren't explicitly mentioned in the target path.  For example, the 'Hub' root ancestor module is usually never included.
        while (targetModules[0].Parent) {
            if (_this.modules[targetModules[0].Parent]) {
                targetPieces.unshift(targetModules[0].Parent.toLowerCase());
                targetModules.unshift(_this.modules[targetModules[0].Parent]);
            } else {
                alert("Could not find parent '" + targetModules[0].Parent + "' of module '" + targetModules[0].ID + "' in the target path '" + path + "'");
            }
        }

        // At this point the targetModules array should have the full ancestry line all the way to the root.
        // Note that the last element might be undefined if the path ends in a specific line within a conversation.
        // Now we need to go back from our current location to get back on track with the new line.
        while (!targetPieces.includes((_this.checkpoint || _this.module.ID).toLowerCase())) {
            // BUG: We might not need to go back if we're in the same conversation as the target path.
            // We might actually need to just go forward to the target and update the colored dots.
            if (_this.backs.length > 0) {
                _this.backs.pop()();
            } else {
                // TODO: What do we do if our module is still not in the path but we can't go back any further?
                alert('Unable to navigate up to path: ' + path);
                return false;
            }
        }

        // Now that we're on the same ancestry line we need to go forward to the new target.
        for (var i = targetPieces.indexOf((_this.checkpoint || _this.module.ID).toLowerCase()) + 1; i < targetPieces.length; i++) {
            if (targetModules[i]) {
                // Make sure the next module is actually a child of the current one (except if the parent is the Hub, then any child is allowed).
                if (_this.module.ID == "Hub" || _this.module.children.includes(targetModules[i])) {
                    _this.addBlade(targetModules[i]);
                } else {
                    alert("Module '" + targetModules[i].ID + "' is not a child of module '" + _this.module.ID + "'");
                    return false;
                }
            } else if (_this.conversation) {
                _this.conversation.clear();
                _this.conversation.goto(targetPieces[i]);
                history.replaceState(targetPieces[i], null, null);
                _this.checkpoint = targetPieces[i];
                // BUG: We aren't updating the bottom colored dots yet, so just hide them.
                $('#mainFooter').removeClass('showNav');
            } else {
                alert("Invalid module: '" + targetPieces[i] + "'");
                return false;
            }
        }

        _this.update();
    });

    _this.isVisible = function (module) {
        return !module.ShowCondition || _this.data.evaluateExpression(module.ShowCondition);
    }

    _this.isAvailable = function (module) {
        return !module.AvailableCondition || _this.data.evaluateExpression(module.AvailableCondition);
    }

    _this.isSatisfied = function (module) {
        return !module.SatisfiedCondition || _this.data.evaluateExpression(module.SatisfiedCondition);
    }

    _this.getModuleStateClasses = function (module) {
        var visible = _this.isVisible(module);
        var available = _this.isAvailable(module);
        var satisfied = _this.isSatisfied(module);

        var state = ''; // Represented like CSS classes.
        if (!visible) {
            state += 'Hidden ';
        }
        if (!available && !satisfied) {
            state += 'Locked ';
        } else {
            if (available) {
                state += 'Available ';
            }
            if (satisfied) {
                state += 'Satisfied ';
            }
        }

        return state;
    }

    // Gets the module-specific classes on an element.
    _this.getElementStateClasses = function ($element) {
        return ($element.prop('class').match(/[A-Z][^\s]*/g) || []).join(' ');
    }

    // Called whenever the script or data have changed or timers have ticked.
    _this.update = function () {
        $(_this).triggerHandler('update');
    }

    // Update ourselves when the data is loaded.
    $(_this.data).on('loaded', _this.update);
}
