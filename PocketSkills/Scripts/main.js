/// <reference path="azure.js" />

// Make the local version super speed.
if (sessionStorage && sessionStorage.debug) {
    azure.debug = true;
    Agent.superSpeed = true;
    Conversation.superSpeed = true;
    DiaryCards.showAllItems = true;
    Data.logToConsole = true;
}

var mainLoadingStatus = document.getElementById('mainLoadingStatus');
mainLoadingStatus.innerHTML += "<div>Running Scripts...</div>";

function showLoad(message, writeLog) {
    $(mainLoadingStatus).append($('<div>').text(message));
    if (writeLog && window.log) {
        window.log(message);
    }
}

// You can hard-code an add-only SAS URL here to log failures that might occur even before Server.cshtml is loaded.
//window.logTable = azure.getTable('https://ACCOUNT.table.core.windows.net:443/TABLENAME?sv=2015-12-11&si=POLICY&tn=TABLENAME&sig=SIGNATURE');
window.log = function (message) {
    console.log(message);
    window.logTable && azure.writeMessage(window.logTable, window.server ? window.server.userID : '.', message);
};

$(function main() {
    'use strict';

    showLoad("Initializing Objects...");

    window.settings = new Settings();
    var data = new Data('Data');
    var hub = new Hub($('#Hub'), data);
    var agent = new Agent($('#mainAgent'), data);
    var diarycards = new DiaryCards($('#DiaryCards'), data);
    var calendar = new Calendar($('#Calendar'), data);
    var notepad = new Notepad($('#Notepad'), data);
    var library = new Library($('#Library'), data);
    var skills = new Skills($('#Skills'), data);
    var store = new Store($('#Store'), data);

    $(data).on('loaded change', update);
    $(hub).on('loaded change', update);
    $(diarycards).on('loaded change', update);
    $(calendar).on('loaded change', update);
    $(notepad).on('loaded change', update);

    $(document).ajaxError(function (event, jqXHR, settings, error) {
        var writeLog = !/\/logs?/.test(settings.url);
        showLoad("Error loading " + settings.url, writeLog);
        if (jqXHR && jqXHR.responseText) {
            $('#mainLoadingStatus').append($('<div>').html(jqXHR.responseText));
        }
        try {
            showLoad("Event: " + $.stringify(event), writeLog);
            showLoad("XHR: " + $.stringify(jqXHR), writeLog);
            showLoad("Error: " + $.stringify(error), writeLog);
        } catch (e) {
            showLoad("Exception: " + e, writeLog);
        }
    });

    checkSignIn();

    function checkSignIn() {
        showLoad("Checking Signin Status...");
        WL.init({
            client_id: 'f1c182b7-95db-42f7-bc6f-56dc9e073380',
            redirect_uri: 'https://' + window.location.hostname + '/wlcallback.html',
        });
        WL.getLoginStatus(function (status, session) {
            if (status.status == 'connected') {
                showLoad("Already Signed In.");
                $('#mainLoginBlocker').hide();
                getAccessTokens();
            } else {
                showLoad("Not Signed In.");
                showLoad("Showing Sign-In Screen...");
                $('#mainLoadingScreen').fadeOut('slow');
            }
        }, true);
        $('#windowsLiveSignOut, #invitationSignOut').click(function () {
            WL.logout(function () {
                location.href = location.origin;
            });
        })
    }

    function getAccessTokens() {
        showLoad("Requesting Access...");

        var request = 'Server.cshtml?' + (location.href.split('?')[1] || '');
        $.getJSON(request, start).fail(function fail(jqxhr, textStatus, error) {
            showLoad("Error Getting Access: '" + textStatus + "', '" + error + "'.  Retrying...");
            $.getJSON(request, start).fail(fail);
        });
    }

    function start(server) {
        window.server = server;
        window.logTable = azure.getTable(server.SAS_logs);

        $('#mainInvitationStatus').empty();
        if (server.SAS_error || !server.SAS_content) {
            showLoad("Showing Invitation Page... " + (server.SAS_error || ""));
            $('#mainLoadingScreen').fadeOut('slow');

            $("#mainInvitationBlocker").show();
            $('#mainInvitationError').text(server.SAS_error);
            setTimeout(function () { $('#mainInvitationError').effect('bounce'); });
        } else {
            $("#mainInvitationBlocker").fadeOut('slow');

            showLoad("Loading Content & Data...");

            var loads = [];

            loads.push(settings.load(server.SAS_content));
            loads.push(hub.load(server.SAS_content));
            loads.push(agent.load(server.SAS_content));
            loads.push(skills.load(server.SAS_content));
            loads.push(library.load(server.SAS_content));
            loads.push(store.load(server.SAS_content));
            loads.push(notepad.load(server.SAS_notes, server.userID));
            loads.push(calendar.load(server.SAS_calendar, server.userID));
            loads.push(diarycards.load(server.SAS_diarycards, server.SAS_content, server.userID));
            loads.push(data.load(server.SAS_data, server.userID));
            
            $.when.apply($, loads).done(finish).fail(function fail(jqxhr, textStatus, error) {
                showLoad("Error Loading Data: '" + textStatus + "', '" + error + "'.");
                $('#mainLoadingScreen').show();
                $('#mainLoadingStatus').append($('<a href="/">Retry</a>'));
            });

            $('#mainSignedInPic').attr('src', 'https://apis.live.net/v5.0/' + server.userID + '/picture?type=small');
            $('#mainSignedInName').text(server.userName);
        }
    }

    var loaded;

    function finish() {
        showLoad("Finished Loading Content & Data.");

        loaded = Date();
        log("Content and Data Loaded on " + loaded);
        data.set('Login', location.href);
        
        // We store the acceptance of the First Run Experience per-device.
        if (!localStorage.getItem('FirstRunAccepted')) {
            showLoad("Loading First Run Experience...");
        } else {
            showLoad("Showing Main Hub...");
            $('#mainFirstRun').hide();
        }

        $('#mainLoadingScreen').fadeOut('slow');
        route();
    }

    $('#mainInvitationForm').on('submit', function (e) {
        $('#mainInvitationError').empty();

        var code = $('#mainInvitationCode').val();

        log("User entered invitation code '" + code + "'")

        if (!/[A-Za-z]{6}/.test(code)) {
            $('#mainInvitationStatus').text("The code should be exactly six letters.");
            setTimeout(function () { $('#mainInvitationStatus').effect('bounce'); });
        } else {
            $('#mainInvitationStatus').text("Checking code...");
            showLoad("Checking Code '" + code + "'...");
            $.getJSON('Server.cshtml?i=' + code, start).fail(function fail(jqxhr, textStatus, error) {
                $('#mainInvitationStatus').text($('#mainInvitationStatus').text() + ".");
                showLoad("Error Checking Code: '" + textStatus + "', '" + error + "'.  Retrying...");
                $.getJSON('Server.cshtml?i=' + code, start).fail(fail);
            });
            $(':focus').blur();
        }

        e.preventDefault();
    });

    $(settings).on('loaded', function () {
        var placeholders = {
            'AboutText': '#AboutAboutText',
            'LegalText': '#AboutLegalText',
            'AccountText': '#AccountAccountText',
            'FirstRun1': '#mainFirstRunText',
            'FirstRunAccept': '#mainFirstRunAccept',
            'ContactHeader': '#ContactHeader',
            'ContactPhoneNumber': '#ContactPhoneNumber, #ContactPhoneNumberLink',
            'ContactFooter': '#ContactFooter',
            'ContactImage': '#ContactImage'
        };

        settings.forEach(function (value, setting) {
            if (placeholders[setting]) {
                $(placeholders[setting]).forEach(function (element) {
                    if (element.is('img')) {
                        element.attr('src', (element.attr('src') || '') + settings[setting]);
                    } else if (element.is('a')) {
                        element.attr('href', (element.attr('href') || '') + settings[setting])
                    } else {
                        element.html(settings[setting]);
                    }
                });
            }
        });

        var firstRunPage = 1;
        var nextText = settings['FirstRun' + (firstRunPage + 1)];
        if (!nextText) {
            $('#mainFirstRunAccept').show();
            $('#mainFirstRunContinue').text('Accept');
        }
        $('#mainFirstRunContinue').on('click', function () {
            if (nextText) {
                $('#mainFirstRunText').html(nextText);
                firstRunPage++;
                nextText = settings['FirstRun' + (firstRunPage + 1)];
                if (!nextText) {
                    $('#mainFirstRunAccept').show();
                    $('#mainFirstRunContinue').text('Accept');
                }
            } else {
                // We store the acceptance of the First Run Experience per-device.
                localStorage.setItem('FirstRunAccepted', Date());
                data.set('FirstRunAccepted', Date()); // Also record it on our side for record keeping.
                showLoad("Showing Main Hub...");
                $('#mainFirstRun').fadeOut('slow');
            }
        });
    });

    var showingScreen = null;

    // Shows the screen with the given ID.
    function showScreen(screen) {
        if (screen != '#' && $(screen).hasClass('screen')) {
            if (showingScreen != screen) {
                clearScreens();
                log("Showing screen '" + screen + "'.");

                var name = $(screen).attr('name');
                $('#mainTitle').html(name);

                var currentScreenHasInput = false;
                if ($(screen).hasClass('autoload')) {
                    if ($(screen).hasClass('daily')) {
                        var dateSuffix = '-' + new Date().toLocalISOString().split('T')[0];
                    } else {
                        var dateSuffix = '';
                    }

                    log("Loading screen data for '" + screen + "'" + (dateSuffix ? " with suffix " + dateSuffix : "."));

                    var fieldsLoaded = 0;

                    $(screen).find('input, select').forEach(function ($element) {
                        if ($element.closest('.popup').length) { // Skip elements in popups.
                            return;
                        }

                        var name = $element.attr('name');
                        if (name) {
                            fieldsLoaded++;
                            var value = data.get(name + dateSuffix);
                            if ($element.is(':radio') || $element.is(':checkbox')) {
                                $element.prop('checked', $element.val() == value);
                            } else {
                                $element.val(value);
                            }
                            currentScreenHasInput = true;
                        }
                    });

                    log("Loaded " + fieldsLoaded + " fields for screen '" + screen + "'" + (dateSuffix ? " with suffix " + dateSuffix : "."));
                }

                $('#mainFooter').toggleClass('showScreen', $(screen).hasClass('screen'));
                $('#mainFooter').toggleClass('showSave', currentScreenHasInput);

                $(screen).triggerHandler('showing');
                $(screen).show();
                showingScreen = screen;

                agent.setContext(screen);
            }

            return showingScreen;
        } else {
            return null;
        }
    }

    // Removes all screens from the display.
    function clearScreens() {
        $('#mainContent').children().not('#Hub').hide();
        $('#mainFooter').removeClass('showScreen showLav showSave showDelete showNew showSparkles showDisabledSparkles');
        $(showingScreen).triggerHandler('hiding');
        showingScreen = null;
        $('#mainTitle').html(hub.module.Content);
        agent.setContext(hub.module.ID);
    }

    // Manages screens when navigating forward/back via popstate or URL hash.
    function route(path) {
        if (path === undefined) {
            path = location.hash; // We're ignoring any physical path parts for now since we're just a single-page app.
            if (history.state)
                path += "/" + history.state;
        }
        log("Routing to '" + path + "'");
        var base = path.split(/\//)[0];
        var rest = path.slice(base.length);
        var screen = showScreen(base);
        if (screen) {
            $(screen).triggerHandler('route', rest);
        } else {
            clearScreens();
            $('#Hub').triggerHandler('route', path.replace(/^#/, ''));
        }
    }

    var poppedHash;

    // Manages screens when navigating forward/back.
    $(window).on('popstate', function () {
        log("History moving to '" + location.pathname + location.hash + "' with state '" + history.state + "'");
        if (loaded) {
            route();
        }
        poppedHash = location.hash;
    });

    // Hack for IE to properly call popstate when the hash changes.
    $(window).on('hashchange', function (ev) {
        if (location.hash != poppedHash) {
            $(window).triggerHandler('popstate');
        }
    });

    // Go home and force a reload when they tap the logo.
    $('#mainButton').on('click', function () {
        log("Main logo pressed. Reloading after all Azure writes complete (or 5 seconds max).");
        azure.onWritesComplete(function () {
            location.hash = '';
            location.reload(true);
        });
        // Just in case something bad is happening force a reload after 5 seconds.
        setTimeout(function () {
            location.hash = '';
            location.reload(true);
        }, 5000);
    });

    $('#mainHamburger').on('click', function (e) {
        log("Main menu pressed. Showing menu.");
        $('#mainMenu').show('slide', { direction: 'right' });
        e.stopPropagation();
    });

    $('#mainHeader, #mainFooter, #mainMenu').on('click', function (e) {
        var target = $(e.target).closest('[data-screen]').data('screen');
        if (target) {
            location.hash = target;
        }
        $('#mainMenu').hide('slide', { direction: 'right' });
        e.stopPropagation();
    });

    // Automatically saves data for screens.
    $('#navSave').on('click', function () {
        $(showingScreen).triggerHandler('save');
        if ($(showingScreen).hasClass('autoload')) {
            if ($(showingScreen).hasClass('daily')) {
                var dateSuffix = '-' + new Date().toLocalISOString().split('T')[0];
            } else {
                var dateSuffix = '';
            }

            log("Saving screen data for '" + showingScreen + "'" + (dateSuffix ? " with suffix " + dateSuffix : "."));

            var fieldsSaved = 0;

            $(showingScreen).find('input, select').forEach(function ($element) {
                var name = $element.attr('name');
                if (name) {
                    if ($element.is(':radio') || $element.is(':checkbox')) {
                        if ($element.prop('checked')) {
                            fieldsSaved++;
                            data.set(name + dateSuffix, $element.val());
                        }
                    } else {
                        fieldsSaved++;
                        data.set(name + dateSuffix, $element.val());
                    }
                }
            });

            log("Saved " + fieldsSaved + " fields for screen '" + showingScreen + "'" + (dateSuffix ? " with suffix " + dateSuffix : "."));

            history.back();
        }
    });

    // Route the new button to the screen being shown.
    $('#navNew').on('click', function () {
        $(showingScreen).triggerHandler('new');
    });

    // Route the sparkles button to the screen being shown.
    $('#navSparkles').on('click', function () {
        $(showingScreen).triggerHandler('sparkles');
    });

    // Route the delete button to the screen being shown.
    $('#navDelete').on('click', function () {
        $(showingScreen).triggerHandler('delete');
    });

    $('#navBack').on('click', function () {
        log("Main back button clicked. Calling history.back()");
        history.back();
    });
    $('#navForward').on('click', function () {
        log("Main forward button clicked. Calling history.forward()");
        history.forward();
    });
    $('#navDiaryCard').on('click', function () {
        log("Main diary card button clicked. Showing diary cards.");
        showScreen('#DiaryCards');
    });

    $(hub).on('moduleChanged', function () {
        log("Navigated to module '" + hub.module.ID + "' ('" + hub.module.Content + "')");

        $('#mainTitle').html(hub.module.Content);
        agent.setContext(hub.module.ID);
        agent.preventAutospeak = hub.module.Type == 'Conversation' || hub.module.Type == 'Skill';
    });

    var $points = $('#mainPoints');
    $points.prop('Points', 0);

    var buttonsEnabled = false;
    function update(e, id) {
        // We currently disable the main menu and diary card until after the data has been loaded.
        if (e.type == 'loaded') {
            if (!buttonsEnabled && data.loaded && diarycards.loaded) {
                $('#mainHamburger').prop('disabled', false);
                $('#navDiaryCard').prop('disabled', false);
                buttonsEnabled = true;
            }
        }

        if (id == 'Points' && +data.get('Points') > $points.prop('Points')) {
            $points
                .stop()
                .addClass('glow', 1000)
                .delay(1000)
                .removeClass('glow', 1000);
        }
        if (e.type == 'loaded' || id == 'Points') {
            $points.animate({
                Points: +data.get('Points') || 0
            }, {
                duration: 2000,
                step: function (now) {
                    $(this).text(Math.ceil(now));
                },
                queue: false
            });
        }
    }

    $(window).on('showtext', function (e, text) {
        if (/Diary\s*Card/i.test(text)) {
            log("Highlighting main Diary Card button.");
            var $element = $('#navDiaryCard');
            $element.addClass('highlight', 0);
            $element.addClass('glow', 1000);
            $element.delay(1000);
            $element.removeClass('glow', 1000);
            $element.delay(600);
            $element.removeClass('highlight', 0);
        }
    });

    $(window).on('agent', function (e, text) {
        agent.say(text);
    });

    $(window).on('contextChanged', function (e, context, data, showImmediately) {
        agent.setContext(context, data, showImmediately);
    });

    window.score = function (points, module) {
        log("Scored points for module '" + module + "': " + points);

        if (+points) {
            var currentPoints = +data.get('Points') || 0;
            data.set('Points', currentPoints + points);

            if (module) {
                var suffix = '_Points';
                var currentModulePoints = +data.get(module + suffix) || 0;
                data.set(module + suffix, currentModulePoints + points);
            }
        }
    }

    $(window).on('mousedown', function (e) {
        var path = $(e.target).parentsUntil('body').addBack().map(function () {
            var entry = this.tagName.toLowerCase();
            if (this.id) {
                entry += '#' + this.id;
            }
            if (this.hasAttribute('name')) {
                entry += '[name="' + this.getAttribute('name') + '"]';
            }
            if (this.hasAttribute('for')) {
                entry += '[for="' + this.getAttribute('for') + '"]';
            }
            if (this.className) {
                entry += '.' + this.className.replace(/ /g, '.');
            }
            return entry;
        }).get().join(' ');
        log("Clicked: " + path);
    });
});
