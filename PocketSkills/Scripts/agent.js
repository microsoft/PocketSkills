/// <reference path="azure.js" />

// Debug/configurable settings:
Agent.chatty = false; // Whether to have the agent constantly saying everything she can.
Agent.superSpeed = false; // Whether the agent's bubbles should appear as fast as possible.

function Agent(element, data) {
    'use strict';

    if (!this instanceof Agent)
        return new Agent(element, data);
    var _this = this;

    _this.$agent = $(element);
    _this.data = data;
    _this.content = new Content('MarshaSays');

    _this.lines = []; // Contains each ordered line that the agent can say.
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

    _this.currentContext = ""; // The current module or screen being shown.
    _this.currentContextData = {}; // Any data associated with the current context.

    _this.agentAutospeakDelay = Agent.superSpeed ? 500 : 3000; // How long to wait in a new context before automatically saying something (3000 is good)
    _this.agentTypingDuration = Agent.superSpeed ? 500 : 2000; // Show the typing bubble for the agent for at least this long to make it seem like a real person typing. (2000 is good)
    _this.agentBubbleDuration = Agent.superSpeed ? 2000 : 5000; // Show the agent's bubble for this long before removing it (5000 is good).
    _this.betweenBubbleDelay = Agent.superSpeed ? 500 : 1000; // The minimum amount of time to wait before showing a new bubble. (1000 is good)

    function applySettings() {
        settings.forEach(function (value, setting) {
            if (!Agent.superSpeed) {
                switch (setting) {
                    case 'AgentAutospeakDelay': _this.agentAutospeakDelay = +value; break;
                    case 'AgentTypingDuration': _this.agentTypingDuration = +value; break;
                    case 'AgentBubbleDuration': _this.agentBubbleDuration = +value; break;
                    case 'BetweenBubbleDelay': _this.betweenBubbleDelay = +value; break;
                }
            }
        });
    };
    applySettings();
    $(window.settings).on('change', applySettings);

    _this.$lastBubble = null; // Store the last bubble shown.
    _this.$typingBubble = null; // Store a reference to the typing bubble.

    // Asynchronously loads content for the agent from azure table storage.
    _this.load = function (sas) {
        return _this.content.load(sas);
    }

    // Sets the current module or screen so that that the agent knows what to speak about next.
    _this.setContext = function (context, data, showImmediately) {
        _this.removeBubble();
        _this.currentContext = context;
        _this.currentContextData = data;
        _this.lineIndex = -1;
        _this.lastSpoke = Date.now(); // Reset the autospeak time since the user is actively doing something.
        _this.update(showImmediately);
    }

    // Shows a chat bubble immediately with the next available saying (such as when the user taps the agent button).
    _this.showBubble = function () {
        return _this.update(true);
    }

    // Removes the currently shown bubble.
    _this.removeBubble = function () {
        _this.$typingBubble && _this.$typingBubble.remove();
        _this.$lastBubble && _this.$lastBubble.remove();
        delete _this.$typingBubble;
        delete _this.$lastBubble;
    }

    // Shows a typing bubble.
    _this.showTypingBubble = function () {
        if (!_this.$typingBubble) {
            var $bubble = $('<label>');
            $bubble.addClass('bubble');
            $bubble.addClass('typing');
            $bubble.addClass('agent');
            $bubble.text("...");

            _this.$agent.after($bubble);
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

    // Shows a saying for the agent.  Any animations are controlled by styles elsewhere.
    _this.showTextBubble = function (text) {
        // First see if we need to replace the typing bubble or create a new one.
        var $bubble;
        if (_this.$typingBubble) {
            $bubble = _this.$typingBubble;
            $bubble.removeClass('typing');
        } else {
            _this.removeBubble();
        }

        // Make sure the agent's head is visible so we don't have an invisible speaker.
        $('#mainFooter').addClass('showAgent');

        if (!$bubble) {
            $bubble = $('<label>');
            $bubble.addClass('bubble');
            $bubble.addClass('agent');
            _this.$agent.after($bubble);
        }

        $bubble.html(text);

        log("AgentSays: '" + text + "'");

        $(window).triggerHandler('showtext', text);

        $bubble.shown = Date.now();
        return $bubble;
    }

    // Direct way of having the agent say something immediately.
    _this.say = function (text) {
        _this.$lastBubble = _this.showTextBubble(text);
        setTimeout(_this.update, _this.agentBubbleDuration);
    }

    // Called whenever the script or data has changed or timers have ticked.
    _this.update = function (showImmediately) {

        if (showImmediately) {
            // We're immediately moving on to the next bubble, so remove any existing one.
            _this.removeBubble();
        } else {
            // If there's a bubble being shown and it's past it's duration then remove it.
            if (_this.$lastBubble) {
                var elapsed = Date.now() - _this.$lastBubble.shown;
                if (elapsed < _this.agentBubbleDuration) {
                    window.setTimeout(_this.update, _this.agentBubbleDuration - elapsed);
                    return false; // Nothing updated for this update.
                } else {
                    _this.removeBubble();
                    _this.lastSpoke = Date.now();
                    window.setTimeout(_this.update); // Call update again immediately after this.
                    return true; // We updated the screen.
                }
            }

            // If we just showed the typing bubble then let it sit for the minimum amount of time to make it look "real".
            if (_this.$typingBubble) {
                var elapsed = Date.now() - _this.$typingBubble.shown;
                if (elapsed < _this.agentTypingDuration) {
                    window.setTimeout(_this.update, _this.agentTypingDuration - elapsed);
                    return false; // Nothing updated for this update.
                }
            }
        }

        // Only show the agent if there are any lines available in the current context.
        var linesInContext = _this.lines && _this.lines.some(function (l, i) {
            return l.Context == _this.currentContext && (!l.ShowCondition || _this.data.evaluateExpression(l.ShowCondition, _this.currentContextData));
        });
        $('#mainFooter').toggleClass('showAgent', linesInContext);

        if (!showImmediately) {
            // Make sure we've waited long enough for the agent to start speaking.
            var elapsed = Date.now() - _this.lastSpoke;
            if (_this.preventAutospeak || elapsed < _this.agentAutospeakDelay) {
                window.setTimeout(_this.update, _this.agentAutospeakDelay - elapsed);
                return false; // Nothing updated for this update.
            }
        }

        // Now see if there are *new* lines available in this context.
        var nextLineIndex = _this.lines && _this.lines.findIndex(function (l, i) {
            return i > _this.lineIndex && l.Context == _this.currentContext;
        });
        var nextLine = _this.lines[nextLineIndex];

        // If there are no more lines to show then return null.
        if (!nextLine) {
            // If all the content has already been loaded then trigger the 'end' event.
            if (_this.loaded) {
                $(_this).triggerHandler('end');
                if (Agent.chatty) {
                    // If we're debugging the agent then keep looping.
                    _this.lineIndex = -1;
                    setTimeout(_this.update);
                }
            }
            return null; // No more content; nothing else to do.
        }

        // Then, check to see if it has a condition to show it and if so make sure it passes.
        if (nextLine.ShowCondition) {
            if (!_this.data.evaluateExpression(nextLine.ShowCondition, _this.currentContextData)) {
                _this.lineIndex = nextLineIndex; // Effectively skip this line by pretending we're on it right now.
                return _this.update(showImmediately);
            }
        }

        // The speaker is always the agent, so unless this is immediate we always show a typing bubble for a while first to make it look like she's typing.
        if (!showImmediately && !_this.$typingBubble) {
            _this.showTypingBubble();
            window.setTimeout(_this.update, _this.agentTypingDuration);
            return true; // We updated the screen.
        }

        // Ok, we've made sure bubbles are (still) being shown if they need to at this point, so now we've verified that we're ready to actually show the next line and award any associated points.
        if (nextLine.Points) {
            $(_this).triggerHandler('scored', +nextLine.Points);
        }

        // Replace variables and expressions in the line's content.
        var text = _this.data.evaluateText(nextLine.Content, _this.currentContextData);
        var $newBubble = _this.showTextBubble(text);
        if ($newBubble) {
            $newBubble.attr('style', nextLine.Style);
            _this.$lastBubble = $newBubble;
            _this.lineIndex = nextLineIndex; // We're on the next line index now.
        }

        // Update again after this.
        setTimeout(_this.update);

        return $newBubble;
    }

    _this.$agent.on('click', function () {
        log("Main agent pressed. Looking for something to say about '" + _this.currentContext + "'.")
        var shown = _this.showBubble();
        if (shown == null) {
            // No new bubbles to show.  But since they clicked it, let's just start over.
            _this.lineIndex = -1;
            _this.showBubble();
        }
    });

    $(_this.data).on('loaded', function () {
        _this.update();
    });
}
