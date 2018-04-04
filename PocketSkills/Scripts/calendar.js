/// <reference path="azure.js" />

// This object manages the Calendar screen.
function Calendar(element, data) {
    'use strict';

    if (!this instanceof Calendar)
        return new Calendar(element, data);
    var _this = this;

    _this.$root = $('<div>').addClass('calendarscreen').appendTo(element); // The root element in the HTML
    _this.data = data; // The user's data and responses to questions
    _this.activities = {}; // Contains each activity in the calendar.

    _this.$calendar = $('<div>').addClass('calendar').datepicker({
        beforeShowDay: function (date) {
            var day = Date.parse(date);
            var today = Date.parse(new Date().toDateString());
            var missed = 0;
            var undone = 0;
            var done = 0;
            _this.activities.forEach(function (a) {
                if (Date.parse(a.Date) == Date.parse(date)) {
                    if (a.Done) {
                        done++;
                    } else if (day < today) {
                        missed++;
                    } else {
                        undone++;
                    }
                }
            });
            return [true, missed ? 'missed' : undone ? 'undone' : done ? 'done' : '', (missed + undone + done) + ' activities'];
        }
    }).appendTo(_this.$root).on('change', function () {
        _this.update();
    });
    _this.$activities = $('<div>').addClass('activities').appendTo(_this.$root);

    // Loads all activities into the list.
    _this.load = function (sas, user) {
        _this.sas = sas;
        _this.table = azure.getTable(sas);
        _this.user = user;

        return _this.table.query(function (rows, error, _, status) {
            if (rows) {
                // Now load the new data.
                _this.activities = {};
                rows.reverse().forEach(function (row) {
                    delete row.RowKey;
                    delete row.Timestamp;
                    if (!row.Deleted) {
                        _this.activities[row.ID] = row;
                    }
                });
            } else {
                log("Error loading calendar from azure storage:\n" + status + "\n" + (error || {}).responseText);
                throw error;
            }
        }).done(function () {
            _this.loaded = new Date();
            if (Data.logToConsole) {
                console.log("Calendar Loaded on " + _this.loaded);
            }
            $(_this).triggerHandler('loaded');
            _this.update();
        });
    }

    $(element).on('showing', function () {
        _this.load(_this.sas, _this.user);
    });

    _this.update = function () {
        var selected = Date.parse(_this.$calendar.val());
        var today = Date.parse(new Date().toDateString());

        _this.$activities.empty();
        _this.$activities.toggleClass('past', selected < today);
        _this.$activities.toggleClass('present', selected == today);
        _this.$activities.toggleClass('future', selected > today);

        var activities = _this.activities.filter(function (a) {
            return Date.parse(a.Date) == selected;
        });

        var count = Object.keys(activities).length;
        if (count > 0) {
            $('<div>').addClass('activitiesHeader').text("Activities for " + dateString(selected)).appendTo(_this.$activities);
            activities.forEach(function (activity) {
                var $activity = $('<div>').addClass('activity').text(activity.Content).appendTo(_this.$activities);
                if (activity.Done) {
                    $activity.addClass('done');
                } else if (selected < today) {
                    $activity.addClass('missed');
                } else {
                    $activity.addClass('undone');
                }
                $activity.on('click', function () {
                    if (activity.Done) {
                        delete activity.Done;
                    } else {
                        activity.Done = Date();
                    }
                    delete activity.RowKey;
                    _this.table.add(activity, _this.update);
                });
            });
        } else {
            $('<div>').addClass('activitiesHeader').text("No activities for " + dateString(selected)).appendTo(_this.$activities);
            $('<div>').addClass('activitiesPlaceholder').appendTo(_this.$activities);
        }

        _this.$calendar.datepicker('refresh');
    }

    function dateString(date) {
        var day = Date.parse(new Date(date).toDateString());
        var today = Date.parse(new Date().toDateString());
        return day == today ? 'today' : new Date(date).toDateString();
    }
}
